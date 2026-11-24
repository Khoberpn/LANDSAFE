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
  index,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const sourceVerificationStatusEnum = pgEnum("source_verification_status", [
  "discovered",
  "verified_public",
  "verified_authenticated",
  "access_required",
  "access_pending",
  "partially_accessible",
  "temporarily_unavailable",
  "deprecated",
  "rejected",
]);

export const ingestionRunStatusEnum = pgEnum("ingestion_run_status", [
  "running",
  "completed",
  "failed",
  "partially_failed",
]);

export const dataQualitySeverityEnum = pgEnum("data_quality_severity", [
  "info",
  "warning",
  "error",
]);

export const hazardCategoryEnum = pgEnum("hazard_category", [
  "earthquake",
  "weather",
  "flood",
  "landslide",
  "volcanic",
  "tsunami",
  "drought",
  "fire",
]);

// ─── 1. Data Source Resources Table ──────────────────────────────────────────

/**
 * Individual endpoint/resource registered under a government data source.
 * (e.g. autogempa, gempadirasakan, cuaca-wilayah under BMKG)
 */
export const dataSourceResourcesTable = pgTable("data_source_resources", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  resourceCode: text("resource_code").notNull().unique(),
  name: text("name").notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  format: text("format").notNull().default("json"), // json, xml, arcgis_rest, wms, wfs, ckan, csv, xlsx
  protocol: text("protocol").notNull().default("https"),
  updateFrequency: text("update_frequency").notNull().default("hourly"),
  status: text("status").notNull().default("active"),
  authRequired: boolean("auth_required").notNull().default(false),
  geographicCoverage: text("geographic_coverage").default("Nasional"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status"),
  recordsIngested: integer("records_ingested").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── 2. Ingestion Runs (Execution History & Auditing) ─────────────────────────

export const ingestionRunsTable = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  sourceCode: text("source_code").notNull(),
  resourceCode: text("resource_code"),
  runType: text("run_type").notNull().default("scheduled"), // scheduled, manual, retry
  status: ingestionRunStatusEnum("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  recordsFetched: integer("records_fetched").notNull().default(0),
  recordsInserted: integer("records_inserted").notNull().default(0),
  recordsUpdated: integer("records_updated").notNull().default(0),
  recordsRejected: integer("records_rejected").notNull().default(0),
  httpStatus: integer("http_status"),
  errorMessage: text("error_message"),
  initiatedBy: integer("initiated_by"), // null = automated worker
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
});

// ─── 3. Layer 1: Raw Ingestion Records ───────────────────────────────────────

/**
 * Immutable store of raw government payloads for auditing, traceability, and re-processing.
 */
export const rawIngestionRecordsTable = pgTable("raw_ingestion_records", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull(),
  sourceCode: text("source_code").notNull(),
  resourceCode: text("resource_code").notNull(),
  externalId: text("external_id"),
  url: text("url").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
  payloadText: text("payload_text"),
  checksum: text("checksum").notNull(), // SHA256 checksum for deduplication
  publishedAt: timestamp("published_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("raw_records_run_idx").on(table.runId),
  index("raw_records_checksum_idx").on(table.checksum),
  index("raw_records_source_external_idx").on(table.sourceCode, table.externalId),
]);

// ─── 4. Layer 2: Standardized Hazard Events ──────────────────────────────────

/**
 * Normalized canonical hazard events (earthquakes, floods, landslides, alerts, volcano notices).
 */
export const standardizedHazardEventsTable = pgTable("standardized_hazard_events", {
  id: serial("id").primaryKey(),
  eventCode: text("event_code").notNull().unique(), // e.g. "BMKG-EQ-20261124-1124"
  hazardCategory: hazardCategoryEnum("hazard_category").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("moderate"), // low, moderate, high, extreme
  sourceAgency: text("source_agency").notNull(), // BMKG, BNPB, PVMBG, BIG, BPBD
  sourceCode: text("source_code").notNull(),
  rawRecordId: integer("raw_record_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  depthKm: real("depth_km"),
  magnitude: real("magnitude"),
  regionName: text("region_name"),
  province: text("province"),
  district: text("district"),
  affectedPeople: integer("affected_people"),
  casualties: integer("casualties"),
  damageSummary: text("damage_summary"),
  tsunamiPotential: boolean("tsunami_potential").default(false),
  shakemapUrl: text("shakemap_url"),
  isOfficialObservation: boolean("is_official_observation").notNull().default(true),
  confidenceScore: real("confidence_score").notNull().default(1.0), // 0.0 - 1.0
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("hazard_events_occurred_idx").on(table.occurredAt),
  index("hazard_events_category_idx").on(table.hazardCategory),
  index("hazard_events_source_idx").on(table.sourceCode),
]);

// ─── 5. Layer 2: Standardized Weather Observations & Forecasts ──────────────

export const standardizedWeatherObservationsTable = pgTable("standardized_weather_observations", {
  id: serial("id").primaryKey(),
  sourceCode: text("source_code").notNull(),
  admCode: text("adm_code").notNull(), // e.g. "33.04.01.2001"
  locationName: text("location_name").notNull(),
  kecamatan: text("kecamatan"),
  regency: text("regency"), // e.g. Banjarnegara
  province: text("province").notNull().default("Jawa Tengah"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  observationTime: timestamp("observation_time", { withTimezone: true }).notNull(),
  temperatureC: real("temperature_c"),
  humidityPercent: real("humidity_percent"),
  rainfallMm: real("rainfall_mm").default(0),
  weatherCode: integer("weather_code"),
  weatherDesc: text("weather_desc"),
  windSpeedKph: real("wind_speed_kph"),
  windDirection: text("wind_direction"),
  isForecast: boolean("is_forecast").notNull().default(false),
  forecastHorizonHours: integer("forecast_horizon_hours").default(0),
  rawRecordId: integer("raw_record_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("weather_obs_time_idx").on(table.observationTime),
  index("weather_obs_adm_idx").on(table.admCode),
]);

// ─── 6. Data Quality Issues ──────────────────────────────────────────────────

export const dataQualityIssuesTable = pgTable("data_quality_issues", {
  id: serial("id").primaryKey(),
  runId: integer("run_id"),
  sourceCode: text("source_code").notNull(),
  ruleName: text("rule_name").notNull(),
  severity: dataQualitySeverityEnum("severity").notNull(),
  message: text("message").notNull(),
  field: text("field"),
  rawRecordId: integer("raw_record_id"),
  sampleValue: text("sample_value"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── 7. Layer 3: Cross-Source Correlations & Reconciliations ─────────────────

export const crossSourceCorrelationsTable = pgTable("cross_source_correlations", {
  id: serial("id").primaryKey(),
  primaryEventType: text("primary_event_type").notNull(), // e.g. "hazard_event", "iot_measurement", "risk_assessment"
  primaryEventId: integer("primary_event_id").notNull(),
  correlatedEventType: text("correlated_event_type").notNull(),
  correlatedEventId: integer("correlated_event_id").notNull(),
  correlationType: text("correlation_type").notNull(), // spatial_temporal, impact_report, early_warning_match, conflicting_report
  confidenceScore: real("confidence_score").notNull().default(0.85),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
