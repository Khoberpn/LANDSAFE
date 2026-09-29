import { pgTable, serial, integer, real, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const predictionRiskLevelEnum = pgEnum("prediction_risk_level", ["normal", "watch", "alert", "danger"]);

export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull(),
  riskLevel: predictionRiskLevelEnum("risk_level").notNull().default("normal"),
  probability: real("probability").notNull().default(0),
  confidence: real("confidence").notNull().default(0),
  potentialTriggers: text("potential_triggers").array().notNull().default([]),
  recommendedActions: text("recommended_actions").array().notNull().default([]),
  evacuationSuggested: boolean("evacuation_suggested").notNull().default(false),
  explanation: text("explanation").notNull().default(""),
  historicalSimilarEvents: integer("historical_similar_events").notNull().default(0),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPredictionSchema = createInsertSchema(predictionsTable).omit({ id: true });
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictionsTable.$inferSelect;
