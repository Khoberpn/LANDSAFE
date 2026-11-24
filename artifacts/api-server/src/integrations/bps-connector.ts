import { BaseGovernmentConnector } from "./base-connector";
import type {
  ConnectorMetadata,
  HealthReport,
  RawRecordPayload,
  StandardizedEventPayload,
} from "./types";

export class BPSConnector extends BaseGovernmentConnector {
  readonly metadata: ConnectorMetadata = {
    code: "BPS-STAT",
    name: "BPS — Statistik Kependudukan & Kerentanan Sosial Ekonomi",
    agency: "geospatial",
    category: "Sosial Ekonomi & Demografi",
    officialPortalUrl: "https://www.bps.go.id/",
    endpointUrl: "https://webapi.bps.go.id/documentation/",
    protocol: "https",
    format: "json",
    authType: "api_key",
    authRequired: true,
    geographicCoverage: "Nasional & Seluruh Kabupaten/Kota",
    updateFrequency: "Tahunan",
    license: "Lisensi Terbuka BPS Indonesia",
    attribution: "Badan Pusat Statistik (BPS Republik Indonesia)",
    documentationUrl: "https://webapi.bps.go.id/documentation/",
    description: "Statistik resmi agregat jumlah penduduk, kepadatan jiwa/km², rasio ketergantungan kelompok rentan, dan indikator kemiskinan per wilayah.",
  };

  async discover(): Promise<ConnectorMetadata> {
    return this.metadata;
  }

  async verify(): Promise<HealthReport> {
    const startedAt = Date.now();
    const apiKey = process.env.BPS_API_KEY;

    if (!apiKey) {
      return {
        code: this.metadata.code,
        status: "unavailable",
        verificationStatus: "access_required",
        lastCheckedAt: new Date(),
        lastSuccessAt: this.lastSuccessAt,
        consecutiveFailures: 0,
        circuitBreakerOpen: false,
        latencyMs: 0,
        message: "Memerlukan konfigurasi kredensial resmi BPS_API_KEY dari portal webapi.bps.go.id.",
      };
    }

    try {
      const testUrl = `https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/3304/key/${apiKey}/`;
      const { status } = await this.safeFetch(testUrl, {}, 8000);
      const latencyMs = Date.now() - startedAt;

      if (status === 200) {
        return {
          code: this.metadata.code,
          status: "healthy",
          verificationStatus: "verified_authenticated",
          lastCheckedAt: new Date(),
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
          circuitBreakerOpen: false,
          httpStatus: status,
          latencyMs,
          message: "Layanan resmi BPS Web API terverifikasi aktif.",
        };
      }

      return {
        code: this.metadata.code,
        status: "degraded",
        verificationStatus: "access_pending",
        lastCheckedAt: new Date(),
        lastSuccessAt: this.lastSuccessAt,
        consecutiveFailures: this.consecutiveFailures,
        circuitBreakerOpen: false,
        httpStatus: status,
        latencyMs,
        message: `Kredensial BPS dikirim namun server merespons HTTP ${status}.`,
      };
    } catch (err: any) {
      return {
        code: this.metadata.code,
        status: "unavailable",
        verificationStatus: "temporarily_unavailable",
        lastCheckedAt: new Date(),
        lastSuccessAt: this.lastSuccessAt,
        consecutiveFailures: this.consecutiveFailures + 1,
        circuitBreakerOpen: true,
        latencyMs: Date.now() - startedAt,
        message: `Koneksi ke BPS API gagal: ${err.message}`,
      };
    }
  }

  async fetch(): Promise<{ demographics: unknown[] }> {
    const apiKey = process.env.BPS_API_KEY;
    if (!apiKey) {
      throw new Error("BPS_API_KEY belum dikonfigurasi pada environment.");
    }

    const targetUrl = `https://webapi.bps.go.id/v1/api/list/model/data/lang/ind/domain/3304/key/${apiKey}/`;
    const { text } = await this.safeFetch(targetUrl);
    const json = JSON.parse(text);
    return { demographics: Array.isArray(json.data) ? json.data : [] };
  }

  async parse(rawPayload: unknown): Promise<RawRecordPayload[]> {
    const data = rawPayload as { demographics?: any[] };
    const records: RawRecordPayload[] = [];

    if (Array.isArray(data.demographics)) {
      for (const d of data.demographics) {
        records.push({
          externalId: `BPS-POP-${d.var_id || Math.random()}`,
          resourceCode: "BPS-DEMOGRAFI",
          url: "https://webapi.bps.go.id/",
          payload: d,
          publishedAt: new Date(),
        });
      }
    }

    return records;
  }

  validate(record: RawRecordPayload): boolean {
    return !record.externalId || !record.payload ? false : true;
  }

  async normalize(records: RawRecordPayload[]): Promise<{
    hazardEvents?: StandardizedEventPayload[];
  }> {
    const hazardEvents: StandardizedEventPayload[] = [];

    for (const record of records) {
      const p = record.payload as any;
      hazardEvents.push({
        eventCode: `BPS-STAT-${p.var_id || Math.random()}`,
        hazardCategory: "weather",
        title: `Statistik BPS: ${p.title || "Indikator Kependudukan"}`,
        description: `Data agregat resmi BPS. Nilai: ${p.val || "-"} ${p.unit || ""}.`,
        severity: "low",
        occurredAt: new Date(),
        regionName: p.domain_name || "Jawa Tengah",
        province: "Jawa Tengah",
        isOfficialObservation: true,
        confidenceScore: 1.0,
      });
    }

    return { hazardEvents };
  }
}
