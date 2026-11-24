import { BaseGovernmentConnector } from "./base-connector";
import type {
  ConnectorMetadata,
  HealthReport,
  RawRecordPayload,
  StandardizedEventPayload,
} from "./types";

export class BNPBConnector extends BaseGovernmentConnector {
  readonly metadata: ConnectorMetadata = {
    code: "BNPB-DIBI",
    name: "BNPB Satu Data & InaRISK — Kejadian Bencana & Peringatan Dini",
    agency: "bnpb_bpbd",
    category: "Kejadian & Risiko Bencana",
    officialPortalUrl: "https://data.bnpb.go.id/",
    endpointUrl: "https://data.bnpb.go.id/api/3/action/package_search?q=banjir+OR+longsor&rows=10",
    protocol: "https",
    format: "json / ckan / arcgis_rest",
    authType: "none",
    authRequired: false,
    geographicCoverage: "Nasional & 38 Provinsi",
    updateFrequency: "Harian & Mingguan",
    license: "Data Terbuka Bencana Indonesia (BNPB)",
    attribution: "Badan Nasional Penanggulangan Bencana (BNPB) & BPBD",
    documentationUrl: "https://data.bnpb.go.id/pages/tentang",
    description: "Katalog resmi kejadian bencana historis, peta kawasan rawan bencana (InaRISK), dan sistem pemantauan ancaman longsor (LEWS).",
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
          message: "Layanan resmi BNPB Satu Data Bencana aktif dan merespons normal.",
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
        message: `Layanan BNPB merespons dengan HTTP ${status}.`,
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
        message: `Koneksi ke BNPB gagal: ${err.message}`,
      };
    }
  }

  async fetch(): Promise<{
    ckanDatasets: unknown;
    lewsFeatures: unknown;
  }> {
    // 1. Fetch CKAN packages for flood and landslide
    const { text: ckanText } = await this.safeFetch(
      "https://data.bnpb.go.id/api/3/action/package_search?q=banjir+OR+longsor&rows=10"
    );
    const ckanDatasets = JSON.parse(ckanText);

    // 2. Fetch LEWS Landslide Early Warning features from ArcGIS REST
    let lewsFeatures: unknown = null;
    try {
      const { text: lewsText } = await this.safeFetch(
        "https://gis.bnpb.go.id/server/rest/services/ATLAS/LEWS_2020/MapServer/0/query?where=1=1&outFields=*&f=json&resultRecordCount=10"
      );
      lewsFeatures = JSON.parse(lewsText);
    } catch {
      // Non-fatal fallback
    }

    return { ckanDatasets, lewsFeatures };
  }

  async parse(rawPayload: unknown): Promise<RawRecordPayload[]> {
    const data = rawPayload as {
      ckanDatasets?: { result?: { results?: any[] } };
      lewsFeatures?: { features?: any[] };
    };

    const records: RawRecordPayload[] = [];

    // Parse CKAN disaster datasets
    if (Array.isArray(data.ckanDatasets?.result?.results)) {
      for (const item of data.ckanDatasets!.result!.results!) {
        records.push({
          externalId: `BNPB-DATASET-${item.name || item.id}`,
          resourceCode: "BNPB-SATU-DATA",
          url: `https://data.bnpb.go.id/dataset/${item.name || item.id}`,
          payload: item,
          publishedAt: item.metadata_modified ? new Date(item.metadata_modified) : new Date(),
        });
      }
    }

    // Parse LEWS features
    if (Array.isArray(data.lewsFeatures?.features)) {
      for (const feat of data.lewsFeatures!.features!) {
        const attr = feat.attributes || {};
        records.push({
          externalId: `BNPB-LEWS-${attr.objectid || attr.id_kab || Math.random()}`,
          resourceCode: "BNPB-GIS-LEWS",
          url: "https://gis.bnpb.go.id/server/rest/services/ATLAS/LEWS_2020/MapServer",
          payload: attr,
          publishedAt: new Date(),
        });
      }
    }

    return records;
  }

  validate(record: RawRecordPayload): boolean {
    if (!record.externalId || !record.payload) return false;
    return true;
  }

  async normalize(records: RawRecordPayload[]): Promise<{
    hazardEvents?: StandardizedEventPayload[];
  }> {
    const hazardEvents: StandardizedEventPayload[] = [];

    for (const record of records) {
      if (record.resourceCode === "BNPB-SATU-DATA") {
        const item = record.payload as any;
        const titleLower = String(item.title || "").toLowerCase();
        let cat: "flood" | "landslide" | "weather" = "flood";
        if (titleLower.includes("longsor")) cat = "landslide";
        else if (titleLower.includes("cuaca")) cat = "weather";

        hazardEvents.push({
          eventCode: `BNPB-${item.name || item.id}`,
          hazardCategory: cat,
          title: item.title || "Katalog Risiko Bencana Resmi BNPB",
          description: item.notes || `Dataset resmi penanggulangan bencana: ${item.title}`,
          severity: "moderate",
          occurredAt: item.metadata_modified ? new Date(item.metadata_modified) : new Date(),
          regionName: item.organization?.title || "Nasional / Regional",
          province: "Indonesia",
          isOfficialObservation: true,
          confidenceScore: 0.95,
          metadata: {
            organization: item.organization?.title,
            numResources: item.num_resources,
            resources: item.resources?.map((r: any) => ({ name: r.name, format: r.format, url: r.url })),
          },
        });
      } else if (record.resourceCode === "BNPB-GIS-LEWS") {
        const attr = record.payload as any;
        const totalSensors = (attr.lews_jumla || 0) + (attr.fews_jumla || 0);

        hazardEvents.push({
          eventCode: `BNPB-LEWS-REG-${attr.id_kab || attr.objectid}`,
          hazardCategory: "landslide",
          title: `Cakupan Sistem Peringatan Dini Longsor (LEWS): ${attr.kab_kota_g || attr.provinsi}`,
          description: `Inventarisasi sensor peringatan dini tanah longsor resmi BNPB/BPBD di ${attr.kab_kota_g}. Terpasang: ${attr.lews_jumla || 0} unit LEWS, ${attr.fews_jumla || 0} unit FEWS.`,
          severity: totalSensors > 0 ? "low" : "moderate",
          occurredAt: new Date(),
          regionName: attr.kab_kota_g || attr.provinsi,
          province: attr.provinsi,
          isOfficialObservation: true,
          confidenceScore: 0.9,
          metadata: {
            fews_jumlah: attr.fews_jumla,
            lews_jumlah: attr.lews_jumla,
            tews_jumlah: attr.tews_jumla,
          },
        });
      }
    }

    return { hazardEvents };
  }
}
