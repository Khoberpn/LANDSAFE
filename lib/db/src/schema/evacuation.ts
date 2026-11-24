import {
  pgTable,
  serial,
  integer,
  real,
  text,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { hazardTypeEnum } from "./modules";

/**
 * Schema for the Evacuation Route Intelligence module.
 *
 * Foreign keys are intentionally application-level (matches the rest of the
 * LANDSAFE codebase). Coordinates stored as real columns (no PostGIS).
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export const routeTypeEnum = pgEnum("route_type", ["primary", "alternative"]);
export const route_type_enum = routeTypeEnum;

export const hazardExposureEnum = pgEnum("hazard_exposure", [
  "none",
  "low",
  "moderate",
  "high",
]);
export const hazard_exposure_enum = hazardExposureEnum;

export const routeStatusEnum = pgEnum("route_status", [
  "draft",
  "analysis",
  "field_verification",
  "review",
  "approved",
  "published",
  "archived",
]);
export const route_status_enum = routeStatusEnum;

export const roadConditionEnum = pgEnum("road_condition", [
  "good",
  "fair",
  "poor",
  "damaged",
  "impassable",
  "unknown",
]);
export const road_condition_enum = roadConditionEnum;

// ─── 1. Evacuation Routes ───────────────────────────────────────────────────

export const evacuationRoutesTable = pgTable("evacuation_routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  routeCode: text("route_code").notNull().unique(),
  originName: text("origin_name").notNull(),
  originLatitude: real("origin_latitude").notNull(),
  originLongitude: real("origin_longitude").notNull(),
  destinationName: text("destination_name").notNull(),
  destinationLatitude: real("destination_latitude").notNull(),
  destinationLongitude: real("destination_longitude").notNull(),
  destinationFacilityId: integer("destination_facility_id"),
  regionName: text("region_name").notNull(),
  province: text("province").notNull().default("Central Java"),
  hazardType: hazardTypeEnum("hazard_type").notNull(),
  routeType: routeTypeEnum("route_type").notNull().default("primary"),
  distanceKm: real("distance_km").notNull().default(0),
  estimatedTimeMinutes: integer("estimated_time_minutes").notNull().default(0),
  maxCapacityPersons: integer("max_capacity_persons").notNull().default(0),
  elevationGainM: real("elevation_gain_m").default(0),
  roadSurface: text("road_surface"),
  isAccessible: boolean("is_accessible").notNull().default(false),
  hazardExposure: hazardExposureEnum("hazard_exposure").notNull().default("none"),
  routeStatus: routeStatusEnum("route_status").notNull().default("draft"),
  routeGeometry: jsonb("route_geometry")
    .$type<Array<[number, number]>>()
    .notNull()
    .default([]),
  evaluationNotes: text("evaluation_notes"),
  publicDescription: text("public_description"),
  createdBy: integer("created_by"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ─── 2. Route Segments ──────────────────────────────────────────────────────

export const routeSegmentsTable = pgTable("route_segments", {
  id: serial("id").primaryKey(),
  routeId: integer("route_id").notNull(),
  segmentOrder: integer("segment_order").notNull().default(0),
  name: text("name").notNull(),
  startLatitude: real("start_latitude").notNull(),
  startLongitude: real("start_longitude").notNull(),
  endLatitude: real("end_latitude").notNull(),
  endLongitude: real("end_longitude").notNull(),
  distanceKm: real("distance_km").notNull().default(0),
  roadCondition: roadConditionEnum("road_condition")
    .notNull()
    .default("unknown"),
  roadWidth: text("road_width"),
  hazardNotes: text("hazard_notes"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockageReason: text("blockage_reason"),
  lastInspectedAt: timestamp("last_inspected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ─── 3. Route Verifications ─────────────────────────────────────────────────

export const routeVerificationsTable = pgTable("route_verifications", {
  id: serial("id").primaryKey(),
  routeId: integer("route_id").notNull(),
  inspectorId: integer("inspector_id").notNull(),
  inspectorName: text("inspector_name").notNull(),
  inspectionDate: timestamp("inspection_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  overallCondition: roadConditionEnum("overall_condition").notNull(),
  roadAccessible: boolean("road_accessible").notNull().default(true),
  signageAdequate: boolean("signage_adequate").notNull().default(false),
  shelterReady: boolean("shelter_ready").notNull().default(false),
  lightingAvailable: boolean("lighting_available").notNull().default(false),
  drainageAdequate: boolean("drainage_adequate").notNull().default(false),
  findings: text("findings").notNull(),
  recommendations: text("recommendations"),
  geotagPhotos: jsonb("geotag_photos")
    .$type<Array<{ url: string; latitude: number; longitude: number; caption: string }>>()
    .notNull()
    .default([]),
  gpsTrack: jsonb("gps_track").$type<Array<[number, number]>>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── 4. Evacuation Scenarios ────────────────────────────────────────────────

export const evacuationScenariosTable = pgTable("evacuation_scenarios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  hazardType: hazardTypeEnum("hazard_type").notNull(),
  regionName: text("region_name").notNull(),
  parameters: jsonb("parameters")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  candidateRoutes: jsonb("candidate_routes")
    .$type<Array<{
      routeId?: number;
      name: string;
      score: number;
      travelTime: number;
      hazardExposure: string;
      notes: string;
    }>>()
    .notNull()
    .default([]),
  recommendation: text("recommendation"),
  status: text("status").notNull().default("draft"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type EvacuationRoute = typeof evacuationRoutesTable.$inferSelect;
export type InsertEvacuationRoute = typeof evacuationRoutesTable.$inferInsert;
export type RouteSegment = typeof routeSegmentsTable.$inferSelect;
export type InsertRouteSegment = typeof routeSegmentsTable.$inferInsert;
export type RouteVerification = typeof routeVerificationsTable.$inferSelect;
export type InsertRouteVerification = typeof routeVerificationsTable.$inferInsert;
export type EvacuationScenario = typeof evacuationScenariosTable.$inferSelect;
export type InsertEvacuationScenario = typeof evacuationScenariosTable.$inferInsert;
