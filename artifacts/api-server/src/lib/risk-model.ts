/**
 * Transparent, deterministic risk & impact model shared by the risk assessment
 * and scenario analysis endpoints.
 *
 * Nothing here is a trained prediction model: every number is derived from
 * stored indicators and user-configured scenario parameters with the fixed
 * weights documented below, so operators can audit how a figure was produced.
 */

export type RiskInputs = {
  hazardIndex: number;
  exposureIndex: number;
  vulnerabilityIndex: number;
  capacityIndex: number;
};

/** Weighting used by the composite risk index (documented in the UI). */
export const RISK_WEIGHTS = {
  hazard: 0.35,
  exposure: 0.25,
  vulnerability: 0.25,
  /** Capacity reduces risk, so it enters the formula inverted. */
  capacity: 0.15,
} as const;

export const PRIORITY_WEIGHTS = {
  riskReduction: 0.35,
  urgency: 0.25,
  costEffectiveness: 0.2,
  feasibility: 0.15,
  equity: 0.05,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 1) => Number(value.toFixed(digits));

export function computeRiskScore(input: RiskInputs): number {
  const score =
    input.hazardIndex * RISK_WEIGHTS.hazard +
    input.exposureIndex * RISK_WEIGHTS.exposure +
    input.vulnerabilityIndex * RISK_WEIGHTS.vulnerability +
    (100 - clamp(input.capacityIndex, 0, 100)) * RISK_WEIGHTS.capacity;
  return round(clamp(score, 0, 100));
}

export type RiskClass = "low" | "moderate" | "high" | "extreme";

export function classifyRisk(score: number): RiskClass {
  if (score >= 75) return "extreme";
  if (score >= 55) return "high";
  if (score >= 35) return "moderate";
  return "low";
}

export type ScenarioParameters = {
  intensity: number;
  durationHours: number;
  rainfallMm: number;
  season: "dry" | "transition" | "wet";
  timeOfDay: "day" | "night";
  warningLeadTimeHours: number;
};

export type ScenarioResults = {
  affectedPopulation: number;
  affectedVulnerableGroups: number;
  displacedPopulation: number;
  medicalNeeds: number;
  affectedFacilities: number;
  affectedRoadsKm: number;
  economicLossIdrBillion: number;
  impactLevel: "limited" | "moderate" | "severe" | "critical";
  sectorImpacts: { sector: string; impact: number; note: string }[];
  reliefNeeds: { category: string; quantity: number; unit: string }[];
  responsePhases: { phase: string; window: string; focus: string }[];
  modelNotes: string[];
};

const RAIN_SENSITIVE = new Set(["flood", "landslide", "strong_wind", "drought"]);

/**
 * Estimates the impact of a hypothetical event. The returned figures are
 * indicative planning estimates, not forecasts of a real event.
 */
export function computeScenarioImpact(
  assessment: {
    hazardType: string;
    population: number;
    exposedPopulation: number;
    exposedFacilities: number;
    exposedRoadsKm: number;
    vulnerabilityIndex: number;
  },
  params: ScenarioParameters,
): ScenarioResults {
  const severity = clamp(params.intensity / 100, 0.05, 1);
  const durationFactor = clamp(0.6 + (params.durationHours / 48) * 0.4, 0.6, 1.3);
  const rainFactor = RAIN_SENSITIVE.has(assessment.hazardType)
    ? clamp(1 + (params.rainfallMm - 60) / 320, 0.85, 1.55)
    : 1;
  const seasonFactor = params.season === "wet" ? 1.12 : params.season === "dry" ? 0.92 : 1;
  const timeFactor = params.timeOfDay === "night" ? 1.08 : 1;
  const leadTimeFactor = 1.12 - clamp(params.warningLeadTimeHours / 24, 0, 1) * 0.22;
  const compoundFactor = durationFactor * rainFactor * seasonFactor * timeFactor * leadTimeFactor;

  const affectedPopulation = Math.min(
    assessment.population,
    Math.round(assessment.exposedPopulation * severity * compoundFactor),
  );
  const vulnerableShare = clamp(0.18 + (assessment.vulnerabilityIndex / 100) * 0.22, 0.15, 0.45);
  const displacedPopulation = Math.min(
    affectedPopulation,
    Math.round(affectedPopulation * clamp(0.12 + severity * 0.28, 0.1, 0.45)),
  );
  const affectedFacilities = Math.min(
    assessment.exposedFacilities,
    Math.round(assessment.exposedFacilities * severity * clamp(compoundFactor, 0.7, 1.5)),
  );
  const affectedRoadsKm = round(assessment.exposedRoadsKm * severity * clamp(compoundFactor, 0.7, 1.5), 1);
  const economicLossIdrBillion = round(
    (affectedPopulation * 1_200_000 + affectedFacilities * 850_000_000 + affectedRoadsKm * 1_500_000_000) /
      1_000_000_000,
    2,
  );

  const impactRatio = affectedPopulation / Math.max(assessment.exposedPopulation, 1);
  const impactLevel: ScenarioResults["impactLevel"] =
    impactRatio >= 0.7 ? "critical" : impactRatio >= 0.45 ? "severe" : impactRatio >= 0.2 ? "moderate" : "limited";


  const sectorImpacts = [
    {
      sector: "Permukiman",
      impact: Math.round(clamp(severity * compoundFactor * 100, 0, 100)),
      note: "Kerusakan rumah tinggal dan kebutuhan hunian sementara",
    },
    {
      sector: "Kesehatan",
      impact: Math.round(clamp(severity * 100 * (1 + assessment.vulnerabilityIndex / 260), 0, 100)),
      note: "Beban layanan medis darurat dan kesehatan lingkungan",
    },
    {
      sector: "Transportasi",
      impact: Math.round(clamp((affectedRoadsKm / 40) * 100, 0, 100)),
      note: "Keterputusan akses jalan dan jembatan penghubung",
    },
    {
      sector: "Air & sanitasi",
      impact: Math.round(clamp(severity * compoundFactor * 92, 0, 100)),
      note: "Kerusakan jaringan air bersih dan risiko penyakit menular",
    },
    {
      sector: "Pendidikan",
      impact: Math.round(clamp(severity * compoundFactor * 78, 0, 100)),
      note: "Bangunan sekolah terdampak dan kegiatan belajar terhenti",
    },
    {
      sector: "Ekonomi lokal",
      impact: Math.round(clamp(severity * compoundFactor * 84, 0, 100)),
      note: "Gangguan aktivitas pasar, pertanian, dan mata pencaharian",
    },
  ];

  const reliefNeeds = [
    { category: "Terpal dan hunian sementara", quantity: Math.ceil(displacedPopulation / 5), unit: "unit" },
    { category: "Air bersih", quantity: Math.ceil(affectedPopulation * 15), unit: "liter/hari" },
    { category: "Paket makanan", quantity: Math.ceil(affectedPopulation * 3), unit: "paket" },
    { category: "Kit medis darurat", quantity: Math.max(10, Math.ceil(affectedPopulation / 120)), unit: "kit" },
    { category: "Selimut", quantity: Math.ceil(displacedPopulation * 1.2), unit: "lembar" },
    { category: "Genset portabel", quantity: Math.max(2, Math.ceil(affectedFacilities * 0.6)), unit: "unit" },
  ];

  const responsePhases = [
    { phase: "Fase tanggap darurat", window: "0–72 jam", focus: "Penyelamatan, evakuasi, dan pemenuhan kebutuhan dasar" },
    { phase: "Fase stabilisasi", window: "4–14 hari", focus: "Verifikasi kerusakan, layanan kesehatan, dan hunian sementara" },
    { phase: "Fase pemulihan awal", window: "1–6 bulan", focus: "Perbaikan infrastruktur kritis dan pemulihan penghidupan" },
  ];

  return {
    affectedPopulation,
    affectedVulnerableGroups: Math.round(affectedPopulation * vulnerableShare),
    displacedPopulation,
    medicalNeeds: Math.round(affectedPopulation * clamp(0.02 + severity * 0.05, 0.02, 0.08)),
    affectedFacilities,
    affectedRoadsKm,
    economicLossIdrBillion,
    impactLevel,
    sectorImpacts,
    reliefNeeds,
    responsePhases,
    modelNotes: [
      "Angka merupakan estimasi perencanaan dari parameter skenario yang dikonfigurasi, bukan prediksi kejadian nyata.",
      `Faktor gabungan: durasi ×${round(durationFactor, 2)}, curah hujan ×${round(rainFactor, 2)}, musim ×${round(seasonFactor, 2)}, waktu ×${round(timeFactor, 2)}, jeda peringatan ×${round(leadTimeFactor, 2)}.`,
      "Populasi terdampak dibatasi oleh jumlah penduduk dan populasi terpapar pada data penilaian risiko.",
    ],
  };
}

export function scoreAction(criteria: Record<string, number>): number {
  const total = Object.entries(PRIORITY_WEIGHTS).reduce((sum, [key, weight]) => {
    return sum + clamp(Number(criteria[key] ?? 0), 0, 100) * weight;
  }, 0);
  return round(clamp(total, 0, 100));
}

export const PRIORITY_CRITERIA = [
  { key: "riskReduction", label: "Potensi penurunan risiko", weight: PRIORITY_WEIGHTS.riskReduction },
  { key: "urgency", label: "Urgensi implementasi", weight: PRIORITY_WEIGHTS.urgency },
  { key: "costEffectiveness", label: "Efektivitas biaya", weight: PRIORITY_WEIGHTS.costEffectiveness },
  { key: "feasibility", label: "Kelayakan teknis", weight: PRIORITY_WEIGHTS.feasibility },
  { key: "equity", label: "Pemerataan manfaat", weight: PRIORITY_WEIGHTS.equity },
] as const;

