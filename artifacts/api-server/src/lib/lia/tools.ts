/**
 * Controlled Function Calling Tools for LANDSAFE Intelligence Assistant (LIA)
 * Connects to PostgreSQL via Drizzle ORM through validated, secure backend functions.
 * NEVER allows unrestricted or raw SQL generation.
 * Enforces strict role-based data access (Public Assistant vs BPBD Copilot).
 */

import {
  db,
  locationsTable,
  predictionsTable,
  sensorsTable,
  alertsTable,
  riskAssessmentsTable,
  scenariosTable,
  dataSourcesTable,
  mitigationPlansTable,
  facilitiesTable,
  evacuationRoutesTable,
  preparednessGuidelinesTable,
  reportsTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql, count, ne, ilike } from "drizzle-orm";
import type { LiaCitation } from "./types";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  access: "public" | "bpbd_copilot";
}

export interface ToolExecutionResult {
  toolName: string;
  data: unknown;
  citation: LiaCitation;
  summaryText?: string;
}

const PUBLIC_TOOL_NAMES = new Set<string>();
const STAFF_TOOL_NAMES = new Set<string>();

function regionFilter(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, 100);
}

function asIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function latestIso(values: Array<Date | string | null | undefined>): string | undefined {
  let latest: number | null = null;
  for (const value of values) {
    const iso = asIso(value);
    if (!iso) continue;
    const time = new Date(iso).getTime();
    if (latest === null || time > latest) latest = time;
  }
  return latest === null ? undefined : new Date(latest).toISOString();
}

export const LIA_TOOLS: ToolDefinition[] = [
  // ─── Public Tools ───────────────────────────────────────────────────────────
  {
    name: "get_public_mitigation_overview",
    description: "Ambil ringkasan agregat rencana mitigasi publik, kapasitas tempat evakuasi, dan status keterbukaan informasi.",
    parameters: { type: "object", properties: {} },
    access: "public",
  },
  {
    name: "get_public_mitigation_plans",
    description: "Ambil daftar rencana mitigasi bencana yang telah resmi dipublikasikan oleh BPBD.",
    parameters: {
      type: "object",
      properties: {
        regionName: { type: "string", description: "Filter berdasarkan nama wilayah/kecamatan (opsional)" },
      },
    },
    access: "public",
  },
  {
    name: "get_public_evacuation_routes",
    description: "Ambil daftar rute evakuasi aman yang telah diverifikasi dan dipublikasikan resmi untuk warga.",
    parameters: {
      type: "object",
      properties: {
        regionName: { type: "string", description: "Filter berdasarkan nama wilayah (opsional)" },
      },
    },
    access: "public",
  },
  {
    name: "get_public_evacuation_facilities",
    description: "Ambil daftar fasilitas tempat penampungan (shelter) dan titik kumpul evakuasi warga yang terbuka untuk publik.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter tipe: shelter atau assembly_point (opsional)" },
      },
    },
    access: "public",
  },
  {
    name: "get_public_guidelines",
    description: "Ambil panduan kesiapsiagaan dan SOP evakuasi resmi untuk masyarakat.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Kategori panduan (opsional)" },
      },
    },
    access: "public",
  },
  {
    name: "get_public_hazard_overview",
    description: "Ambil ringkasan status bahaya umum per lokasi pantauan tanpa mengekspos data operasional rahasia.",
    parameters: { type: "object", properties: {} },
    access: "public",
  },

  // ─── BPBD Copilot Tools ─────────────────────────────────────────────────────
  {
    name: "get_regional_risk_assessments",
    description: "Analisis pengkajian risiko regional: indeks bahaya (hazard), kerentanan (vulnerability), kapasitas (capacity), dan skor risiko komposit.",
    parameters: {
      type: "object",
      properties: {
        regionName: { type: "string", description: "Filter nama wilayah spesifik (opsional)" },
      },
    },
    access: "bpbd_copilot",
  },
  {
    name: "get_xgboost_predictions",
    description: "Ambil dan jelaskan hasil analisis prediksi model XGBoost: probabilitas longsor, confidence score, pemicu utama (SHAP triggers), dan rekomendasi evakuasi.",
    parameters: {
      type: "object",
      properties: {
        locationId: { type: "number", description: "ID lokasi spesifik (opsional)" },
      },
    },
    access: "bpbd_copilot",
  },
  {
    name: "get_sensor_telemetry_status",
    description: "Ambil status operasional jaringan sensor IoT, telemetri curah hujan/kemiringan lereng/kelembaban tanah, dan peringatan sensor offline.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter status sensor: online, offline, maintenance (opsional)" },
      },
    },
    access: "bpbd_copilot",
  },
  {
    name: "get_active_alerts_and_history",
    description: "Ambil daftar peringatan dini aktif dan riwayat log peringatan (kritis, tinggi, sedang).",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter status: active, acknowledged, resolved (default: active)" },
      },
    },
    access: "bpbd_copilot",
  },
  {
    name: "get_disaster_scenarios",
    description: "Bandingkan skenario simulasi dampak bencana hipotetis (intensitas curah hujan, estimasi korban, dampak ekonomi, fasilitas terdampak).",
    parameters: { type: "object", properties: {} },
    access: "bpbd_copilot",
  },
  {
    name: "get_all_evacuation_routes_and_evaluations",
    description: "Ambil seluruh data rute evakuasi operasional (termasuk draf/analisis/verifikasi lapangan), catatan hambatan, dan evaluasi kelayakan rute.",
    parameters: {
      type: "object",
      properties: {
        routeStatus: { type: "string", description: "Filter status: draft, analysis, field_verification, review, approved, published (opsional)" },
      },
    },
    access: "bpbd_copilot",
  },
  {
    name: "get_data_integration_status",
    description: "Periksa status integrasi data eksternal (BMKG, PVMBG, IoT, Geospatial), kelengkapan data, dan identifikasi dataset simulasi.",
    parameters: { type: "object", properties: {} },
    access: "bpbd_copilot",
  },
  {
    name: "get_dashboard_overview",
    description: "Ambil ringkasan operasional dashboard: jumlah lokasi pantauan per tingkat risiko, status sensor, dan peringatan aktif.",
    parameters: { type: "object", properties: {} },
    access: "bpbd_copilot",
  },
  {
    name: "get_recent_reports",
    description: "Ambil daftar laporan yang pernah dibuat beserta status dan periodenya, untuk membantu penyusunan laporan baru.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Jumlah laporan maksimum (1-20, opsional)" },
      },
    },
    access: "bpbd_copilot",
  },
  {
    name: "generate_draft_mitigation_recommendation",
    description: "Susun draf rekomendasi rencana mitigasi berbasis bukti (evidence-based) untuk wilayah prioritas risiko tinggi.",
    parameters: {
      type: "object",
      properties: {
        regionName: { type: "string", description: "Nama wilayah target rekomendasi (wajib)" },
      },
      required: ["regionName"],
    },
    access: "bpbd_copilot",
  },
];

for (const tool of LIA_TOOLS) {
  if (tool.access === "public") PUBLIC_TOOL_NAMES.add(tool.name);
  else STAFF_TOOL_NAMES.add(tool.name);
}

/**
 * Filter available tools based on the server-resolved mode and role.
 * Public callers never receive staff tool schemas, even if they forge a mode.
 */
export function getAvailableTools(
  role: "public" | "operator" | "admin",
  mode: "public" | "bpbd_copilot",
): ToolDefinition[] {
  if (mode === "public" || role === "public") {
    return LIA_TOOLS.filter((t) => t.access === "public");
  }
  return LIA_TOOLS;
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return LIA_TOOLS.find((tool) => tool.name === name);
}

export function isToolAllowed(
  name: string,
  role: "public" | "operator" | "admin",
  mode: "public" | "bpbd_copilot",
): boolean {
  if (!getToolDefinition(name)) return false;
  if (mode === "public" || role === "public") return PUBLIC_TOOL_NAMES.has(name);
  return PUBLIC_TOOL_NAMES.has(name) || STAFF_TOOL_NAMES.has(name);
}

/**
 * Validate and normalize model-supplied tool arguments. The model sees a JSON
 * schema, but its output is still untrusted input.
 */
export function sanitizeToolArguments(
  name: string,
  raw: unknown,
): Record<string, unknown> {
  const definition = getToolDefinition(name);
  if (!definition) throw new Error(`Tool tidak dikenal: ${name}`);

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    if (raw.trim().length === 0) parsed = {};
    else {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`Argumen tool ${name} bukan JSON yang valid.`);
      }
    }
  }

  if (parsed === null || parsed === undefined) parsed = {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Argumen tool ${name} harus berupa objek.`);
  }

  const allowedProperties = new Set(
    Object.keys((definition.parameters as { properties?: Record<string, unknown> }).properties ?? {}),
  );
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!allowedProperties.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;

    if (key === "locationId" || key === "limit") {
      const numeric = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(numeric) || numeric <= 0) continue;
      result[key] = numeric;
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0 || trimmed.length > 160) continue;
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(trimmed)) continue;
      result[key] = trimmed;
    }
  }

  const required = (definition.parameters as { required?: string[] }).required ?? [];
  for (const key of required) {
    if (!(key in result)) {
      throw new Error(`Parameter ${key} wajib diisi untuk tool ${name}.`);
    }
  }

  return result;
}

/**
 * Execute a specific tool. Access is checked before any query runs; the
 * wrapper below also adds a retrieval timestamp to every citation.
 */
async function executeToolInternal(
  name: string,
  args: Record<string, unknown> = {},
  userRole: "public" | "operator" | "admin" = "public",
): Promise<ToolExecutionResult> {
  const nowStr = new Date().toISOString();

  // ─── PUBLIC TOOLS EXECUTION ──────────────────────────────────────────────────
  if (name === "get_public_mitigation_overview") {
    const [planCounts] = await db
      .select({
        published: sql<number>`COUNT(CASE WHEN ${mitigationPlansTable.status} = 'published' THEN 1 END)`,
        regions: sql<number>`COUNT(DISTINCT CASE WHEN ${mitigationPlansTable.status} = 'published' THEN ${mitigationPlansTable.regionName} END)`,
        lastPublishedAt: sql<string | null>`MAX(CASE WHEN ${mitigationPlansTable.status} = 'published' THEN ${mitigationPlansTable.publishedAt} END)::text`,
      })
      .from(mitigationPlansTable);

    const [facilityCounts] = await db
      .select({
        shelters: sql<number>`COUNT(CASE WHEN ${facilitiesTable.type} = 'shelter' AND ${facilitiesTable.isPublic} THEN 1 END)`,
        capacity: sql<number>`COALESCE(SUM(CASE WHEN ${facilitiesTable.type} = 'shelter' AND ${facilitiesTable.isPublic} THEN ${facilitiesTable.capacity} ELSE 0 END), 0)`,
      })
      .from(facilitiesTable);

    const [guidelineCounts] = await db
      .select({ total: count() })
      .from(preparednessGuidelinesTable)
      .where(eq(preparednessGuidelinesTable.isPublic, true));

    return {
      toolName: name,
      data: {
        publishedPlans: Number(planCounts?.published ?? 0),
        regionsCovered: Number(planCounts?.regions ?? 0),
        publicShelters: Number(facilityCounts?.shelters ?? 0),
        totalShelterCapacity: Number(facilityCounts?.capacity ?? 0),
        availableGuidelines: Number(guidelineCounts?.total ?? 0),
        lastPublishedAt: asIso(planCounts?.lastPublishedAt) ?? null,
      },
      citation: {
        source: "Portal Mitigasi Publik BPBD",
        title: "Ringkasan Rencana Mitigasi Resmi",
        timestamp: nowStr,
        dataAsOf: asIso(planCounts?.lastPublishedAt),
        type: "official_data",
        isSimulated: false,
      },
      summaryText: `Terdapat ${planCounts?.published ?? 0} rencana mitigasi resmi mencakup ${planCounts?.regions ?? 0} wilayah dengan kapasitas tampung ${facilityCounts?.capacity ?? 0} jiwa di tempat evakuasi terverifikasi.`,
    };
  }

  if (name === "get_public_mitigation_plans") {
    const regionName = regionFilter(args.regionName);
    const conditions = [eq(mitigationPlansTable.status, "published")];
    if (regionName) conditions.push(ilike(mitigationPlansTable.regionName, `%${regionName}%`));

    const rows = await db
      .select({
        id: mitigationPlansTable.id,
        title: mitigationPlansTable.title,
        regionName: mitigationPlansTable.regionName,
        province: mitigationPlansTable.province,
        hazardType: mitigationPlansTable.hazardType,
        publicSummary: mitigationPlansTable.publicSummary,
        leadAgency: mitigationPlansTable.leadAgency,
        timelineStart: mitigationPlansTable.timelineStart,
        timelineEnd: mitigationPlansTable.timelineEnd,
        publishedAt: mitigationPlansTable.publishedAt,
      })
      .from(mitigationPlansTable)
      .where(and(...conditions))
      .orderBy(desc(mitigationPlansTable.publishedAt))
      .limit(10);

    return {
      toolName: name,
      data: rows.map((r) => ({
        ...r,
        timelineStart: r.timelineStart?.toISOString(),
        timelineEnd: r.timelineEnd?.toISOString(),
        publishedAt: r.publishedAt?.toISOString(),
      })),
      citation: {
        source: "Dokumen Rencana Mitigasi Resmi BPBD",
        title: "Katalog Rencana Mitigasi Wilayah",
        timestamp: nowStr,
        dataAsOf: latestIso(rows.map((row) => row.publishedAt)),
        type: "official_data",
        isSimulated: false,
      },
    };
  }

  if (name === "get_public_evacuation_routes") {
    const regionName = regionFilter(args.regionName);
    const conditions = [eq(evacuationRoutesTable.routeStatus, "published")];
    if (regionName) conditions.push(ilike(evacuationRoutesTable.regionName, `%${regionName}%`));

    const rows = await db
      .select({
        id: evacuationRoutesTable.id,
        name: evacuationRoutesTable.name,
        routeCode: evacuationRoutesTable.routeCode,
        originName: evacuationRoutesTable.originName,
        destinationName: evacuationRoutesTable.destinationName,
        regionName: evacuationRoutesTable.regionName,
        hazardType: evacuationRoutesTable.hazardType,
        routeType: evacuationRoutesTable.routeType,
        distanceKm: evacuationRoutesTable.distanceKm,
        estimatedTimeMinutes: evacuationRoutesTable.estimatedTimeMinutes,
        roadSurface: evacuationRoutesTable.roadSurface,
        isAccessible: evacuationRoutesTable.isAccessible,
        hazardExposure: evacuationRoutesTable.hazardExposure,
        publicDescription: evacuationRoutesTable.publicDescription,
        publishedAt: evacuationRoutesTable.publishedAt,
      })
      .from(evacuationRoutesTable)
      .where(and(...conditions))
      .orderBy(asc(evacuationRoutesTable.routeType), asc(evacuationRoutesTable.name))
      .limit(10);

    return {
      toolName: name,
      data: rows.map((r) => ({
        ...r,
        publishedAt: r.publishedAt?.toISOString(),
      })),
      citation: {
        source: "Peta Rute Evakuasi Terverifikasi BPBD",
        title: "Jalur Evakuasi Publik Terverifikasi",
        timestamp: nowStr,
        dataAsOf: latestIso(rows.map((row) => row.publishedAt)),
        type: "official_data",
        isSimulated: false,
      },
      summaryText: `Ditemukan ${rows.length} jalur evakuasi resmi yang berstatus terverifikasi dan aman digunakan masyarakat.`,
    };
  }

  if (name === "get_public_evacuation_facilities") {
    const conditions = [eq(facilitiesTable.isPublic, true), ne(facilitiesTable.type, "command_post")];
    if (args.type && typeof args.type === "string") {
      conditions.push(eq(facilitiesTable.type, args.type as any));
    }

    const rows = await db
      .select({
        id: facilitiesTable.id,
        name: facilitiesTable.name,
        type: facilitiesTable.type,
        regionName: facilitiesTable.regionName,
        address: facilitiesTable.address,
        capacity: facilitiesTable.capacity,
        amenities: facilitiesTable.amenities,
        status: facilitiesTable.status,
        contact: facilitiesTable.contact,
        operatingAgency: facilitiesTable.operatingAgency,
      })
      .from(facilitiesTable)
      .where(and(...conditions))
      .orderBy(asc(facilitiesTable.type), asc(facilitiesTable.name))
      .limit(15);

    return {
      toolName: name,
      data: rows,
      citation: {
        source: "Direktori Titik Kumpul & Shelter BPBD",
        title: "Fasilitas Pengungsian Publik",
        timestamp: nowStr,
        type: "official_data",
        isSimulated: false,
      },
    };
  }

  if (name === "get_public_guidelines") {
    const conditions = [eq(preparednessGuidelinesTable.isPublic, true)];
    if (args.category && typeof args.category === "string") {
      conditions.push(eq(preparednessGuidelinesTable.category, args.category));
    }

    const rows = await db
      .select()
      .from(preparednessGuidelinesTable)
      .where(and(...conditions))
      .orderBy(asc(preparednessGuidelinesTable.category))
      .limit(10);

    return {
      toolName: name,
      data: rows.map((r) => ({
        title: r.title,
        category: r.category,
        summary: r.summary,
        steps: r.steps,
        source: r.source,
      })),
      citation: {
        source: "Katalog SOP Kesiapsiagaan BNPB / BPBD",
        title: "Panduan Penyelamatan Diri Bencana",
        timestamp: nowStr,
        type: "guideline",
        isSimulated: false,
      },
    };
  }

  if (name === "get_public_hazard_overview") {
    const locations = await db
      .select({
        id: locationsTable.id,
        name: locationsTable.name,
        district: locationsTable.district,
        province: locationsTable.province,
        riskLevel: locationsTable.riskLevel,
        status: locationsTable.status,
        updatedAt: locationsTable.updatedAt,
      })
      .from(locationsTable)
      .orderBy(desc(locationsTable.riskLevel), asc(locationsTable.name))
      .limit(12);

    return {
      toolName: name,
      data: locations.map((location) => ({
        ...location,
        updatedAt: location.updatedAt.toISOString(),
      })),
      citation: {
        source: "Sistem Peringatan Dini LANDSAFE",
        title: "Status Bahaya Wilayah Pantauan Publik",
        timestamp: nowStr,
        dataAsOf: latestIso(locations.map((location) => location.updatedAt)),
        type: "official_data",
        isSimulated: false,
      },
    };
  }

  // ─── BPBD COPILOT TOOLS EXECUTION (Restricted to operator/admin) ─────────────
  if (userRole !== "operator" && userRole !== "admin") {
    throw new Error("Akses ditolak: Operasi ini hanya diizinkan untuk personel operasional BPBD (role: operator atau admin).");
  }

  if (name === "get_regional_risk_assessments") {
    const regionName = regionFilter(args.regionName);
    const conditions = [];
    if (regionName) conditions.push(ilike(riskAssessmentsTable.regionName, `%${regionName}%`));

    const rows = await db
      .select()
      .from(riskAssessmentsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(riskAssessmentsTable.riskScore))
      .limit(10);

    return {
      toolName: name,
      data: rows.map((r) => ({
        id: r.id,
        regionName: r.regionName,
        province: r.province,
        hazardType: r.hazardType,
        hazardIndex: r.hazardIndex,
        exposureIndex: r.exposureIndex,
        vulnerabilityIndex: r.vulnerabilityIndex,
        capacityIndex: r.capacityIndex,
        riskScore: r.riskScore,
        riskClass: r.riskClass,
        population: r.population,
        exposedPopulation: r.exposedPopulation,
        indicators: r.indicators,
        sources: r.sources,
        verified: r.verified,
        assessedAt: r.assessedAt.toISOString(),
      })),
      citation: {
        source: "Kajian Risiko Bencana Regional (Perka BNPB No. 02/2012)",
        title: "Matriks Indeks Risiko Komposit Wilayah",
        timestamp: nowStr,
        dataAsOf: latestIso(rows.map((row) => row.assessedAt)),
        type: "official_data",
        isSimulated: false,
      },
      summaryText: `Menampilkan ${rows.length} kajian risiko komposit. Wilayah dengan skor risiko tertinggi: ${rows[0]?.regionName ?? "N/A"} (${rows[0]?.riskClass ?? "N/A"} - Skor: ${rows[0]?.riskScore ?? 0}).`,
    };
  }

  if (name === "get_xgboost_predictions") {
    const locationId = typeof args.locationId === "number" ? args.locationId : undefined;
    const conditions = [];
    if (locationId) conditions.push(eq(predictionsTable.locationId, locationId));

    const rawRows = await db
      .select({
        id: predictionsTable.id,
        locationId: predictionsTable.locationId,
        locationName: locationsTable.name,
        district: locationsTable.district,
        riskLevel: predictionsTable.riskLevel,
        probability: predictionsTable.probability,
        confidence: predictionsTable.confidence,
        potentialTriggers: predictionsTable.potentialTriggers,
        recommendedActions: predictionsTable.recommendedActions,
        evacuationSuggested: predictionsTable.evacuationSuggested,
        explanation: predictionsTable.explanation,
        historicalSimilarEvents: predictionsTable.historicalSimilarEvents,
        analyzedAt: predictionsTable.analyzedAt,
      })
      .from(predictionsTable)
      .leftJoin(locationsTable, eq(predictionsTable.locationId, locationsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(predictionsTable.analyzedAt))
      .limit(60);

    // Keep the latest inference per location so one noisy location cannot
    // dominate the answer.
    const seenLocations = new Set<number>();
    const rows = rawRows.filter((row) => {
      if (seenLocations.has(row.locationId)) return false;
      seenLocations.add(row.locationId);
      return true;
    }).slice(0, 10);

    return {
      toolName: name,
      data: rows.map((r) => ({
        ...r,
        analyzedAt: r.analyzedAt.toISOString(),
      })),
      citation: {
        source: "LANDSAFE XGBoost Machine Learning Engine",
        title: "Prediksi Probabilitas Risiko & Analisis Pemicu (SHAP)",
        timestamp: nowStr,
        dataAsOf: latestIso(rows.map((row) => row.analyzedAt)),
        type: "official_data",
        isSimulated: false,
      },
      summaryText: `Hasil inferensi XGBoost untuk ${rows.length} lokasi. Lokasi prioritas: ${rows[0]?.locationName ?? "N/A"} (Probabilitas: ${Math.round((rows[0]?.probability ?? 0) * 100)}%, Status: ${rows[0]?.riskLevel ?? "N/A"}).`,
    };
  }

  if (name === "get_sensor_telemetry_status") {
    const allowedStatuses = new Set(["online", "offline", "maintenance", "calibration"]);
    const statusFilter = typeof args.status === "string" ? args.status : undefined;
    if (statusFilter && !allowedStatuses.has(statusFilter)) {
      throw new Error("Status sensor tidak valid. Gunakan online, offline, maintenance, atau calibration.");
    }
    const conditions = [];
    if (statusFilter) conditions.push(eq(sensorsTable.status, statusFilter as "online" | "offline" | "maintenance" | "calibration"));

    const sensors = await db
      .select({
        id: sensorsTable.id,
        sensorCode: sensorsTable.sensorCode,
        sensorType: sensorsTable.sensorType,
        status: sensorsTable.status,
        batteryLevel: sensorsTable.batteryLevel,
        signalStrength: sensorsTable.signalStrength,
        locationId: sensorsTable.locationId,
        locationName: locationsTable.name,
        lastSeen: sensorsTable.lastSeen,
      })
      .from(sensorsTable)
      .leftJoin(locationsTable, eq(sensorsTable.locationId, locationsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(sensorsTable.status), desc(sensorsTable.lastSeen))
      .limit(20);

    const offlineCount = sensors.filter((s) => s.status === "offline").length;

    return {
      toolName: name,
      data: sensors.map((s) => ({
        ...s,
        lastSeen: s.lastSeen?.toISOString(),
      })),
      citation: {
        source: "Jaringan Telemetri Sensor IoT LANDSAFE",
        title: "Status Kesehatan & Bacaan Sensor Realtime",
        timestamp: nowStr,
        dataAsOf: latestIso(sensors.map((sensor) => sensor.lastSeen)),
        type: "sensor_telemetry",
        isSimulated: false,
      },
      summaryText: `Total ${sensors.length} sensor terpantau (${offlineCount} offline, ${sensors.length - offlineCount} aktif/operasional).`,
    };
  }

  if (name === "get_active_alerts_and_history") {
    const allowedStatuses = new Set(["active", "acknowledged", "resolved", "all"]);
    const status = typeof args.status === "string" ? args.status : "active";
    if (!allowedStatuses.has(status)) {
      throw new Error("Status peringatan tidak valid. Gunakan active, acknowledged, resolved, atau all.");
    }
    const rows = await db
      .select({
        id: alertsTable.id,
        alertType: alertsTable.alertType,
        priority: alertsTable.priority,
        status: alertsTable.status,
        message: alertsTable.message,
        locationId: alertsTable.locationId,
        locationName: locationsTable.name,
        acknowledgedAt: alertsTable.acknowledgedAt,
        resolvedAt: alertsTable.resolvedAt,
        createdAt: alertsTable.createdAt,
      })
      .from(alertsTable)
      .leftJoin(locationsTable, eq(alertsTable.locationId, locationsTable.id))
      .where(status !== "all" ? eq(alertsTable.status, status as "active" | "acknowledged" | "resolved") : undefined)
      .orderBy(desc(alertsTable.createdAt))
      .limit(15);

    return {
      toolName: name,
      data: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        acknowledgedAt: r.acknowledgedAt?.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString(),
      })),
      citation: {
        source: "Pusat Peringatan & Insiden Pusdalops BPBD",
        title: "Log Peringatan Dini Bencana",
        timestamp: nowStr,
        dataAsOf: latestIso(rows.map((row) => row.createdAt)),
        type: "official_data",
        isSimulated: false,
      },
      summaryText: `Ditemukan ${rows.length} catatan peringatan (${rows.filter((a) => a.priority === "critical").length} berstatus KRITIS).`,
    };
  }

  if (name === "get_disaster_scenarios") {
    const rows = await db
      .select()
      .from(scenariosTable)
      .orderBy(desc(scenariosTable.createdAt))
      .limit(10);

    return {
      toolName: name,
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        hazardType: r.hazardType,
        regionName: r.regionName,
        parameters: r.parameters,
        results: r.results,
        status: r.status,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
        isSimulated: true, // Crucial distinction
      })),
      citation: {
        source: "Modul Simulasi Skenario Dampak Bencana (SIMULASI)",
        title: "Perbandingan Skenario Hipotetis Dampak Bahaya",
        timestamp: nowStr,
        dataAsOf: latestIso(rows.map((row) => row.createdAt)),
        type: "simulation",
        isSimulated: true,
      },
      summaryText: `Tersedia ${rows.length} skenario simulasi hipotetis. PERHATIAN: Seluruh angka dampak adalah hasil simulasi matematis, BUKAN prediksi kejadian nyata.`,
    };
  }

  if (name === "get_all_evacuation_routes_and_evaluations") {
    const allowedStatuses = new Set(["draft", "analysis", "field_verification", "review", "approved", "published", "archived"]);
    const status = typeof args.routeStatus === "string" ? args.routeStatus : undefined;
    if (status && !allowedStatuses.has(status)) {
      throw new Error("Status rute evakuasi tidak valid.");
    }
    const conditions = [];
    if (status) {
      conditions.push(eq(
        evacuationRoutesTable.routeStatus,
        status as "draft" | "analysis" | "field_verification" | "review" | "approved" | "published" | "archived",
      ));
    }

    const routes = await db
      .select()
      .from(evacuationRoutesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(evacuationRoutesTable.updatedAt))
      .limit(10);

    return {
      toolName: name,
      data: routes.map((r) => ({
        id: r.id,
        name: r.name,
        routeCode: r.routeCode,
        originName: r.originName,
        destinationName: r.destinationName,
        regionName: r.regionName,
        routeStatus: r.routeStatus,
        distanceKm: r.distanceKm,
        estimatedTimeMinutes: r.estimatedTimeMinutes,
        maxCapacityPersons: r.maxCapacityPersons,
        hazardExposure: r.hazardExposure,
        isAccessible: r.isAccessible,
        evaluationNotes: r.evaluationNotes,
        updatedAt: r.updatedAt.toISOString(),
      })),
      citation: {
        source: "Basis Data Manajemen Rute Evakuasi BPBD",
        title: "Status Siklus Hidup Rute Evakuasi & Verifikasi",
        timestamp: nowStr,
        dataAsOf: latestIso(routes.map((route) => route.updatedAt)),
        type: "official_data",
        isSimulated: false,
      },
    };
  }

  if (name === "get_data_integration_status") {
    const sources = await db
      .select()
      .from(dataSourcesTable)
      .orderBy(asc(dataSourcesTable.agency))
      .limit(15);

    return {
      toolName: name,
      data: sources.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        agency: s.agency,
        category: s.category,
        status: s.status,
        completeness: s.completeness,
        duplicateRate: s.duplicateRate,
        isSimulated: s.isSimulated,
        lastSyncAt: s.lastSyncAt?.toISOString(),
      })),
      citation: {
        source: "Data Integration Hub Pusdalops",
        title: "Status Integrasi Feed Instansi (BMKG, PVMBG, IoT)",
        timestamp: nowStr,
        dataAsOf: latestIso(sources.map((source) => source.lastSyncAt)),
        type: "official_data",
        isSimulated: false,
      },
    };
  }

  if (name === "get_dashboard_overview") {
    const [locationStats] = await db
      .select({
        total: count(),
        danger: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'danger' THEN 1 END)`,
        alert: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'alert' THEN 1 END)`,
        watch: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'watch' THEN 1 END)`,
        normal: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'normal' THEN 1 END)`,
        lastUpdated: sql<string | null>`MAX(${locationsTable.updatedAt})::text`,
      })
      .from(locationsTable);

    const [sensorStats] = await db
      .select({
        total: count(),
        online: sql<number>`COUNT(CASE WHEN ${sensorsTable.status} = 'online' THEN 1 END)`,
        offline: sql<number>`COUNT(CASE WHEN ${sensorsTable.status} = 'offline' THEN 1 END)`,
        maintenance: sql<number>`COUNT(CASE WHEN ${sensorsTable.status} = 'maintenance' THEN 1 END)`,
        lastSeen: sql<string | null>`MAX(${sensorsTable.lastSeen})::text`,
      })
      .from(sensorsTable);

    const [alertStats] = await db
      .select({
        active: count(),
        critical: sql<number>`COUNT(CASE WHEN ${alertsTable.priority} = 'critical' THEN 1 END)`,
        latest: sql<string | null>`MAX(${alertsTable.createdAt})::text`,
      })
      .from(alertsTable)
      .where(eq(alertsTable.status, "active"));

    return {
      toolName: name,
      data: {
        locations: {
          total: Number(locationStats?.total ?? 0),
          danger: Number(locationStats?.danger ?? 0),
          alert: Number(locationStats?.alert ?? 0),
          watch: Number(locationStats?.watch ?? 0),
          normal: Number(locationStats?.normal ?? 0),
        },
        sensors: {
          total: Number(sensorStats?.total ?? 0),
          online: Number(sensorStats?.online ?? 0),
          offline: Number(sensorStats?.offline ?? 0),
          maintenance: Number(sensorStats?.maintenance ?? 0),
        },
        activeAlerts: {
          total: Number(alertStats?.active ?? 0),
          critical: Number(alertStats?.critical ?? 0),
        },
      },
      citation: {
        source: "Dashboard Operasional LANDSAFE",
        title: "Ringkasan Status Lokasi, Sensor, dan Peringatan Aktif",
        timestamp: nowStr,
        dataAsOf: latestIso([locationStats?.lastUpdated, sensorStats?.lastSeen, alertStats?.latest]),
        type: "official_data",
        isSimulated: false,
      },
      summaryText: `Terdapat ${Number(locationStats?.total ?? 0)} lokasi pantauan (${Number(locationStats?.danger ?? 0)} berstatus danger), ${Number(sensorStats?.online ?? 0)} dari ${Number(sensorStats?.total ?? 0)} sensor online, dan ${Number(alertStats?.active ?? 0)} peringatan aktif.`,
    };
  }

  if (name === "get_recent_reports") {
    const rawLimit = typeof args.limit === "number" ? args.limit : 10;
    const limit = Math.max(1, Math.min(20, Math.trunc(rawLimit)));
    const rows = await db
      .select({
        id: reportsTable.id,
        title: reportsTable.title,
        reportType: reportsTable.reportType,
        period: reportsTable.period,
        status: reportsTable.status,
        locationId: reportsTable.locationId,
        locationName: locationsTable.name,
        completedAt: reportsTable.completedAt,
        createdAt: reportsTable.createdAt,
      })
      .from(reportsTable)
      .leftJoin(locationsTable, eq(reportsTable.locationId, locationsTable.id))
      .orderBy(desc(reportsTable.createdAt))
      .limit(limit);

    return {
      toolName: name,
      data: rows.map((row) => ({
        ...row,
        completedAt: row.completedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      citation: {
        source: "Modul Laporan LANDSAFE",
        title: "Daftar Laporan Terbaru",
        timestamp: nowStr,
        dataAsOf: latestIso(rows.map((row) => row.createdAt)),
        type: "official_data",
        isSimulated: false,
      },
      summaryText: `Ditemukan ${rows.length} laporan terbaru.`,
    };
  }

  if (name === "generate_draft_mitigation_recommendation") {
    const regionName = regionFilter(args.regionName);
    if (!regionName) {
      throw new Error("Parameter regionName wajib diisi untuk menghasilkan rekomendasi mitigasi.");
    }

    const assessments = await db
      .select()
      .from(riskAssessmentsTable)
      .where(ilike(riskAssessmentsTable.regionName, `%${regionName}%`))
      .orderBy(desc(riskAssessmentsTable.riskScore))
      .limit(3);

    const assessment = assessments[0];

    const relatedPlans = await db
      .select({
        id: mitigationPlansTable.id,
        title: mitigationPlansTable.title,
        status: mitigationPlansTable.status,
        publicSummary: mitigationPlansTable.publicSummary,
        leadAgency: mitigationPlansTable.leadAgency,
        timelineStart: mitigationPlansTable.timelineStart,
        timelineEnd: mitigationPlansTable.timelineEnd,
      })
      .from(mitigationPlansTable)
      .where(ilike(mitigationPlansTable.regionName, `%${regionName}%`))
      .limit(5);

    if (!assessment) {
      return {
        toolName: name,
        data: {
          available: false,
          targetRegion: regionName,
          reason: "Tidak ada kajian risiko terverifikasi untuk wilayah ini di basis data LANDSAFE.",
          missingData: [
            "Kajian risiko komposit (hazard, exposure, vulnerability, capacity)",
            "Data kerentanan dan kapasitas wilayah",
            "Dokumen rencana mitigasi yang berlaku",
          ],
          nextSteps: [
            "Lakukan atau impor kajian risiko wilayah terlebih dahulu.",
            "Verifikasi data dengan BPBD dan instansi terkait.",
            "Jangan menyusun angka risiko atau anggaran tanpa data sumber.",
          ],
          approvalNotice: "Tidak ada draf rekomendasi yang dihasilkan karena data dasar tidak tersedia.",
        },
        citation: {
          source: "Kajian Risiko LANDSAFE",
          title: `Pemeriksaan Ketersediaan Data Mitigasi ${regionName}`,
          timestamp: nowStr,
          type: "official_data",
          isSimulated: false,
        },
        summaryText: `Data kajian risiko untuk ${regionName} tidak ditemukan. LIA tidak boleh mengarang rekomendasi atau angka.`,
      };
    }

    const indicators = assessment.indicators ?? {};
    const indicatorEntries = Object.entries(indicators).slice(0, 8);
    const dataGaps: string[] = [];
    if (!assessment.verified) dataGaps.push("Kajian risiko belum ditandai terverifikasi.");
    if (indicatorEntries.length === 0) dataGaps.push("Rincian indikator risiko belum tersedia.");
    if (relatedPlans.length === 0) dataGaps.push("Belum ada rencana mitigasi wilayah yang tercatat.");

    const recommendedActions = [
      {
        priority: assessment.riskClass === "extreme" || assessment.riskClass === "high" ? "Tinggi" : "Menengah",
        category: "structural",
        title: `Penilaian geoteknik dan perkuatan lereng di ${assessment.regionName}`,
        rationale: `Kajian risiko mencatat kelas ${assessment.riskClass} dengan skor ${assessment.riskScore}. Perlu verifikasi lapangan sebelum desain teknis.`,
        responsibleAgency: "Dinas PUPR, BPBD, dan konsultan geoteknik",
        budgetEstimate: null,
      },
      {
        priority: "Tinggi",
        category: "early_warning",
        title: "Optimalisasi pemantauan telemetri dan ambang batas peringatan",
        rationale: "Gunakan data sensor dan curah hujan aktual; jangan menetapkan ambang batas tanpa kalibrasi lapangan.",
        responsibleAgency: "BPBD, Pusdalops, dan tim teknis LANDSAFE",
        budgetEstimate: null,
      },
      {
        priority: "Menengah",
        category: "non_structural",
        title: "Gladi evakuasi dan verifikasi titik kumpul",
        rationale: "Pastikan jalur dan shelter yang digunakan sudah berstatus published/verified.",
        responsibleAgency: "Bidang Kesiapsiagaan BPBD",
        budgetEstimate: null,
      },
    ];

    return {
      toolName: name,
      data: {
        available: true,
        status: "draft_requires_human_review",
        targetRegion: assessment.regionName,
        hazardType: assessment.hazardType,
        riskClass: assessment.riskClass,
        riskScore: assessment.riskScore,
        hazardIndex: assessment.hazardIndex,
        exposureIndex: assessment.exposureIndex,
        vulnerabilityIndex: assessment.vulnerabilityIndex,
        capacityIndex: assessment.capacityIndex,
        exposedPopulation: assessment.exposedPopulation,
        verified: assessment.verified,
        assessedAt: assessment.assessedAt.toISOString(),
        indicators,
        sources: assessment.sources,
        existingPlans: relatedPlans.map((plan) => ({
          ...plan,
          timelineStart: plan.timelineStart?.toISOString() ?? null,
          timelineEnd: plan.timelineEnd?.toISOString() ?? null,
        })),
        recommendedActions,
        dataGaps,
        legalFramework: "UU No. 24/2007 tentang Penanggulangan Bencana dan Perka BNPB No. 02/2012",
        approvalNotice: "DRAF REKOMENDASI AI. Wajib ditelaah lapangan, diverifikasi pejabat berwenang, dan tidak boleh dipublikasikan otomatis. Estimasi biaya belum dihitung dan harus disusun oleh instansi teknis.",
      },
      citation: {
        source: "Kajian Risiko Regional LANDSAFE",
        title: `Draf Rekomendasi Mitigasi ${assessment.regionName}`,
        timestamp: nowStr,
        dataAsOf: assessment.assessedAt.toISOString(),
        type: "official_data",
        isSimulated: false,
      },
      summaryText: `Draf rekomendasi untuk ${assessment.regionName} disusun dari kajian risiko skor ${assessment.riskScore} (${assessment.riskClass}). Status: draf, memerlukan verifikasi manusia.`,
    };
  }

  throw new Error(`Tool tidak dikenal atau belum diimplementasikan: ${name}`);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown> = {},
  userRole: "public" | "operator" | "admin" = "public",
): Promise<ToolExecutionResult> {
  const result = await executeToolInternal(name, args, userRole);
  const retrievedAt = new Date().toISOString();
  return {
    ...result,
    citation: {
      ...result.citation,
      retrievedAt: result.citation.retrievedAt ?? retrievedAt,
      timestamp: result.citation.timestamp ?? retrievedAt,
    },
  };
}
