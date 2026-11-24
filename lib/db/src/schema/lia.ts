import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const liaModeEnum = pgEnum("lia_mode", ["public", "bpbd_copilot"]);
export const liaMessageRoleEnum = pgEnum("lia_message_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);

export const liaConversationsTable = pgTable("lia_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  sessionId: text("session_id").notNull(),
  title: text("title").notNull().default("Percakapan Baru"),
  mode: liaModeEnum("mode").notNull().default("public"),
  contextModule: text("context_module").default("dashboard"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const liaMessagesTable = pgTable("lia_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: liaMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  thought: text("thought"),
  citations: jsonb("citations")
    .$type<
      Array<{
        source: string;
        title: string;
        timestamp?: string;
        retrievedAt?: string;
        dataAsOf?: string;
        type: "official_data" | "sensor_telemetry" | "regulation" | "simulation" | "guideline";
        isSimulated?: boolean;
        url?: string;
        documentId?: string;
      }>
    >()
    .default([]),
  toolCalls: jsonb("tool_calls").$type<Array<Record<string, unknown>>>().default([]),
  dataSummary: jsonb("data_summary").$type<Record<string, unknown>>().default({}),
  isSimulated: boolean("is_simulated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const liaUsageLogsTable = pgTable("lia_usage_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  sessionId: text("session_id"),
  conversationId: integer("conversation_id"),
  mode: text("mode").notNull(),
  model: text("model").notNull().default("@cf/qwen/qwen3.8-27b"),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  status: text("status").notNull().default("success"),
  errorCode: text("error_code"),
  toolNames: jsonb("tool_names").$type<string[]>().notNull().default([]),
  estimated: boolean("estimated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type LiaConversation = typeof liaConversationsTable.$inferSelect;
export type InsertLiaConversation = typeof liaConversationsTable.$inferInsert;
export type LiaMessage = typeof liaMessagesTable.$inferSelect;
export type InsertLiaMessage = typeof liaMessagesTable.$inferInsert;
export type LiaUsageLog = typeof liaUsageLogsTable.$inferSelect;
export type InsertLiaUsageLog = typeof liaUsageLogsTable.$inferInsert;
