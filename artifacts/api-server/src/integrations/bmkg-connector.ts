import { BaseGovernmentConnector } from "./base-connector";
import type {
  ConnectorMetadata,
  HealthReport,
  RawRecordPayload,
  StandardizedEventPayload,
  StandardizedWeatherPayload,
} from "./types";

export class BMKGConnector extends BaseGovernmentConnector {
  readonly metadata: ConnectorMetadata = {
    code: "BMKG-OPEN",
    name: "BMKG Open Data — Cuaca, Gempabumi & Peringatan Dini",
    agency: "bmkg",
    category: "Meteorologi & Geofisika",
    officialPortalUrl: "https://data.bmkg.go.id/",
    endpointUrl: "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
    protocol: "https",
    format: "json",
    authType: "none",
    authRequired: false,
    geographicCoverage: "Nasional & Regional Indonesia",
    updateFrequency: "Real-time & 10 menit",
    license: "Open Data Pemerintah Indonesia (BMKG)",
    attribution: "Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)",
    documentationUrl: "https://data.bmkg.go.id/",
    description: "Layanan resmi BMKG untuk gempabumi M ≥ 5.0 real-time, gempabumi dirasakan, prakiraan cuaca, dan peringatan dini cuaca ekstrem.",
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
          message: "Layanan resmi BMKG Open Data aktif dan merespons normal.",
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
        message: `Layanan BMKG merespons dengan kode HTTP ${status}.`,
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
        message: `Koneksi ke BMKG gagal: ${err.message}`,
      };
    }
  }

  async fetch(): Promise<{
    autogempa: unknown;
    gempaDirasakan: unknown;
    gempaTerkini: unknown;
    cuacaWilayah: unknown;
  }> {
    // 1. Fetch autogempa (M5.0+ latest)
    const { text: autoText } = await this.safeFetch("https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json");
    const autogempa = JSON.parse(autoText);

    // 2. Fetch gempa dirasakan
    const { text: dirasakanText } = await this.safeFetch("https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json");
    const gempaDirasakan = JSON.parse(dirasakanText);

    // 3. Fetch 15 gempa terbaru
    const { text: terkiniText } = await this.safeFetch("https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json");
    const gempaTerkini = JSON.parse(terkiniText);

    // 4. Fetch cuaca wilayah (Banjarnegara target: adm4=33.04.01.2001)
    let cuacaWilayah: unknown = null;
    try {
      const { text: cuacaText } = await this.safeFetch("https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=33.04.01.2001");
      cuacaWilayah = JSON.parse(cuacaText);
    } catch {
      // Non-fatal if regional API endpoint has transient latency
    }

    return { autogempa, gempaDirasakan, gempaTerkini, cuacaWilayah };
  }

  async parse(rawPayload: unknown): Promise<RawRecordPayload[]> {
    const data = rawPayload as {
      autogempa?: { Infogempa?: { gempa?: any } };
      gempaDirasakan?: { Infogempa?: { gempa?: any[] } };
      gempaTerkini?: { Infogempa?: { gempa?: any[] } };
      cuacaWilayah?: { data?: any[] };
    };

    const records: RawRecordPayload[] = [];

    // Parse autogempa
    if (data.autogempa?.Infogempa?.gempa) {
      const g = data.autogempa.Infogempa.gempa;
      records.push({
        externalId: `AUTOGEMPA-${g.DateTime || g.Tanggal + "_" + g.Jam}`,
        resourceCode: "BMKG-AUTOGEMPA",
        url: "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
        payload: g,
        publishedAt: g.DateTime ? new Date(g.DateTime) : new Date(),
      });
    }

    // Parse gempa terkini
    if (Array.isArray(data.gempaTerkini?.Infogempa?.gempa)) {
      for (const g of data.gempaTerkini!.Infogempa!.gempa!) {
        records.push({
          externalId: `TERKINI-${g.DateTime || g.Tanggal + "_" + g.Jam}`,
          resourceCode: "BMKG-GEMPA-TERKINI",
          url: "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json",
          payload: g,
          publishedAt: g.DateTime ? new Date(g.DateTime) : new Date(),
        });
      }
    }

    // Parse gempa dirasakan
    if (Array.isArray(data.gempaDirasakan?.Infogempa?.gempa)) {
      for (const g of data.gempaDirasakan!.Infogempa!.gempa!) {
        records.push({
          externalId: `DIRASAKAN-${g.DateTime || g.Tanggal + "_" + g.Jam}`,
          resourceCode: "BMKG-GEMPA-DIRASAKAN",
          url: "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json",
          payload: g,
          publishedAt: g.DateTime ? new Date(g.DateTime) : new Date(),
        });
      }
    }

    // Parse cuaca wilayah
    if (Array.isArray(data.cuacaWilayah?.data)) {
      for (const item of data.cuacaWilayah!.data!) {
        records.push({
          externalId: `CUACA-${item.lokasi?.adm4 || "33.04.01.2001"}`,
          resourceCode: "BMKG-CUACA-WILAYAH",
          url: "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=33.04.01.2001",
          payload: item,
          publishedAt: new Date(),
        });
      }
    }

    return records;
  }

  validate(record: RawRecordPayload): boolean {
    if (!record.externalId || !record.payload) return false;
    if (record.resourceCode.startsWith("BMKG-GEMPA") || record.resourceCode === "BMKG-AUTOGEMPA") {
      const p = record.payload as any;
      return typeof p.Magnitude === "string" || typeof p.Magnitude === "number";
    }
    if (record.resourceCode === "BMKG-CUACA-WILAYAH") {
      const p = record.payload as any;
      return !!p.lokasi;
    }
    return true;
  }

  async normalize(records: RawRecordPayload[]): Promise<{
    hazardEvents?: StandardizedEventPayload[];
    weatherObservations?: StandardizedWeatherPayload[];
  }> {
    const hazardEvents: StandardizedEventPayload[] = [];
    const weatherObservations: StandardizedWeatherPayload[] = [];

    for (const record of records) {
      if (record.resourceCode.startsWith("BMKG-GEMPA") || record.resourceCode === "BMKG-AUTOGEMPA") {
        const p = record.payload as any;
        const mag = parseFloat(String(p.Magnitude || "0"));
        const depth = parseFloat(String(p.Kedalaman || "0").replace(/[^0-9.]/g, ""));

        // Parse coordinates "lat,lng"
        let lat: number | undefined;
        let lng: number | undefined;
        if (p.Coordinates && typeof p.Coordinates === "string") {
          const parts = p.Coordinates.split(",");
          if (parts.length === 2) {
            lat = parseFloat(parts[0].trim());
            lng = parseFloat(parts[1].trim());
          }
        }

        // Determine severity
        let severity: "low" | "moderate" | "high" | "extreme" = "low";
        if (mag >= 7.0) severity = "extreme";
        else if (mag >= 6.0) severity = "high";
        else if (mag >= 5.0) severity = "moderate";

        const occurredAt = p.DateTime ? new Date(p.DateTime) : new Date();
        const eventCode = `BMKG-EQ-${occurredAt.getTime()}-${Math.round(mag * 10)}`;

        hazardEvents.push({
          eventCode,
          hazardCategory: "earthquake",
          title: `Gempabumi M ${mag.toFixed(1)} - ${p.Wilayah || "Wilayah Indonesia"}`,
          description: `Gempabumi berkekuatan M ${mag.toFixed(1)} kedalaman ${depth} km. ${p.Potensi || ""}. Dirasakan: ${p.Dirasakan || "-"}`,
          severity,
          occurredAt,
          latitude: lat,
          longitude: lng,
          depthKm: depth,
          magnitude: mag,
          regionName: p.Wilayah,
          tsunamiPotential: String(p.Potensi || "").toLowerCase().includes("berpotensi tsunami") && !String(p.Potensi || "").toLowerCase().includes("tidak"),
          shakemapUrl: p.Shakemap ? `https://data.bmkg.go.id/DataMKG/TEWS/${p.Shakemap}` : undefined,
          isOfficialObservation: true,
          confidenceScore: 1.0,
          metadata: {
            lintang: p.Lintang,
            bujur: p.Bujur,
            dirasakan: p.Dirasakan,
            jam: p.Jam,
            tanggal: p.Tanggal,
          },
        });
      } else if (record.resourceCode === "BMKG-CUACA-WILAYAH") {
        const p = record.payload as any;
        const lokasi = p.lokasi || {};
        const cuacaList = p.cuaca?.[0] || [];

        for (const c of cuacaList) {
          weatherObservations.push({
            admCode: lokasi.adm4 || "33.04.01.2001",
            locationName: `${lokasi.desa || "Berta"}, ${lokasi.kecamatan || "Susukan"}`,
            kecamatan: lokasi.kecamatan,
            regency: lokasi.kotkab || "Banjarnegara",
            province: lokasi.provinsi || "Jawa Tengah",
            latitude: lokasi.lat,
            longitude: lokasi.lon,
            observationTime: c.datetime ? new Date(c.datetime) : new Date(),
            temperatureC: c.t,
            humidityPercent: c.hu,
            rainfallMm: c.tp,
            weatherCode: c.weather,
            weatherDesc: c.weather_desc,
            windSpeedKph: c.ws ? c.ws * 3.6 : undefined,
            windDirection: c.wd,
            isForecast: true,
            forecastHorizonHours: 3,
          });
        }
      }
    }

    return { hazardEvents, weatherObservations };
  }
}
