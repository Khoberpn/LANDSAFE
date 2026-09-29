import { pgTable, serial, integer, text, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alertTypeEnum = pgEnum("alert_type", ["threshold_exceeded", "rainfall_warning", "sensor_offline", "battery_low", "ground_movement", "earthquake", "emergency_notification"]);
export const alertPriorityEnum = pgEnum("alert_priority", ["critical", "high", "medium", "low"]);
export const alertStatusEnum = pgEnum("alert_status", ["active", "acknowledged", "resolved"]);

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull(),
  alertType: alertTypeEnum("alert_type").notNull(),
  priority: alertPriorityEnum("priority").notNull(),
  status: alertStatusEnum("status").notNull().default("active"),
  message: text("message").notNull(),
  operatorId: integer("operator_id"),
  operatorNote: text("operator_note"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;
