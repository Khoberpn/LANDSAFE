-- LANDSAFE Intelligence Assistant (LIA) schema
-- Safe to run more than once. Only creates LIA-owned objects; it does not
-- alter existing LANDSAFE tables.

DO $$
BEGIN
  CREATE TYPE lia_mode AS ENUM ('public', 'bpbd_copilot');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE lia_message_role AS ENUM ('user', 'assistant', 'system', 'tool');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS lia_conversations (
  id serial PRIMARY KEY,
  user_id integer,
  session_id text NOT NULL,
  title text NOT NULL DEFAULT 'Percakapan Baru',
  mode lia_mode NOT NULL DEFAULT 'public',
  context_module text DEFAULT 'dashboard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lia_conversations_user_idx
  ON lia_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS lia_conversations_session_idx
  ON lia_conversations (session_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS lia_messages (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL,
  role lia_message_role NOT NULL,
  content text NOT NULL,
  thought text,
  citations jsonb DEFAULT '[]'::jsonb,
  tool_calls jsonb DEFAULT '[]'::jsonb,
  data_summary jsonb DEFAULT '{}'::jsonb,
  is_simulated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lia_messages_conversation_idx
  ON lia_messages (conversation_id, id);

CREATE TABLE IF NOT EXISTS lia_usage_logs (
  id serial PRIMARY KEY,
  user_id integer,
  session_id text,
  conversation_id integer,
  mode text NOT NULL,
  model text NOT NULL DEFAULT '@cf/qwen/qwen3.8-27b',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_code text,
  tool_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Upgrade path for installations that already created a partial LIA schema.
ALTER TABLE lia_usage_logs ADD COLUMN IF NOT EXISTS conversation_id integer;
ALTER TABLE lia_usage_logs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success';
ALTER TABLE lia_usage_logs ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE lia_usage_logs ADD COLUMN IF NOT EXISTS tool_names jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE lia_usage_logs ADD COLUMN IF NOT EXISTS estimated boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS lia_usage_logs_user_idx
  ON lia_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lia_usage_logs_session_idx
  ON lia_usage_logs (session_id, created_at DESC);
