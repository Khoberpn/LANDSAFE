import { BaseGovernmentConnector } from "./base-connector";
import type {
  ConnectorMetadata,
  HealthReport,
  RawRecordPayload,
  StandardizedEventPayload,
} from "./types";

export class PVMBGConnector extends BaseGovernmentConnector {
  readonly metadata: ConnectorMetadata = {
    code: "PVMBG-VAR",
    name: "PVMBG / MAGMA Indonesia — Status Aktivitas Gunung Api & Gerakan Tanah",
    agency: "pvmbg",
    category: "Vulkanologi & Mitigasi Bencana Geologi",
    officialPortalUrl: "https://magma.esdm.go.id/",
    endpointUrl: "https://magma.esdm.go.id/api/v1/gunung-api",
    protocol: "https",
    format: "json",
    authType: "api_key",
    authRequired: true,
    geographicCoverage: "127 Gunung Api Aktif & Zona Rawan Gerakan Tanah",
    updateFrequency: "6 jam / Real-time Saat Krisis",
    license: "Hak Cipta PVMBG — Badan Geologi Kementerian ESDM",
    attribution: "Pusat Vulkanologi dan Mitigasi Bencana Geologi (PVMBG - Badan Geologi)",
    documentationUrl: "https://magma.esdm.go.id/docs/api",
    description: "Laporan Aktivitas Gunung Api (VAR), status tingkat aktivitas (Level I–IV), rekomendasi radius bahaya, dan evaluasi gerakan tanah.",
  };

  async discover(): Promise<ConnectorMetadata> {
    return this.metadata;
  }

  async verify(): Promise<HealthReport> {
    const startedAt = Date.now();
    const apiKey = process.env.MAGMA_API_KEY;

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
        message: "Memerlukan konfigurasi kredensial resmi MAGMA_API_KEY dari PVMBG/Badan Geologi.",
      };
    }

    try {
      const { status } = await this.safeFetch(
        this.metadata.endpointUrl,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "X-Api-Key": apiKey,
          },
        },
        8000
      );
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
          message: "Layanan resmi MAGMA Indonesia terverifikasi dengan kredensial aktif.",
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
        message: `Kredensial dikirim namun server merespons HTTP ${status}.`,
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
        message: `Koneksi ke MAGMA Indonesia gagal: ${err.message}`,
      };
    }
  }

  async fetch(): Promise<{ reports: unknown[] }> {
    const apiKey = process.env.MAGMA_API_KEY;
    if (!apiKey) {
      throw new Error("MAGMA_API_KEY belum dikonfigurasi pada environment.");
    }

    const { text } = await this.safeFetch(this.metadata.endpointUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Api-Key": apiKey,
      },
    });

    const json = JSON.parse(text);
    return { reports: Array.isArray(json.data) ? json.data : [] };
  }

  async parse(rawPayload: unknown): Promise<RawRecordPayload[]> {
    const data = rawPayload as { reports?: any[] };
    const records: RawRecordPayload[] = [];

    if (Array.isArray(data.reports)) {
      for (const r of data.reports) {
        records.push({
          externalId: `PVMBG-VAR-${r.id || r.kode || Math.random()}`,
          resourceCode: "PVMBG-VAR",
          url: "https://magma.esdm.go.id/api/v1/gunung-api",
          payload: r,
          publishedAt: r.created_at ? new Date(r.created_at) : new Date(),
        });
      }
    }

    return records;
  }

  validate(record: RawRecordPayload): boolean {
    if (!record.externalId || !record.payload) return false;
    const p = record.payload as any;
    return !!p.nama || !!p.gunung_api;
  }

  async normalize(records: RawRecordPayload[]): Promise<{
    hazardEvents?: StandardizedEventPayload[];
  }> {
    const hazardEvents: StandardizedEventPayload[] = [];

    for (const record of records) {
      const p = record.payload as any;
      const level = String(p.status || p.level || "Level II (Waspada)");
      let severity: "low" | "moderate" | "high" | "extreme" = "moderate";
      if (level.includes("IV") || level.toLowerCase().includes("awas")) severity = "extreme";
      else if (level.includes("III") || level.toLowerCase().includes("siaga")) severity = "high";
      else if (level.includes("II") || level.toLowerCase().includes("waspada")) severity = "moderate";
      else severity = "low";

      hazardEvents.push({
        eventCode: `PVMBG-VAR-${p.id || p.kode}`,
        hazardCategory: "volcanic",
        title: `Status Aktivitas Gunung Api: ${p.nama || p.gunung_api} (${level})`,
        description: p.rekomendasi || `Laporan aktivitas resmi PVMBG: status ${level}. Harap mematuhi radius bahaya yang ditetapkan.`,
        severity,
        occurredAt: p.created_at ? new Date(p.created_at) : new Date(),
        latitude: p.latitude,
        longitude: p.longitude,
        regionName: p.nama || p.gunung_api,
        province: p.provinsi,
        isOfficialObservation: true,
        confidenceScore: 1.0,
        metadata: {
          radius_rekomendasi_km: p.radius_rekomendasi,
          visual: p.visual,
          kegempaan: p.kegempaan,
        },
      });
    }

    return { hazardEvents };
  }
}
