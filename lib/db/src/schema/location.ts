import { pgTable, serial, text, real, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const riskLevelEnum = pgEnum("risk_level", ["normal", "watch", "alert", "danger"]);
export const locationStatusEnum = pgEnum("location_status", ["active", "inactive", "maintenance"]);

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  district: text("district").notNull(),
  province: text("province").notNull().default("Central Java"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  elevation: real("elevation"),
  riskLevel: riskLevelEnum("risk_level").notNull().default("normal"),
  status: locationStatusEnum("status").notNull().default("active"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLocationSchema = createInsertSchema(locationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locationsTable.$inferSelect;
