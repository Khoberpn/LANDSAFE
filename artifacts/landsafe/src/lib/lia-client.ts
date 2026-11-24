export type LiaMode = 'public' | 'bpbd_copilot';

export interface LiaCitation {
  source: string;
  title: string;
  timestamp?: string;
  retrievedAt?: string;
  dataAsOf?: string;
  type: 'official_data' | 'sensor_telemetry' | 'regulation' | 'simulation' | 'guideline';
  isSimulated: boolean;
  url?: string;
  documentId?: string;
}

export interface LiaUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LiaToolExecution {
  name: string;
  ok: boolean;
  summary?: string;
  error?: string;
}

export type LiaStreamEvent =
  | {
      type: 'meta';
      conversationId: number | null;
      mode: LiaMode;
      title: string;
      model: string;
      createdAt: string;
    }
  | { type: 'status'; phase: 'retrieving' | 'reading_data' | 'analyzing' | 'generating'; label: string }
  | { type: 'delta'; text: string }
  | { type: 'tool'; tool: LiaToolExecution }
  | { type: 'citation'; citation: LiaCitation }
  | {
      type: 'done';
      conversationId: number | null;
      messageId: number | null;
      usage: LiaUsage;
      citations: LiaCitation[];
      toolExecutions: LiaToolExecution[];
      model: string;
      finishReason: string;
      durationMs: number;
    }
  | { type: 'error'; message: string; code?: string };

export interface LiaConversationSummary {
  id: number;
  title: string;
  mode: LiaMode;
  contextModule: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LiaConversationMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations: LiaCitation[];
  toolCalls: Array<Record<string, unknown>>;
  isSimulated: boolean;
  createdAt: string;
}

export interface LiaUsageStats {
  requests: number;
  requestsToday: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedRequests: number;
  lastUsedAt: string | null;
  mode: LiaMode;
  limits: { windowSeconds: number; requestsPerWindow: number };
}

export class LiaApiError extends Error {
  readonly name = 'LiaApiError';
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const SESSION_KEY = 'landsafe_lia_session';

export function getLiaSessionId(): string {
  if (typeof window === 'undefined') return 'server-session';
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing && /^[A-Za-z0-9_-]{8,128}$/.test(existing)) return existing;

  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `lia-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  window.localStorage.setItem(SESSION_KEY, generated);
  return generated;
}

function authToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('landsafe_token');
}

function authHeaders(extra?: Record<string, string>): HeadersInit {
  const token = authToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseError(response: Response): Promise<LiaApiError> {
  let message = `Permintaan LIA gagal (${response.status}).`;
  let code: string | undefined;
  try {
    const body = await response.json() as { error?: unknown; message?: unknown; code?: unknown };
    if (typeof body.error === 'string') message = body.error;
    else if (typeof body.message === 'string') message = body.message;
    if (typeof body.code === 'string') code = body.code;
  } catch {
    // Keep the generic message.
  }
  return new LiaApiError(message, response.status, code);
}

function parseSseBlock(block: string): LiaStreamEvent | null {
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n').trim();
  if (!raw || raw === '[DONE]') return null;
  try {
    const parsed = JSON.parse(raw) as LiaStreamEvent;
    return parsed && typeof parsed === 'object' && typeof parsed.type === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

async function readSse(
  response: Response,
  onEvent: (event: LiaStreamEvent) => void,
): Promise<void> {
  if (!response.body) {
    const raw = await response.text();
    for (const block of raw.replace(/\r\n/g, '\n').split('\n\n')) {
      const event = parseSseBlock(block);
      if (event) onEvent(event);
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseSseBlock(block);
      if (event) onEvent(event);
      boundary = buffer.indexOf('\n\n');
    }
  }

  buffer += decoder.decode();
  const event = parseSseBlock(buffer.replace(/\r\n/g, '\n'));
  if (event) onEvent(event);
}

export async function streamLiaChat(input: {
  message: string;
  conversationId?: number | null;
  context: { module: string; path?: string };
  signal?: AbortSignal;
  onEvent: (event: LiaStreamEvent) => void;
}): Promise<void> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    }),
    body: JSON.stringify({
      message: input.message,
      conversationId: input.conversationId ?? undefined,
      sessionId: getLiaSessionId(),
      context: input.context,
      stream: true,
    }),
    signal: input.signal,
  });

  if (!response.ok) throw await parseError(response);
  await readSse(response, input.onEvent);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: authHeaders({
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    }),
  });
  if (!response.ok) throw await parseError(response);
  return await response.json() as T;
}

export async function listLiaConversations(): Promise<LiaConversationSummary[]> {
  const data = await requestJson<{ conversations: LiaConversationSummary[] }>(
    `/api/ai/conversations?sessionId=${encodeURIComponent(getLiaSessionId())}`,
  );
  return data.conversations;
}

export async function getLiaConversation(id: number): Promise<{
  conversation: LiaConversationSummary;
  messages: LiaConversationMessage[];
}> {
  return requestJson(`/api/ai/conversations/${id}?sessionId=${encodeURIComponent(getLiaSessionId())}`);
}

export async function deleteLiaConversation(id: number): Promise<void> {
  await requestJson(`/api/ai/conversations/${id}?sessionId=${encodeURIComponent(getLiaSessionId())}`, {
    method: 'DELETE',
  });
}

export async function getLiaUsage(): Promise<LiaUsageStats> {
  return requestJson(`/api/ai/usage?sessionId=${encodeURIComponent(getLiaSessionId())}`);
}

export async function getLiaSuggestions(module: string): Promise<string[]> {
  const data = await requestJson<{ suggestions: string[] }>(
    `/api/ai/suggestions?module=${encodeURIComponent(module)}`,
  );
  return data.suggestions;
}
