import { db } from "@workspace/db";
import * as schema from "@workspace/db/schema";

/**
 * Demo seed for the risk-assessment, data-hub and mitigation-planning modules.
 *
 * Everything here is deterministic example data shipped with the demo build.
 * No official feed is implied: data sources are explicitly flagged
 * `isSimulated` unless they read from this deployment's own IoT tables.
 */

type HazardType = "flood" | "landslide" | "earthquake" | "volcanic" | "tsunami" | "drought" | "strong_wind";

const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));

/** Mirrors `api-server/src/lib/risk-model.ts` (0.35/0.25/0.25/0.15 weights). */
function riskScore(h: number, e: number, v: number, c: number): number {
  return clamp(h * 0.35 + e * 0.25 + v * 0.25 + (100 - c) * 0.15);
}

function riskClass(score: number): "low" | "moderate" | "high" | "extreme" {
  if (score >= 75) return "extreme";
  if (score >= 55) return "high";
  if (score >= 35) return "moderate";
  return "low";
}

/** Mirrors the weighted criteria score used for mitigation actions. */
function criteriaScore(criteria: Record<string, number>): number {
  return clamp(
    criteria.riskReduction * 0.35 +
      criteria.urgency * 0.25 +
      criteria.costEffectiveness * 0.2 +
      criteria.feasibility * 0.15 +
      criteria.equity * 0.05,
  );
}

/**
 * Builds the four indicator groups from the composite indices so every
 * assessment exposes the same auditable breakdown shape.
 */
function buildIndicators(h: number, e: number, v: number, c: number, seed: number) {
  const drift = (i: number) => ((seed * 7 + i * 13) % 17) - 8;
  return {
    hazard: [
      { label: "Frekuensi kejadian historis", value: clamp(h + drift(1)) },
      { label: "Intensitas ancaman", value: clamp(h + drift(2)) },
      { label: "Luas wilayah terancam", value: clamp(h + drift(3)) },
    ],
    exposure: [
      { label: "Permukiman terpapar", value: clamp(e + drift(4)) },
      { label: "Fasilitas kritis terpapar", value: clamp(e + drift(5)) },
      { label: "Jaringan jalan terpapar", value: clamp(e + drift(6)) },
    ],
    vulnerability: [
      { label: "Kelompok rentan", value: clamp(v + drift(7)) },
      { label: "Kualitas bangunan", value: clamp(v + drift(8)) },
      { label: "Ketergantungan penghidupan", value: clamp(v + drift(9)) },
    ],
    capacity: [
      { label: "Cakupan peringatan dini", value: clamp(c + drift(10)) },
      { label: "Kesiapan jalur evakuasi", value: clamp(c + drift(11)) },
      { label: "Kapasitas layanan darurat", value: clamp(c + drift(12)) },
    ],
  };
}

type AssessmentSeed = {
  regionName: string;
  regionCode: string;
  province: string;
  lat: number;
  lng: number;
  extentKm: number;
  hazard: HazardType;
  population: number;
  exposedPopulation: number;
  exposedFacilities: number;
  exposedRoadsKm: number;
  hazardIndex: number;
  exposureIndex: number;
  vulnerabilityIndex: number;
  capacityIndex: number;
  verified: boolean;
  sources: string[];
};

const ASSESSMENTS: AssessmentSeed[] = [
  {
    regionName: "Banjarnegara Utara", regionCode: "3304", province: "Central Java", lat: -7.35, lng: 109.65, extentKm: 18,
    hazard: "landslide", population: 186_000, exposedPopulation: 42_500, exposedFacilities: 34, exposedRoadsKm: 18.2,
    hazardIndex: 88, exposureIndex: 72, vulnerabilityIndex: 74, capacityIndex: 41, verified: true,
    sources: ["InaRISK — contoh data", "BNPB DIBI — contoh data", "Sensor IoT LANDSAFE"],
  },
  {
    regionName: "Banjarnegara Selatan", regionCode: "3304", province: "Central Java", lat: -7.48, lng: 109.72, extentKm: 16,
    hazard: "flood", population: 142_000, exposedPopulation: 28_400, exposedFacilities: 21, exposedRoadsKm: 12.6,
    hazardIndex: 66, exposureIndex: 57, vulnerabilityIndex: 71, capacityIndex: 44, verified: false,
    sources: ["InaRISK — contoh data", "BMKG curah hujan — contoh data"],
  },
  {
    regionName: "Cilacap Selatan", regionCode: "3301", province: "Central Java", lat: -7.72, lng: 109.02, extentKm: 22,
    hazard: "flood", population: 312_000, exposedPopulation: 96_000, exposedFacilities: 51, exposedRoadsKm: 27.5,
    hazardIndex: 82, exposureIndex: 78, vulnerabilityIndex: 68, capacityIndex: 52, verified: true,
    sources: ["InaRISK — contoh data", "BMKG curah hujan — contoh data", "BPBD Jawa Tengah — contoh data"],
  },
  {
    regionName: "Semarang Timur", regionCode: "3374", province: "Central Java", lat: -6.99, lng: 110.45, extentKm: 14,
    hazard: "flood", population: 421_000, exposedPopulation: 128_000, exposedFacilities: 73, exposedRoadsKm: 34.8,
    hazardIndex: 74, exposureIndex: 86, vulnerabilityIndex: 61, capacityIndex: 63, verified: true,
    sources: ["InaRISK — contoh data", "BPBD Kota Semarang — contoh data", "Sensor IoT LANDSAFE"],
  },
  {
    regionName: "Karanganyar Timur", regionCode: "3313", province: "Central Java", lat: -7.62, lng: 111.05, extentKm: 17,
    hazard: "landslide", population: 164_000, exposedPopulation: 31_800, exposedFacilities: 19, exposedRoadsKm: 15.4,
    hazardIndex: 71, exposureIndex: 58, vulnerabilityIndex: 66, capacityIndex: 49, verified: false,
    sources: ["InaRISK — contoh data", "PVMBG gerakan tanah — contoh data"],
  },
  {
    regionName: "Magelang Utara", regionCode: "3371", province: "Central Java", lat: -7.45, lng: 110.22, extentKm: 15,
    hazard: "volcanic", population: 208_000, exposedPopulation: 46_200, exposedFacilities: 26, exposedRoadsKm: 16.9,
    hazardIndex: 84, exposureIndex: 64, vulnerabilityIndex: 59, capacityIndex: 58, verified: true,
    sources: ["PVMBG tingkat aktivitas — contoh data", "BPBD Jawa Tengah — contoh data"],
  },
  {
    regionName: "Sleman Barat", regionCode: "3404", province: "DI Yogyakarta", lat: -7.68, lng: 110.28, extentKm: 13,
    hazard: "volcanic", population: 236_000, exposedPopulation: 52_100, exposedFacilities: 31, exposedRoadsKm: 19.3,
    hazardIndex: 76, exposureIndex: 70, vulnerabilityIndex: 52, capacityIndex: 66, verified: true,
    sources: ["PVMBG tingkat aktivitas — contoh data", "InaRISK — contoh data"],
  },
  {
    regionName: "Bantul Selatan", regionCode: "3402", province: "DI Yogyakarta", lat: -7.95, lng: 110.33, extentKm: 16,
    hazard: "earthquake", population: 198_000, exposedPopulation: 58_600, exposedFacilities: 37, exposedRoadsKm: 21.7,
    hazardIndex: 72, exposureIndex: 74, vulnerabilityIndex: 63, capacityIndex: 57, verified: true,
    sources: ["Peta gempabumi BMKG — contoh data", "InaRISK — contoh data"],
  },
  {
    regionName: "Padang Barat", regionCode: "1371", province: "West Sumatra", lat: -0.95, lng: 100.35, extentKm: 12,
    hazard: "earthquake", population: 178_000, exposedPopulation: 71_400, exposedFacilities: 44, exposedRoadsKm: 14.2,
    hazardIndex: 86, exposureIndex: 72, vulnerabilityIndex: 71, capacityIndex: 48, verified: false,
    sources: ["Peta gempabumi BMKG — contoh data", "BNPB DIBI — contoh data"],
  },
  {
    regionName: "Palu Timur", regionCode: "7271", province: "Central Sulawesi", lat: -0.9, lng: 119.88, extentKm: 11,
    hazard: "tsunami", population: 132_000, exposedPopulation: 48_900, exposedFacilities: 28, exposedRoadsKm: 9.8,
    hazardIndex: 79, exposureIndex: 61, vulnerabilityIndex: 69, capacityIndex: 44, verified: true,
    sources: ["Peta rendaman tsunami BMKG — contoh data", "BNPB DIBI — contoh data"],
  },
  {
    regionName: "Lombok Utara", regionCode: "5208", province: "West Nusa Tenggara", lat: -8.35, lng: 116.15, extentKm: 19,
    hazard: "earthquake", population: 108_000, exposedPopulation: 29_700, exposedFacilities: 17, exposedRoadsKm: 11.5,
    hazardIndex: 74, exposureIndex: 55, vulnerabilityIndex: 72, capacityIndex: 42, verified: false,
    sources: ["Peta gempabumi BMKG — contoh data", "InaRISK — contoh data"],
  },
  {
    regionName: "Ende Selatan", regionCode: "5311", province: "East Nusa Tenggara", lat: -8.85, lng: 121.66, extentKm: 15,
    hazard: "volcanic", population: 96_000, exposedPopulation: 21_300, exposedFacilities: 12, exposedRoadsKm: 8.4,
    hazardIndex: 68, exposureIndex: 44, vulnerabilityIndex: 64, capacityIndex: 39, verified: false,
    sources: ["PVMBG tingkat aktivitas — contoh data"],
  },
  {
    regionName: "Kupang Timur", regionCode: "5371", province: "East Nusa Tenggara", lat: -10.18, lng: 123.65, extentKm: 24,
    hazard: "drought", population: 154_000, exposedPopulation: 38_800, exposedFacilities: 15, exposedRoadsKm: 6.2,
    hazardIndex: 63, exposureIndex: 48, vulnerabilityIndex: 76, capacityIndex: 36, verified: false,
    sources: ["BMKG kekeringan — contoh data", "BNPB DIBI — contoh data"],
  },
];


type DataSourceSeed = {
  code: string;
  name: string;
  agency: "bmkg" | "pvmbg" | "bnpb_bpbd" | "iot_sensor" | "geospatial";
  category: string;
  integrationType: "api" | "file_import" | "manual" | "simulated";
  status: "connected" | "degraded" | "unavailable" | "simulated";
  endpointUrl: string | null;
  updateFrequency: string;
  lastSyncMinutesAgo: number | null;
  lastSyncStatus: string | null;
  recordsAvailable: number;
  completeness: number;
  duplicateRate: number;
  owner: string;
  description: string;
  isSimulated: boolean;
};

const DATA_SOURCES: DataSourceSeed[] = [
  {
    code: "BMKG-OPEN", name: "BMKG Open Data — Cuaca & Peringatan Dini", agency: "bmkg", category: "Meteorologi",
    integrationType: "api", status: "unavailable", endpointUrl: "https://data.bmkg.go.id/",
    updateFrequency: "10 menit", lastSyncMinutesAgo: null,
    lastSyncStatus: "Belum terhubung — kredensial API belum dikonfigurasi pada deployment ini",
    recordsAvailable: 0, completeness: 0, duplicateRate: 0, owner: "BMKG",
    description: "Adapter siap pakai untuk prakiraan cuaca dan peringatan dini. Tidak ada koneksi resmi aktif pada demo ini.",
    isSimulated: true,
  },
  {
    code: "PVMBG-VAR", name: "PVMBG — Tingkat Aktivitas Gunung Api", agency: "pvmbg", category: "Vulkanologi",
    integrationType: "api", status: "unavailable", endpointUrl: "https://vsi.esdm.go.id/",
    updateFrequency: "6 jam", lastSyncMinutesAgo: null,
    lastSyncStatus: "Belum terhubung — integrasi memerlukan kerja sama data resmi",
    recordsAvailable: 0, completeness: 0, duplicateRate: 0, owner: "PVMBG",
    description: "Adapter status gunung api (Level I–IV). Hanya data contoh yang tersedia di deployment demo.",
    isSimulated: true,
  },
  {
    code: "BNPB-DIBI", name: "BNPB DIBI — Data Informasi Bencana Indonesia", agency: "bnpb_bpbd", category: "Kejadian bencana",
    integrationType: "file_import", status: "simulated", endpointUrl: "https://dibi.bnpb.go.id/",
    updateFrequency: "harian", lastSyncMinutesAgo: 1_260, lastSyncStatus: "Impor contoh (berkas demo)",
    recordsAvailable: 486, completeness: 92.4, duplicateRate: 1.8, owner: "BNPB",
    description: "Impor terstruktur riwayat kejadian bencana. Berkas demo, bukan unduhan resmi.",
    isSimulated: true,
  },
  {
    code: "BPBD-JTG", name: "BPBD Jawa Tengah — Laporan Harian", agency: "bnpb_bpbd", category: "Operasional BPBD",
    integrationType: "file_import", status: "simulated", endpointUrl: null,
    updateFrequency: "harian", lastSyncMinutesAgo: 540, lastSyncStatus: "Impor contoh (berkas demo)",
    recordsAvailable: 132, completeness: 88.1, duplicateRate: 3.2, owner: "BPBD Provinsi Jawa Tengah",
    description: "Rekap laporan harian pusdalops. Pada demo ini diisi dari berkas contoh.",
    isSimulated: true,
  },
  {
    code: "IOT-GATEWAY", name: "Jaringan Sensor IoT LANDSAFE", agency: "iot_sensor", category: "Telemetri lapangan",
    integrationType: "api", status: "connected", endpointUrl: "/api/measurements",
    updateFrequency: "5 menit", lastSyncMinutesAgo: 3, lastSyncStatus: "Sinkron — data internal deployment",
    recordsAvailable: 0, completeness: 96.4, duplicateRate: 0.7, owner: "Tim operasi LANDSAFE",
    description: "Satu-satunya sumber yang benar-benar aktif: membaca tabel perangkat dan pengukuran pada basis data LANDSAFE.",
    isSimulated: false,
  },
  {
    code: "INARISK-GEO", name: "InaRISK — Peta Risiko Bencana", agency: "geospatial", category: "Geospasial risiko",
    integrationType: "file_import", status: "simulated", endpointUrl: "https://inarisk.bnpb.go.id/",
    updateFrequency: "tahunan", lastSyncMinutesAgo: 10_080, lastSyncStatus: "Impor contoh (GeoJSON demo)",
    recordsAvailable: 34, completeness: 78.6, duplicateRate: 0, owner: "BNPB",
    description: "Batas administrasi dan kelas risiko contoh. Geometri pada demo ini bersifat perkiraan, bukan peta resmi.",
    isSimulated: true,
  },
  {
    code: "BIG-RBI", name: "BIG — Peta Rupabumi Indonesia", agency: "geospatial", category: "Geospasial dasar",
    integrationType: "manual", status: "unavailable", endpointUrl: "https://tanahair.indonesia.go.id/",
    updateFrequency: "tahunan", lastSyncMinutesAgo: null,
    lastSyncStatus: "Belum terhubung — memerlukan layanan WMS resmi",
    recordsAvailable: 0, completeness: 0, duplicateRate: 0, owner: "Badan Informasi Geospasial",
    description: "Layer dasar topografi. Di demo ini peta dasar memakai OpenStreetMap, bukan layanan BIG.",
    isSimulated: true,
  },
];


type LogSeed = {
  sourceCode: string;
  level: "info" | "warning" | "error";
  event: string;
  message: string;
  recordsProcessed: number;
  invalidRecords: number;
  durationMs: number;
  minutesAgo: number;
};

const INTEGRATION_LOGS: LogSeed[] = [
  { sourceCode: "IOT-GATEWAY", level: "info", event: "sync.completed", message: "Sinkronisasi telemetri selesai — 180 perangkat terbaca", recordsProcessed: 180, invalidRecords: 2, durationMs: 412, minutesAgo: 3 },
  { sourceCode: "IOT-GATEWAY", level: "warning", event: "quality.missing", message: "6 pembacaan sensor tanpa nilai tilt angle — diisi null", recordsProcessed: 180, invalidRecords: 6, durationMs: 388, minutesAgo: 63 },
  { sourceCode: "IOT-GATEWAY", level: "error", event: "device.offline", message: "Gateway DEV-JTG-014 tidak mengirim data lebih dari 4 jam", recordsProcessed: 0, invalidRecords: 1, durationMs: 5_012, minutesAgo: 240 },
  { sourceCode: "BNPB-DIBI", level: "info", event: "import.completed", message: "Impor berkas contoh DIBI selesai (486 baris)", recordsProcessed: 486, invalidRecords: 9, durationMs: 1_240, minutesAgo: 1_260 },
  { sourceCode: "BNPB-DIBI", level: "warning", event: "quality.duplicate", message: "9 baris duplikat terdeteksi pada kombinasi wilayah + tanggal", recordsProcessed: 486, invalidRecords: 9, durationMs: 1_240, minutesAgo: 1_260 },
  { sourceCode: "BPBD-JTG", level: "info", event: "import.completed", message: "Impor laporan harian BPBD selesai (132 baris)", recordsProcessed: 132, invalidRecords: 4, durationMs: 640, minutesAgo: 540 },
  { sourceCode: "INARISK-GEO", level: "info", event: "import.completed", message: "Layer GeoJSON contoh dimuat ulang (34 fitur)", recordsProcessed: 34, invalidRecords: 0, durationMs: 980, minutesAgo: 10_080 },
  { sourceCode: "BMKG-OPEN", level: "error", event: "connection.failed", message: "Tidak dapat terhubung — kredensial API belum dikonfigurasi", recordsProcessed: 0, invalidRecords: 0, durationMs: 1_500, minutesAgo: 30 },
  { sourceCode: "PVMBG-VAR", level: "error", event: "connection.failed", message: "Integrasi belum aktif — menunggu perjanjian data resmi", recordsProcessed: 0, invalidRecords: 0, durationMs: 1_500, minutesAgo: 55 },
  { sourceCode: "BIG-RBI", level: "warning", event: "connection.skipped", message: "Layanan WMS resmi belum dikonfigurasi — peta dasar memakai OpenStreetMap", recordsProcessed: 0, invalidRecords: 0, durationMs: 0, minutesAgo: 90 },
];

type PlanSeed = {
  title: string;
  regionName: string;
  province: string;
  hazard: HazardType;
  status: "draft" | "review" | "approved" | "published" | "archived";
  publicSummary: string;
  internalNotes: string;
  leadAgency: string;
  budgetTotal: number;
  startDaysAgo: number;
  endDaysAhead: number;
  publishedDaysAgo: number | null;
  actions: {
    title: string;
    description: string;
    category: string;
    agency: string;
    budget: number;
    progress: number;
    status: "planned" | "in_progress" | "completed" | "on_hold";
    criteria: Record<string, number>;
  }[];
};


const PLANS: PlanSeed[] = [
  {
    title: "Rencana Mitigasi Longsor Lereng Utara Banjarnegara",
    regionName: "Banjarnegara Utara", province: "Central Java", hazard: "landslide", status: "published",
    publicSummary:
      "Rencana penanganan longsor pada lereng utara Banjarnegara yang mencakup perkuatan lereng, perbaikan drainase, dan penguatan sistem peringatan dini berbasis komunitas. Seluruh kegiatan dijadwalkan selesai dalam 18 bulan.",
    internalNotes:
      "Prioritas 1 pusdalops. Koordinasi dengan Balai Besar Wilayah Sungai Serayu-Opak untuk pekerjaan drainase. Anggaran menunggu verifikasi TAPD.",
    leadAgency: "BPBD Kabupaten Banjarnegara", budgetTotal: 18_600_000_000,
    startDaysAgo: 120, endDaysAhead: 420, publishedDaysAgo: 21,
    actions: [
      { title: "Perkuatan lereng dengan bronjong dan bioengineering", description: "Pemasangan bronjong pada 6 titik kritis dan penanaman vegetasi berakar dalam.", category: "structural", agency: "Dinas PUPR Kab. Banjarnegara", budget: 8_400_000_000, progress: 62, status: "in_progress", criteria: { riskReduction: 92, urgency: 88, costEffectiveness: 74, feasibility: 70, equity: 80 } },
      { title: "Perbaikan jaringan drainase lereng", description: "Normalisasi saluran dan pembuatan saluran pintas sepanjang 3,4 km.", category: "structural", agency: "BBWS Serayu-Opak", budget: 4_100_000_000, progress: 48, status: "in_progress", criteria: { riskReduction: 84, urgency: 80, costEffectiveness: 82, feasibility: 76, equity: 72 } },
      { title: "Penguatan sistem peringatan dini berbasis komunitas", description: "Pelatihan 40 relawan, pemasangan sirine di 5 dusun, dan prosedur evakuasi tertulis.", category: "early_warning", agency: "BPBD Kab. Banjarnegara", budget: 1_250_000_000, progress: 75, status: "in_progress", criteria: { riskReduction: 78, urgency: 90, costEffectiveness: 94, feasibility: 88, equity: 86 } },
      { title: "Sosialisasi jalur evakuasi dan simulasi tahunan", description: "Simulasi evakuasi dua kali setahun bersama sekolah dan kelompok rentan.", category: "preparedness", agency: "BPBD Kab. Banjarnegara", budget: 450_000_000, progress: 30, status: "planned", criteria: { riskReduction: 58, urgency: 64, costEffectiveness: 90, feasibility: 92, equity: 94 } },
    ],
  },
  {
    title: "Mitigasi Banjir Pesisir Cilacap Selatan",
    regionName: "Cilacap Selatan", province: "Central Java", hazard: "flood", status: "published",
    publicSummary:
      "Program pengendalian banjir dan rob di kawasan pesisir Cilacap Selatan melalui normalisasi sungai, pembangunan pompa, serta penataan kawasan permukiman terdampak.",
    internalNotes:
      "Perlu sinkronisasi dengan proyek tanggul laut nasional. Titik pompa prioritas di Kelurahan Tegalsari.",
    leadAgency: "BPBD Kabupaten Cilacap", budgetTotal: 24_200_000_000,
    startDaysAgo: 200, endDaysAhead: 520, publishedDaysAgo: 45,
    actions: [
      { title: "Normalisasi Kali Yasa dan pembersihan sedimen", description: "Pengerukan sedimen 42.000 m³ dan perbaikan tanggul kritis.", category: "structural", agency: "BBWS Serayu-Opak", budget: 9_800_000_000, progress: 55, status: "in_progress", criteria: { riskReduction: 88, urgency: 86, costEffectiveness: 78, feasibility: 72, equity: 74 } },
      { title: "Pembangunan rumah pompa dan genset cadangan", description: "Dua rumah pompa berkapasitas 1,2 m³/detik di titik genangan utama.", category: "structural", agency: "Dinas PUPR Kab. Cilacap", budget: 7_600_000_000, progress: 35, status: "in_progress", criteria: { riskReduction: 82, urgency: 78, costEffectiveness: 70, feasibility: 66, equity: 68 } },
      { title: "Penataan drainase permukiman padat", description: "Rehabilitasi 8,2 km drainase lingkungan dan sumur resapan komunal.", category: "structural", agency: "Dinas Perumahan dan Kawasan Permukiman", budget: 5_400_000_000, progress: 20, status: "planned", criteria: { riskReduction: 70, urgency: 68, costEffectiveness: 74, feasibility: 80, equity: 82 } },
      { title: "Tim siaga banjir tingkat kelurahan", description: "Pembentukan 6 tim siaga dengan peralatan evakuasi dan pelatihan triwulanan.", category: "preparedness", agency: "BPBD Kabupaten Cilacap", budget: 1_400_000_000, progress: 80, status: "in_progress", criteria: { riskReduction: 62, urgency: 76, costEffectiveness: 92, feasibility: 90, equity: 88 } },
    ],
  },
  {
    title: "Pengendalian Genangan Kawasan Semarang Timur",
    regionName: "Semarang Timur", province: "Central Java", hazard: "flood", status: "approved",
    publicSummary:
      "Rencana pengendalian genangan di Semarang Timur melalui kolam retensi, rehabilitasi pompa, dan penguatan koordinasi lintas instansi.",
    internalNotes:
      "Status disetujui, menunggu jadwal publikasi setelah rapat koordinasi dengan Kecamatan. Catatan: kapasitas kolam perlu dikaji ulang terhadap proyeksi penurunan tanah.",
    leadAgency: "BPBD Kota Semarang", budgetTotal: 15_800_000_000,
    startDaysAgo: 40, endDaysAhead: 400, publishedDaysAgo: null,
    actions: [
      { title: "Pembangunan kolam retensi 2,4 ha", description: "Kolam retensi dengan kapasitas tampung 38.000 m³ di Kelurahan Karangturi.", category: "structural", agency: "Dinas PU Kota Semarang", budget: 8_900_000_000, progress: 12, status: "in_progress", criteria: { riskReduction: 86, urgency: 74, costEffectiveness: 68, feasibility: 62, equity: 70 } },
      { title: "Rehabilitasi 4 unit rumah pompa", description: "Penggantian pompa dan panel listrik pada empat titik rawan genangan.", category: "structural", agency: "Dinas PU Kota Semarang", budget: 4_600_000_000, progress: 25, status: "in_progress", criteria: { riskReduction: 74, urgency: 80, costEffectiveness: 82, feasibility: 78, equity: 66 } },
      { title: "Peta jalur evakuasi banjir kota", description: "Penyusunan peta jalur evakuasi dan titik kumpul resmi tingkat kecamatan.", category: "non_structural", agency: "BPBD Kota Semarang", budget: 320_000_000, progress: 0, status: "planned", criteria: { riskReduction: 54, urgency: 58, costEffectiveness: 94, feasibility: 90, equity: 90 } },
    ],
  },
  {
    title: "Kesiapsiagaan Erupsi Merapi — Sektor Magelang Utara",
    regionName: "Magelang Utara", province: "Central Java", hazard: "volcanic", status: "review",
    publicSummary:
      "Rencana kesiapsiagaan menghadapi erupsi Gunung Merapi pada sektor Magelang Utara, mencakup jalur evakuasi, titik kumpul, dan dukungan logistik pengungsian.",
    internalNotes:
      "Dalam peninjauan teknis. Perlu konfirmasi radius aman terbaru dari PVMBG sebelum disetujui.",
    leadAgency: "BPBD Kabupaten Magelang", budgetTotal: 11_200_000_000,
    startDaysAgo: 15, endDaysAhead: 300, publishedDaysAgo: null,
    actions: [
      { title: "Rehabilitasi 12 km jalur evakuasi utama", description: "Perbaikan permukaan jalan dan penerangan jalur evakuasi sektor utara.", category: "structural", agency: "Dinas PUPR Kab. Magelang", budget: 6_300_000_000, progress: 0, status: "planned", criteria: { riskReduction: 80, urgency: 84, costEffectiveness: 66, feasibility: 70, equity: 78 } },
      { title: "Penetapan dan verifikasi titik kumpul", description: "Verifikasi 9 titik kumpul dan pemasangan papan informasi resmi.", category: "non_structural", agency: "BPBD Kabupaten Magelang", budget: 540_000_000, progress: 35, status: "in_progress", criteria: { riskReduction: 58, urgency: 72, costEffectiveness: 92, feasibility: 88, equity: 84 } },
      { title: "Stok logistik pengungsian 3 hari", description: "Penyediaan buffer stock untuk 5.000 pengungsi selama 72 jam pertama.", category: "preparedness", agency: "Dinas Sosial Kab. Magelang", budget: 2_800_000_000, progress: 20, status: "in_progress", criteria: { riskReduction: 46, urgency: 88, costEffectiveness: 74, feasibility: 82, equity: 92 } },
    ],
  },
  {
    title: "Mitigasi Gerakan Tanah Karanganyar Timur",
    regionName: "Karanganyar Timur", province: "Central Java", hazard: "landslide", status: "draft",
    publicSummary:
      "Draf rencana mitigasi gerakan tanah pada lereng permukiman Karanganyar Timur, masih dalam penyusunan bersama pemerintah desa.",
    internalNotes:
      "Draf awal — data investigasi geoteknik belum lengkap. Jangan dipublikasikan sebelum verifikasi lapangan.",
    leadAgency: "BPBD Kabupaten Karanganyar", budgetTotal: 6_400_000_000,
    startDaysAgo: 5, endDaysAhead: 240, publishedDaysAgo: null,
    actions: [
      { title: "Investigasi geoteknik lereng", description: "Pengeboran dan uji tanah pada 8 titik untuk menentukan desain perkuatan.", category: "non_structural", agency: "Dinas PUPR Kab. Karanganyar", budget: 950_000_000, progress: 10, status: "in_progress", criteria: { riskReduction: 64, urgency: 70, costEffectiveness: 80, feasibility: 86, equity: 60 } },
      { title: "Pemasangan sensor pergerakan tanah tambahan", description: "Penambahan 6 titik sensor tiltmeter terintegrasi LANDSAFE.", category: "early_warning", agency: "Tim operasi LANDSAFE", budget: 780_000_000, progress: 0, status: "planned", criteria: { riskReduction: 72, urgency: 68, costEffectiveness: 88, feasibility: 90, equity: 74 } },
    ],
  },
];


type FacilitySeed = {
  name: string;
  type: "shelter" | "assembly_point" | "hospital" | "health_center" | "command_post" | "evacuation_route";
  regionName: string;
  province: string;
  address: string;
  lat: number;
  lng: number;
  capacity: number;
  occupancy: number;
  amenities: string[];
  status: "operational" | "limited" | "full" | "closed";
  isPublic: boolean;
  contact: string;
  operatingAgency: string;
  notes: string;
};

const FACILITIES: FacilitySeed[] = [
  { name: "Balai Desa Batur — Shelter Utama", type: "shelter", regionName: "Banjarnegara Utara", province: "Central Java", address: "Jl. Raya Batur No. 12, Banjarnegara", lat: -7.34, lng: 109.66, capacity: 450, occupancy: 120, amenities: ["Dapur umum", "MCK terpisah", "Genset", "Pos kesehatan"], status: "operational", isPublic: true, contact: "0812-2500-1101", operatingAgency: "BPBD Kab. Banjarnegara", notes: "Gudang logistik sayap timur dialihkan untuk stok tambahan." },
  { name: "SD Negeri 2 Wanayasa", type: "shelter", regionName: "Banjarnegara Utara", province: "Central Java", address: "Jl. Wanayasa Km 4, Banjarnegara", lat: -7.31, lng: 109.71, capacity: 280, occupancy: 60, amenities: ["Dapur umum", "MCK", "Ruang laktasi"], status: "operational", isPublic: true, contact: "0812-2500-1102", operatingAgency: "BPBD Kab. Banjarnegara", notes: "Akses jalan sempit, kendaraan besar hanya bisa sampai gerbang utama." },
  { name: "GOR Cilacap Selatan", type: "shelter", regionName: "Cilacap Selatan", province: "Central Java", address: "Jl. Nusantara No. 8, Cilacap", lat: -7.73, lng: 109.01, capacity: 900, occupancy: 540, amenities: ["Dapur umum", "MCK", "Genset", "Pos kesehatan", "Area parkir"], status: "limited", isPublic: true, contact: "0812-2500-2101", operatingAgency: "BPBD Kab. Cilacap", notes: "Kapasitas tersisa 360 orang. Koordinasi pengungsi tambahan dengan GOR Kroya." },
  { name: "Balai Kelurahan Tegalsari", type: "assembly_point", regionName: "Cilacap Selatan", province: "Central Java", address: "Jl. Tegalsari No. 3, Cilacap", lat: -7.74, lng: 109.03, capacity: 150, occupancy: 0, amenities: ["Area terbuka", "Papan informasi"], status: "operational", isPublic: true, contact: "0812-2500-2102", operatingAgency: "Kelurahan Tegalsari", notes: "Titik kumpul utama sebelum evakuasi ke GOR." },
  { name: "Lapangan Simpang Lima", type: "assembly_point", regionName: "Semarang Timur", province: "Central Java", address: "Jl. Simpang Lima, Semarang", lat: -6.99, lng: 110.42, capacity: 2_000, occupancy: 0, amenities: ["Area terbuka", "Penerangan", "Pos koordinasi"], status: "operational", isPublic: true, contact: "0812-2500-3101", operatingAgency: "BPBD Kota Semarang", notes: "Area kumpul sementara bila genangan meluas ke permukiman." },
  { name: "RSUD Dr. Moewardi", type: "hospital", regionName: "Semarang Timur", province: "Central Java", address: "Jl. Kolonel Sutarto No. 132, Surakarta", lat: -7.55, lng: 110.85, capacity: 640, occupancy: 512, amenities: ["IGD 24 jam", "Bedah", "Ruang isolasi", "Helipad"], status: "limited", isPublic: true, contact: "(0271) 634634", operatingAgency: "Pemprov Jawa Tengah", notes: "Kapasitas IGD dapat ditambah 40 bed saat status darurat." },
  { name: "RSUD Cilacap", type: "hospital", regionName: "Cilacap Selatan", province: "Central Java", address: "Jl. A. Yani No. 28, Cilacap", lat: -7.71, lng: 109.00, capacity: 420, occupancy: 365, amenities: ["IGD 24 jam", "Ruang luka bakar", "Ambulans"], status: "operational", isPublic: true, contact: "(0282) 533301", operatingAgency: "Pemkab Cilacap", notes: "Rujukan utama korban banjir pesisir." },
  { name: "RSUD Tidar Magelang", type: "hospital", regionName: "Magelang Utara", province: "Central Java", address: "Jl. Tidar No. 30, Magelang", lat: -7.47, lng: 110.21, capacity: 380, occupancy: 298, amenities: ["IGD 24 jam", "Ruang luka bakar", "Genset"], status: "operational", isPublic: true, contact: "(0293) 362245", operatingAgency: "Pemkot Magelang", notes: "Rujukan korban luka bakar erupsi." },
  { name: "Puskesmas Sleman", type: "health_center", regionName: "Sleman Barat", province: "DI Yogyakarta", address: "Jl. Magelang Km 12, Sleman", lat: -7.67, lng: 110.29, capacity: 120, occupancy: 74, amenities: ["Rawat jalan", "Ambulans", "Pos obat"], status: "operational", isPublic: true, contact: "(0274) 868101", operatingAgency: "Dinkes Sleman", notes: "Pos medis lapangan dapat diaktifkan dalam 6 jam." },
  { name: "Pusdalops BPBD Banjarnegara", type: "command_post", regionName: "Banjarnegara Utara", province: "Central Java", address: "Jl. Selamanik No. 5, Banjarnegara", lat: -7.40, lng: 109.69, capacity: 60, occupancy: 22, amenities: ["Ruang kendali", "Radio komunikasi", "Genset", "Gudang logistik"], status: "operational", isPublic: false, contact: "0812-2500-4001", operatingAgency: "BPBD Kab. Banjarnegara", notes: "Pos komando utama. Koordinat lengkap hanya untuk personel." },
  { name: "Posko Lapangan Palu Timur", type: "command_post", regionName: "Palu Timur", province: "Central Sulawesi", address: "Jl. Basuki Rahmat, Palu", lat: -0.91, lng: 119.89, capacity: 45, occupancy: 15, amenities: ["Radio komunikasi", "Tenda", "Genset"], status: "operational", isPublic: false, contact: "0812-2500-4101", operatingAgency: "BPBD Kota Palu", notes: "Posko sementara, peralatan komunikasi terbatas." },
  { name: "Jalur Evakuasi Sektor Utara Merapi", type: "evacuation_route", regionName: "Magelang Utara", province: "Central Java", address: "Ruas Srumbung — Salam (12 km)", lat: -7.44, lng: 110.24, capacity: 0, occupancy: 0, amenities: ["Penerangan jalan", "Rambu evakuasi"], status: "limited", isPublic: true, contact: "0812-2500-4201", operatingAgency: "Dinas PUPR Kab. Magelang", notes: "Tiga titik rawan longsor di km 6-8, perlu perbaikan sebelum musim hujan." },
  { name: "SMP Negeri 1 Bantul", type: "shelter", regionName: "Bantul Selatan", province: "DI Yogyakarta", address: "Jl. RA Kartini No. 18, Bantul", lat: -7.94, lng: 110.34, capacity: 320, occupancy: 0, amenities: ["Dapur umum", "MCK", "Area berkumpul"], status: "operational", isPublic: true, contact: "0812-2500-5101", operatingAgency: "BPBD Kab. Bantul", notes: "Diverifikasi sebagai shelter gempa, belum pernah dipakai." },
  { name: "GOR Lombok Utara", type: "shelter", regionName: "Lombok Utara", province: "West Nusa Tenggara", address: "Jl. Raya Tanjung, Lombok Utara", lat: -8.36, lng: 116.16, capacity: 600, occupancy: 210, amenities: ["Dapur umum", "MCK", "Genset", "Pos kesehatan"], status: "operational", isPublic: true, contact: "0812-2500-6101", operatingAgency: "BPBD Lombok Utara", notes: "Struktur tahan gempa, jalur akses lebar." },
  { name: "Lapangan Nanganui", type: "assembly_point", regionName: "Ende Selatan", province: "East Nusa Tenggara", address: "Jl. Soekarno, Ende", lat: -8.86, lng: 121.65, capacity: 800, occupancy: 0, amenities: ["Area terbuka", "Papan informasi"], status: "operational", isPublic: true, contact: "0812-2500-7101", operatingAgency: "BPBD Kab. Ende", notes: "Titik kumpul evakuasi abu vulkanik." },
];


const RESOURCES: {
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  regionName: string;
  facilityName: string | null;
  condition: string;
  allocationStatus: string;
  notes: string;
}[] = [
  { itemName: "Tenda pengungsian", category: "Perlengkapan evakuasi", quantity: 42, unit: "unit", regionName: "Banjarnegara Utara", facilityName: "Balai Desa Batur — Shelter Utama", condition: "good", allocationStatus: "allocated", notes: "24 unit terpasang, 18 unit cadangan di gudang." },
  { itemName: "Selimut", category: "Logistik pangan", quantity: 1_800, unit: "lembar", regionName: "Banjarnegara Utara", facilityName: "Balai Desa Batur — Shelter Utama", condition: "good", allocationStatus: "available", notes: "Stok buffer untuk 1.500 pengungsi." },
  { itemName: "Air bersih kemasan", category: "Air bersih", quantity: 3_200, unit: "liter", regionName: "Cilacap Selatan", facilityName: "GOR Cilacap Selatan", condition: "good", allocationStatus: "allocated", notes: "Distribusi harian 1.100 liter untuk pengungsi." },
  { itemName: "Genset 5 kVA", category: "Peralatan berat", quantity: 6, unit: "unit", regionName: "Cilacap Selatan", facilityName: "GOR Cilacap Selatan", condition: "fair", allocationStatus: "allocated", notes: "Dua unit perlu servis berkala." },
  { itemName: "Perahu karet", category: "Perlengkapan evakuasi", quantity: 8, unit: "unit", regionName: "Cilacap Selatan", facilityName: null, condition: "good", allocationStatus: "available", notes: "Disiagakan di posko pesisir." },
  { itemName: "Obat-obatan darurat", category: "Kesehatan", quantity: 240, unit: "kit", regionName: "Semarang Timur", facilityName: "RSUD Dr. Moewardi", condition: "good", allocationStatus: "available", notes: "Stok 14 hari untuk pos medis lapangan." },
  { itemName: "Ambulans", category: "Transportasi", quantity: 5, unit: "unit", regionName: "Semarang Timur", facilityName: "RSUD Dr. Moewardi", condition: "good", allocationStatus: "allocated", notes: "Dua unit siaga 24 jam." },
  { itemName: "Masker N95", category: "Kesehatan", quantity: 12_000, unit: "lembar", regionName: "Magelang Utara", facilityName: "RSUD Tidar Magelang", condition: "good", allocationStatus: "available", notes: "Untuk evakuasi abu vulkanik." },
  { itemName: "Traktor dan dump truck", category: "Peralatan berat", quantity: 4, unit: "unit", regionName: "Magelang Utara", facilityName: null, condition: "fair", allocationStatus: "maintenance", notes: "Satu unit dalam perbaikan di bengkel mitra." },
  { itemName: "Radio komunikasi HT", category: "Komunikasi", quantity: 65, unit: "unit", regionName: "Banjarnegara Utara", facilityName: "Pusdalops BPBD Banjarnegara", condition: "good", allocationStatus: "allocated", notes: "Frekuensi khusus pusdalops, tidak untuk publikasi." },
  { itemName: "Pompa air 4 inci", category: "Peralatan berat", quantity: 9, unit: "unit", regionName: "Semarang Timur", facilityName: null, condition: "good", allocationStatus: "available", notes: "Untuk penanganan genangan." },
  { itemName: "Paket makanan siap saji", category: "Logistik pangan", quantity: 4_500, unit: "paket", regionName: "Lombok Utara", facilityName: "GOR Lombok Utara", condition: "good", allocationStatus: "allocated", notes: "Stok 3 hari untuk 1.500 pengungsi." },
  { itemName: "Matras dan tikar", category: "Perlengkapan evakuasi", quantity: 950, unit: "lembar", regionName: "Bantul Selatan", facilityName: "SMP Negeri 1 Bantul", condition: "good", allocationStatus: "available", notes: "Disimpan di gudang sekolah." },
  { itemName: "Lampu sorot portabel", category: "Komunikasi", quantity: 28, unit: "unit", regionName: "Palu Timur", facilityName: "Posko Lapangan Palu Timur", condition: "fair", allocationStatus: "available", notes: "Sebagian baterai perlu diganti." },
];


const GUIDELINES: {
  title: string;
  category: string;
  audience: string;
  summary: string;
  steps: string[];
  source: string;
  sourceUrl: string;
}[] = [
  {
    title: "Kesiapsiagaan menghadapi gempa bumi",
    category: "Gempa bumi",
    audience: "public",
    summary: "Langkah dasar yang dianjurkan sebelum, saat, dan setelah gempabumi untuk keluarga dan komunitas.",
    steps: [
      "Kenali titik kumpul terdekat dan dua jalur keluar dari rumah.",
      "Amankan perabot tinggi dan kaca agar tidak jatuh saat guncangan.",
      "Saat guncangan: lindungi kepala, berlindung di bawah meja kokoh, jauhi kaca.",
      "Jangan menggunakan lift; gunakan tangga darurat setelah guncangan berhenti.",
      "Keluar ke area terbuka, jauhi bangunan dan tiang listrik.",
      "Periksa cedera, matikan aliran listrik dan gas, lalu ikuti informasi resmi BMKG/BPBD.",
    ],
    source: "Ringkasan kesiapsiagaan umum — rujuk BNPB dan BMKG untuk versi resmi terbaru.",
    sourceUrl: "https://www.bmkg.go.id/",
  },
  {
    title: "Langkah aman saat banjir",
    category: "Banjir",
    audience: "public",
    summary: "Panduan singkat menghadapi banjir dan rob di kawasan permukiman.",
    steps: [
      "Pantau informasi peringatan dini dari BMKG dan BPBD setempat.",
      "Pindahkan dokumen penting dan barang elektronik ke tempat lebih tinggi.",
      "Putuskan aliran listrik bila air mulai masuk rumah.",
      "Evakuasi lebih awal ke tempat lebih tinggi atau shelter resmi terdekat.",
      "Jangan menerobos arus banjir, terutama dengan kendaraan.",
      "Waspadai penyakit pasca-banjir dan bersihkan rumah dengan alat pelindung.",
    ],
    source: "Ringkasan kesiapsiagaan umum — rujuk BNPB dan BMKG untuk versi resmi terbaru.",
    sourceUrl: "https://www.bnpb.go.id/",
  },
  {
    title: "Mengenali tanda peringatan dini tanah longsor",
    category: "Longsor",
    audience: "public",
    summary: "Tanda-tanda awal pergerakan lereng yang perlu diwaspadai warga.",
    steps: [
      "Perhatikan retakan baru pada tanah atau dinding rumah di lereng.",
      "Waspadai pohon dan tiang listrik yang miring secara tiba-tiba.",
      "Perhatikan mata air baru atau air keruh yang muncul di lereng.",
      "Dengarkan suara gemuruh dari arah lereng, terutama saat hujan lebat.",
      "Segera menjauh ke arah samping lereng, bukan ke bawah lereng.",
      "Laporkan tanda-tanda tersebut ke kepala desa atau BPBD.",
    ],
    source: "Ringkasan kesiapsiagaan umum — rujuk PVMBG/BNPB untuk versi resmi terbaru.",
    sourceUrl: "https://vsi.esdm.go.id/",
  },
  {
    title: "Evakuasi saat erupsi gunung api",
    category: "Erupsi gunung api",
    audience: "public",
    summary: "Tindakan yang dianjurkan bila terjadi erupsi atau hujan abu vulkanik.",
    steps: [
      "Ikuti arahan radius aman dan status aktivitas dari PVMBG/BPBD.",
      "Gunakan masker dan pelindung mata saat hujan abu.",
      "Tutup wadah air dan makanan agar tidak terkontaminasi abu.",
      "Evakuasi ke shelter resmi di luar radius bahaya sesuai arahan petugas.",
      "Jangan menuju lembah atau sungai yang berhulu di gunung api.",
      "Bawa dokumen, obat pribadi, dan kebutuhan bayi/anak saat evakuasi.",
    ],
    source: "Ringkasan kesiapsiagaan umum — rujuk PVMBG untuk versi resmi terbaru.",
    sourceUrl: "https://vsi.esdm.go.id/",
  },
  {
    title: "Isi tas siaga bencana",
    category: "Umum",
    audience: "public",
    summary: "Daftar kebutuhan dasar yang sebaiknya tersedia di setiap rumah tangga.",
    steps: [
      "Air minum dan makanan siap saji untuk minimal tiga hari.",
      "Obat pribadi, kotak P3K, dan alat kebersihan diri.",
      "Senter, baterai cadangan, dan power bank.",
      "Salinan dokumen penting dalam wadah kedap air.",
      "Pakaian layak, selimut, dan uang tunai secukupnya.",
      "Nomor kontak darurat keluarga dan petugas BPBD setempat.",
    ],
    source: "Ringkasan kesiapsiagaan umum — rujuk BNPB untuk versi resmi terbaru.",
    sourceUrl: "https://www.bnpb.go.id/",
  },
  {
    title: "Kenali titik kumpul dan jalur evakuasi",
    category: "Umum",
    audience: "public",
    summary: "Cara memastikan seluruh anggota keluarga mengetahui jalur evakuasi resmi.",
    steps: [
      "Cek daftar titik kumpul dan shelter resmi pada portal ini atau papan informasi desa.",
      "Tentukan dua jalur alternatif dari rumah menuju titik kumpul.",
      "Sepakati satu titik temu bila anggota keluarga terpisah.",
      "Latih jalur evakuasi bersama keluarga minimal dua kali setahun.",
      "Catat nomor darurat BPBD dan puskesmas terdekat.",
    ],
    source: "Ringkasan kesiapsiagaan umum — rujuk BPBD setempat untuk jalur resmi.",
    sourceUrl: "https://www.bnpb.go.id/",
  },
];


const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

/**
 * Seeds the enhancement modules. Every block is skipped when the table already
 * has rows so the script stays safe to re-run.
 */
export async function seedEnhancementModules(
  actors: { adminId?: number; operatorId?: number } = {},
): Promise<void> {
  // ─── Risk assessments ──────────────────────────────────────────────────────
  console.log("🧭 Seeding risk & vulnerability assessments...");
  const [existingAssessment] = await db
    .select({ id: schema.riskAssessmentsTable.id })
    .from(schema.riskAssessmentsTable)
    .limit(1);

  const assessments = existingAssessment
    ? await db.select().from(schema.riskAssessmentsTable).orderBy(schema.riskAssessmentsTable.id)
    : await db
        .insert(schema.riskAssessmentsTable)
        .values(
          ASSESSMENTS.map((a, index) => {
            const score = riskScore(a.hazardIndex, a.exposureIndex, a.vulnerabilityIndex, a.capacityIndex);
            return {
              regionName: a.regionName,
              regionCode: a.regionCode,
              province: a.province,
              latitude: a.lat,
              longitude: a.lng,
              extentKm: a.extentKm,
              hazardType: a.hazard,
              hazardIndex: a.hazardIndex,
              exposureIndex: a.exposureIndex,
              vulnerabilityIndex: a.vulnerabilityIndex,
              capacityIndex: a.capacityIndex,
              riskScore: score,
              riskClass: riskClass(score),
              population: a.population,
              exposedPopulation: a.exposedPopulation,
              exposedFacilities: a.exposedFacilities,
              exposedRoadsKm: a.exposedRoadsKm,
              indicators: buildIndicators(
                a.hazardIndex,
                a.exposureIndex,
                a.vulnerabilityIndex,
                a.capacityIndex,
                index + 1,
              ),
              sources: a.sources,
              verified: a.verified,
              verifiedBy: a.verified ? actors.adminId ?? null : null,
              verifiedAt: a.verified ? hoursAgo(24 * (3 + index)) : null,
              assessedAt: hoursAgo(24 * (5 + (index % 6))),
            };
          }),
        )
        .returning();
  console.log(`  ✓ ${assessments.length} risk assessments available`);

  // ─── Data sources & integration logs ───────────────────────────────────────
  console.log("🔌 Seeding data integration registry...");
  const [existingSource] = await db
    .select({ id: schema.dataSourcesTable.id })
    .from(schema.dataSourcesTable)
    .limit(1);

  const deviceRows = await db.select({ id: schema.devicesTable.id }).from(schema.devicesTable);

  const sources = existingSource
    ? await db.select().from(schema.dataSourcesTable).orderBy(schema.dataSourcesTable.id)
    : await db
        .insert(schema.dataSourcesTable)
        .values(
          DATA_SOURCES.map((s) => ({
            code: s.code,
            name: s.name,
            agency: s.agency,
            category: s.category,
            integrationType: s.integrationType,
            status: s.status,
            endpointUrl: s.endpointUrl,
            updateFrequency: s.updateFrequency,
            lastSyncAt: s.lastSyncMinutesAgo === null ? null : hoursAgo(s.lastSyncMinutesAgo / 60),
            lastSyncStatus: s.lastSyncStatus,
            // The IoT adapter reports the live row count of this deployment.
            recordsAvailable: s.code === "IOT-GATEWAY" ? deviceRows.length : s.recordsAvailable,
            completeness: s.completeness,
            duplicateRate: s.duplicateRate,
            owner: s.owner,
            description: s.description,
            isSimulated: s.isSimulated,
          })),
        )
        .returning();

  const [existingLog] = await db
    .select({ id: schema.integrationLogsTable.id })
    .from(schema.integrationLogsTable)
    .limit(1);

  let logsInserted = 0;
  if (!existingLog) {
    const byCode = new Map(sources.map((s) => [s.code, s.id]));
    const logRows = INTEGRATION_LOGS.flatMap((l) => {
      const sourceId = byCode.get(l.sourceCode);
      if (!sourceId) return [];
      return [{
        sourceId,
        level: l.level,
        event: l.event,
        message: l.message,
        recordsProcessed: l.recordsProcessed,
        invalidRecords: l.invalidRecords,
        durationMs: l.durationMs,
        actorId: actors.operatorId ?? null,
        createdAt: hoursAgo(l.minutesAgo / 60),
      }];
    });
    if (logRows.length > 0) {
      await db.insert(schema.integrationLogsTable).values(logRows);
      logsInserted = logRows.length;
    }
  }
  console.log(`  ✓ ${sources.length} data sources, ${logsInserted} integration log entries`);


  // ─── Facilities, resources & public guidelines ─────────────────────────────
  console.log("🏥 Seeding evacuation facilities...");
  const [existingFacility] = await db
    .select({ id: schema.facilitiesTable.id })
    .from(schema.facilitiesTable)
    .limit(1);

  const facilities = existingFacility
    ? await db.select().from(schema.facilitiesTable).orderBy(schema.facilitiesTable.id)
    : await db
        .insert(schema.facilitiesTable)
        .values(
          FACILITIES.map((f, index) => ({
            name: f.name,
            type: f.type,
            regionName: f.regionName,
            province: f.province,
            address: f.address,
            latitude: f.lat,
            longitude: f.lng,
            capacity: f.capacity,
            occupancy: f.occupancy,
            amenities: f.amenities,
            status: f.status,
            isPublic: f.isPublic,
            contact: f.contact,
            operatingAgency: f.operatingAgency,
            notes: f.notes,
            verifiedAt: hoursAgo(24 * (2 + (index % 9))),
          })),
        )
        .returning();

  console.log("📦 Seeding resource inventory...");
  const [existingResource] = await db
    .select({ id: schema.resourcesTable.id })
    .from(schema.resourcesTable)
    .limit(1);

  let resourcesInserted = 0;
  if (!existingResource) {
    const facilityByName = new Map(facilities.map((f) => [f.name, f.id]));
    const resourceRows = RESOURCES.map((r, index) => ({
      itemName: r.itemName,
      category: r.category,
      quantity: r.quantity,
      unit: r.unit,
      regionName: r.regionName,
      facilityId: r.facilityName ? facilityByName.get(r.facilityName) ?? null : null,
      condition: r.condition,
      allocationStatus: r.allocationStatus,
      notes: r.notes,
      updatedBy: actors.operatorId ?? null,
      lastUpdated: hoursAgo(2 + index * 3),
    }));
    await db.insert(schema.resourcesTable).values(resourceRows);
    resourcesInserted = resourceRows.length;
  }
  console.log(`  ✓ ${facilities.length} facilities, ${resourcesInserted} resource items`);

  console.log("📘 Seeding public preparedness guidelines...");
  const [existingGuideline] = await db
    .select({ id: schema.preparednessGuidelinesTable.id })
    .from(schema.preparednessGuidelinesTable)
    .limit(1);

  let guidelinesInserted = 0;
  if (!existingGuideline) {
    const guidelineRows = GUIDELINES.map((g, index) => ({
      title: g.title,
      category: g.category,
      audience: g.audience,
      summary: g.summary,
      steps: g.steps,
      source: g.source,
      sourceUrl: g.sourceUrl,
      isPublic: true,
      updatedAt: hoursAgo(24 * (10 + index * 7)),
    }));
    await db.insert(schema.preparednessGuidelinesTable).values(guidelineRows);
    guidelinesInserted = guidelineRows.length;
  }
  console.log(`  ✓ ${guidelinesInserted} public guidelines inserted`);


  // ─── Mitigation plans & actions ────────────────────────────────────────────
  console.log("🛠️  Seeding mitigation plans...");
  const [existingPlan] = await db
    .select({ id: schema.mitigationPlansTable.id })
    .from(schema.mitigationPlansTable)
    .limit(1);

  let plansInserted = 0;
  let actionsInserted = 0;
  if (!existingPlan) {
    for (const p of PLANS) {
      const linked = assessments.find((a) => a.regionName === p.regionName && a.hazardType === p.hazard);
      const isPublished = p.status === "published";
      const isApproved = p.status === "approved" || isPublished;

      const [plan] = await db
        .insert(schema.mitigationPlansTable)
        .values({
          title: p.title,
          regionName: p.regionName,
          province: p.province,
          hazardType: p.hazard,
          assessmentId: linked?.id ?? null,
          status: p.status,
          publicSummary: p.publicSummary,
          internalNotes: p.internalNotes,
          leadAgency: p.leadAgency,
          budgetTotal: p.budgetTotal,
          timelineStart: daysAgo(p.startDaysAgo),
          timelineEnd: daysFromNow(p.endDaysAhead),
          version: 1,
          createdBy: actors.operatorId ?? null,
          reviewedBy: p.status === "draft" ? null : actors.adminId ?? null,
          reviewedAt: p.status === "draft" ? null : daysAgo(18),
          approvedBy: isApproved ? actors.adminId ?? null : null,
          approvedAt: isApproved ? daysAgo(12) : null,
          publishedAt: isPublished && p.publishedDaysAgo !== null ? daysAgo(p.publishedDaysAgo) : null,
        })
        .returning();

      if (!plan) continue;
      plansInserted += 1;

      const actionRows = p.actions.map((a, index) => ({
        planId: plan.id,
        title: a.title,
        description: a.description,
        category: a.category,
        responsibleAgency: a.agency,
        startDate: daysAgo(Math.max(1, p.startDaysAgo - index * 5)),
        endDate: daysFromNow(Math.max(30, p.endDaysAhead - index * 20)),
        budget: a.budget,
        progress: a.progress,
        status: a.status,
        priorityScore: criteriaScore(a.criteria),
        criteria: a.criteria,
        sortOrder: index,
      }));
      await db.insert(schema.mitigationActionsTable).values(actionRows);
      actionsInserted += actionRows.length;
    }
  }
  console.log(`  ✓ ${plansInserted} mitigation plans, ${actionsInserted} actions inserted`);
}

