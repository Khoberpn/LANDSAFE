/**
 * LANDSAFE Intelligence Assistant (LIA) configuration.
 *
 * All provider credentials are read from server-side environment variables.
 * No secret is ever hard-coded or sent to the browser. Configuration is
 * validated lazily so non-AI routes keep working when LIA is not configured.
 */

export type LiaProviderName = "cloudflare";
export type LiaReasoningEffort = "low" | "medium" | "xhigh";

export interface LiaConfig {
  provider: LiaProviderName;
  accountId: string;
  apiToken: string;
  model: string;
  apiBaseUrl: string;
  requestTimeoutMs: number;
  streamTimeoutMs: number;
  toolTimeoutMs: number;
  maxHistoryMessages: number;
  maxToolRounds: number;
  defaultMaxTokens: number;
  reasoningEffort: LiaReasoningEffort;
  temperature: number;
  contextMaxChars: number;
  maxMessageLength: number;
  rateLimitWindowMs: number;
  anonymousRateLimit: number;
  authenticatedRateLimit: number;
  staffRateLimit: number;
}

export class LiaConfigurationError extends Error {
  readonly name = "LiaConfigurationError";
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new LiaConfigurationError(
      `${name} belum dikonfigurasi. LIA membutuhkan kredensial Cloudflare Workers AI di environment server.`,
    );
  }
  return value;
}

function reasoningEffort(): LiaReasoningEffort {
  const raw = (process.env.LIA_REASONING_EFFORT ?? "low").trim().toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "xhigh") return raw;
  throw new LiaConfigurationError(
    "LIA_REASONING_EFFORT harus salah satu dari: low, medium, xhigh.",
  );
}

function integer(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new LiaConfigurationError(
      `${name} harus berupa bilangan bulat antara ${minimum} dan ${maximum}.`,
    );
  }
  return parsed;
}

let cached: LiaConfig | null = null;

export function getLiaConfig(): LiaConfig {
  if (cached) return cached;

  const provider = (process.env.LIA_AI_PROVIDER ?? "cloudflare").trim().toLowerCase();
  if (provider !== "cloudflare") {
    throw new LiaConfigurationError(
      `Provider AI "${provider}" belum didukung. Provider yang tersedia: cloudflare.`,
    );
  }

  const accountId = required("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = required("CLOUDFLARE_API_TOKEN");
  if (apiToken.length < 20) {
    throw new LiaConfigurationError("CLOUDFLARE_API_TOKEN tidak valid.");
  }

  cached = {
    provider: "cloudflare",
    accountId,
    apiToken,
    model: process.env.CLOUDFLARE_AI_MODEL?.trim() || "@cf/qwen/qwen3.8-27b",
    apiBaseUrl: process.env.CLOUDFLARE_API_BASE_URL?.trim() || "https://api.cloudflare.com/client/v4",
    requestTimeoutMs: integer("LIA_REQUEST_TIMEOUT_MS", 60_000, 5_000, 120_000),
    streamTimeoutMs: integer("LIA_STREAM_TIMEOUT_MS", 120_000, 10_000, 300_000),
    toolTimeoutMs: integer("LIA_TOOL_TIMEOUT_MS", 10_000, 1_000, 30_000),
    maxHistoryMessages: integer("LIA_MAX_HISTORY_MESSAGES", 12, 2, 24),
    maxToolRounds: integer("LIA_MAX_TOOL_ROUNDS", 3, 1, 5),
    defaultMaxTokens: integer("LIA_MAX_OUTPUT_TOKENS", 2_048, 128, 4_096),
    reasoningEffort: reasoningEffort(),
    temperature: 0.25,
    contextMaxChars: integer("LIA_CONTEXT_MAX_CHARS", 16_000, 4_000, 40_000),
    maxMessageLength: integer("LIA_MAX_MESSAGE_LENGTH", 2_000, 100, 8_000),
    rateLimitWindowMs: integer("LIA_RATE_LIMIT_WINDOW_MS", 60_000, 10_000, 600_000),
    anonymousRateLimit: integer("LIA_ANON_RATE_LIMIT", 6, 1, 100),
    authenticatedRateLimit: integer("LIA_USER_RATE_LIMIT", 20, 1, 200),
    staffRateLimit: integer("LIA_STAFF_RATE_LIMIT", 30, 1, 300),
  };

  return cached;
}

export function isLiaConfigured(): boolean {
  try {
    getLiaConfig();
    return true;
  } catch {
    return false;
  }
}

export function getAiEndpointUrl(config: LiaConfig = getLiaConfig()): string {
  return `${config.apiBaseUrl}/accounts/${config.accountId}/ai/run/${config.model}`;
}

/** Only used by tests that need to reload configuration. */
export function resetLiaConfigCache(): void {
  cached = null;
}
