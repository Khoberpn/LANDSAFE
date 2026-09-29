import { pgTable, serial, integer, text, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportTypeEnum = pgEnum("report_type", ["daily", "weekly", "monthly", "annual"]);
export const reportStatusEnum = pgEnum("report_status", ["generating", "ready", "failed"]);

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  reportType: reportTypeEnum("report_type").notNull(),
  title: text("title").notNull(),
  period: text("period").notNull(),
  status: reportStatusEnum("status").notNull().default("generating"),
  locationId: integer("location_id"),
  generatedBy: integer("generated_by"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
