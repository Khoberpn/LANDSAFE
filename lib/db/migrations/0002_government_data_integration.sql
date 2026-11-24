-- ============================================================================
-- LANDSAFE Autonomous Government Data Discovery, Acquisition & Integration
-- Migration 0002: Unified Multi-Source Data Architecture
-- Fully additive and idempotent. Safe to execute multiple times.
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE source_verification_status AS ENUM (
    'discovered',
    'verified_public',
    'verified_authenticated',
    'access_required',
    'access_pending',
    'partially_accessible',
    'temporarily_unavailable',
    'deprecated',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ingestion_run_status AS ENUM (
    'running',
    'completed',
    'failed',
    'partially_failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE data_quality_severity AS ENUM (
    'info',
    'warning',
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE hazard_category AS ENUM (
    'earthquake',
    'weather',
    'flood',
    'landslide',
    'volcanic',
    'tsunami',
    'drought',
    'fire'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Extend data_sources table with operational government metadata
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'discovered';
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'none';
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS license text;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS attribution text;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS documentation_url text;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS geographic_coverage text DEFAULT 'Nasional';
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS last_success_at timestamptz;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS circuit_breaker_state text NOT NULL DEFAULT 'closed';

-- 2. Data Source Resources Table (individual endpoints)
CREATE TABLE IF NOT EXISTS data_source_resources (
  id serial PRIMARY KEY,
  source_id integer NOT NULL,
  resource_code text NOT NULL UNIQUE,
  name text NOT NULL,
  endpoint_url text NOT NULL,
  format text NOT NULL DEFAULT 'json',
  protocol text NOT NULL DEFAULT 'https',
  update_frequency text NOT NULL DEFAULT 'hourly',
  status text NOT NULL DEFAULT 'active',
  auth_required boolean NOT NULL DEFAULT false,
  geographic_coverage text DEFAULT 'Nasional',
  last_sync_at timestamptz,
  last_sync_status text,
  records_ingested integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_source_resources_source_idx
  ON data_source_resources (source_id);

-- 3. Ingestion Runs (Execution tracking & health)
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id serial PRIMARY KEY,
  source_id integer NOT NULL,
  source_code text NOT NULL,
  resource_code text,
  run_type text NOT NULL DEFAULT 'scheduled',
  status ingestion_run_status NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  records_fetched integer NOT NULL DEFAULT 0,
  records_inserted integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  http_status integer,
  error_message text,
  initiated_by integer,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ingestion_runs_source_idx
  ON ingestion_runs (source_id, started_at DESC);

-- 4. Layer 1: Raw Ingestion Records (Full payload traceability)
CREATE TABLE IF NOT EXISTS raw_ingestion_records (
  id serial PRIMARY KEY,
  run_id integer NOT NULL,
  source_code text NOT NULL,
  resource_code text NOT NULL,
  external_id text,
  url text NOT NULL,
  payload_json jsonb,
  payload_text text,
  checksum text NOT NULL,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raw_records_run_idx ON raw_ingestion_records (run_id);
CREATE INDEX IF NOT EXISTS raw_records_checksum_idx ON raw_ingestion_records (checksum);
CREATE INDEX IF NOT EXISTS raw_records_source_external_idx ON raw_ingestion_records (source_code, external_id);

-- 5. Layer 2: Standardized Hazard Events
CREATE TABLE IF NOT EXISTS standardized_hazard_events (
  id serial PRIMARY KEY,
  event_code text NOT NULL UNIQUE,
  hazard_category hazard_category NOT NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'moderate',
  source_agency text NOT NULL,
  source_code text NOT NULL,
  raw_record_id integer,
  occurred_at timestamptz NOT NULL,
  latitude real,
  longitude real,
  depth_km real,
  magnitude real,
  region_name text,
  province text,
  district text,
  affected_people integer,
  casualties integer,
  damage_summary text,
  tsunami_potential boolean DEFAULT false,
  shakemap_url text,
  is_official_observation boolean NOT NULL DEFAULT true,
  confidence_score real NOT NULL DEFAULT 1.0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hazard_events_occurred_idx ON standardized_hazard_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS hazard_events_category_idx ON standardized_hazard_events (hazard_category);
CREATE INDEX IF NOT EXISTS hazard_events_source_idx ON standardized_hazard_events (source_code);

-- 6. Layer 2: Standardized Weather Observations & Forecasts
CREATE TABLE IF NOT EXISTS standardized_weather_observations (
  id serial PRIMARY KEY,
  source_code text NOT NULL,
  adm_code text NOT NULL,
  location_name text NOT NULL,
  kecamatan text,
  regency text,
  province text NOT NULL DEFAULT 'Jawa Tengah',
  latitude real,
  longitude real,
  observation_time timestamptz NOT NULL,
  temperature_c real,
  humidity_percent real,
  rainfall_mm real DEFAULT 0,
  weather_code integer,
  weather_desc text,
  wind_speed_kph real,
  wind_direction text,
  is_forecast boolean NOT NULL DEFAULT false,
  forecast_horizon_hours integer DEFAULT 0,
  raw_record_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weather_obs_time_idx ON standardized_weather_observations (observation_time DESC);
CREATE INDEX IF NOT EXISTS weather_obs_adm_idx ON standardized_weather_observations (adm_code);

-- 7. Data Quality Issues
CREATE TABLE IF NOT EXISTS data_quality_issues (
  id serial PRIMARY KEY,
  run_id integer,
  source_code text NOT NULL,
  rule_name text NOT NULL,
  severity data_quality_severity NOT NULL,
  message text NOT NULL,
  field text,
  raw_record_id integer,
  sample_value text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Layer 3: Cross-Source Correlations & Reconciliations
CREATE TABLE IF NOT EXISTS cross_source_correlations (
  id serial PRIMARY KEY,
  primary_event_type text NOT NULL,
  primary_event_id integer NOT NULL,
  correlated_event_type text NOT NULL,
  correlated_event_id integer NOT NULL,
  correlation_type text NOT NULL,
  confidence_score real NOT NULL DEFAULT 0.85,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
