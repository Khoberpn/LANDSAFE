import { pgTable, serial, integer, text, real, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deviceStatusEnum = pgEnum("device_status", ["online", "offline", "maintenance", "calibration"]);

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  locationId: integer("location_id").notNull(),
  firmwareVersion: text("firmware_version").notNull().default("v1.0.0"),
  status: deviceStatusEnum("status").notNull().default("online"),
  batteryLevel: real("battery_level").notNull().default(100),
  signalStrength: real("signal_strength").notNull().default(100),
  lastCommunication: timestamp("last_communication", { withTimezone: true }).notNull().defaultNow(),
  installationDate: timestamp("installation_date", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
