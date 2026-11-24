import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Popup,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  useGetRiskAssessments,
  useGetRiskSummary,
  useGetRiskRankings,
  useVerifyRiskAssessment,
  useGetLocations,
  useGetMitigationFacilities,
  getGetRiskAssessmentsQueryKey,
  getGetRiskSummaryQueryKey,
  getGetRiskRankingsQueryKey,
  getGetLocationsQueryKey,
  getGetMitigationFacilitiesQueryKey,
} from '@workspace/api-client-react';
import {
  ShieldAlert,
  MapPin,
  Search,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building2,
  GitCompare,
  Layers,
  Activity,
  BadgeCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  HAZARD_LABELS,
  hazardLabel,
  riskMeta,
  RISK_CLASS_META,
  facilityTypeMeta,
  formatNumber,
  formatDecimal,
  formatDate,
  formatCompact,
} from '@/lib/risk-ui';

function MapFix() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

const HAZARD_OPTIONS = Object.keys(HAZARD_LABELS);
const CLASS_OPTIONS = ['extreme', 'high', 'moderate', 'low'];

const INDEX_META = [
  { key: 'hazardIndex', label: 'Hazard', weight: '35%', description: 'Frekuensi, intensitas, dan luas ancaman' },
  { key: 'exposureIndex', label: 'Exposure', weight: '25%', description: 'Permukiman, fasilitas, dan jalan terpapar' },
  { key: 'vulnerabilityIndex', label: 'Vulnerability', weight: '25%', description: 'Kelompok rentan dan kualitas bangunan' },
  { key: 'capacityIndex', label: 'Capacity', weight: '15%', description: 'Kapasitas kesiapsiagaan (menurunkan risiko)' },
] as const;

export default function RiskAssessment() {
  const [, setLocation] = useLocation();
  const [hazard, setHazard] = useState<string>('');
  const [riskClass, setRiskClass] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [showRisk, setShowRisk] = useState(true);
  const [showSensors, setShowSensors] = useState(false);
  const [showFacilities, setShowFacilities] = useState(false);

  const params = {
    ...(hazard ? { hazardType: hazard } : {}),
    ...(riskClass ? { riskClass } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };

  const assessmentsQuery = useGetRiskAssessments(params, {
    query: { queryKey: getGetRiskAssessmentsQueryKey(params) },
  });
  const summaryQuery = useGetRiskSummary({ query: { queryKey: getGetRiskSummaryQueryKey() } });
  const rankingsQuery = useGetRiskRankings({ limit: 10 }, { query: { queryKey: getGetRiskRankingsQueryKey({ limit: 10 }) } });
  const locationsQuery = useGetLocations({ query: { queryKey: getGetLocationsQueryKey() } });
  const facilitiesQuery = useGetMitigationFacilities(undefined, {
    query: { queryKey: getGetMitigationFacilitiesQueryKey() },
  });

  const verifyMutation = useVerifyRiskAssessment();

  const assessments = Array.isArray(assessmentsQuery.data) ? assessmentsQuery.data : [];
  const summary = summaryQuery.data;
  const rankings = Array.isArray(rankingsQuery.data) ? rankingsQuery.data : [];
  const locations = Array.isArray(locationsQuery.data) ? locationsQuery.data : [];
  const facilities = Array.isArray(facilitiesQuery.data) ? facilitiesQuery.data : [];

  const selected = useMemo(
    () => assessments.find((item) => item.id === selectedId) ?? assessments[0] ?? null,
    [assessments, selectedId],
  );

  const hazardChart = useMemo(
    () =>
      [...(summary?.byHazard ?? [])].map((row) => ({
        name: hazardLabel(row.hazardType),
        score: Number(row.averageRiskScore ?? 0),
        count: Number(row.count ?? 0),
      })),
    [summary],
  );

  const loading = summaryQuery.isLoading || assessmentsQuery.isLoading;
  const error = assessmentsQuery.isError || summaryQuery.isError;

  const startScenario = (assessmentId: number) => {
    localStorage.setItem('landsafe_scenario_assessment', String(assessmentId));
    setLocation('/scenario-analysis');
  };

  const runVerification = (verified: boolean) => {
    if (!selected) return;
    verifyMutation.mutate(
      { id: selected.id, data: { verified, note: verifyNote.trim() || null } },
      {
        onSuccess: () => {
          setVerifyNote('');
          assessmentsQuery.refetch();
          summaryQuery.refetch();
          rankingsQuery.refetch();
        },
      },
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-lg border border-border bg-card" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-lg border border-border bg-card" />
          ))}
        </div>
        <div className="h-[26rem] rounded-lg border border-border bg-card" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-10 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <div>
          <p className="font-semibold">Data kajian risiko tidak dapat dimuat</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Periksa koneksi API atau hak akses akun Anda, lalu coba lagi.
          </p>
        </div>
        <button
          onClick={() => { assessmentsQuery.refetch(); summaryQuery.refetch(); }}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Muat ulang
        </button>
      </div>
    );
  }

  const byClass = summary?.byClass ?? { low: 0, moderate: 0, high: 0, extreme: 0 };
  const totalAssessments = summary?.totalAssessments ?? 0;
  const verifiedPct = totalAssessments > 0 ? Math.round(((summary?.verifiedAssessments ?? 0) / totalAssessments) * 100) : 0;


  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              Modul analitik BPBD Â· internal
            </div>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Kajian Risiko &amp; Kerentanan Wilayah</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Skor risiko gabungan dari indeks Hazard, Exposure, Vulnerability, dan Capacity.
              Seluruh angka berasal dari penilaian tersimpan; data contoh ditandai pada setiap sumber.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Pembaruan terakhir: {formatDate(summary?.lastAssessedAt)}
            </span>
            <span className="text-[11px] text-muted-foreground">Bobot: H 35% Â· E 25% Â· V 25% Â· C 15%</span>
          </div>
        </div>

        <div className="grid gap-px bg-border grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-card px-5 py-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Skor risiko rata-rata
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-semibold tabular">{formatDecimal(summary?.averageRiskScore, 1)}</span>
              <span className="pb-1 text-xs text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, summary?.averageRiskScore ?? 0)}%` }} />
            </div>
          </div>

          <div className="bg-card px-5 py-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Wilayah dikaji
            </div>
            <div className="mt-2 text-3xl font-semibold tabular">{formatNumber(summary?.regionsCovered)}</div>
            <p className="mt-3 text-xs text-muted-foreground">
              {totalAssessments} penilaian Â· {summary?.provinces?.length ?? 0} provinsi
            </p>
          </div>

          <div className="bg-card px-5 py-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Populasi terpapar
            </div>
            <div className="mt-2 text-3xl font-semibold tabular">{formatCompact(summary?.exposedPopulation)}</div>
            <p className="mt-3 text-xs text-muted-foreground">Akumulasi seluruh wilayah kajian</p>
          </div>

          <div className="bg-card px-5 py-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Fasilitas kritis
            </div>
            <div className="mt-2 text-3xl font-semibold tabular">{formatNumber(summary?.exposedFacilities)}</div>
            <p className="mt-3 text-xs text-muted-foreground">
              {formatDecimal(summary?.exposedRoadsKm, 1)} km jaringan jalan terpapar
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/60 px-5 py-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BadgeCheck className="h-3.5 w-3.5 text-success" />
            {summary?.verifiedAssessments ?? 0} dari {totalAssessments} penilaian terverifikasi ({verifiedPct}%)
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {CLASS_OPTIONS.map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RISK_CLASS_META[key].color }} />
                {RISK_CLASS_META[key].label} ({byClass[key as keyof typeof byClass] ?? 0})
              </span>
            ))}
          </div>
        </div>
      </section>


      <Tabs defaultValue="overview" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="bg-secondary max-w-full overflow-x-auto scrollbar-hide">
            <TabsTrigger value="overview">Ikhtisar</TabsTrigger>
            <TabsTrigger value="map">Peta risiko</TabsTrigger>
            <TabsTrigger value="rankings">Peringkat &amp; paparan</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari wilayahâ€¦"
                className="h-9 w-full sm:w-48 rounded-md border border-input bg-card pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={hazard}
              onChange={(event) => setHazard(event.target.value)}
              className="h-9 rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              aria-label="Filter jenis ancaman"
            >
              <option value="">Semua ancaman</option>
              {HAZARD_OPTIONS.map((key) => (
                <option key={key} value={key}>{HAZARD_LABELS[key]}</option>
              ))}
            </select>
            <select
              value={riskClass}
              onChange={(event) => setRiskClass(event.target.value)}
              className="h-9 rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              aria-label="Filter kelas risiko"
            >
              <option value="">Semua kelas</option>
              {CLASS_OPTIONS.map((key) => (
                <option key={key} value={key}>{RISK_CLASS_META[key].label}</option>
              ))}
            </select>
            <button
              onClick={() => { setHazard(''); setRiskClass(''); setSearch(''); }}
              className="h-9 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-secondary"
            >
              Reset
            </button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <section className="panel p-5 lg:col-span-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Skor risiko rata-rata per ancaman</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Skala 0â€“100 Â· dihitung dari seluruh wilayah kajian</p>
                </div>
                <span className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {hazardChart.reduce((sum, item) => sum + item.count, 0)} penilaian
                </span>
              </div>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hazardChart} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 0 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                      formatter={(value: number) => [`${value}`, 'Skor rata-rata']}
                    />
                    <Bar dataKey="score" barSize={14} radius={[0, 3, 3, 0]}>
                      {hazardChart.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.score >= 75 ? '#B91C1C' : entry.score >= 55 ? '#C2410C' : entry.score >= 35 ? '#B45309' : '#0F766E'}
                        />
                      ))}
                      <LabelList dataKey="score" position="right" fontSize={11} fill="hsl(var(--muted-foreground))" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>


            <section className="panel p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold">Komposisi indeks risiko</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selected ? `${selected.regionName} Â· ${hazardLabel(selected.hazardType)}` : 'Rata-rata seluruh wilayah'}
              </p>
              <div className="mt-4 space-y-3.5">
                {INDEX_META.map((index) => {
                  const value = selected
                    ? Number(selected[index.key] ?? 0)
                    : Number(
                        index.key === 'hazardIndex'
                          ? summary?.averageHazard
                          : index.key === 'exposureIndex'
                            ? summary?.averageExposure
                            : index.key === 'vulnerabilityIndex'
                              ? summary?.averageVulnerability
                              : summary?.averageCapacity ?? 0,
                      );
                  return (
                    <div key={index.key}>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium text-foreground">
                          {index.label}
                          <span className="ml-1.5 font-normal text-muted-foreground">{index.weight}</span>
                        </span>
                        <span className="font-semibold tabular">{formatDecimal(value, 1)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${index.key === 'capacityIndex' ? 'bg-success' : 'bg-primary'}`}
                          style={{ width: `${Math.min(100, value)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{index.description}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>


          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold">Daftar penilaian risiko ({assessments.length})</h3>
              <span className="text-[11px] text-muted-foreground">Klik baris untuk melihat rincian indikator</span>
            </div>
            {assessments.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium">Tidak ada penilaian yang cocok</p>
                <p className="mt-1 text-xs text-muted-foreground">Ubah filter ancaman, kelas risiko, atau kata kunci.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-5 py-2.5 font-semibold">Wilayah</th>
                      <th className="px-3 py-2.5 font-semibold">Ancaman</th>
                      <th className="px-3 py-2.5 text-right font-semibold">H</th>
                      <th className="px-3 py-2.5 text-right font-semibold">E</th>
                      <th className="px-3 py-2.5 text-right font-semibold">V</th>
                      <th className="px-3 py-2.5 text-right font-semibold">C</th>
                      <th className="px-3 py-2.5 font-semibold">Skor</th>
                      <th className="px-3 py-2.5 font-semibold">Kelas</th>
                      <th className="px-5 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((item) => {
                      const meta = riskMeta(item.riskClass);
                      const isSelected = selected?.id === item.id;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          className={`cursor-pointer border-b border-border/70 transition-colors ${isSelected ? 'bg-accent/60' : 'hover:bg-secondary/60'}`}
                        >
                          <td className="px-5 py-2.5">
                            <div className="font-medium">{item.regionName}</div>
                            <div className="text-[11px] text-muted-foreground">{item.province}</div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{hazardLabel(item.hazardType)}</td>
                          <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{Math.round(item.hazardIndex)}</td>
                          <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{Math.round(item.exposureIndex)}</td>
                          <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{Math.round(item.vulnerabilityIndex)}</td>
                          <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{Math.round(item.capacityIndex)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.min(100, item.riskScore)}%`, backgroundColor: meta.color }}
                                />
                              </div>
                              <span className="font-semibold tabular">{formatDecimal(item.riskScore, 1)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.chip}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-5 py-2.5">
                            {item.verified ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Terverifikasi
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
                                <AlertTriangle className="h-3.5 w-3.5" /> Menunggu verifikasi
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>


        <TabsContent value="map" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <section className="panel overflow-hidden xl:col-span-2">
              <div className="relative h-[560px]">
                <MapContainer
                  center={[-4.5, 113]}
                  zoom={5}
                  zoomControl={false}
                  scrollWheelZoom
                  className="h-full w-full isolate"
                  style={{ background: '#eef3f9' }}
                >
                  <MapFix />
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <ZoomControl position="bottomright" />

                  {showRisk && assessments.map((item) => {
                    const meta = riskMeta(item.riskClass);
                    return (
                      <Circle
                        key={`risk-${item.id}`}
                        center={[item.latitude, item.longitude]}
                        radius={Math.max(6, item.extentKm ?? 0) * 1000}
                        pathOptions={{
                          color: meta.color,
                          fillColor: meta.color,
                          fillOpacity: selected?.id === item.id ? 0.34 : 0.16,
                          weight: selected?.id === item.id ? 2.5 : 1.25,
                        }}
                        eventHandlers={{ click: () => setSelectedId(item.id) }}
                      >
                        <Popup>
                          <div className="min-w-[190px]">
                            <div className="text-sm font-semibold">{item.regionName}</div>
                            <div className="text-[11px] text-muted-foreground">{item.province}</div>
                            <div className="mt-2 flex items-center justify-between text-xs">
                              <span>Skor risiko</span>
                              <span className="font-semibold" style={{ color: meta.color }}>{formatDecimal(item.riskScore, 1)}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs">
                              <span>Kelas</span>
                              <span>{meta.label}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs">
                              <span>Populasi terpapar</span>
                              <span>{formatCompact(item.exposedPopulation)}</span>
                            </div>
                          </div>
                        </Popup>
                      </Circle>
                    );
                  })}

                  {showSensors && locations.map((location) => (
                    <CircleMarker
                      key={`loc-${location.id}`}
                      center={[location.latitude, location.longitude]}
                      radius={4}
                      pathOptions={{ color: '#0F766E', fillColor: '#0F766E', fillOpacity: 0.85, weight: 1 }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <div className="text-sm font-semibold">{location.name}</div>
                          <div className="text-muted-foreground">{location.district}, {location.province}</div>
                          <div className="mt-1">Status risiko: {location.riskLevel}</div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}

                  {showFacilities && facilities.map((facility) => {
                    const meta = facilityTypeMeta(facility.type);
                    return (
                      <CircleMarker
                        key={`fac-${facility.id}`}
                        center={[facility.latitude, facility.longitude]}
                        radius={5}
                        pathOptions={{ color: meta.color, fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
                      >
                        <Popup>
                          <div className="text-xs">
                            <div className="text-sm font-semibold">{facility.name}</div>
                            <div className="text-muted-foreground">{meta.label} Â· {facility.regionName}</div>
                            <div className="mt-1">Kapasitas: {formatNumber(facility.capacity)}</div>
                            <div>Status: {facility.status}</div>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>


                <div className="absolute left-3 top-3 z-[400] w-56 rounded-md border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" /> Lapisan peta
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={showRisk} onChange={(event) => setShowRisk(event.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" />
                      Kelas risiko wilayah
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={showSensors} onChange={(event) => setShowSensors(event.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" />
                      Sensor pemantauan
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={showFacilities} onChange={(event) => setShowFacilities(event.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" />
                      Fasilitas evakuasi
                    </label>
                  </div>
                  <p className="mt-2.5 border-t border-border pt-2 text-[10px] leading-snug text-muted-foreground">
                    Batas wilayah digambarkan sebagai radius perkiraan dari titik pusat administratif, bukan peta resmi.
                  </p>
                </div>

                <div className="absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Legenda kelas</div>
                  <div className="space-y-1">
                    {CLASS_OPTIONS.map((key) => (
                      <div key={key} className="flex items-center gap-2 text-[11px]">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: RISK_CLASS_META[key].color }} />
                        {RISK_CLASS_META[key].label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              {selected ? (
                <>
                  <section className="panel p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold leading-tight">{selected.regionName}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{selected.province} Â· {hazardLabel(selected.hazardType)}</p>
                      </div>
                      <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskMeta(selected.riskClass).chip}`}>
                        {riskMeta(selected.riskClass).label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-3xl font-semibold tabular" style={{ color: riskMeta(selected.riskClass).color }}>
                        {formatDecimal(selected.riskScore, 1)}
                      </span>
                      <span className="pb-1 text-xs text-muted-foreground">skor risiko</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Populasi</dt>
                        <dd className="mt-0.5 font-medium tabular">{formatNumber(selected.population)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Terpapar</dt>
                        <dd className="mt-0.5 font-medium tabular">{formatNumber(selected.exposedPopulation)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Fasilitas</dt>
                        <dd className="mt-0.5 font-medium tabular">{formatNumber(selected.exposedFacilities)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Jalan</dt>
                        <dd className="mt-0.5 font-medium tabular">{formatDecimal(selected.exposedRoadsKm, 1)} km</dd>
                      </div>
                    </dl>
                  </section>


                  <section className="panel p-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Indikator terperinci</h4>
                    <div className="mt-3 space-y-3">
                      {(['hazard', 'exposure', 'vulnerability', 'capacity'] as const).map((group) => {
                        const items = selected.indicators?.[group];
                        if (!items || items.length === 0) return null;
                        return (
                          <div key={group}>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">{group}</div>
                            <ul className="mt-1 space-y-1">
                              {items.map((item) => (
                                <li key={item.label} className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="text-muted-foreground">{item.label}</span>
                                  <span className="shrink-0 font-medium tabular">{formatDecimal(item.value, 1)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                    {Array.isArray(selected.sources) && selected.sources.length > 0 && (
                      <div className="mt-3 border-t border-border pt-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sumber data</div>
                        <ul className="mt-1.5 space-y-1">
                          {selected.sources.map((source) => (
                            <li key={source} className="text-[11px] text-muted-foreground">Â· {source}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>


                  <section className="panel p-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Verifikasi penilaian</h4>
                    {selected.verified ? (
                      <div className="mt-2 space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Terverifikasi {selected.verifiedAt ? `Â· ${formatDate(selected.verifiedAt)}` : ''}
                        </p>
                        <button
                          onClick={() => runVerification(false)}
                          disabled={verifyMutation.isPending}
                          className="w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
                        >
                          Cabut verifikasi
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={verifyNote}
                          onChange={(event) => setVerifyNote(event.target.value)}
                          rows={2}
                          placeholder="Catatan verifikasi (opsional)"
                          className="w-full rounded-md border border-input bg-card px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button
                          onClick={() => runVerification(true)}
                          disabled={verifyMutation.isPending}
                          className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {verifyMutation.isPending ? 'Menyimpanâ€¦' : 'Tandai terverifikasi'}
                        </button>
                        <p className="text-[10px] leading-snug text-muted-foreground">
                          Tindakan ini tercatat pada log audit beserta akun Anda.
                        </p>
                      </div>
                    )}
                    {verifyMutation.isError && (
                      <p className="mt-2 text-[11px] text-destructive">Verifikasi gagal disimpan. Coba lagi.</p>
                    )}
                    <button
                      onClick={() => startScenario(selected.id)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                    >
                      <GitCompare className="h-3.5 w-3.5" /> Jalankan analisis skenario
                    </button>
                  </section>
                </>
              ) : (
                <section className="panel p-6 text-center text-sm text-muted-foreground">
                  Pilih wilayah pada peta untuk melihat rincian indikator.
                </section>
              )}
            </aside>
          </div>
        </TabsContent>


        <TabsContent value="rankings" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="panel overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold">Peringkat wilayah berisiko tertinggi</h3>
                <span className="text-[11px] text-muted-foreground">10 teratas berdasarkan skor risiko</span>
              </div>
              {rankings.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">Belum ada peringkat.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {rankings.map((item) => {
                    const meta = riskMeta(item.riskClass);
                    return (
                      <li key={item.id} className="flex items-center gap-4 px-5 py-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-background text-[11px] font-semibold tabular">
                          {item.rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{item.regionName}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {item.province} Â· {hazardLabel(item.hazardType)}
                              </div>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular" style={{ color: meta.color }}>
                              {formatDecimal(item.riskScore, 1)}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, item.riskScore)}%`, backgroundColor: meta.color }} />
                          </div>
                        </div>
                        <div className="hidden w-28 shrink-0 text-right sm:block">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Terpapar</div>
                          <div className="text-xs font-medium tabular">{formatCompact(item.exposedPopulation)}</div>
                        </div>
                        <div className="hidden w-24 shrink-0 justify-end md:flex">
                          {item.verified ? (
                            <span className="rounded border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">Verified</span>
                          ) : (
                            <span className="rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">Draft</span>
                          )}
                        </div>
                        <button
                          onClick={() => startScenario(item.id)}
                          className="shrink-0 rounded border border-border px-2 py-1 text-[11px] font-medium hover:bg-secondary"
                        >
                          Skenario
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>


            <section className="panel p-5">
              <h3 className="text-sm font-semibold">Paparan infrastruktur</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Akumulasi dari seluruh penilaian risiko</p>
              <dl className="mt-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
                  <dt className="text-muted-foreground">Populasi terpapar</dt>
                  <dd className="font-semibold tabular">{formatNumber(summary?.exposedPopulation)}</dd>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
                  <dt className="text-muted-foreground">Fasilitas kritis</dt>
                  <dd className="font-semibold tabular">{formatNumber(summary?.exposedFacilities)}</dd>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
                  <dt className="text-muted-foreground">Jaringan jalan</dt>
                  <dd className="font-semibold tabular">{formatDecimal(summary?.exposedRoadsKm, 1)} km</dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted-foreground">Penilaian terverifikasi</dt>
                  <dd className="font-semibold tabular">{summary?.verifiedAssessments ?? 0}</dd>
                </div>
              </dl>

              <div className="mt-5 border-t border-border pt-4">
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sebaran ancaman</h4>
                <ul className="mt-2 space-y-1.5">
                  {(summary?.byHazard ?? []).map((row) => (
                    <li key={row.hazardType} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{hazardLabel(row.hazardType)}</span>
                      <span className="font-medium tabular">{row.count} wilayah</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 rounded-md border border-border bg-background p-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Skor risiko bersifat indikatif dan diperbarui manual oleh analis. Verifikasi lapangan tetap
                  diperlukan sebelum penilaian digunakan sebagai dasar anggaran atau publikasi.
                </p>
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


