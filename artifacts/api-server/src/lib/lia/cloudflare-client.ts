/**
 * Cloudflare Workers AI adapter for LIA.
 *
 * Uses the OpenAI-compatible Workers AI endpoint. Credentials come from the
 * server environment only; this module never logs or returns the API token.
 */

import { getLiaConfig, getAiEndpointUrl, type LiaConfig } from "./config";
import { logger } from "../logger";
import type {
  AiProvider,
  AiStreamEvent,
  LiaUsage,
  ProviderChatOptions,
  ProviderMessage,
  ProviderTool,
} from "./types";

export class CloudflareAiError extends Error {
  readonly name = "CloudflareAiError";
  readonly status: number;
  readonly code?: string;
  readonly retryable: boolean;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = status === 408 || status === 429 || status >= 500;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readUsage(value: unknown): LiaUsage | null {
  const usage = asRecord(value);
  if (!usage) return null;
  const prompt = Number(usage.prompt_tokens ?? 0);
  const completion = Number(usage.completion_tokens ?? 0);
  const total = Number(usage.total_tokens ?? prompt + completion);
  if (![prompt, completion, total].every(Number.isFinite)) return null;
  if (prompt === 0 && completion === 0 && total === 0) return null;
  return {
    promptTokens: Math.max(0, Math.trunc(prompt)),
    completionTokens: Math.max(0, Math.trunc(completion)),
    totalTokens: Math.max(0, Math.trunc(total)),
  };
}

async function toCloudflareError(response: Response): Promise<CloudflareAiError> {
  const raw = await response.text().catch(() => "");
  let message = `Cloudflare Workers AI mengembalikan status ${response.status}.`;
  let code: string | undefined;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
      const first = asRecord(errors[0]);
      if (first) {
        if (typeof first.message === "string") message = first.message;
        if (typeof first.code === "string" || typeof first.code === "number") {
          code = String(first.code);
        }
      } else if (typeof parsed.error === "string") {
        message = parsed.error;
      } else if (typeof parsed.message === "string") {
        message = parsed.message;
      }
    } catch {
      message = raw.slice(0, 300);
    }
  }

  return new CloudflareAiError(message, response.status, code);
}

function buildRequestBody(
  messages: ProviderMessage[],
  options: ProviderChatOptions,
  config: LiaConfig,
  stream: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    messages,
    stream,
    max_completion_tokens: options.maxTokens ?? config.defaultMaxTokens,
    // Qwen 3.8 defaults to xhigh reasoning, which is needlessly slow for a
    // grounded assistant. Low effort keeps latency predictable while the
    // system prompt and tools still enforce the safety rules.
    reasoning_effort: config.reasoningEffort,
    temperature: options.temperature ?? config.temperature,
  };

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }

  return body;
}

interface SseResult {
  content: string;
  toolCalls: Array<{ index: number; id?: string; name?: string; arguments: string }>;
  finishReason: string;
  usage: LiaUsage | null;
}

function consumeCompletionPayload(payload: unknown, result: SseResult): void {
  const record = asRecord(payload);
  if (!record) return;

  const usage = readUsage(record.usage);
  if (usage) result.usage = usage;

  if (typeof record.response === "string" && record.response.length > 0) {
    result.content += record.response;
  }

  const choices = Array.isArray(record.choices) ? record.choices : [];
  for (const choiceValue of choices) {
    const choice = asRecord(choiceValue);
    if (!choice) continue;

    if (typeof choice.finish_reason === "string") {
      result.finishReason = choice.finish_reason;
    }

    const delta = asRecord(choice.delta) ?? asRecord(choice.message);
    if (!delta) continue;

    if (typeof delta.content === "string") result.content += delta.content;

    const rawToolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
    for (const rawToolCall of rawToolCalls) {
      const toolCall = asRecord(rawToolCall);
      if (!toolCall) continue;
      const fn = asRecord(toolCall.function);
      const index = Number.isInteger(toolCall.index)
        ? Number(toolCall.index)
        : result.toolCalls.length;
      let existing = result.toolCalls.find((entry) => entry.index === index);
      if (!existing) {
        existing = { index, arguments: "" };
        result.toolCalls.push(existing);
      }
      if (typeof toolCall.id === "string") existing.id = toolCall.id;
      if (fn && typeof fn.name === "string" && fn.name.length > 0) existing.name = fn.name;
      if (fn && typeof fn.arguments === "string") existing.arguments += fn.arguments;
    }
  }
}

/**
 * Stream a chat completion. Content deltas are yielded as they arrive.
 * Tool-call fragments are normalized into `tool_call` events.
 */
export async function* streamCloudflareChat(
  messages: ProviderMessage[],
  options: ProviderChatOptions = {},
  config: LiaConfig = getLiaConfig(),
): AsyncGenerator<AiStreamEvent, void, unknown> {
  const url = getAiEndpointUrl(config);
  const controller = new AbortController();
  let externallyAborted = false;
  const onExternalAbort = () => {
    externallyAborted = true;
    controller.abort();
  };

  if (options.signal) {
    if (options.signal.aborted) {
      throw new DOMException("Permintaan dibatalkan.", "AbortError");
    }
    options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  let idleTimer: NodeJS.Timeout | undefined;
  const overallTimer = setTimeout(() => controller.abort(), config.streamTimeoutMs);
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  };
  resetIdleTimer();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(buildRequestBody(messages, options, config, true)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await toCloudflareError(response);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const isSse = contentType.includes("text/event-stream");

    if (!isSse) {
      // Some deployments/proxies buffer the stream and return a single JSON body.
      const raw = await response.text();
      const parsed = JSON.parse(raw) as unknown;
      const result: SseResult = { content: "", toolCalls: [], finishReason: "stop", usage: null };
      consumeCompletionPayload(parsed, result);
      if (result.content) yield { type: "content", text: result.content };
      for (const toolCall of result.toolCalls) {
        yield {
          type: "tool_call",
          index: toolCall.index,
          id: toolCall.id,
          name: toolCall.name,
          argumentsDelta: toolCall.arguments,
        };
      }
      if (result.usage) yield { type: "usage", usage: result.usage };
      yield { type: "finish", reason: result.finishReason };
      return;
    }

    if (!response.body) {
      throw new CloudflareAiError("Cloudflare Workers AI tidak mengirimkan body respons.", 502);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalUsage: LiaUsage | null = null;
    let finishReason = "stop";
    let sawEvent = false;

    const processLine = function* (line: string): Generator<AiStreamEvent> {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":") || trimmed === "data: [DONE]") return;

      let payloadText: string | null = null;
      if (trimmed.startsWith("data:")) payloadText = trimmed.slice(5).trim();
      else if (trimmed.startsWith("{")) payloadText = trimmed;
      if (!payloadText || payloadText === "[DONE]") return;

      let payload: unknown;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        return;
      }

      sawEvent = true;
      const record = asRecord(payload);
      if (!record) return;

      const usage = readUsage(record.usage);
      if (usage) finalUsage = usage;

      if (typeof record.response === "string" && record.response.length > 0) {
        yield { type: "content", text: record.response };
      }

      const choices = Array.isArray(record.choices) ? record.choices : [];
      for (const choiceValue of choices) {
        const choice = asRecord(choiceValue);
        if (!choice) continue;

        if (typeof choice.finish_reason === "string" && choice.finish_reason) {
          finishReason = choice.finish_reason;
        }

        const delta = asRecord(choice.delta) ?? asRecord(choice.message);
        if (!delta) continue;

        if (typeof delta.reasoning === "string" && delta.reasoning.length > 0) {
          yield { type: "reasoning", text: delta.reasoning };
        }
        if (typeof delta.content === "string" && delta.content.length > 0) {
          yield { type: "content", text: delta.content };
        }

        const rawToolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
        for (const rawToolCall of rawToolCalls) {
          const toolCall = asRecord(rawToolCall);
          if (!toolCall) continue;
          const fn = asRecord(toolCall.function);
          const index = Number.isInteger(toolCall.index) ? Number(toolCall.index) : 0;
          const argumentsDelta = fn && typeof fn.arguments === "string" ? fn.arguments : undefined;
          const name = fn && typeof fn.name === "string" ? fn.name : undefined;
          const id = typeof toolCall.id === "string" ? toolCall.id : undefined;

          if (id || name || argumentsDelta) {
            yield { type: "tool_call", index, id, name, argumentsDelta };
          }
        }
      }

      if (Array.isArray(record.choices) && record.choices.length === 0) {
        // Final usage-only chunk.
        return;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdleTimer();
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        for (const event of processLine(line)) {
          if (event.type === "finish") finishReason = event.reason;
          yield event;
        }
      }
    }

    if (buffer.trim()) {
      for (const event of processLine(buffer)) {
        if (event.type === "finish") finishReason = event.reason;
        yield event;
      }
    }

    if (!sawEvent) {
      throw new CloudflareAiError("Cloudflare Workers AI mengirimkan respons kosong.", 502);
    }
    if (finalUsage) yield { type: "usage", usage: finalUsage };
    yield { type: "finish", reason: finishReason };
  } catch (error) {
    if (error instanceof CloudflareAiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      if (externallyAborted) {
        throw new DOMException("Permintaan dibatalkan.", "AbortError");
      }
      throw new CloudflareAiError(
        "Layanan AI Cloudflare tidak merespons tepat waktu. Silakan coba lagi.",
        504,
      );
    }
    logger.error({ err: error }, "Cloudflare Workers AI request failed");
    throw new CloudflareAiError(
      "Gagal menghubungi layanan AI Cloudflare. Silakan coba lagi.",
      502,
    );
  } finally {
    clearTimeout(overallTimer);
    if (idleTimer) clearTimeout(idleTimer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}

export class CloudflareProvider implements AiProvider {
  readonly name = "cloudflare";
  readonly config: LiaConfig;

  constructor(config: LiaConfig = getLiaConfig()) {
    this.config = config;
  }

  streamChat(
    messages: ProviderMessage[],
    options: ProviderChatOptions = {},
  ): AsyncGenerator<AiStreamEvent, void, unknown> {
    return streamCloudflareChat(messages, options, this.config);
  }
}

export function toProviderTools(
  definitions: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
): ProviderTool[] {
  return definitions.map((definition) => ({
    type: "function" as const,
    function: {
      name: definition.name,
      description: definition.description,
      parameters: {
        ...definition.parameters,
        additionalProperties: false,
      },
    },
  }));
}
