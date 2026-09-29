export const FEATURE_NAMES = [
  "elevation",
  "sample_count",
  "rainfall_avg",
  "rainfall_max",
  "soil_moisture_avg",
  "soil_moisture_max",
  "tilt_angle_avg",
  "tilt_angle_max",
  "acceleration_avg",
  "acceleration_max",
  "temperature_avg",
  "humidity_avg",
  "signal_quality_avg",
] as const;

export type RiskLevel = "normal" | "watch" | "alert" | "danger";

export interface LocationFeatures {
  locationId: number;
  locationName: string;
  elevation: number;
  sampleCount: number;
  rainfallAvg: number;
  rainfallMax: number;
  soilMoistureAvg: number;
  soilMoistureMax: number;
  tiltAngleAvg: number;
  tiltAngleMax: number;
  accelerationAvg: number;
  accelerationMax: number;
  temperatureAvg: number;
  humidityAvg: number;
  signalQualityAvg: number;
}

export interface PredictionDetails {
  riskLevel: RiskLevel;
  probability: number;
  confidence: number;
  potentialTriggers: string[];
  recommendedActions: string[];
  evacuationSuggested: boolean;
  explanation: string;
}

export function riskLevelFromProbability(probability: number): RiskLevel {
  if (probability >= 75) return "danger";
  if (probability >= 55) return "alert";
  if (probability >= 35) return "watch";
  return "normal";
}

export function toModelFeatures(features: LocationFeatures): number[] {
  if (features.sampleCount < 1) {
    throw new Error("XGBoost features require at least one measurement");
  }

  return [
    features.elevation,
    features.sampleCount,
    features.rainfallAvg,
    features.rainfallMax,
    features.soilMoistureAvg,
    features.soilMoistureMax,
    features.tiltAngleAvg,
    features.tiltAngleMax,
    features.accelerationAvg,
    features.accelerationMax,
    features.temperatureAvg,
    features.humidityAvg,
    features.signalQualityAvg,
  ];
}

export function buildPredictionDetails(
  features: LocationFeatures,
  probability: number,
  confidence: number,
): PredictionDetails {
  const riskLevel = riskLevelFromProbability(probability);
  const potentialTriggers: string[] = [];

  if (features.rainfallMax >= 40) potentialTriggers.push("Puncak curah hujan tinggi");
  if (features.soilMoistureMax >= 75) potentialTriggers.push("Kenaikan kelembapan tanah");
  if (features.tiltAngleMax >= 3) potentialTriggers.push("Perubahan sudut kemiringan tanah");
  if (features.accelerationMax >= 0.35) potentialTriggers.push("Getaran tanah di atas ambang");
  if (potentialTriggers.length === 0) potentialTriggers.push("Tidak ada pemicu dominan yang terdeteksi");

  const recommendedActions =
    riskLevel === "danger"
      ? ["Aktifkan prosedur evakuasi", "Verifikasi kondisi lapangan dan jalur evakuasi"]
      : riskLevel === "alert"
        ? ["Siagakan petugas lapangan", "Tingkatkan frekuensi pemantauan sensor"]
        : riskLevel === "watch"
          ? ["Pantau tren sensor", "Periksa perangkat dengan perubahan terbesar"]
          : ["Lanjutkan pemantauan rutin"];

  return {
    riskLevel,
    probability: roundMetric(probability),
    confidence: roundMetric(confidence),
    potentialTriggers,
    recommendedActions,
    evacuationSuggested: riskLevel === "danger",
    explanation:
      `XGBoost memperkirakan risiko ${riskLevel} sebesar ${roundMetric(probability)}% ` +
      `berdasarkan ${features.sampleCount} pengukuran terbaru di ${features.locationName}.`,
  };
}

function roundMetric(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}
