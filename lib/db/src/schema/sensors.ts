import { pgTable, serial, text, real, integer, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sensorTypeEnum = pgEnum("sensor_type", ["rainfall", "soil_moisture", "tilt", "acceleration", "temperature", "humidity", "battery_voltage", "solar_charging", "all_in_one"]);
export const sensorStatusEnum = pgEnum("sensor_status", ["online", "offline", "maintenance", "calibration"]);

export const sensorsTable = pgTable("sensors", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull(),
  sensorCode: text("sensor_code").notNull().unique(),
  sensorType: sensorTypeEnum("sensor_type").notNull(),
  status: sensorStatusEnum("status").notNull().default("online"),
  batteryLevel: real("battery_level").notNull().default(100),
  signalStrength: real("signal_strength").notNull().default(100),
  firmwareVersion: text("firmware_version").default("v1.0.0"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSensorSchema = createInsertSchema(sensorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSensor = z.infer<typeof insertSensorSchema>;
export type Sensor = typeof sensorsTable.$inferSelect;
