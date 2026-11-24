import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  Copy,
  Database,
  FileText,
  FlaskConical,
  History,
  Loader2,
  MessageSquare,
  Plus,
  Radio,
  RotateCcw,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { moduleForPath, type LiaModuleContext } from '../../lib/lia-context';
import {
  deleteLiaConversation,
  getLiaConversation,
  getLiaSuggestions,
  getLiaUsage,
  listLiaConversations,
  streamLiaChat,
  type LiaCitation,
  type LiaConversationMessage,
  type LiaConversationSummary,
  type LiaMode,
  type LiaToolExecution,
  type LiaUsage,
  type LiaUsageStats,
} from '../../lib/lia-client';
import { LiaMarkdown } from './LiaMarkdown';

const MAX_MESSAGE_LENGTH = 2_000;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  citations: LiaCitation[];
  toolExecutions: LiaToolExecution[];
  isSimulated: boolean;
  state: 'done' | 'streaming' | 'error' | 'stopped';
  error?: string;
  prompt?: string;
  finishReason?: string;
};

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `lia-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function relativeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfDate) / 86_400_000);
  if (dayDiff === 0) return `Hari ini · ${timeLabel(iso)}`;
  if (dayDiff === 1) return `Kemarin · ${timeLabel(iso)}`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: dayDiff > 300 ? 'numeric' : undefined });
}

function citationTime(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function dedupeCitations(citations: LiaCitation[]): LiaCitation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = citation.documentId ?? `${citation.source}::${citation.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toolExecutionsFromRaw(raw: LiaConversationMessage['toolCalls']): LiaToolExecution[] {
  return raw.flatMap((entry) => {
    const name = typeof entry.name === 'string' ? entry.name : null;
    if (!name) return [];
    return [{
      name,
      ok: entry.ok !== false,
      summary: typeof entry.summary === 'string' ? entry.summary : undefined,
      error: typeof entry.error === 'string' ? entry.error : undefined,
    }];
  });
}

function mapStoredMessage(message: LiaConversationMessage): ChatMessage {
  return {
    id: `db-${message.id}`,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    citations: Array.isArray(message.citations) ? message.citations : [],
    toolExecutions: toolExecutionsFromRaw(Array.isArray(message.toolCalls) ? message.toolCalls : []),
    isSimulated: message.isSimulated,
    state: 'done',
  };
}

function safeCitationUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch {
    return null;
  }
  return null;
}

function citationTypeLabel(type: LiaCitation['type']): string {
  switch (type) {
    case 'official_data':
      return 'Data resmi';
    case 'sensor_telemetry':
      return 'Telemetri sensor';
    case 'regulation':
      return 'Regulasi';
    case 'simulation':
      return 'Simulasi';
    default:
      return 'Panduan';
  }
}

function CitationIcon({ type }: { type: LiaCitation['type'] }) {
  const className = 'mt-0.5 h-3 w-3 shrink-0 text-info';
  switch (type) {
    case 'official_data':
      return <Database className={className} aria-hidden="true" />;
    case 'sensor_telemetry':
      return <Radio className={className} aria-hidden="true" />;
    case 'regulation':
      return <Scale className={className} aria-hidden="true" />;
    case 'simulation':
      return <FlaskConical className={className} aria-hidden="true" />;
    default:
      return <FileText className={className} aria-hidden="true" />;
  }
}

function fallbackSuggestions(mode: LiaMode): string[] {
  if (mode === 'bpbd_copilot') {
    return [
      'Ringkas kondisi risiko dan peringatan aktif saat ini.',
      'Data apa yang perlu diverifikasi sebelum rekomendasi mitigasi?',
      'Buat draf ringkasan laporan untuk pimpinan.',
      'Jelaskan keterbatasan data pada modul ini.',
    ];
  }
  return [
    'Apa yang harus saya lakukan saat terjadi gempa?',
    'Di mana saya bisa melihat rute evakuasi?',
    'Bagaimana membaca status peringatan LANDSAFE?',
    'Apa itu LANDSAFE dan bagaimana data saya digunakan?',
  ];
}

function ModeBadge({ mode, dark = false }: { mode: LiaMode; dark?: boolean }) {
  const staff = mode === 'bpbd_copilot';
  const tone = dark
    ? staff
      ? 'border-emerald-300/30 bg-emerald-300/15 text-emerald-200'
      : 'border-sky-300/30 bg-sky-300/10 text-sky-100'
    : staff
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-info/30 bg-info/10 text-info';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.1em] ${tone}`}>
      {staff ? <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" /> : <MessageSquare className="h-2.5 w-2.5" aria-hidden="true" />}
      {staff ? 'BPBD Copilot' : 'Publik'}
    </span>
  );
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-[11px] text-muted-foreground" role="status">
      <span className="flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-info/70"
            style={{ animationDelay: `${index * 120}ms`, animationDuration: '900ms' }}
          />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}

function CitationSection({ citations }: { citations: LiaCitation[] }) {
  if (citations.length === 0) return null;
  return (
    <details className="group mt-2.5 border-t border-border pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground">
        <BookOpen className="h-3 w-3" aria-hidden="true" />
        Sumber &amp; data ({citations.length})
        <ChevronDown className="ml-auto h-3 w-3 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="mt-2 space-y-1.5">
        {citations.map((citation, index) => {
          const url = safeCitationUrl(citation.url);
          const stamp = citationTime(citation.dataAsOf) ?? citationTime(citation.timestamp);
          return (
            <li key={`${citation.documentId ?? citation.source}-${index}`} className="rounded-md border border-border bg-secondary/40 px-2 py-1.5">
              <div className="flex items-start gap-1.5">
                <CitationIcon type={citation.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10.5px] font-medium leading-snug text-foreground">{citation.title}</span>
                    <span className="rounded bg-secondary px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {citationTypeLabel(citation.type)}
                    </span>
                    {citation.isSimulated && (
                      <span className="rounded bg-warning/15 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-warning">
                        Simulasi
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[9.5px] leading-snug text-muted-foreground">
                    {citation.source}
                    {stamp ? ` · ${citation.dataAsOf ? 'Data per' : 'Waktu'} ${stamp}` : ''}
                  </div>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-0.5 inline-block text-[9.5px] font-medium text-info underline underline-offset-2"
                    >
                      Buka sumber
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function ToolTrace({ tools }: { tools: LiaToolExecution[] }) {
  if (tools.length === 0) return null;
  return (
    <details className="group mt-2 border-t border-border pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground">
        <Database className="h-3 w-3" aria-hidden="true" />
        Data LANDSAFE diperiksa ({tools.length})
        <ChevronDown className="ml-auto h-3 w-3 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="mt-1.5 space-y-1">
        {tools.map((tool, index) => (
          <li key={`${tool.name}-${index}`} className="flex items-start gap-1.5 text-[9.5px] leading-snug">
            {tool.ok
              ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" aria-hidden="true" />
              : <X className="mt-0.5 h-3 w-3 shrink-0 text-destructive" aria-hidden="true" />}
            <span className="min-w-0">
              <span className="font-medium text-foreground">{tool.summary ?? tool.name.replace(/_/g, ' ')}</span>
              <span className="ml-1 font-mono text-[8.5px] text-muted-foreground">{tool.name}</span>
              {tool.error && <span className="mt-0.5 block text-destructive">{tool.error}</span>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function EmptyState({
  mode,
  context,
  suggestions,
  onPick,
}: {
  mode: LiaMode;
  context: LiaModuleContext;
  suggestions: string[];
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col items-center px-1 pt-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--sidebar))] text-white shadow-lg ring-1 ring-white/10">
        <BrainCircuit className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-3 text-[15px] font-semibold tracking-tight text-foreground">Halo, saya LIA</h2>
      <p className="mt-1 max-w-[300px] text-[11.5px] leading-relaxed text-muted-foreground">
        {mode === 'bpbd_copilot'
          ? `Asisten intelijen LANDSAFE untuk ${context.label}. Saya membantu membaca data operasional, merujuk SOP, dan menyusun draf analisis. Rekomendasi tetap memerlukan persetujuan manusia.`
          : 'Asisten intelijen kebencanaan LANDSAFE. Saya membantu menjelaskan data, regulasi, dan langkah mitigasi dalam bahasa yang mudah dipahami.'}
      </p>

      {mode === 'public' && (
        <div className="mt-2.5 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[9.5px] leading-snug text-warning">
          Dalam keadaan darurat, hubungi <strong>112</strong> atau BPBD setempat. LIA bukan layanan darurat.
        </div>
      )}

      <div className="mt-5 w-full space-y-1.5 text-left">
        <div className="px-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mulai dengan</div>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="group flex w-full items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left text-[11px] leading-snug text-foreground transition-colors hover:border-info/40 hover:bg-info/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-info/70" aria-hidden="true" />
            <span className="flex-1">{suggestion}</span>
            <span className="mt-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function LiaPanel() {
  const { user } = useAuth();
  const [location] = useLocation();
  const context = moduleForPath(location);

  const expectedMode: LiaMode = user && user.role !== 'public' ? 'bpbd_copilot' : 'public';
  const isStaff = !!user && user.role !== 'public';

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [mode, setMode] = useState<LiaMode>(expectedMode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(() => fallbackSuggestions(expectedMode));
  const [conversations, setConversations] = useState<LiaConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [usageStats, setUsageStats] = useState<LiaUsageStats | null>(null);
  const [usage, setUsage] = useState<LiaUsage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const conversationIdRef = useRef<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const streamGenerationRef = useRef(0);
  const streamingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);

  const displayMode: LiaMode = conversationId !== null ? mode : expectedMode;

  useEffect(() => {
    if (conversationId === null && !streamingRef.current) setMode(expectedMode);
  }, [expectedMode, conversationId]);

  useEffect(() => {
    if (!isStaff) {
      setUsageStats(null);
      setUsage(null);
    }
  }, [isStaff]);

  useEffect(() => () => {
    controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getLiaSuggestions(context.id)
      .then((items) => {
        if (!cancelled) setSuggestions(items.length > 0 ? items.slice(0, 4) : fallbackSuggestions(displayMode));
      })
      .catch(() => {
        if (!cancelled) setSuggestions(fallbackSuggestions(displayMode));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, context.id, displayMode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (view === 'history') setView('chat');
      else setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view]);

  useEffect(() => {
    if (!isOpen || view !== 'chat') return;
    if (!stickToBottomRef.current) return;
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, isOpen, view, status, loadingConversation]);

  useEffect(() => {
    if (!isOpen || view !== 'chat') return;
    if (!window.matchMedia('(min-width: 640px)').matches) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isOpen, view, conversationId]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
  }, [input, isOpen, view]);

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(null), 1_800);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  function updateAssistant(id: string, updater: (message: ChatMessage) => ChatMessage) {
    setMessages((previous) => previous.map((message) => (message.id === id ? updater(message) : message)));
  }

  function cancelActiveStream() {
    streamGenerationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    streamingRef.current = false;
    setIsStreaming(false);
    setStatus(null);
  }

  function resetConversation() {
    cancelActiveStream();
    conversationIdRef.current = null;
    setConversationId(null);
    setConversationTitle(null);
    setMessages([]);
    setUsage(null);
    setNotice(null);
    setInput('');
    setView('chat');
    stickToBottomRef.current = true;
  }

  function openPanel() {
    setIsOpen(true);
    setView('chat');
    stickToBottomRef.current = true;
  }

  function onScroll() {
    const element = scrollRef.current;
    if (!element) return;
    stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  }

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || streamingRef.current) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      setNotice(`Pesan terlalu panjang. Maksimum ${MAX_MESSAGE_LENGTH.toLocaleString('id-ID')} karakter.`);
      return;
    }

    const generation = ++streamGenerationRef.current;
    streamingRef.current = true;
    setIsStreaming(true);
    setStatus('Menyiapkan jawaban...');
    setNotice(null);
    setInput('');
    stickToBottomRef.current = true;

    const createdAt = new Date().toISOString();
    const assistantId = newId();
    const userMessage: ChatMessage = {
      id: newId(),
      role: 'user',
      content: text,
      createdAt,
      citations: [],
      toolExecutions: [],
      isSimulated: false,
      state: 'done',
    };
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt,
      citations: [],
      toolExecutions: [],
      isSimulated: false,
      state: 'streaming',
      prompt: text,
    };

    setMessages((previous) => [...previous, userMessage, assistantMessage]);

    const controller = new AbortController();
    controllerRef.current = controller;
    let receivedDone = false;
    let receivedContent = false;

    try {
      await streamLiaChat({
        message: text,
        conversationId: conversationIdRef.current,
        context: { module: context.id, path: location },
        signal: controller.signal,
        onEvent: (event) => {
          if (streamGenerationRef.current !== generation) return;
          switch (event.type) {
            case 'meta':
              conversationIdRef.current = event.conversationId;
              setConversationId(event.conversationId);
              setConversationTitle(event.title);
              setMode(event.mode);
              break;
            case 'status':
              setStatus(event.label);
              break;
            case 'delta':
              receivedContent = true;
              updateAssistant(assistantId, (message) => ({ ...message, content: message.content + event.text }));
              break;
            case 'tool':
              updateAssistant(assistantId, (message) => ({
                ...message,
                toolExecutions: [...message.toolExecutions, event.tool],
              }));
              break;
            case 'citation':
              updateAssistant(assistantId, (message) => ({
                ...message,
                citations: dedupeCitations([...message.citations, event.citation]),
              }));
              break;
            case 'done':
              receivedDone = true;
              conversationIdRef.current = event.conversationId;
              setConversationId(event.conversationId);
              setUsage(event.usage);
              updateAssistant(assistantId, (message) => ({
                ...message,
                citations: event.citations.length > 0 ? event.citations : message.citations,
                toolExecutions: event.toolExecutions,
                isSimulated: event.citations.some((citation) => citation.isSimulated) || message.isSimulated,
                state: 'done',
                finishReason: event.finishReason,
              }));
              break;
            case 'error':
              updateAssistant(assistantId, (message) => ({
                ...message,
                state: 'error',
                error: event.message,
              }));
              break;
          }
        },
      });

      if (streamGenerationRef.current === generation) {
        if (!receivedDone && !receivedContent) {
          updateAssistant(assistantId, (message) => ({
            ...message,
            state: 'error',
            error: 'LIA tidak mengirim respons. Periksa koneksi Anda lalu coba lagi.',
          }));
        } else {
          updateAssistant(assistantId, (message) => (
            message.state === 'streaming' ? { ...message, state: 'done' } : message
          ));
        }
      }
    } catch (error) {
      if (streamGenerationRef.current !== generation) return;
      if (isAbortError(error)) {
        updateAssistant(assistantId, (message) => ({ ...message, state: 'stopped' }));
      } else {
        const message = error instanceof Error ? error.message : 'LIA tidak dapat memproses pesan. Silakan coba lagi.';
        updateAssistant(assistantId, (current) => ({ ...current, state: 'error', error: message }));
      }
    } finally {
      if (streamGenerationRef.current === generation) {
        streamingRef.current = false;
        setIsStreaming(false);
        setStatus(null);
        controllerRef.current = null;
      }
    }
  }

  function stopStreaming() {
    setMessages((previous) => previous.map((message) => (
      message.state === 'streaming' ? { ...message, state: 'stopped' } : message
    )));
    cancelActiveStream();
  }

  function retryMessage(message: ChatMessage) {
    if (!message.prompt || streamingRef.current) return;
    setMessages((previous) => {
      const index = previous.findIndex((entry) => entry.id === message.id);
      if (index < 0) return previous;
      return previous.filter((entry, entryIndex) => (
        entryIndex !== index && !(entryIndex === index - 1 && entry.role === 'user')
      ));
    });
    setNotice(null);
    void sendMessage(message.prompt);
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setNotice(null);
    try {
      const items = await listLiaConversations();
      setConversations(items);
      if (isStaff) {
        setUsageStats(await getLiaUsage().catch(() => null));
      } else {
        setUsageStats(null);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Riwayat percakapan tidak dapat dimuat.');
    } finally {
      setHistoryLoading(false);
    }
  }

  function openHistory() {
    setView('history');
    void loadHistory();
  }

  async function selectConversation(id: number) {
    if (id === conversationIdRef.current) {
      setView('chat');
      return;
    }
    cancelActiveStream();
    setView('chat');
    setLoadingConversation(true);
    setNotice(null);
    stickToBottomRef.current = true;
    try {
      const detail = await getLiaConversation(id);
      conversationIdRef.current = detail.conversation.id;
      setConversationId(detail.conversation.id);
      setConversationTitle(detail.conversation.title);
      setMode(detail.conversation.mode);
      setMessages(detail.messages.map(mapStoredMessage));
      setUsage(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Percakapan tidak dapat dimuat.');
      setView('history');
    } finally {
      setLoadingConversation(false);
    }
  }

  async function removeConversation(item: LiaConversationSummary) {
    if (deletingId !== null) return;
    if (!window.confirm(`Hapus percakapan "${item.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeletingId(item.id);
    setNotice(null);
    try {
      await deleteLiaConversation(item.id);
      setConversations((previous) => previous.filter((conversation) => conversation.id !== item.id));
      if (conversationIdRef.current === item.id) resetConversation();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Percakapan tidak dapat dihapus.');
    } finally {
      setDeletingId(null);
    }
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
    } catch {
      setNotice('Jawaban tidak dapat disalin otomatis. Pilih teks secara manual.');
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - input.length;
  const canSend = input.trim().length > 0 && !isStreaming && !loadingConversation;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Buka LIA, asisten intelijen kebencanaan"
          className="group fixed bottom-18 right-3.5 sm:bottom-6 sm:right-6 z-[1100] flex items-center gap-2.5 rounded-full bg-[hsl(var(--sidebar))] py-2.5 pl-2.5 pr-3 sm:pr-4 text-white shadow-xl ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
            <BrainCircuit className="h-5 w-5" aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[hsl(var(--sidebar))]" />
          </span>
          <span className="text-left leading-tight hidden xs:inline sm:inline">
            <span className="block text-[13px] font-semibold tracking-tight">Tanya LIA</span>
            <span className="block text-[9px] text-white/55">Asisten intelijen kebencanaan</span>
          </span>
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="LIA - Asisten Intelijen LANDSAFE"
          aria-modal="false"
          className="fixed inset-0 z-[1300] flex flex-col overflow-hidden bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(780px,calc(100vh-3rem))] sm:w-[430px] sm:rounded-2xl sm:border sm:border-border sm:ring-1 sm:ring-black/5"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 bg-[hsl(var(--sidebar))] px-3 py-2.5 text-white">
            <div className="flex min-w-0 items-center gap-2.5">
              {view === 'history' ? (
                <button
                  type="button"
                  onClick={() => setView('chat')}
                  aria-label="Kembali ke percakapan"
                  className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <BrainCircuit className="h-[18px] w-[18px]" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold tracking-[0.1em]">{view === 'history' ? 'RIWAYAT' : 'LIA'}</span>
                  {view === 'chat' && <ModeBadge mode={displayMode} dark />}
                </div>
                <div className="truncate text-[9.5px] leading-tight text-white/55" title={conversationTitle ?? undefined}>
                  {view === 'history' ? 'Percakapan LANDSAFE' : conversationTitle ?? 'LANDSAFE Intelligence Assistant'}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              {view === 'chat' && (
                <button
                  type="button"
                  onClick={openHistory}
                  aria-label="Buka riwayat percakapan"
                  title="Riwayat percakapan"
                  className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <History className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={resetConversation}
                aria-label="Mulai percakapan baru"
                title="Percakapan baru"
                className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup LIA"
                title="Tutup"
                className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Context strip */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5">
            <div className="flex min-w-0 items-center gap-1.5 text-[9.5px] text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
              <span className="truncate">
                Konteks: <span className="font-medium text-foreground">{context.label}</span>
              </span>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
              AI generatif
            </span>
          </div>

          <div className="sr-only" aria-live="polite">
            {isStreaming && status ? status : ''}
          </div>

          {view === 'history' ? (
            <div className="flex-1 overflow-y-auto bg-background p-3">
              {notice && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[10.5px] text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{notice}</span>
                  <button type="button" onClick={() => setNotice(null)} aria-label="Tutup pesan galat" className="rounded p-0.5 hover:bg-destructive/10">
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              )}

              {isStaff && usageStats && (
                <div className="mb-2 rounded-lg border border-border bg-card p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pemakaian LIA</span>
                    <ModeBadge mode={usageStats.mode} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <div className="rounded-md bg-secondary/50 px-2 py-1.5">
                      <div className="text-[13px] font-semibold tabular text-foreground">{usageStats.requestsToday.toLocaleString('id-ID')}</div>
                      <div className="text-[8.5px] text-muted-foreground">Permintaan hari ini</div>
                    </div>
                    <div className="rounded-md bg-secondary/50 px-2 py-1.5">
                      <div className="text-[13px] font-semibold tabular text-foreground">{usageStats.requests.toLocaleString('id-ID')}</div>
                      <div className="text-[8.5px] text-muted-foreground">Total permintaan</div>
                    </div>
                    <div className="rounded-md bg-secondary/50 px-2 py-1.5">
                      <div className="text-[13px] font-semibold tabular text-foreground">{usageStats.totalTokens.toLocaleString('id-ID')}</div>
                      <div className="text-[8.5px] text-muted-foreground">Total token</div>
                    </div>
                    <div className="rounded-md bg-secondary/50 px-2 py-1.5">
                      <div className="text-[13px] font-semibold tabular text-foreground">{usageStats.estimatedRequests.toLocaleString('id-ID')}</div>
                      <div className="text-[8.5px] text-muted-foreground">Permintaan estimasi</div>
                    </div>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <div className="rounded-md border border-border/70 px-2 py-1.5">
                      <div className="text-[11px] font-semibold tabular text-foreground">{usageStats.promptTokens.toLocaleString('id-ID')}</div>
                      <div className="text-[8.5px] text-muted-foreground">Token masuk</div>
                    </div>
                    <div className="rounded-md border border-border/70 px-2 py-1.5">
                      <div className="text-[11px] font-semibold tabular text-foreground">{usageStats.completionTokens.toLocaleString('id-ID')}</div>
                      <div className="text-[8.5px] text-muted-foreground">Token keluar</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-border/70 pt-1.5 text-[8.5px] text-muted-foreground">
                    <span className="tabular">Batas {usageStats.limits.requestsPerWindow} / {usageStats.limits.windowSeconds}s</span>
                    <span>
                      {usageStats.lastUsedAt
                        ? `Terakhir: ${relativeLabel(usageStats.lastUsedAt)}`
                        : 'Belum ada pemakaian'}
                    </span>
                  </div>
                  {usageStats.estimatedRequests > 0 && (
                    <p className="mt-1.5 text-[8.5px] leading-snug text-muted-foreground">
                      Sebagian pemakaian memakai estimasi token karena provider tidak mengirim rincian usage.
                    </p>
                  )}
                </div>
              )}

              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Percakapan tersimpan</span>
                <button
                  type="button"
                  onClick={() => void loadHistory()}
                  disabled={historyLoading}
                  className="text-[9.5px] font-medium text-info hover:underline disabled:opacity-50"
                >
                  Muat ulang
                </button>
              </div>

              {historyLoading && conversations.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-10 text-[11px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat riwayat...
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center px-3 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                    <History className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-[12px] font-medium text-foreground">Belum ada percakapan</p>
                  <p className="mt-1 max-w-[240px] text-[10.5px] leading-relaxed text-muted-foreground">
                    Mulai pertanyaan pertama Anda. Riwayat akan tersimpan sesuai akun atau sesi perangkat ini.
                  </p>
                  <button
                    type="button"
                    onClick={() => setView('chat')}
                    className="mt-3 rounded-md bg-primary px-3 py-1.5 text-[10.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Mulai percakapan
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {conversations.map((conversation) => {
                    const active = conversation.id === conversationId;
                    return (
                      <div
                        key={conversation.id}
                        className={`group flex items-start gap-2 rounded-lg border p-2.5 transition-colors ${
                          active ? 'border-info/40 bg-info/5' : 'border-border bg-card hover:border-info/30 hover:bg-secondary/40'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => void selectConversation(conversation.id)}
                          disabled={loadingConversation}
                          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="truncate text-[11.5px] font-semibold leading-snug text-foreground">{conversation.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-muted-foreground">
                            <ModeBadge mode={conversation.mode} />
                            <span>{conversation.messageCount} pesan</span>
                            <span aria-hidden="true">·</span>
                            <span>{relativeLabel(conversation.updatedAt)}</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeConversation(conversation)}
                          disabled={deletingId !== null}
                          aria-label={`Hapus percakapan ${conversation.title}`}
                          title="Hapus percakapan"
                          className="rounded p-1 text-muted-foreground opacity-60 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          {deletingId === conversation.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-3 px-2 text-center text-[8.5px] leading-relaxed text-muted-foreground">
                Riwayat tersimpan sesuai akun atau sesi perangkat Anda. Menghapus percakapan juga menghapus seluruh pesannya.
              </p>
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                onScroll={onScroll}
                className="flex-1 overflow-y-auto bg-background px-3 py-3.5"
              >
                {loadingConversation ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-[11px] text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat percakapan...
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState
                    mode={displayMode}
                    context={context}
                    suggestions={suggestions}
                    onPick={(prompt) => void sendMessage(prompt)}
                  />
                ) : (
                  <div className="space-y-3.5">
                    {notice && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[10.5px] text-destructive">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="flex-1">{notice}</span>
                        <button type="button" onClick={() => setNotice(null)} aria-label="Tutup pesan galat" className="rounded p-0.5 hover:bg-destructive/10">
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    {messages.map((message) => {
                      if (message.role === 'user') {
                        return (
                          <div key={message.id} className="flex flex-col items-end gap-1">
                            <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-[12px] leading-relaxed text-primary-foreground shadow-sm">
                              {message.content}
                            </div>
                            <span className="pr-1 text-[9px] tabular text-muted-foreground">{timeLabel(message.createdAt)}</span>
                          </div>
                        );
                      }

                      return (
                        <div key={message.id} className="flex gap-2">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--sidebar))] text-white shadow-sm ring-1 ring-white/10">
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`rounded-2xl rounded-tl-sm border px-3 py-2.5 ${
                              message.state === 'error'
                                ? 'border-destructive/30 bg-destructive/5'
                                : 'border-border bg-card'
                            }`}>
                              {message.isSimulated && (
                                <div className="mb-1.5 inline-flex items-center gap-1 rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-warning">
                                  <FlaskConical className="h-2.5 w-2.5" aria-hidden="true" /> Skenario simulasi
                                </div>
                              )}

                              {message.content ? (
                                <LiaMarkdown content={message.content} />
                              ) : message.state === 'streaming' ? (
                                <TypingIndicator label={status ?? 'Menyusun jawaban...'} />
                              ) : message.state === 'stopped' ? (
                                <p className="text-[11px] italic text-muted-foreground">Respons dihentikan sebelum selesai.</p>
                              ) : null}

                              {message.state === 'error' && (
                                <div className="mt-1.5 space-y-1.5">
                                  <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-destructive">
                                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                                    {message.error ?? 'LIA tidak dapat memproses pesan ini.'}
                                  </p>
                                  {message.prompt && (
                                    <button
                                      type="button"
                                      onClick={() => retryMessage(message)}
                                      disabled={isStreaming}
                                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                                    >
                                      <RotateCcw className="h-3 w-3" aria-hidden="true" /> Coba lagi
                                    </button>
                                  )}
                                </div>
                              )}

                              {message.state !== 'error' && <CitationSection citations={message.citations} />}
                              {message.state !== 'error' && <ToolTrace tools={message.toolExecutions} />}

                              {message.finishReason === 'length' && (
                                <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[9.5px] leading-snug text-warning">
                                  Jawaban mencapai batas panjang. Kirim &quot;lanjutkan&quot; jika Anda memerlukan bagian berikutnya.
                                </p>
                              )}
                            </div>

                            <div className="mt-1 flex min-h-[14px] items-center gap-1.5 px-1 text-[9px] text-muted-foreground">
                              <span className="tabular">{timeLabel(message.createdAt)}</span>
                              {message.state === 'stopped' && <span>· Dihentikan</span>}
                              {message.state === 'streaming' && (
                                <span className="flex items-center gap-1">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                                  {status ?? 'Memproses'}
                                </span>
                              )}
                              {message.state === 'done' && message.content && (
                                <button
                                  type="button"
                                  onClick={() => void copyMessage(message)}
                                  aria-label="Salin jawaban"
                                  title="Salin jawaban"
                                  className="ml-auto rounded p-0.5 text-muted-foreground opacity-60 transition-colors hover:bg-secondary hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {copiedId === message.id
                                    ? <Check className="h-3 w-3 text-success" aria-hidden="true" />
                                    : <Copy className="h-3 w-3" aria-hidden="true" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="shrink-0 border-t border-border bg-card px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2">
                {isStaff && usage && (
                  <div className="mb-1.5 flex items-center justify-end gap-1 text-[8.5px] text-muted-foreground">
                    <Database className="h-2.5 w-2.5" aria-hidden="true" />
                    {usage.totalTokens.toLocaleString('id-ID')} token
                  </div>
                )}

                <div className={`rounded-xl border bg-background p-1.5 transition-colors focus-within:border-info/50 focus-within:ring-1 focus-within:ring-info/20 ${
                  remaining < 0 ? 'border-destructive/50' : 'border-border'
                }`}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        if (canSend) void sendMessage(input);
                      }
                    }}
                    rows={1}
                    maxLength={MAX_MESSAGE_LENGTH + 200}
                    placeholder={displayMode === 'bpbd_copilot'
                      ? 'Tanyakan data operasional, SOP, atau draf analisis...'
                      : 'Tanyakan tentang risiko, evakuasi, atau mitigasi...'}
                    aria-label="Tulis pertanyaan untuk LIA"
                    className="max-h-[120px] min-h-[38px] w-full resize-none bg-transparent px-2 py-2 text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8.5px] tabular ${remaining < 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                        {input.length > 0 ? `${input.length}/${MAX_MESSAGE_LENGTH}` : 'Enter kirim · Shift+Enter baris baru'}
                      </span>
                    </div>
                    {isStreaming ? (
                      <button
                        type="button"
                        onClick={stopStreaming}
                        aria-label="Hentikan jawaban LIA"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void sendMessage(input)}
                        disabled={!canSend}
                        aria-label="Kirim pesan"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-1.5 text-center text-[8.5px] leading-snug text-muted-foreground">
                  LIA adalah AI generatif dan dapat membuat kesalahan. Verifikasi informasi penting.
                  LIA tidak menerbitkan peringatan resmi.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
