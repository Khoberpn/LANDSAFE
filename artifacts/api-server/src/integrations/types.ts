export type SourceVerificationStatus =
  | "discovered"
  | "verified_public"
  | "verified_authenticated"
  | "access_required"
  | "access_pending"
  | "partially_accessible"
  | "temporarily_unavailable"
  | "deprecated"
  | "rejected";

export type ConnectorHealthState = "healthy" | "degraded" | "unavailable";

export interface ConnectorMetadata {
  code: string;
  name: string;
  agency: "bmkg" | "bnpb_bpbd" | "pvmbg" | "geospatial" | "iot_sensor";
  category: string;
  officialPortalUrl: string;
  endpointUrl: string;
  protocol: string;
  format: string;
  authType: "none" | "api_key" | "bearer_token" | "oauth2";
  authRequired: boolean;
  geographicCoverage: string;
  updateFrequency: string;
  license: string;
  attribution: string;
  documentationUrl: string;
  description: string;
}

export interface HealthReport {
  code: string;
  status: ConnectorHealthState;
  verificationStatus: SourceVerificationStatus;
  lastCheckedAt: Date;
  lastSuccessAt: Date | null;
  consecutiveFailures: number;
  circuitBreakerOpen: boolean;
  httpStatus?: number;
  latencyMs?: number;
  message: string;
}

export interface RawRecordPayload {
  externalId: string;
  resourceCode: string;
  url: string;
  payload: Record<string, unknown>;
  publishedAt?: Date;
}

export interface StandardizedEventPayload {
  eventCode: string;
  hazardCategory: "earthquake" | "weather" | "flood" | "landslide" | "volcanic" | "tsunami" | "drought" | "fire";
  title: string;
  description?: string;
  severity: "low" | "moderate" | "high" | "extreme";
  occurredAt: Date;
  latitude?: number;
  longitude?: number;
  depthKm?: number;
  magnitude?: number;
  regionName?: string;
  province?: string;
  district?: string;
  affectedPeople?: number;
  casualties?: number;
  damageSummary?: string;
  tsunamiPotential?: boolean;
  shakemapUrl?: string;
  isOfficialObservation: boolean;
  confidenceScore: number;
  metadata?: Record<string, unknown>;
}

export interface StandardizedWeatherPayload {
  admCode: string;
  locationName: string;
  kecamatan?: string;
  regency?: string;
  province: string;
  latitude?: number;
  longitude?: number;
  observationTime: Date;
  temperatureC?: number;
  humidityPercent?: number;
  rainfallMm?: number;
  weatherCode?: number;
  weatherDesc?: string;
  windSpeedKph?: number;
  windDirection?: string;
  isForecast: boolean;
  forecastHorizonHours?: number;
}

export interface SyncOutcome {
  sourceCode: string;
  status: "completed" | "failed" | "partially_failed";
  recordsFetched: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsRejected: number;
  durationMs: number;
  error?: string;
  warnings?: string[];
}

export interface GovernmentConnector {
  readonly metadata: ConnectorMetadata;
  discover(): Promise<ConnectorMetadata>;
  verify(): Promise<HealthReport>;
  fetch(): Promise<unknown>;
  parse(rawPayload: unknown): Promise<RawRecordPayload[]>;
  validate(record: RawRecordPayload): boolean;
  normalize(records: RawRecordPayload[]): Promise<{
    hazardEvents?: StandardizedEventPayload[];
    weatherObservations?: StandardizedWeatherPayload[];
  }>;
  persist(
    runId: number,
    rawRecords: RawRecordPayload[],
    standardized: {
      hazardEvents?: StandardizedEventPayload[];
      weatherObservations?: StandardizedWeatherPayload[];
    }
  ): Promise<{ inserted: number; updated: number; rejected: number }>;
  synchronize(initiatedBy?: number): Promise<SyncOutcome>;
  getHealth(): Promise<HealthReport>;
}
