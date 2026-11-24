import React, { useEffect, useMemo, useState } from 'react';
import {
  useGetScenarios,
  useCreateScenario,
  useDeleteScenario,
  useCompareScenarios,
  useGetRiskAssessments,
  getGetScenariosQueryKey,
  getGetRiskAssessmentsQueryKey,
} from '@workspace/api-client-react';
import type { Scenario } from '@workspace/api-client-react';
import {
  AlertTriangle,
  Download,
  Trash2,
  GitCompare,
  PlayCircle,
  Info,
  Users,
  Home,
  Building2,
  Route,
  Activity,
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
} from 'recharts';
import {
  hazardLabel,
  formatNumber,
  formatDecimal,
  formatDateTime,
  formatCompact,
  riskMeta,
} from '@/lib/risk-ui';

const SEASONS = [
  { value: 'dry', label: 'Musim kemarau' },
  { value: 'transition', label: 'Peralihan' },
  { value: 'wet', label: 'Musim hujan' },
];

const PRESETS = [
  {
    key: 'worst',
    label: 'Skenario terburuk',
    description: 'Intensitas maksimum, hujan ekstrem, terjadi malam hari',
    values: { intensity: 95, durationHours: 36, rainfallMm: 240, season: 'wet' as const, timeOfDay: 'night' as const, warningLeadTimeHours: 2 },
  },
  {
    key: 'typical',
    label: 'Skenario tipikal',
    description: 'Intensitas sedang dengan jeda peringatan wajar',
    values: { intensity: 65, durationHours: 12, rainfallMm: 90, season: 'transition' as const, timeOfDay: 'day' as const, warningLeadTimeHours: 12 },
  },
  {
    key: 'managed',
    label: 'Skenario termitigasi',
    description: 'Intensitas tinggi namun peringatan dini berjalan penuh',
    values: { intensity: 85, durationHours: 18, rainfallMm: 150, season: 'wet' as const, timeOfDay: 'day' as const, warningLeadTimeHours: 24 },
  },
];

const IMPACT_META: Record<string, { label: string; chip: string }> = {
  limited: { label: 'Dampak terbatas', chip: 'border-success/30 bg-success/10 text-success' },
  moderate: { label: 'Dampak sedang', chip: 'border-border bg-secondary text-foreground' },
  severe: { label: 'Dampak berat', chip: 'border-warning/40 bg-warning/10 text-warning' },
  critical: { label: 'Dampak kritis', chip: 'border-destructive/30 bg-destructive/10 text-destructive' },
};

export default function ScenarioAnalysis() {
  const assessmentsQuery = useGetRiskAssessments(undefined, {
    query: { queryKey: getGetRiskAssessmentsQueryKey() },
  });
  const scenariosQuery = useGetScenarios({ query: { queryKey: getGetScenariosQueryKey() } });
  const createMutation = useCreateScenario();
  const deleteMutation = useDeleteScenario();
  const compareMutation = useCompareScenarios();

  const assessments = Array.isArray(assessmentsQuery.data) ? assessmentsQuery.data : [];
  const scenarios = Array.isArray(scenariosQuery.data) ? scenariosQuery.data : [];

  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState({
    intensity: 70,
    durationHours: 12,
    rainfallMm: 100,
    season: 'wet' as 'dry' | 'transition' | 'wet',
    timeOfDay: 'night' as 'day' | 'night',
    warningLeadTimeHours: 8,
  });
  const [activeScenarioId, setActiveScenarioId] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  useEffect(() => {
    if (assessments.length === 0 || assessmentId !== null) return;
    const stored = Number(localStorage.getItem('landsafe_scenario_assessment'));
    const match = assessments.find((item) => item.id === stored) ?? assessments[0];
    setAssessmentId(match.id);
  }, [assessments, assessmentId]);

  const assessment = assessments.find((item) => item.id === assessmentId) ?? null;

  const orderedScenarios = useMemo(
    () => [...scenarios].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [scenarios],
  );

  const activeScenario: Scenario | null =
    orderedScenarios.find((item) => item.id === activeScenarioId) ?? orderedScenarios[0] ?? null;

  const results = activeScenario?.results;

  const runScenario = () => {
    if (!assessmentId) return;
    const scenarioName = name.trim() || `Simulasi ${hazardLabel(assessment?.hazardType)} â€” ${assessment?.regionName ?? ''}`.trim();
    createMutation.mutate(
      { data: { name: scenarioName, assessmentId, parameters: values, notes: notes.trim() || null } },
      {
        onSuccess: (created) => {
          setActiveScenarioId(created.id);
          setName('');
          setNotes('');
          scenariosQuery.refetch();
        },
      },
    );
  };

  const removeScenario = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          setCompareIds((current) => current.filter((value) => value !== id));
          if (activeScenarioId === id) setActiveScenarioId(null);
          scenariosQuery.refetch();
        },
      },
    );
  };

  const toggleCompare = (id: number) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  };

  const downloadReport = async (id: number) => {
    const token = localStorage.getItem('landsafe_token');
    const response = await fetch(`/api/scenarios/${id}/report`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `landsafe-skenario-${id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-warning/40 bg-warning/[0.07] px-4 py-3">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-foreground">Simulasi skenario hipotetis â€” bukan prediksi kejadian</p>
            <p className="mt-0.5 text-xs leading-relaxed text-foreground/70">
              Hasil di halaman ini dihitung dari parameter yang Anda konfigurasi dan data penilaian risiko tersimpan.
              Angka tidak menunjukkan perkiraan waktu, lokasi, atau peluang terjadinya bencana nyata, dan tidak boleh
              disampaikan kepada publik sebagai peringatan.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="panel space-y-4 p-5 xl:col-span-1">
          <div>
            <h2 className="text-sm font-semibold">Konfigurasi skenario</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Tentukan wilayah dan parameter hipotetis</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Wilayah kajian</label>
            <select
              value={assessmentId ?? ''}
              onChange={(event) => setAssessmentId(Number(event.target.value))}
              className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              {assessments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.regionName} â€” {hazardLabel(item.hazardType)} ({formatDecimal(item.riskScore, 1)})
                </option>
              ))}
            </select>
            {assessment && (
              <p className="text-[11px] text-muted-foreground">
                Basis paparan: {formatNumber(assessment.exposedPopulation)} jiwa Â· {formatNumber(assessment.exposedFacilities)} fasilitas
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Nama skenario</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Hujan ekstrem 24 jam"
              className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Preset cepat</div>
            <div className="mt-1.5 grid gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => setValues(preset.values)}
                  className="rounded-md border border-border px-2.5 py-1.5 text-left transition-colors hover:bg-secondary"
                >
                  <div className="text-[11px] font-semibold">{preset.label}</div>
                  <div className="text-[10px] text-muted-foreground">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            {[
              { key: 'intensity' as const, label: 'Intensitas ancaman', min: 10, max: 100, step: 1, suffix: '/100' },
              { key: 'durationHours' as const, label: 'Durasi kejadian', min: 1, max: 72, step: 1, suffix: 'jam' },
              { key: 'rainfallMm' as const, label: 'Curah hujan', min: 0, max: 400, step: 10, suffix: 'mm' },
              { key: 'warningLeadTimeHours' as const, label: 'Jeda peringatan dini', min: 0, max: 24, step: 1, suffix: 'jam' },
            ].map((slider) => (
              <div key={slider.key}>
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="font-medium text-foreground">{slider.label}</span>
                  <span className="font-semibold tabular text-muted-foreground">
                    {values[slider.key]} {slider.suffix}
                  </span>
                </div>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={values[slider.key]}
                  onChange={(event) => setValues((current) => ({ ...current, [slider.key]: Number(event.target.value) }))}
                  className="mt-1 w-full accent-[hsl(var(--primary))]"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">Musim</span>
              <select
                value={values.season}
                onChange={(event) => setValues((current) => ({ ...current, season: event.target.value as typeof values.season }))}
                className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              >
                {SEASONS.map((season) => (
                  <option key={season.value} value={season.value}>{season.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">Waktu kejadian</span>
              <div className="flex overflow-hidden rounded-md border border-input">
                {(['day', 'night'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setValues((current) => ({ ...current, timeOfDay: option }))}
                    className={`h-8 flex-1 text-xs font-medium transition-colors ${
                      values.timeOfDay === option ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {option === 'day' ? 'Siang' : 'Malam'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Catatan analis</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Konteks asumsi skenario (opsional)"
              className="w-full rounded-md border border-input bg-card px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <button
            onClick={runScenario}
            disabled={createMutation.isPending || !assessmentId}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <PlayCircle className="h-4 w-4" />
            {createMutation.isPending ? 'Menghitung dampakâ€¦' : 'Jalankan simulasi'}
          </button>
          {createMutation.isError && (
            <p className="text-[11px] text-destructive">Simulasi gagal dijalankan. Periksa parameter lalu coba lagi.</p>
          )}
        </section>

        <section className="panel space-y-4 p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Hasil simulasi dan bandingkan skenario</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Hasil dihitung dengan asumsi model sederhana; gunakan untuk perencanaan evakuasi dan mitigasi, bukan perkiraan kejadian nyata.
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => toggleCompare(activeScenario?.id ?? 0)}
                disabled={!activeScenario?.id}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  compareIds.includes(activeScenario?.id ?? 0)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                }`}
              >
                {compareIds.includes(activeScenario?.id ?? 0) ? 'Hapus bandingan' : 'Bandingkan'}
              </button>
              <button
                onClick={() => downloadReport(activeScenario?.id ?? 0)}
                disabled={!activeScenario?.id || !results}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Unduh laporan
              </button>
            </div>
          </div>

          {orderedScenarios.length === 0 ? (

            <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
              <Info className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">Belum ada skenario simulasi</h3>
              <p className="mt-0.5 text-xs text-muted-foreground max-w-xs mx-auto">
                Konfigurasikan skenario di panel kiri lalu jalankan simulasi untuk melihat estimasi dampak dan kebutuhan evakuasi.
              </p>
            </div>
          ) : (
            <>
              {activeScenario && results ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Estimasi jiwa terpapar</div>
                    <div className="mt-1 text-2xl font-semibold tabular">{formatNumber(results.affectedPopulation)}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Fasilitas kritis terpapar</div>
                    <div className="mt-1 text-2xl font-semibold tabular">{formatNumber(results.affectedFacilities)}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Jaringan jalan terpapar</div>
                    <div className="mt-1 text-2xl font-semibold tabular">{formatDecimal(results.affectedRoadsKm, 1)} km</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Terdampak evakuasi</div>
                    <div className="mt-1 text-2xl font-semibold tabular">{formatNumber(results.displacedPopulation)}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Dampak</div>
                    <div className="mt-1 text-xl font-semibold">
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${IMPACT_META[results.impactLevel].chip}`}>
                        {IMPACT_META[results.impactLevel].label}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Dibuat pada</div>
                    <div className="mt-1 text-sm font-medium">{formatDateTime(activeScenario.createdAt)}</div>
                  </div>
                </div>
              ) : null}

              {compareIds.length > 0 ? (
                <div className="mt-4 rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-background">
                        <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Skenario</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Wilayah</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Jiwa terpapar</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Fasilitas</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Jalan (km)</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Dampak</th>
                        <th className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orderedScenarios
                        .filter((item) => compareIds.includes(item.id))
                        .map((item) => {
                          const scenarioResults = item.results;
                          return (
                            <tr key={item.id} className="group">
                              <td className="px-3 py-2">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-[10px] text-muted-foreground">{formatDateTime(item.createdAt)}</div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="text-sm font-medium">{item.regionName}</div>
                                <div className="text-[10px] text-muted-foreground">{hazardLabel(item.hazardType)}</div>
                              </td>
                              <td className="px-3 py-2 font-medium tabular">
                                {scenarioResults?.affectedPopulation ?? 'â€”'}
                              </td>
                              <td className="px-3 py-2 font-medium tabular">
                                {scenarioResults?.affectedFacilities ?? 'â€”'}
                              </td>
                              <td className="px-3 py-2 font-medium tabular">
                                {scenarioResults?.affectedRoadsKm != null ? formatDecimal(scenarioResults.affectedRoadsKm, 1) : 'â€”'}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  scenarioResults ? IMPACT_META[scenarioResults.impactLevel].chip : 'border-border bg-secondary text-muted-foreground'
                                }`}>
                                  {scenarioResults ? IMPACT_META[scenarioResults.impactLevel].label : 'â€”'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => setActiveScenarioId(item.id)}
                                  className="text-xs font-medium text-primary hover:underline"
                                >
                                  Muat
                                </button>
                                <button
                                  onClick={() => removeScenario(item.id)}
                                  className="ml-2 text-xs font-medium text-destructive hover:underline"
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {activeScenario && activeScenario.results && (
                <div className="mt-4 rounded-lg border border-border overflow-hidden">
                  <div className="border-b border-border bg-background px-3 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Parameter skenario aktif</h3>
                  </div>
                  <div className="px-3 py-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between border-b border-border pb-1">
                      <span className="text-muted-foreground">Intensitas</span>
                      <span className="font-medium">{activeScenario.parameters.intensity} /100</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-1">
                      <span className="text-muted-foreground">Durasi</span>
                      <span className="font-medium">{activeScenario.parameters.durationHours} jam</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-1">
                      <span className="text-muted-foreground">Curah hujan</span>
                      <span className="font-medium">{activeScenario.parameters.rainfallMm} mm</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-1">
                      <span className="text-muted-foreground">Musim</span>
                      <span className="font-medium">{activeScenario.parameters.season}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-1">
                      <span className="text-muted-foreground">Waktu</span>
                      <span className="font-medium">{activeScenario.parameters.timeOfDay}</span>
                    </div>
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-muted-foreground">Jeda peringatan</span>
                      <span className="font-medium">{activeScenario.parameters.warningLeadTimeHours} jam</span>
                    </div>
                  </div>
                </div>
              )}

              {activeScenario && (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={() => removeScenario(activeScenario.id)}
                    disabled={deleteMutation.isPending}
                    className="w-full rounded-md border border-destructive px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Menghapusâ€¦' : 'Hapus skenario aktif'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}



