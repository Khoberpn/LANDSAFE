export interface LiaModuleContext {
  id: string;
  label: string;
  description: string;
}

export const LIA_MODULES: Record<string, LiaModuleContext> = {
  dashboard: { id: 'dashboard', label: 'Dashboard', description: 'Ringkasan operasional LANDSAFE' },
  'live-map': { id: 'live-map', label: 'Peta Langsung', description: 'Sebaran lokasi dan layer risiko' },
  'ai-analytics': { id: 'ai-analytics', label: 'AI Analytics', description: 'Keluaran model XGBoost' },
  'sensor-analytics': { id: 'sensor-analytics', label: 'Analitik Sensor', description: 'Telemetri sensor IoT' },
  'risk-assessment': { id: 'risk-assessment', label: 'Kajian Risiko', description: 'Indeks risiko komposit wilayah' },
  'scenario-analysis': { id: 'scenario-analysis', label: 'Analisis Skenario', description: 'Simulasi dampak hipotetis' },
  'mitigation-planning': { id: 'mitigation-planning', label: 'Perencanaan Mitigasi', description: 'Prioritas dan rencana mitigasi' },
  evacuation: { id: 'evacuation', label: 'Rute Evakuasi', description: 'Rute, shelter, dan verifikasi lapangan' },
  alerts: { id: 'alerts', label: 'Pusat Peringatan', description: 'Peringatan aktif dan riwayat' },
  'data-hub': { id: 'data-hub', label: 'Hub Integrasi Data', description: 'Kualitas dan integrasi data' },
  reports: { id: 'reports', label: 'Laporan', description: 'Penyusunan laporan decision support' },
  devices: { id: 'devices', label: 'Perangkat', description: 'Status perangkat dan sensor' },
  administration: { id: 'administration', label: 'Administrasi', description: 'Pengguna, audit, dan pengaturan' },
  general: { id: 'general', label: 'LANDSAFE', description: 'Asisten intelijen kebencanaan' },
};

const PATH_TO_MODULE: Array<{ pattern: RegExp; module: string }> = [
  { pattern: /^\/dashboard/, module: 'dashboard' },
  { pattern: /^\/live-map/, module: 'live-map' },
  { pattern: /^\/ai-risk/, module: 'ai-analytics' },
  { pattern: /^\/sensor-analytics/, module: 'sensor-analytics' },
  { pattern: /^\/risk-assessment/, module: 'risk-assessment' },
  { pattern: /^\/scenario-analysis/, module: 'scenario-analysis' },
  { pattern: /^\/mitigation/, module: 'mitigation-planning' },
  { pattern: /^\/evacuation-routes/, module: 'evacuation' },
  { pattern: /^\/public\/evacuation/, module: 'evacuation' },
  { pattern: /^\/evacuation/, module: 'evacuation' },
  { pattern: /^\/alerts/, module: 'alerts' },
  { pattern: /^\/data-hub/, module: 'data-hub' },
  { pattern: /^\/reports/, module: 'reports' },
  { pattern: /^\/devices/, module: 'devices' },
  { pattern: /^\/(users|audit|settings)/, module: 'administration' },
  { pattern: /^\/public\/mitigation/, module: 'mitigation-planning' },
];

export function moduleForPath(pathname: string): LiaModuleContext {
  const match = PATH_TO_MODULE.find((entry) => entry.pattern.test(pathname));
  return LIA_MODULES[match?.module ?? 'general'] ?? LIA_MODULES.general;
}

export function moduleById(id: string): LiaModuleContext {
  return LIA_MODULES[id] ?? LIA_MODULES.general;
}
