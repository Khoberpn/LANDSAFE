import { pgTable, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const measurementsTable = pgTable("measurements", {
  id: serial("id").primaryKey(),
  sensorId: integer("sensor_id").notNull(),
  locationId: integer("location_id"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  rainfall: real("rainfall"),
  soilMoisture: real("soil_moisture"),
  tiltAngle: real("tilt_angle"),
  acceleration: real("acceleration"),
  temperature: real("temperature"),
  humidity: real("humidity"),
  batteryVoltage: real("battery_voltage"),
  solarCharging: real("solar_charging"),
  signalQuality: real("signal_quality"),
});

export const insertMeasurementSchema = createInsertSchema(measurementsTable).omit({ id: true });
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurementsTable.$inferSelect;
