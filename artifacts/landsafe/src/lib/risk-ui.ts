/**
 * Shared presentation helpers for the risk, scenario, data-hub and mitigation
 * modules. Keeping labels/colours here guarantees one visual language across
 * the new pages.
 */

export const HAZARD_LABELS: Record<string, string> = {
  flood: 'Banjir',
  landslide: 'Tanah longsor',
  earthquake: 'Gempabumi',
  volcanic: 'Erupsi gunung api',
  tsunami: 'Tsunami',
  drought: 'Kekeringan',
  strong_wind: 'Angin kencang',
};

export const hazardLabel = (hazard?: string | null) =>
  (hazard && HAZARD_LABELS[hazard]) || hazard || 'Tidak diketahui';

export const RISK_CLASS_META: Record<
  string,
  { label: string; color: string; chip: string; bar: string }
> = {
  extreme: {
    label: 'Sangat tinggi',
    color: '#B91C1C',
    chip: 'border-destructive/30 bg-destructive/10 text-destructive',
    bar: 'bg-destructive',
  },
  high: {
    label: 'Tinggi',
    color: '#C2410C',
    chip: 'border-warning/40 bg-warning/10 text-warning',
    bar: 'bg-warning',
  },
  moderate: {
    label: 'Sedang',
    color: '#B45309',
    chip: 'border-border bg-secondary text-foreground',
    bar: 'bg-foreground/40',
  },
  low: {
    label: 'Rendah',
    color: '#0F766E',
    chip: 'border-success/30 bg-success/10 text-success',
    bar: 'bg-success',
  },
};

export const riskMeta = (riskClass?: string | null) =>
  (riskClass && RISK_CLASS_META[riskClass]) || RISK_CLASS_META.low;

export const PLAN_STATUS_META: Record<string, { label: string; chip: string }> = {
  draft: { label: 'Draf', chip: 'border-border bg-secondary text-muted-foreground' },
  review: { label: 'Dalam tinjauan', chip: 'border-warning/40 bg-warning/10 text-warning' },
  approved: { label: 'Disetujui', chip: 'border-info/30 bg-info/10 text-info' },
  published: { label: 'Dipublikasikan', chip: 'border-success/30 bg-success/10 text-success' },
  archived: { label: 'Diarsipkan', chip: 'border-border bg-background text-muted-foreground' },
};

export const planStatusMeta = (status?: string | null) =>
  (status && PLAN_STATUS_META[status]) || PLAN_STATUS_META.draft;

export const SOURCE_STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  connected: { label: 'Terhubung', chip: 'border-success/30 bg-success/10 text-success', dot: 'bg-success' },
  degraded: { label: 'Terdegradasi', chip: 'border-warning/40 bg-warning/10 text-warning', dot: 'bg-warning' },
  unavailable: { label: 'Belum terhubung', chip: 'border-destructive/30 bg-destructive/10 text-destructive', dot: 'bg-destructive' },
  simulated: { label: 'Data contoh', chip: 'border-border bg-secondary text-muted-foreground', dot: 'bg-muted-foreground' },
};

export const sourceStatusMeta = (status?: string | null) =>
  (status && SOURCE_STATUS_META[status]) || SOURCE_STATUS_META.simulated;

export const AGENCY_LABELS: Record<string, string> = {
  bmkg: 'BMKG',
  pvmbg: 'PVMBG',
  bnpb_bpbd: 'BNPB / BPBD',
  iot_sensor: 'Sensor IoT',
  geospatial: 'Geospasial',
};

export const FACILITY_TYPE_META: Record<string, { label: string; color: string }> = {
  shelter: { label: 'Shelter pengungsian', color: '#2563EB' },
  assembly_point: { label: 'Titik kumpul', color: '#0EA5A5' },
  hospital: { label: 'Rumah sakit', color: '#B91C1C' },
  health_center: { label: 'Puskesmas', color: '#C2410C' },
  command_post: { label: 'Pos komando', color: '#102A4C' },
  evacuation_route: { label: 'Jalur evakuasi', color: '#7C3AED' },
};

export const facilityTypeMeta = (type?: string | null) =>
  (type && FACILITY_TYPE_META[type]) || { label: type ?? 'Fasilitas', color: '#102A4C' };

export const FACILITY_STATUS_LABELS: Record<string, string> = {
  operational: 'Beroperasi',
  limited: 'Kapasitas terbatas',
  full: 'Penuh',
  closed: 'Ditutup',
};

export const PRIORITY_META: Record<string, { label: string; chip: string }> = {
  immediate: { label: 'Prioritas segera', chip: 'border-destructive/30 bg-destructive/10 text-destructive' },
  high: { label: 'Prioritas tinggi', chip: 'border-warning/40 bg-warning/10 text-warning' },
  planned: { label: 'Terencana', chip: 'border-info/30 bg-info/10 text-info' },
  monitor: { label: 'Pemantauan', chip: 'border-border bg-secondary text-muted-foreground' },
};

export const priorityMeta = (priority?: string | null) =>
  (priority && PRIORITY_META[priority]) || PRIORITY_META.monitor;

export const INTERVENTION_CATEGORY_LABELS: Record<string, string> = {
  structural: 'Struktural',
  non_structural: 'Non-struktural',
  preparedness: 'Kesiapsiagaan',
  early_warning: 'Peringatan dini',
};

export const ACTION_STATUS_LABELS: Record<string, string> = {
  planned: 'Direncanakan',
  in_progress: 'Berjalan',
  completed: 'Selesai',
  on_hold: 'Ditunda',
};

export const RESOURCE_STATUS_LABELS: Record<string, string> = {
  available: 'Tersedia',
  allocated: 'Dialokasikan',
  maintenance: 'Perawatan',
  depleted: 'Habis',
};

export const ACTION_STATUS_OPTIONS = ['planned', 'in_progress', 'completed', 'on_hold'];
export const RESOURCE_STATUS_OPTIONS = ['available', 'allocated', 'maintenance', 'depleted'];
export const RESOURCE_CONDITION_OPTIONS = ['good', 'fair', 'damaged'];
export const FACILITY_STATUS_OPTIONS = ['operational', 'limited', 'full', 'closed'];

// ─── Formatters ──────────────────────────────────────────────────────────────

const numberFormat = new Intl.NumberFormat('id-ID');

export const formatNumber = (value?: number | null) =>
  value === null || value === undefined ? '—' : numberFormat.format(Math.round(value));

export const formatDecimal = (value?: number | null, digits = 1) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

export const formatCompact = (value?: number | null) => {
  if (value === null || value === undefined) return '—';
  if (Math.abs(value) >= 1_000_000_000) return `${formatDecimal(value / 1_000_000_000, 1)} M`;
  if (Math.abs(value) >= 1_000_000) return `${formatDecimal(value / 1_000_000, 1)} jt`;
  if (Math.abs(value) >= 1_000) return `${formatDecimal(value / 1_000, 1)} rb`;
  return formatNumber(value);
};

export const formatIdr = (value?: number | null) => {
  if (value === null || value === undefined) return '—';
  if (Math.abs(value) >= 1_000_000_000) return `Rp ${formatDecimal(value / 1_000_000_000, 2)} miliar`;
  if (Math.abs(value) >= 1_000_000) return `Rp ${formatDecimal(value / 1_000_000, 1)} juta`;
  return `Rp ${formatNumber(value)}`;
};

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
};

export const formatRelative = (value?: string | null) => {
  if (!value) return 'belum pernah';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'belum pernah';
  const diffMinutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return 'baru saja';
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return formatDate(value);
};

export const toIsoDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const todayInput = () => new Date().toISOString().slice(0, 10);

export const ROUTE_STATUS_META: Record<string, { label: string; chip: string; description: string }> = {
  draft: { label: 'Draf', chip: 'border-border bg-secondary text-muted-foreground', description: 'Rancangan awal belum diverifikasi' },
  analysis: { label: 'Analisis GIS', chip: 'border-blue-400/40 bg-blue-500/10 text-blue-600', description: 'Sedang dalam pengujian jaringan jalan & hidrologi' },
  field_verification: { label: 'Verifikasi Lapangan', chip: 'border-amber-400/40 bg-amber-500/10 text-amber-600', description: 'Pemeriksaan fisik oleh Tim Reaksi Cepat BPBD' },
  review: { label: 'Peninjauan Pimpinan', chip: 'border-purple-400/40 bg-purple-500/10 text-purple-600', description: 'Menunggu review teknis struktural BPBD' },
  approved: { label: 'Disetujui', chip: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600', description: 'Disetujui kepala pelaksana BPBD, siap terbit' },
  published: { label: 'Terbit Publik', chip: 'border-green-600/50 bg-green-500/15 text-green-700 font-bold', description: 'Rute resmi disahkan dan dapat diakses warga publik' },
  archived: { label: 'Diarsipkan', chip: 'border-border bg-secondary text-muted-foreground', description: 'Jalur tidak aktif atau digantikan rute baru' },
};

export const routeStatusMeta = (status?: string | null) =>
  (status && ROUTE_STATUS_META[status]) || ROUTE_STATUS_META.draft;

export const HAZARD_EXPOSURE_META: Record<string, { label: string; color: string; badge: string }> = {
  none: { label: 'Bebas Bahaya', color: '#16A34A', badge: 'bg-green-100 text-green-800 border-green-300' },
  low: { label: 'Paparan Rendah', color: '#059669', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  moderate: { label: 'Paparan Sedang', color: '#D97706', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  high: { label: 'Paparan Tinggi', color: '#DC2626', badge: 'bg-red-100 text-red-800 border-red-300' },
};

export const hazardExposureMeta = (exposure?: string | null) =>
  (exposure && HAZARD_EXPOSURE_META[exposure]) || HAZARD_EXPOSURE_META.none;

export const ROAD_CONDITION_META: Record<string, { label: string; color: string; chip: string }> = {
  good: { label: 'Baik / Lancar', color: '#16A34A', chip: 'bg-green-50 text-green-700 border-green-200' },
  fair: { label: 'Cukup / Waspada', color: '#D97706', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  poor: { label: 'Buruk / Rusak Ringan', color: '#EA580C', chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  damaged: { label: 'Rusak Berat', color: '#DC2626', chip: 'bg-red-50 text-red-700 border-red-200' },
  impassable: { label: 'Terputus / Tak Dapat Dilalui', color: '#991B1B', chip: 'bg-red-100 text-red-900 border-red-400 font-bold' },
  unknown: { label: 'Belum Terdata', color: '#6B7280', chip: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export const roadConditionMeta = (cond?: string | null) =>
  (cond && ROAD_CONDITION_META[cond]) || ROAD_CONDITION_META.unknown;

export const ROUTE_TYPE_META: Record<string, { label: string; color: string; badge: string }> = {
  primary: { label: 'Rute Utama Resmi', color: '#2563EB', badge: 'bg-[#102A4C] text-white border-[#183B63]' },
  alternative: { label: 'Rute Alternatif', color: '#7C3AED', badge: 'bg-purple-100 text-purple-800 border-purple-300' },
};

export const routeTypeMeta = (type?: string | null) =>
  (type && ROUTE_TYPE_META[type]) || ROUTE_TYPE_META.primary;


