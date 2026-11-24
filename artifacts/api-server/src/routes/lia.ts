import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { optionalAuthenticate } from "../middlewares/auth";
import { aiChatRateLimit } from "../middlewares/aiRateLimit";
import { recordAudit } from "../lib/audit";
import { CloudflareAiError } from "../lib/lia/cloudflare-client";
import { LiaConfigurationError, getLiaConfig } from "../lib/lia/config";
import {
  deleteConversation,
  getConversationDetail,
  getUsageStats,
  listConversations,
  resolveActor,
  runLiaChat,
  sanitizeUserMessage,
  suggestionsFor,
} from "../lib/lia/orchestrator";
import { LIA_CONTEXT_MODULES, normalizeContext } from "../lib/lia/prompts";
import { parsePositiveInt } from "../lib/validation";
import type { LiaChatResult, LiaStreamEvent } from "../lib/lia/types";

const router = Router();

const sessionIdSchema = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/);

const chatBodySchema = z.object({
  message: z.string(),
  conversationId: z.number().int().positive().optional(),
  sessionId: sessionIdSchema.optional(),
  context: z.object({
    module: z.string().max(40).optional(),
    path: z.string().max(160).optional(),
  }).strict().optional(),
  stream: z.boolean().optional(),
}).strict();

function requestActor(req: Request) {
  return resolveActor(req.user ? { userId: req.user.userId, role: req.user.role } : undefined);
}

function statusForError(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (Number.isInteger(status) && status >= 400 && status <= 599) return status;
  }
  if (error instanceof LiaConfigurationError) return 503;
  if (error instanceof CloudflareAiError) {
    if (error.status === 429) return 429;
    if (error.status === 504) return 504;
    return 502;
  }
  return 500;
}

function errorPayload(error: unknown): { error: string; code?: string } {
  if (error instanceof CloudflareAiError) {
    return {
      error: "Layanan AI sedang tidak dapat diakses. Silakan coba lagi beberapa saat lagi.",
      code: `provider_${error.status}`,
    };
  }
  if (error instanceof LiaConfigurationError) {
    return {
      error: "Layanan LIA belum dikonfigurasi di server. Hubungi administrator sistem.",
      code: "not_configured",
    };
  }
  if (error instanceof Error) {
    const code = "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
    return { error: error.message || "Terjadi kesalahan pada LIA.", code };
  }
  return { error: "Terjadi kesalahan pada LIA." };
}

function writeSse(res: Response, event: LiaStreamEvent): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function runNonStreaming(req: Request, res: Response, body: z.infer<typeof chatBodySchema>): Promise<void> {
  const actor = requestActor(req);
  const events: LiaStreamEvent[] = [];
  let content = "";

  for await (const event of runLiaChat({
    message: body.message,
    conversationId: body.conversationId,
    sessionId: body.sessionId,
    context: normalizeContext(body.context, body.context?.path),
  }, actor)) {
    events.push(event);
    if (event.type === "delta") content += event.text;
  }

  const done = events.find((event) => event.type === "done");
  const meta = events.find((event) => event.type === "meta");
  if (!done || done.type !== "done") {
    res.status(500).json({ error: "LIA tidak menyelesaikan respons." });
    return;
  }

  const result: LiaChatResult = {
    conversationId: done.conversationId,
    assistantMessageId: done.messageId,
    content,
    citations: done.citations,
    toolExecutions: done.toolExecutions,
    usage: done.usage,
    model: done.model,
    finishReason: done.finishReason,
    durationMs: done.durationMs,
  };

  if (req.user && meta && meta.type === "meta") {
    try {
      await recordAudit(req, "lia.chat", "ai_conversation", meta.conversationId, {
        mode: meta.mode,
        model: done.model,
        toolNames: done.toolExecutions.map((tool) => tool.name),
        totalTokens: done.usage.totalTokens,
      });
    } catch {
      // Audit failure must not break the response.
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({ ...result, mode: meta?.type === "meta" ? meta.mode : actor.mode });
}

/**
 * POST /api/ai/chat
 * Streams Server-Sent Events by default; `stream: false` returns JSON for
 * integrations and smoke tests.
 */
router.post("/ai/chat", optionalAuthenticate, aiChatRateLimit, async (req, res): Promise<void> => {
  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Permintaan chat tidak valid.", code: "invalid_request" });
    return;
  }

  const body = parsed.data;
  const stream = body.stream !== false;

  try {
    // Validate message length before opening the SSE response.
    sanitizeUserMessage(body.message);

    if (!stream) {
      await runNonStreaming(req, res, body);
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const controller = new AbortController();
    const heartbeat = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) res.write(": keep-alive\n\n");
    }, 15_000);

    let finished = false;
    let conversationId: number | null = null;
    let mode: string | null = null;
    let model: string | null = null;
    let toolNames: string[] = [];
    let totalTokens = 0;

    res.on("close", () => {
      if (!finished) controller.abort();
    });

    try {
      for await (const event of runLiaChat({
        message: body.message,
        conversationId: body.conversationId,
        sessionId: body.sessionId,
        context: normalizeContext(body.context, body.context?.path),
        signal: controller.signal,
        stream: true,
      }, requestActor(req))) {
        if (res.writableEnded || res.destroyed) break;
        writeSse(res, event);
        if (event.type === "meta") {
          conversationId = event.conversationId;
          mode = event.mode;
          model = event.model;
        } else if (event.type === "done") {
          toolNames = event.toolExecutions.map((tool) => tool.name);
          totalTokens = event.usage.totalTokens;
        }
      }
      finished = true;

      if (req.user && conversationId !== null) {
        try {
          await recordAudit(req, "lia.chat", "ai_conversation", conversationId, {
            mode,
            model,
            toolNames,
            totalTokens,
          });
        } catch {
          // Audit failure must not break the stream.
        }
      }
    } catch (error) {
      finished = true;
      const payload = errorPayload(error);
      if (!res.writableEnded) {
        writeSse(res, {
          type: "error",
          message: payload.error,
          code: payload.code,
        });
        res.end();
      }
      if (statusForError(error) >= 500) {
        // Logged by orchestrator; avoid leaking provider details to clients.
      }
    } finally {
      clearInterval(heartbeat);
      finished = true;
      if (!res.writableEnded) res.end();
    }
  } catch (error) {
    const payload = errorPayload(error);
    if (!res.headersSent) {
      res.status(statusForError(error)).json(payload);
      return;
    }
    if (!res.writableEnded) {
      writeSse(res, { type: "error", message: payload.error, code: payload.code });
      res.end();
    }
  }
});

router.get("/ai/conversations", optionalAuthenticate, async (req, res): Promise<void> => {
  try {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
    const conversations = await listConversations(requestActor(req), sessionId);
    res.setHeader("Cache-Control", "no-store");
    res.json({ conversations });
  } catch (error) {
    res.status(statusForError(error)).json(errorPayload(error));
  }
});

router.get("/ai/conversations/:id", optionalAuthenticate, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const conversationId = parsePositiveInt(raw);
  if (conversationId === null) {
    res.status(400).json({ error: "ID percakapan tidak valid." });
    return;
  }

  try {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
    const detail = await getConversationDetail(requestActor(req), conversationId, sessionId);
    res.setHeader("Cache-Control", "no-store");
    res.json(detail);
  } catch (error) {
    res.status(statusForError(error)).json(errorPayload(error));
  }
});

router.delete("/ai/conversations/:id", optionalAuthenticate, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const conversationId = parsePositiveInt(raw);
  if (conversationId === null) {
    res.status(400).json({ error: "ID percakapan tidak valid." });
    return;
  }

  try {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
    await deleteConversation(requestActor(req), conversationId, sessionId);
    if (req.user) {
      try {
        await recordAudit(req, "lia.conversation.delete", "ai_conversation", conversationId);
      } catch {
        // Audit failure must not break deletion.
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true });
  } catch (error) {
    res.status(statusForError(error)).json(errorPayload(error));
  }
});

router.get("/ai/suggestions", optionalAuthenticate, (req, res): void => {
  const actor = requestActor(req);
  const module = typeof req.query.module === "string" ? req.query.module : "general";
  const resolvedModule = LIA_CONTEXT_MODULES[module] ? module : "general";
  res.setHeader("Cache-Control", "no-store");
  res.json({
    mode: actor.mode,
    module: resolvedModule,
    suggestions: suggestionsFor(actor.mode, resolvedModule),
  });
});

router.get("/ai/usage", optionalAuthenticate, async (req, res): Promise<void> => {
  try {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
    const actor = requestActor(req);
    const stats = await getUsageStats(actor, sessionId);
    let limits: { windowSeconds: number; requestsPerWindow: number };
    try {
      const config = getLiaConfig();
      limits = {
        windowSeconds: Math.round(config.rateLimitWindowMs / 1000),
        requestsPerWindow: actor.userId === null
          ? config.anonymousRateLimit
          : actor.role === "public"
            ? config.authenticatedRateLimit
            : config.staffRateLimit,
      };
    } catch {
      limits = { windowSeconds: 60, requestsPerWindow: 0 };
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ ...stats, mode: actor.mode, limits });
  } catch (error) {
    res.status(statusForError(error)).json(errorPayload(error));
  }
});

router.get("/ai/health", (_req, res): void => {
  try {
    const config = getLiaConfig();
    res.json({
      status: "configured",
      provider: config.provider,
      model: config.model,
      capabilities: {
        streaming: true,
        toolCalling: true,
        rag: true,
        publicMode: true,
        bpbdMode: true,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "not_configured",
      error: error instanceof Error ? error.message : "LIA belum dikonfigurasi.",
    });
  }
});

export default router;
