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

/**
 * Schema for the three LANDSAFE enhancement modules:
 *  1. Risk & vulnerability assessment + scenario impact analysis
 *  2. Data integration hub
 *  3. Mitigation planning, recommendations and evacuation resources
 *
 * Foreign keys are intentionally not declared (matches the rest of the
 * codebase, which keeps relations in application code).
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export const hazardTypeEnum = pgEnum("hazard_type", [
  "flood",
  "landslide",
  "earthquake",
  "volcanic",
  "tsunami",
  "drought",
  "strong_wind",
]);

export const riskClassEnum = pgEnum("risk_class", ["low", "moderate", "high", "extreme"]);

export const planStatusEnum = pgEnum("plan_status", [
  "draft",
  "review",
  "approved",
  "published",
  "archived",
]);

export const actionStatusEnum = pgEnum("action_status", [
  "planned",
  "in_progress",
  "completed",
  "on_hold",
]);

export const dataAgencyEnum = pgEnum("data_agency", [
  "bmkg",
  "pvmbg",
  "bnpb_bpbd",
  "iot_sensor",
  "geospatial",
]);

export const dataSourceStatusEnum = pgEnum("data_source_status", [
  "connected",
  "degraded",
  "unavailable",
  "simulated",
]);

export const integrationTypeEnum = pgEnum("integration_type", [
  "api",
  "file_import",
  "manual",
  "simulated",
]);

export const facilityTypeEnum = pgEnum("facility_type", [
  "shelter",
  "assembly_point",
  "hospital",
  "health_center",
  "command_post",
  "evacuation_route",
]);

export const facilityStatusEnum = pgEnum("facility_status", [
  "operational",
  "limited",
  "full",
  "closed",
]);

// ─── 1. Risk & vulnerability assessment ──────────────────────────────────────

/**
 * One row per administrative region + hazard combination. Indices use a 0–100
 * scale (higher index = more hazard / exposure / vulnerability, higher capacity
 * index = better coping capacity). `riskScore` is the transparent composite
 * computed by `api-server/src/lib/risk-model.ts`.
 */
export const riskAssessmentsTable = pgTable("risk_assessments", {
  id: serial("id").primaryKey(),
  regionName: text("region_name").notNull(),
  regionCode: text("region_code"),
  province: text("province").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  /** Approximate administrative extent radius, used for map rendering. */
  extentKm: real("extent_km").notNull().default(15),
  hazardType: hazardTypeEnum("hazard_type").notNull(),
  hazardIndex: real("hazard_index").notNull(),
  exposureIndex: real("exposure_index").notNull(),
  vulnerabilityIndex: real("vulnerability_index").notNull(),
  capacityIndex: real("capacity_index").notNull(),
  riskScore: real("risk_score").notNull(),
  riskClass: riskClassEnum("risk_class").notNull(),
  population: integer("population").notNull().default(0),
  exposedPopulation: integer("exposed_population").notNull().default(0),
  exposedFacilities: integer("exposed_facilities").notNull().default(0),
  exposedRoadsKm: real("exposed_roads_km").notNull().default(0),
  /** Sub-indicator breakdown shown in the assessment detail panel. */
  indicators: jsonb("indicators").$type<Record<string, unknown>>().notNull().default({}),
  /** Dataset names that fed the assessment (provenance). */
  sources: jsonb("sources").$type<string[]>().notNull().default([]),
  verified: boolean("verified").notNull().default(false),
  verifiedBy: integer("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  assessedAt: timestamp("assessed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * Hypothetical impact scenarios. These are always simulations — never event
 * predictions — and the API/UI label them as such.
 */
export const scenariosTable = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hazardType: hazardTypeEnum("hazard_type").notNull(),
  assessmentId: integer("assessment_id").notNull(),
  regionName: text("region_name").notNull(),
  /** User-configured hypothetical parameters (intensity, rainfall, season...). */
  parameters: jsonb("parameters").$type<Record<string, unknown>>().notNull().default({}),
  /** Computed impact estimates for the scenario. */
  results: jsonb("results").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("completed"),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── 2. Data integration hub ─────────────────────────────────────────────────

export const dataSourcesTable = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  agency: dataAgencyEnum("agency").notNull(),
  category: text("category").notNull(),
  integrationType: integrationTypeEnum("integration_type").notNull(),
  status: dataSourceStatusEnum("status").notNull().default("simulated"),
  endpointUrl: text("endpoint_url"),
  updateFrequency: text("update_frequency").notNull().default("hourly"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status"),
  recordsAvailable: integer("records_available").notNull().default(0),
  completeness: real("completeness").notNull().default(0),
  duplicateRate: real("duplicate_rate").notNull().default(0),
  owner: text("owner"),
  description: text("description"),
  verificationStatus: text("verification_status").notNull().default("discovered"),
  authType: text("auth_type").notNull().default("none"),
  license: text("license"),
  attribution: text("attribution"),
  documentationUrl: text("documentation_url"),
  geographicCoverage: text("geographic_coverage").default("Nasional"),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  circuitBreakerState: text("circuit_breaker_state").notNull().default("closed"),
  /** True when the dataset shipped with the demo and is not an official feed. */
  isSimulated: boolean("is_simulated").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const integrationLogsTable = pgTable("integration_logs", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  level: text("level").notNull().default("info"),
  event: text("event").notNull(),
  message: text("message").notNull(),
  recordsProcessed: integer("records_processed").notNull().default(0),
  invalidRecords: integer("invalid_records").notNull().default(0),
  durationMs: integer("duration_ms"),
  actorId: integer("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── 3. Mitigation planning & evacuation resources ───────────────────────────

export const mitigationPlansTable = pgTable("mitigation_plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  regionName: text("region_name").notNull(),
  province: text("province").notNull().default("Central Java"),
  hazardType: hazardTypeEnum("hazard_type").notNull(),
  assessmentId: integer("assessment_id"),
  status: planStatusEnum("status").notNull().default("draft"),
  /** Publishable narrative shown on the public portal once published. */
  publicSummary: text("public_summary"),
  /** Internal working notes — never exposed publicly. */
  internalNotes: text("internal_notes"),
  leadAgency: text("lead_agency").notNull(),
  budgetTotal: real("budget_total").notNull().default(0),
  timelineStart: timestamp("timeline_start", { withTimezone: true }),
  timelineEnd: timestamp("timeline_end", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdBy: integer("created_by"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const mitigationActionsTable = pgTable("mitigation_actions", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("structural"),
  responsibleAgency: text("responsible_agency").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  budget: real("budget").notNull().default(0),
  progress: integer("progress").notNull().default(0),
  status: actionStatusEnum("status").notNull().default("planned"),
  /** Weighted priority score (0–100) and the transparent criteria behind it. */
  priorityScore: real("priority_score").notNull().default(0),
  criteria: jsonb("criteria").$type<Record<string, number>>().notNull().default({}),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const facilitiesTable = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: facilityTypeEnum("type").notNull(),
  regionName: text("region_name").notNull(),
  province: text("province").notNull().default("Central Java"),
  address: text("address"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  capacity: integer("capacity").notNull().default(0),
  /** Current occupancy — internal operational data, not public. */
  occupancy: integer("occupancy").notNull().default(0),
  amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
  status: facilityStatusEnum("status").notNull().default("operational"),
  isPublic: boolean("is_public").notNull().default(true),
  contact: text("contact"),
  operatingAgency: text("operating_agency"),
  /** Internal operational notes — stripped from public responses. */
  notes: text("notes"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const resourcesTable = pgTable("resources", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  quantity: integer("quantity").notNull().default(0),
  unit: text("unit").notNull().default("unit"),
  regionName: text("region_name").notNull(),
  facilityId: integer("facility_id"),
  condition: text("condition").notNull().default("good"),
  allocationStatus: text("allocation_status").notNull().default("available"),
  notes: text("notes"),
  updatedBy: integer("updated_by"),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const preparednessGuidelinesTable = pgTable("preparedness_guidelines", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  audience: text("audience").notNull().default("public"),
  summary: text("summary").notNull(),
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  isPublic: boolean("is_public").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RiskAssessment = typeof riskAssessmentsTable.$inferSelect;
export type Scenario = typeof scenariosTable.$inferSelect;
export type DataSource = typeof dataSourcesTable.$inferSelect;
export type IntegrationLog = typeof integrationLogsTable.$inferSelect;
export type MitigationPlan = typeof mitigationPlansTable.$inferSelect;
export type MitigationAction = typeof mitigationActionsTable.$inferSelect;
export type Facility = typeof facilitiesTable.$inferSelect;
export type Resource = typeof resourcesTable.$inferSelect;
export type PreparednessGuideline = typeof preparednessGuidelinesTable.$inferSelect;
