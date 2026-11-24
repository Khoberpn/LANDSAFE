import type { LiaConfig } from "./config";

export type LiaMode = "public" | "bpbd_copilot";
export type LiaActorRole = "public" | "operator" | "admin";

export interface LiaContext {
  module: string;
  path?: string;
}

export interface LiaCitation {
  source: string;
  title: string;
  timestamp?: string;
  retrievedAt?: string;
  dataAsOf?: string;
  type: "official_data" | "sensor_telemetry" | "regulation" | "simulation" | "guideline";
  isSimulated: boolean;
  url?: string;
  documentId?: string;
}

export interface LiaUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolExecutionSummary {
  name: string;
  ok: boolean;
  summary?: string;
  error?: string;
}

export interface LiaChatRequest {
  message: string;
  conversationId?: number;
  sessionId?: string;
  context?: LiaContext;
  signal?: AbortSignal;
  stream?: boolean;
}

export interface LiaResolvedActor {
  userId: number | null;
  role: LiaActorRole;
  mode: LiaMode;
  displayName: string;
}

export interface LiaChatResult {
  conversationId: number | null;
  assistantMessageId: number | null;
  content: string;
  citations: LiaCitation[];
  toolExecutions: ToolExecutionSummary[];
  usage: LiaUsage;
  model: string;
  finishReason: string;
  durationMs: number;
}

export type LiaStreamEvent =
  | {
      type: "meta";
      conversationId: number | null;
      mode: LiaMode;
      title: string;
      model: string;
      createdAt: string;
    }
  | { type: "status"; phase: "retrieving" | "reading_data" | "analyzing" | "generating"; label: string }
  | { type: "delta"; text: string }
  | { type: "tool"; tool: ToolExecutionSummary }
  | { type: "citation"; citation: LiaCitation }
  | {
      type: "done";
      conversationId: number | null;
      messageId: number | null;
      usage: LiaUsage;
      citations: LiaCitation[];
      toolExecutions: ToolExecutionSummary[];
      model: string;
      finishReason: string;
      durationMs: number;
    }
  | { type: "error"; message: string; code?: string };

export type AiStreamEvent =
  | { type: "content"; text: string }
  | { type: "reasoning"; text: string }
  | {
      type: "tool_call";
      index: number;
      id?: string;
      name?: string;
      argumentsDelta?: string;
    }
  | { type: "usage"; usage: LiaUsage }
  | { type: "finish"; reason: string };

export interface AiProvider {
  name: string;
  config: LiaConfig;
  streamChat(messages: ProviderMessage[], options?: ProviderChatOptions): AsyncGenerator<AiStreamEvent>;
}

export interface ProviderChatOptions {
  tools?: ProviderTool[];
  toolChoice?: "auto" | "none";
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface ProviderTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}
