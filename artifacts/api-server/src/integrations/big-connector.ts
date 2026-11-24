import { BaseGovernmentConnector } from "./base-connector";
import type {
  ConnectorMetadata,
  HealthReport,
  RawRecordPayload,
  StandardizedEventPayload,
} from "./types";

export class BIGConnector extends BaseGovernmentConnector {
  readonly metadata: ConnectorMetadata = {
    code: "BIG-RBI",
    name: "BIG Geoportal — Batas Administrasi & Geospasial Dasar",
    agency: "geospatial",
    category: "Geospasial Dasar & Administrasi",
    officialPortalUrl: "https://geoportal.big.go.id/",
    endpointUrl: "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_KABKOTA_AR/MapServer/0/query?where=1=1&outFields=OBJECTID,NAMOBJ,WADMKK,WADMPR,KDPKAB,LUASWH,SRS_ID&returnGeometry=false&f=json&resultRecordCount=10",
    protocol: "https",
    format: "arcgis_rest / geojson",
    authType: "none",
    authRequired: false,
    geographicCoverage: "Nasional & Seluruh Kabupaten/Kota",
    updateFrequency: "Tahunan / Semesteran",
    license: "Data Spasial Nasional Terbuka (BIG)",
    attribution: "Badan Informasi Geospasial (BIG)",
    documentationUrl: "https://tanahair.indonesia.go.id/",
    description: "Layanan referensi geospasial tunggal nasional (One Map Policy) untuk batas administrasi kabupaten/kota, kodifikasi BPS/Kemendagri, dan luas wilayah resmi.",
  };

  async discover(): Promise<ConnectorMetadata> {
    return this.metadata;
  }

  async verify(): Promise<HealthReport> {
    const startedAt = Date.now();
    try {
      const { status } = await this.safeFetch(this.metadata.endpointUrl, {}, 8000);
      const latencyMs = Date.now() - startedAt;
      if (status === 200) {
        return {
          code: this.metadata.code,
          status: "healthy",
          verificationStatus: "verified_public",
          lastCheckedAt: new Date(),
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
          circuitBreakerOpen: false,
          httpStatus: status,
          latencyMs,
          message: "Layanan resmi ArcGIS REST BIG aktif dan melayani query batas wilayah.",
        };
      }
      return {
        code: this.metadata.code,
        status: "degraded",
        verificationStatus: "partially_accessible",
        lastCheckedAt: new Date(),
        lastSuccessAt: this.lastSuccessAt,
        consecutiveFailures: this.consecutiveFailures,
        circuitBreakerOpen: this.circuitBreakerOpen,
        httpStatus: status,
        latencyMs,
        message: `Layanan BIG merespons dengan HTTP ${status}.`,
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
        message: `Koneksi ke BIG gagal: ${err.message}`,
      };
    }
  }

  async fetch(): Promise<{ features: unknown[] }> {
    const { text } = await this.safeFetch(
      "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_KABKOTA_AR/MapServer/0/query?where=1=1&outFields=OBJECTID,NAMOBJ,WADMKK,WADMPR,KDPKAB,LUASWH,SRS_ID&returnGeometry=false&f=json&resultRecordCount=25"
    );
    const json = JSON.parse(text);
    return { features: json.features || [] };
  }

  async parse(rawPayload: unknown): Promise<RawRecordPayload[]> {
    const data = rawPayload as { features?: any[] };
    const records: RawRecordPayload[] = [];

    if (Array.isArray(data.features)) {
      for (const feat of data.features) {
        const attr = feat.attributes || {};
        records.push({
          externalId: `BIG-KABKOTA-${attr.OBJECTID || attr.KDPKAB || attr.WADMKK}`,
          resourceCode: "BIG-BATAS-KABKOTA",
          url: "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_KABKOTA_AR/MapServer/0",
          payload: attr,
          publishedAt: new Date(),
        });
      }
    }

    return records;
  }

  validate(record: RawRecordPayload): boolean {
    if (!record.externalId || !record.payload) return false;
    const p = record.payload as any;
    return !!p.WADMKK || !!p.NAMOBJ;
  }

  async normalize(records: RawRecordPayload[]): Promise<{
    hazardEvents?: StandardizedEventPayload[];
  }> {
    const hazardEvents: StandardizedEventPayload[] = [];

    for (const record of records) {
      const p = record.payload as any;
      hazardEvents.push({
        eventCode: `BIG-ADM-${p.OBJECTID || p.KDPKAB || p.WADMKK}`,
        hazardCategory: "landslide", // Geospatial baseline layer for hazard mapping
        title: `Batas Administrasi Resmi: ${p.WADMKK || p.NAMOBJ} (${p.WADMPR || "Indonesia"})`,
        description: `Batas wilayah geospasial resmi BIG. Kode Wilayah: ${p.KDPKAB || "-"}, Luas Resmi: ${p.LUASWH ? p.LUASWH.toFixed(1) + " km²" : "Tercatat"}, Datum: EPSG:${p.SRS_ID || "4326"}.`,
        severity: "low",
        occurredAt: new Date(),
        regionName: p.WADMKK || p.NAMOBJ,
        province: p.WADMPR,
        isOfficialObservation: true,
        confidenceScore: 1.0,
        metadata: {
          bps_code: p.KDBBPS,
          kemendagri_code: p.KDPKAB,
          luas_km2: p.LUASWH,
          metadata_id: p.METADATA,
        },
      });
    }

    return { hazardEvents };
  }
}
