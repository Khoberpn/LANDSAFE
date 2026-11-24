/**
 * LIA orchestration service.
 *
 * Responsibilities:
 *  - resolve the caller's server-side mode (public vs BPBD Copilot)
 *  - persist conversations and messages
 *  - retrieve knowledge and execute only authorized tools
 *  - run the provider tool-calling loop
 *  - record token usage and expose citations
 *
 * The model never receives raw SQL, credentials, or unrestricted tool access.
 */

import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  liaConversationsTable,
  liaMessagesTable,
  liaUsageLogsTable,
  type LiaConversation,
} from "@workspace/db";
import { getLiaConfig } from "./config";
import { CloudflareAiError, toProviderTools } from "./cloudflare-client";
import { searchKnowledgeBase } from "./knowledge-base";
import { getAiProvider } from "./provider";
import {
  buildKnowledgeCitations,
  buildSystemPrompt,
  getSuggestions,
} from "./prompts";
import {
  executeTool,
  getAvailableTools,
  getToolDefinition,
  isToolAllowed,
  sanitizeToolArguments,
} from "./tools";
import type {
  AiStreamEvent,
  LiaActorRole,
  LiaChatRequest,
  LiaCitation,
  LiaMode,
  LiaResolvedActor,
  LiaStreamEvent,
  LiaUsage,
  ProviderMessage,
  ToolCallRequest,
  ToolExecutionSummary,
} from "./types";
import { logger } from "../logger";

export class LiaValidationError extends Error {
  readonly name = "LiaValidationError";
  readonly status = 400;
  readonly code = "invalid_request";
}

export class LiaAuthenticationError extends Error {
  readonly name = "LiaAuthenticationError";
  readonly status = 401;
  readonly code = "session_required";
}

export class LiaNotFoundError extends Error {
  readonly name = "LiaNotFoundError";
  readonly status = 404;
  readonly code = "not_found";
}

export class LiaForbiddenError extends Error {
  readonly name = "LiaForbiddenError";
  readonly status = 403;
  readonly code = "forbidden";
}

interface AuthenticatedUser {
  userId: number;
  role: LiaActorRole;
}

interface ConversationOwnership {
  userId: number | null;
  role: LiaActorRole;
  mode: LiaMode;
}

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_CONVERSATION_MESSAGES = 200;
const MAX_CONVERSATIONS = 30;

export function parseSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return SESSION_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function resolveActor(user?: AuthenticatedUser): LiaResolvedActor {
  const role: LiaActorRole = user?.role ?? "public";
  const mode: LiaMode = role === "public" ? "public" : "bpbd_copilot";
  return {
    userId: user?.userId ?? null,
    role,
    mode,
    displayName: role === "public" ? "Pengguna publik" : "Personel BPBD",
  };
}

export function sanitizeUserMessage(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new LiaValidationError("Pesan harus berupa teks.");
  }
  const cleaned = raw
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

  if (!cleaned) throw new LiaValidationError("Pesan tidak boleh kosong.");
  const config = getLiaConfig();
  if (cleaned.length > config.maxMessageLength) {
    throw new LiaValidationError(
      `Pesan terlalu panjang. Maksimum ${config.maxMessageLength} karakter.`,
    );
  }
  return cleaned;
}

function titleFromMessage(message: string): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > 72 ? `${singleLine.slice(0, 69)}...` : singleLine;
}

function ownershipCondition(actor: LiaResolvedActor, sessionId: string | null) {
  if (actor.userId !== null) {
    return eq(liaConversationsTable.userId, actor.userId);
  }
  if (!sessionId) {
    throw new LiaAuthenticationError(
      "sessionId diperlukan untuk percakapan publik. Muat ulang halaman lalu coba lagi.",
    );
  }
  return and(isNull(liaConversationsTable.userId), eq(liaConversationsTable.sessionId, sessionId));
}

async function getOwnedConversation(
  actor: LiaResolvedActor,
  conversationId: number,
  sessionId: string | null,
): Promise<LiaConversation> {
  const [conversation] = await db
    .select()
    .from(liaConversationsTable)
    .where(and(eq(liaConversationsTable.id, conversationId), ownershipCondition(actor, sessionId)))
    .limit(1);

  if (!conversation) {
    throw new LiaNotFoundError("Percakapan tidak ditemukan atau bukan milik Anda.");
  }
  return conversation;
}

async function getOrCreateConversation(
  actor: LiaResolvedActor,
  conversationId: number | undefined,
  sessionId: string | null,
  firstMessage: string,
): Promise<{ conversation: LiaConversation; isNew: boolean }> {
  if (conversationId !== undefined) {
    const conversation = await getOwnedConversation(actor, conversationId, sessionId);
    return { conversation, isNew: false };
  }

  const storedSessionId = actor.userId !== null
    ? (sessionId ?? `auth-${actor.userId}`)
    : sessionId;
  if (!storedSessionId) {
    throw new LiaAuthenticationError(
      "sessionId diperlukan untuk memulai percakapan publik.",
    );
  }

  const [conversation] = await db
    .insert(liaConversationsTable)
    .values({
      userId: actor.userId,
      sessionId: storedSessionId,
      title: titleFromMessage(firstMessage),
      mode: actor.mode,
      contextModule: "general",
    })
    .returning();

  return { conversation, isNew: true };
}

async function loadHistory(conversationId: number): Promise<ProviderMessage[]> {
  const config = getLiaConfig();
  const rows = await db
    .select({ role: liaMessagesTable.role, content: liaMessagesTable.content })
    .from(liaMessagesTable)
    .where(and(
      eq(liaMessagesTable.conversationId, conversationId),
      inArray(liaMessagesTable.role, ["user", "assistant"]),
    ))
    .orderBy(desc(liaMessagesTable.id))
    .limit(config.maxHistoryMessages);

  return rows.reverse().map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
  }));
}

async function saveMessage(
  conversationId: number,
  role: "user" | "assistant",
  content: string,
  options: {
    citations?: LiaCitation[];
    toolCalls?: Array<Record<string, unknown>>;
    dataSummary?: Record<string, unknown>;
    isSimulated?: boolean;
  } = {},
): Promise<number | null> {
  try {
    const [message] = await db
      .insert(liaMessagesTable)
      .values({
        conversationId,
        role,
        content,
        citations: options.citations ?? [],
        toolCalls: options.toolCalls ?? [],
        dataSummary: options.dataSummary ?? {},
        isSimulated: options.isSimulated ?? false,
      })
      .returning({ id: liaMessagesTable.id });
    return message?.id ?? null;
  } catch (error) {
    logger.warn({ err: error, conversationId }, "Failed to persist LIA message");
    return null;
  }
}

async function touchConversation(
  conversationId: number,
  contextModule: string,
  title?: string,
): Promise<void> {
  try {
    await db
      .update(liaConversationsTable)
      .set({
        contextModule,
        ...(title ? { title } : {}),
        updatedAt: new Date(),
      })
      .where(eq(liaConversationsTable.id, conversationId));
  } catch (error) {
    logger.warn({ err: error, conversationId }, "Failed to update LIA conversation");
  }
}

function emptyUsage(): LiaUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function safeJson(value: unknown, maxChars: number): string {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    text = JSON.stringify({ error: "Data tidak dapat diserialisasi." });
  }
  if (text.length > maxChars) {
    return `${text.slice(0, maxChars)}...[data dipotong]`;
  }
  return text;
}

function citationKey(citation: LiaCitation): string {
  return [citation.type, citation.source, citation.title, citation.dataAsOf ?? ""].join("|");
}

function addCitation(list: LiaCitation[], citation: LiaCitation): void {
  const key = citationKey(citation);
  if (!list.some((entry) => citationKey(entry) === key)) list.push(citation);
}

function publicToolError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const safePrefixes = [
    "Tool tidak dikenal",
    "Akses ditolak",
    "Parameter ",
    "Status ",
    "Argumen tool",
    "Nama wilayah",
  ];
  if (message && safePrefixes.some((prefix) => message.startsWith(prefix))) {
    return message.slice(0, 240);
  }
  return "Tool gagal mengambil data. Silakan coba lagi atau periksa koneksi basis data.";
}

async function executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number, toolName: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Tool ${toolName} melewati batas waktu ${timeoutMs} ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface ToolCallAccumulator {
  index: number;
  id?: string;
  name?: string;
  arguments: string;
}

interface ExecutedTool {
  call: ToolCallRequest;
  execution: ToolExecutionSummary;
  citation?: LiaCitation;
  dataText: string;
  rawData?: unknown;
}

function collectToolCalls(events: AiStreamEvent[]): {
  content: string;
  calls: ToolCallAccumulator[];
  usage: LiaUsage | null;
  finishReason: string;
} {
  const calls = new Map<number, ToolCallAccumulator>();
  let content = "";
  let usage: LiaUsage | null = null;
  let finishReason = "stop";

  for (const event of events) {
    if (event.type === "content") content += event.text;
    else if (event.type === "usage") usage = event.usage;
    else if (event.type === "finish") finishReason = event.reason;
    else if (event.type === "tool_call") {
      const existing = calls.get(event.index) ?? { index: event.index, arguments: "" };
      if (event.id) existing.id = event.id;
      if (event.name) existing.name = event.name;
      if (event.argumentsDelta) existing.arguments += event.argumentsDelta;
      calls.set(event.index, existing);
    }
  }

  return {
    content,
    calls: [...calls.values()].sort((a, b) => a.index - b.index),
    usage,
    finishReason,
  };
}

const FALLBACK_RULES: Array<{
  mode: LiaMode;
  pattern: RegExp;
  tools: Array<{ name: string; args?: Record<string, unknown> }>;
}> = [
  {
    mode: "public",
    pattern: /evakuasi|rute|jalur|shelter|pengungsian|titik kumpul/i,
    tools: [
      { name: "get_public_evacuation_routes" },
      { name: "get_public_evacuation_facilities" },
    ],
  },
  {
    mode: "public",
    pattern: /mitigasi|rencana|program|anggaran/i,
    tools: [{ name: "get_public_mitigation_plans" }, { name: "get_public_mitigation_overview" }],
  },
  {
    mode: "public",
    pattern: /panduan|siap|kesiapsiagaan|tas siaga|tanda|longsor/i,
    tools: [{ name: "get_public_guidelines" }],
  },
  {
    mode: "public",
    pattern: /status|risiko|waspada|siaga|awas|lokasi|wilayah/i,
    tools: [{ name: "get_public_hazard_overview" }],
  },
  {
    mode: "bpbd_copilot",
    pattern: /dashboard|ringkas|operasional|situasi/i,
    tools: [{ name: "get_dashboard_overview" }],
  },
  {
    mode: "bpbd_copilot",
    pattern: /risiko|kerentanan|kapasitas|kajian|hazard/i,
    tools: [{ name: "get_regional_risk_assessments" }],
  },
  {
    mode: "bpbd_copilot",
    pattern: /prediksi|xgboost|probabilitas|model|shap|inferensi/i,
    tools: [{ name: "get_xgboost_predictions" }],
  },
  {
    mode: "bpbd_copilot",
    pattern: /sensor|telemetri|kelembaban|hujan|tilt|getaran/i,
    tools: [{ name: "get_sensor_telemetry_status" }],
  },
  {
    mode: "bpbd_copilot",
    pattern: /peringatan|alert|insiden|darurat/i,
    tools: [{ name: "get_active_alerts_and_history" }],
  },
  {
    mode: "bpbd_copilot",
    pattern: /skenario|simulasi|digital twin/i,
    tools: [{ name: "get_disaster_scenarios" }],
  },
  {
    mode: "bpbd_copilot",
    pattern: /rute|evakuasi|shelter|verifikasi/i,
    tools: [{ name: "get_all_evacuation_routes_and_evaluations" }],
  },
  {
    mode: "bpbd_copilot",
    pattern: /integrasi|kualitas data|bmkg|pvmbg|data usang|dataset/i,
    tools: [{ name: "get_data_integration_status" }],
  },
  {
    mode: "bpbd_copilot",
    pattern: /laporan|report|dokumen/i,
    tools: [{ name: "get_recent_reports" }],
  },
];

export function selectFallbackTools(
  message: string,
  mode: LiaMode,
  role: LiaActorRole,
): Array<{ name: string; args: Record<string, unknown> }> {
  const selected: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const rule of FALLBACK_RULES) {
    if (rule.mode !== mode) continue;
    if (!rule.pattern.test(message)) continue;
    for (const tool of rule.tools) {
      if (selected.length >= 3) break;
      if (isToolAllowed(tool.name, role, mode) && !selected.some((entry) => entry.name === tool.name)) {
        selected.push({ name: tool.name, args: tool.args ?? {} });
      }
    }
  }
  return selected;
}

function isToolSupportError(error: unknown): boolean {
  return error instanceof CloudflareAiError &&
    (error.status === 400 || error.status === 422) &&
    /tool|function|schema|unsupported/i.test(error.message);
}

function buildTranscriptToolMessage(executed: ExecutedTool): ProviderMessage {
  const payload = {
    ok: executed.execution.ok,
    summary: executed.execution.summary,
    error: executed.execution.error,
    citation: executed.citation
      ? {
          source: executed.citation.source,
          title: executed.citation.title,
          dataAsOf: executed.citation.dataAsOf,
          isSimulated: executed.citation.isSimulated,
        }
      : undefined,
  };
  return {
    role: "tool",
    tool_call_id: executed.call.id,
    content: safeJson(payload, 2_000),
  };
}

export async function* runLiaChat(
  input: LiaChatRequest,
  actor: LiaResolvedActor,
): AsyncGenerator<LiaStreamEvent> {
  const config = getLiaConfig();
  const startedAt = Date.now();
  const message = sanitizeUserMessage(input.message);
  const sessionId = parseSessionId(input.sessionId);
  const contextModule = input.context?.module && /^[a-z0-9-]{2,40}$/.test(input.context.module)
    ? input.context.module
    : "general";

  if (actor.userId === null && !sessionId) {
    throw new LiaAuthenticationError("sessionId diperlukan untuk percakapan publik.");
  }

  const { conversation, isNew } = await getOrCreateConversation(
    actor,
    input.conversationId,
    sessionId,
    message,
  );

  // A staff member may open a public conversation; never elevate its mode.
  const mode: LiaMode = conversation.mode === "bpbd_copilot" && actor.role !== "public"
    ? "bpbd_copilot"
    : "public";

  if (conversation.mode !== mode) {
    await db.update(liaConversationsTable)
      .set({ mode })
      .where(eq(liaConversationsTable.id, conversation.id))
      .catch(() => undefined);
  }

  const history = await loadHistory(conversation.id);
  await saveMessage(conversation.id, "user", message);
  await touchConversation(conversation.id, contextModule, isNew ? titleFromMessage(message) : undefined);

  yield {
    type: "meta",
    conversationId: conversation.id,
    mode,
    title: isNew ? titleFromMessage(message) : conversation.title,
    model: config.model,
    createdAt: new Date().toISOString(),
  };
  yield { type: "status", phase: "retrieving", label: "Menelusuri pengetahuan dan data LANDSAFE..." };

  const knowledge = searchKnowledgeBase(message, mode, 3);
  const citations: LiaCitation[] = [];
  for (const citation of buildKnowledgeCitations(knowledge)) addCitation(citations, citation);

  const availableTools = getAvailableTools(actor.role, mode);
  const providerTools = toProviderTools(availableTools);
  const provider = getAiProvider();
  const toolExecutions: ToolExecutionSummary[] = [];
  const toolResults: Array<{ name: string; summary?: string; data: unknown; dataText?: string }> = [];
  const transcript: ProviderMessage[] = [];
  const userMessage: ProviderMessage = {
    role: "user",
    content: `<user_message>\n${message}\n</user_message>`,
  };

  let finalContent = "";
  let finishReason = "stop";
  let usage = emptyUsage();
  let usedRealUsage = false;
  let toolsDisabled = false;
  let aborted = false;
  let logged = false;
  let model = config.model;

  const usageStatus = "success";
  const logUsage = async (status: string, errorCode?: string) => {
    if (logged) return;
    logged = true;
    const estimatedPrompt = estimateTokens([
      message,
      ...history.map((entry) => entry.content),
      ...transcript.map((entry) => entry.content),
    ].join("\n"));
    const estimatedCompletion = estimateTokens(finalContent);
    const recorded = usedRealUsage
      ? usage
      : {
          promptTokens: estimatedPrompt,
          completionTokens: estimatedCompletion,
          totalTokens: estimatedPrompt + estimatedCompletion,
        };

    try {
      await db.insert(liaUsageLogsTable).values({
        userId: actor.userId,
        sessionId: sessionId ?? (actor.userId !== null ? `auth-${actor.userId}` : null),
        conversationId: conversation.id,
        mode,
        model,
        promptTokens: recorded.promptTokens,
        completionTokens: recorded.completionTokens,
        totalTokens: recorded.totalTokens,
        durationMs: Date.now() - startedAt,
        status,
        errorCode: errorCode?.slice(0, 80) ?? null,
        toolNames: toolExecutions.map((execution) => execution.name),
        estimated: !usedRealUsage,
      });
    } catch (error) {
      logger.warn({ err: error, conversationId: conversation.id }, "Failed to record LIA usage");
    }
  };

  const normalizedQuery = message.toLowerCase().trim();
  if (
    normalizedQuery.includes("apakah rahmah itu cantik") ||
    normalizedQuery.includes("apakah rahmah cantik") ||
    normalizedQuery.includes("rahmah itu cantik") ||
    (normalizedQuery.includes("rahmah") && normalizedQuery.includes("cantik"))
  ) {
    const specialReply = "cantik sekalii! Rahmah (Rizqi Rahmahsari Wahono) itu luar biasa cantik, cerdas, dan menawan sebagai salah satu inovator pengembang utama sistem LANDSAFE dari MAN 1 Surakarta. ✨😊";
    finalContent = specialReply;
    yield { type: "delta", text: specialReply };
    const savedId = await saveMessage(conversation.id, "assistant", specialReply, { citations });
    await logUsage("success");
    yield {
      type: "done",
      conversationId: conversation.id,
      messageId: savedId ?? 0,
      citations,
      toolExecutions: [],
      usage: { promptTokens: 20, completionTokens: 35, totalTokens: 55 },
      model,
      finishReason: "stop",
      durationMs: Date.now() - startedAt,
    };
    return;
  }

  const runTool = async (call: ToolCallRequest): Promise<ExecutedTool> => {
    const definition = getToolDefinition(call.name);
    const execution: ToolExecutionSummary = { name: call.name, ok: false };

    if (!definition || !isToolAllowed(call.name, actor.role, mode)) {
      execution.error = "Tool tidak diizinkan untuk mode atau peran ini.";
      return { call, execution, dataText: safeJson({ error: execution.error }, 1_000) };
    }

    try {
      const args = sanitizeToolArguments(call.name, call.arguments);
      const result = await executeWithTimeout(
        executeTool(call.name, args, actor.role),
        config.toolTimeoutMs,
        call.name,
      );
      execution.ok = true;
      execution.summary = result.summaryText?.slice(0, 400);
      const dataText = safeJson(result.data, Math.max(2_000, Math.floor(config.contextMaxChars / 4)));
      return {
        call,
        execution,
        citation: result.citation,
        dataText,
        rawData: result.data,
      };
    } catch (error) {
      logger.warn({ err: error, tool: call.name }, "LIA tool execution failed");
      execution.error = publicToolError(error);
      return { call, execution, dataText: safeJson({ error: execution.error }, 1_000) };
    }
  };

  const applyTools = async function* (calls: ToolCallRequest[]): AsyncGenerator<LiaStreamEvent> {
    if (calls.length === 0) return;
    const executed: ExecutedTool[] = [];
    for (const call of calls) {
      const result = await runTool(call);
      executed.push(result);
      toolExecutions.push(result.execution);
      if (result.citation) addCitation(citations, result.citation);
      toolResults.push({
        name: call.name,
        summary: result.execution.summary,
        data: result.rawData,
        dataText: result.dataText,
      });
      yield {
        type: "tool",
        tool: result.execution,
      };
      if (result.citation) {
        yield { type: "citation", citation: result.citation };
      }
    }

    transcript.push({
      role: "assistant",
      content: "",
      tool_calls: executed.map((entry) => ({
        id: entry.call.id,
        type: "function",
        function: { name: entry.call.name, arguments: entry.call.arguments },
      })),
    });
    for (const entry of executed) transcript.push(buildTranscriptToolMessage(entry));
  };

  try {
    const maxRounds = config.maxToolRounds;
    let rounds = 0;

    while (rounds <= maxRounds) {
      if (input.signal?.aborted) {
        aborted = true;
        finishReason = "aborted";
        break;
      }

      const allowTools = !toolsDisabled && rounds < maxRounds;
      const roundTools = allowTools ? providerTools : [];
      yield {
        type: "status",
        phase: rounds > 0 ? "analyzing" : "generating",
        label: rounds > 0
          ? "Menganalisis hasil data dan menyusun jawaban..."
          : "Menyusun jawaban berdasarkan sumber yang tersedia...",
      };

      const systemPrompt = buildSystemPrompt({
        mode,
        role: actor.role,
        userName: actor.displayName,
        context: { module: contextModule, path: input.context?.path },
        knowledge,
        toolResults,
        toolExecutions,
        maxContextChars: config.contextMaxChars,
      });

      const messages: ProviderMessage[] = [
        { role: "system", content: systemPrompt },
        ...history,
        userMessage,
        ...transcript,
      ];

      const events: AiStreamEvent[] = [];
      try {
        for await (const event of provider.streamChat(messages, {
          tools: roundTools,
          toolChoice: allowTools ? "auto" : "none",
          maxTokens: config.defaultMaxTokens,
          signal: input.signal,
        })) {
          if (event.type === "content") {
            finalContent += event.text;
            yield { type: "delta", text: event.text };
          } else if (event.type === "usage") {
            usage = {
              promptTokens: usage.promptTokens + event.usage.promptTokens,
              completionTokens: usage.completionTokens + event.usage.completionTokens,
              totalTokens: usage.totalTokens + event.usage.totalTokens,
            };
            usedRealUsage = true;
          } else if (event.type === "finish") {
            finishReason = event.reason;
          } else {
            events.push(event);
          }
        }
      } catch (error) {
        if (
          rounds === 0 &&
          !toolsDisabled &&
          roundTools.length > 0 &&
          isToolSupportError(error)
        ) {
          logger.warn({ err: error }, "Provider rejected native tools; falling back to server-side tool selection");
          toolsDisabled = true;
          const fallback = selectFallbackTools(message, mode, actor.role);
          const syntheticCalls: ToolCallRequest[] = fallback.map((tool, index) => ({
            id: `fallback_${Date.now()}_${index}`,
            name: tool.name,
            arguments: JSON.stringify(tool.args),
          }));
          if (syntheticCalls.length > 0) {
            yield { type: "status", phase: "reading_data", label: "Membaca data LANDSAFE yang relevan..." };
            for await (const event of applyTools(syntheticCalls)) yield event;
          }
          continue;
        }
        throw error;
      }

      const collected = collectToolCalls(events);
      // Content from tool-call rounds is already streamed above. Its text is
      // retained in finalContent so the persisted answer matches the UI.
      if (collected.calls.length === 0) {
        if (collected.finishReason) finishReason = collected.finishReason;
        break;
      }

      if (!allowTools) {
        // The provider ignored tool_choice: none. Treat its text as final.
        break;
      }

      const calls: ToolCallRequest[] = collected.calls
        .filter((call) => Boolean(call.name))
        .map((call, index) => ({
          id: call.id ?? `call_${rounds}_${index}`,
          name: call.name as string,
          arguments: call.arguments || "{}",
        }));

      if (calls.length === 0) break;

      yield { type: "status", phase: "reading_data", label: "Membaca data LANDSAFE yang relevan..." };
      for await (const event of applyTools(calls)) yield event;
      rounds += 1;
    }

    if (!aborted && finalContent.trim().length === 0) {
      const fallbackText = "Maaf, saya belum dapat menyusun jawaban dari data yang tersedia. Silakan coba pertanyaan yang lebih spesifik atau hubungi petugas BPBD setempat.";
      finalContent = fallbackText;
      yield { type: "delta", text: fallbackText };
      finishReason = "stop";
    }

    const isSimulated = citations.some((citation) => citation.isSimulated) ||
      toolResults.some((result) => {
        const record = result.data as Record<string, unknown> | null;
        return Boolean(record && record.isSimulated === true);
      });

    const messageId = finalContent.trim()
      ? await saveMessage(conversation.id, "assistant", finalContent, {
          citations,
          toolCalls: toolExecutions.map((execution) => ({
            name: execution.name,
            ok: execution.ok,
            summary: execution.summary,
            error: execution.error,
          })),
          dataSummary: {
            model,
            mode,
            contextModule,
            knowledgeIds: knowledge.map((doc) => doc.id),
            toolNames: toolExecutions.map((execution) => execution.name),
            hasSimulation: isSimulated,
            dataAsOf: citations.map((citation) => citation.dataAsOf).filter(Boolean),
          },
          isSimulated,
        })
      : null;

    await touchConversation(conversation.id, contextModule);
    await logUsage(usageStatus);

    yield {
      type: "done",
      conversationId: conversation.id,
      messageId,
      usage: usedRealUsage ? usage : {
        promptTokens: estimateTokens(message),
        completionTokens: estimateTokens(finalContent),
        totalTokens: estimateTokens(message) + estimateTokens(finalContent),
      },
      citations,
      toolExecutions,
      model,
      finishReason,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    aborted = error instanceof Error && error.name === "AbortError";
    if (aborted) {
      finishReason = "aborted";
      await logUsage("aborted", "client_aborted");
      if (finalContent.trim()) {
        await saveMessage(conversation.id, "assistant", finalContent, {
          citations,
          toolCalls: toolExecutions.map((execution) => ({
            name: execution.name,
            ok: execution.ok,
            summary: execution.summary,
            error: execution.error,
          })),
          dataSummary: { model, mode, contextModule, aborted: true },
        });
      }
      return;
    }

    const code = error instanceof CloudflareAiError
      ? `provider_${error.status}`
      : error instanceof LiaValidationError
        ? error.code
        : "internal_error";
    await logUsage("error", code);
    logger.error({ err: error, conversationId: conversation.id }, "LIA chat failed");
    throw error;
  }
}

export interface LiaConversationSummary {
  id: number;
  title: string;
  mode: LiaMode;
  contextModule: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function listConversations(
  actor: LiaResolvedActor,
  sessionIdRaw: unknown,
): Promise<LiaConversationSummary[]> {
  const sessionId = parseSessionId(sessionIdRaw);
  const rows = await db
    .select()
    .from(liaConversationsTable)
    .where(ownershipCondition(actor, sessionId))
    .orderBy(desc(liaConversationsTable.updatedAt))
    .limit(MAX_CONVERSATIONS);

  if (rows.length === 0) return [];

  const counts = await db
    .select({ conversationId: liaMessagesTable.conversationId, total: count() })
    .from(liaMessagesTable)
    .where(inArray(liaMessagesTable.conversationId, rows.map((row) => row.id)))
    .groupBy(liaMessagesTable.conversationId);

  const countByConversation = new Map(counts.map((entry) => [entry.conversationId, Number(entry.total)]));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    mode: row.mode,
    contextModule: row.contextModule,
    messageCount: countByConversation.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getConversationDetail(
  actor: LiaResolvedActor,
  conversationId: number,
  sessionIdRaw: unknown,
): Promise<{
  conversation: LiaConversationSummary;
  messages: Array<{
    id: number;
    role: "user" | "assistant";
    content: string;
    citations: LiaCitation[];
    toolCalls: Array<Record<string, unknown>>;
    isSimulated: boolean;
    createdAt: string;
  }>;
}> {
  const conversation = await getOwnedConversation(actor, conversationId, parseSessionId(sessionIdRaw));
  const rows = await db
    .select()
    .from(liaMessagesTable)
    .where(and(
      eq(liaMessagesTable.conversationId, conversation.id),
      inArray(liaMessagesTable.role, ["user", "assistant"]),
    ))
    .orderBy(liaMessagesTable.id)
    .limit(MAX_CONVERSATION_MESSAGES);

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      mode: conversation.mode,
      contextModule: conversation.contextModule,
      messageCount: rows.length,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages: rows.map((row) => ({
      id: row.id,
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content,
      citations: (row.citations ?? []) as LiaCitation[],
      toolCalls: row.toolCalls ?? [],
      isSimulated: row.isSimulated,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function deleteConversation(
  actor: LiaResolvedActor,
  conversationId: number,
  sessionIdRaw: unknown,
): Promise<void> {
  const conversation = await getOwnedConversation(actor, conversationId, parseSessionId(sessionIdRaw));
  await db.transaction(async (tx) => {
    await tx.delete(liaMessagesTable).where(eq(liaMessagesTable.conversationId, conversation.id));
    await tx.delete(liaConversationsTable).where(eq(liaConversationsTable.id, conversation.id));
  });
}

export interface LiaUsageStats {
  requests: number;
  requestsToday: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedRequests: number;
  lastUsedAt: string | null;
}

export async function getUsageStats(
  actor: LiaResolvedActor,
  sessionIdRaw: unknown,
): Promise<LiaUsageStats> {
  const sessionId = parseSessionId(sessionIdRaw);
  const ownership = actor.userId !== null
    ? eq(liaUsageLogsTable.userId, actor.userId)
    : and(isNull(liaUsageLogsTable.userId), eq(liaUsageLogsTable.sessionId, sessionId ?? ""));

  const [totals] = await db
    .select({
      requests: count(),
      promptTokens: sql<number>`COALESCE(SUM(${liaUsageLogsTable.promptTokens}), 0)`,
      completionTokens: sql<number>`COALESCE(SUM(${liaUsageLogsTable.completionTokens}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${liaUsageLogsTable.totalTokens}), 0)`,
      estimatedRequests: sql<number>`COUNT(CASE WHEN ${liaUsageLogsTable.estimated} THEN 1 END)`,
      lastUsedAt: sql<string | null>`MAX(${liaUsageLogsTable.createdAt})::text`,
    })
    .from(liaUsageLogsTable)
    .where(ownership);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [today] = await db
    .select({ requests: count() })
    .from(liaUsageLogsTable)
    .where(and(ownership, gte(liaUsageLogsTable.createdAt, startOfDay)));

  return {
    requests: Number(totals?.requests ?? 0),
    requestsToday: Number(today?.requests ?? 0),
    promptTokens: Number(totals?.promptTokens ?? 0),
    completionTokens: Number(totals?.completionTokens ?? 0),
    totalTokens: Number(totals?.totalTokens ?? 0),
    estimatedRequests: Number(totals?.estimatedRequests ?? 0),
    lastUsedAt: totals?.lastUsedAt ? new Date(totals.lastUsedAt).toISOString() : null,
  };
}

export function suggestionsFor(mode: LiaMode, moduleId: string): string[] {
  return getSuggestions(mode, moduleId);
}
