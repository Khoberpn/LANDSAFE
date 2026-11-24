import type { Request, Response, NextFunction } from "express";
import { getLiaConfig } from "../lib/lia/config";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Small in-process limiter for the chat endpoint. A production deployment
 * with multiple API instances should replace this with a shared store.
 */
export function aiChatRateLimit(req: Request, res: Response, next: NextFunction): void {
  let config;
  try {
    config = getLiaConfig();
  } catch {
    res.status(503).json({ error: "Layanan LIA belum dikonfigurasi." });
    return;
  }

  const now = Date.now();
  sweep(now);

  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const identity = req.user?.userId
    ? `user:${req.user.userId}`
    : `anon:${ip}`;
  const limit = req.user
    ? req.user.role === "public"
      ? config.authenticatedRateLimit
      : config.staffRateLimit
    : config.anonymousRateLimit;

  const existing = buckets.get(identity);
  if (!existing || existing.resetAt <= now) {
    buckets.set(identity, { count: 1, resetAt: now + config.rateLimitWindowMs });
    res.setHeader("X-LIA-RateLimit-Limit", String(limit));
    res.setHeader("X-LIA-RateLimit-Remaining", String(Math.max(0, limit - 1)));
    next();
    return;
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  res.setHeader("X-LIA-RateLimit-Limit", String(limit));
  res.setHeader("X-LIA-RateLimit-Remaining", String(remaining));

  if (existing.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: "Terlalu banyak permintaan ke LIA. Silakan tunggu sebentar lalu coba lagi.",
      retryAfter,
    });
    return;
  }

  next();
}
