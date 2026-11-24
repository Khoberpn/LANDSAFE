import { pool } from "@workspace/db";
import { logger } from "../logger";

/**
 * Initializes LIA tables if they don't already exist.
 * This guarantees zero downtime and avoids migration hurdles.
 */
export async function initLiaDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        DO $$ BEGIN
          CREATE TYPE lia_mode AS ENUM ('public', 'bpbd_copilot');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;

        DO $$ BEGIN
          CREATE TYPE lia_message_role AS ENUM ('user', 'assistant', 'system', 'tool');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;

        CREATE TABLE IF NOT EXISTS lia_conversations (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          session_id TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT 'Percakapan Baru',
          mode lia_mode NOT NULL DEFAULT 'public',
          context_module TEXT DEFAULT 'dashboard',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS lia_messages (
          id SERIAL PRIMARY KEY,
          conversation_id INTEGER NOT NULL,
          role lia_message_role NOT NULL,
          content TEXT NOT NULL,
          thought TEXT,
          citations JSONB DEFAULT '[]'::jsonb,
          tool_calls JSONB DEFAULT '[]'::jsonb,
          data_summary JSONB DEFAULT '{}'::jsonb,
          is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS lia_usage_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          session_id TEXT,
          mode TEXT NOT NULL,
          model TEXT NOT NULL DEFAULT '@cf/qwen/qwen3.8-27b',
          prompt_tokens INTEGER NOT NULL DEFAULT 0,
          completion_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_lia_conv_user ON lia_conversations(user_id);
        CREATE INDEX IF NOT EXISTS idx_lia_conv_session ON lia_conversations(session_id);
        CREATE INDEX IF NOT EXISTS idx_lia_msg_conv ON lia_messages(conversation_id);
      `);
      logger.info("LIA database tables initialized successfully");
    } finally {
      client.release();
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "Could not auto-create LIA tables (might be handled by in-memory fallback)");
  }
}
