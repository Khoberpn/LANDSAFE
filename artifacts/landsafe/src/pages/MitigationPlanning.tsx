import React, { useState } from 'react';
import {
  useGetMitigationPlans,
  useGetMitigationRecommendations,
  useGetResources,
  createMitigationPlan,
  transitionMitigationPlan,
  getGetMitigationPlansQueryKey,
  getGetMitigationRecommendationsQueryKey,
} from '@workspace/api-client-react';
import type { MitigationPlan, MitigationRecommendation, ResourceItem } from '@workspace/api-client-react';
import {
  ClipboardList,
  AlertTriangle,
  ShieldCheck,
  Users,
  RefreshCw,
  PlayCircle,
  Send,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatNumber,
  formatDecimal,
  formatDateTime,
  formatIdr,
  planStatusMeta,
  ACTION_STATUS_LABELS,
} from '@/lib/risk-ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function StatusChip({ status }: { status?: string | null }) {
  const meta = planStatusMeta(status);
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.chip}`}>
      {meta.label}
    </span>
  );
}

export default function MitigationPlanning() {
  const [createDialog, setCreateDialog] = useState(false);
  const [newPlan, setNewPlan] = useState({
    title: '',
    regionName: '',
    province: '',
    hazardType: 'flood',
    leadAgency: 'BNPB / BPBD',
    publicSummary: '',
    budgetTotal: '',
  });
  const [transitionPlanId, setTransitionPlanId] = useState<number | null>(null);

  const plansQuery = useGetMitigationPlans(undefined, {
    query: { queryKey: getGetMitigationPlansQueryKey() },
  });
  const recommendationsQuery = useGetMitigationRecommendations({
    query: { queryKey: getGetMitigationRecommendationsQueryKey() },
  });

  const plans = Array.isArray(plansQuery.data) ? plansQuery.data : [];
  const recommendations = Array.isArray(recommendationsQuery.data) ? recommendationsQuery.data : [];

  const handleCreate = async () => {
    try {
      await createMitigationPlan({
        title: newPlan.title,
        regionName: newPlan.regionName,
        province: newPlan.province || undefined,
        hazardType: newPlan.hazardType,
        leadAgency: newPlan.leadAgency,
        publicSummary: newPlan.publicSummary || undefined,
        budgetTotal: newPlan.budgetTotal ? Number(newPlan.budgetTotal) : undefined,
      });
      setCreateDialog(false);
      setNewPlan({ title: '', regionName: '', province: '', hazardType: 'flood', leadAgency: 'BNPB / BPBD', publicSummary: '', budgetTotal: '' });
      plansQuery.refetch?.();
    } catch {
      // error
    }
  };

  const handleTransition = async (plan: MitigationPlan, action: string) => {
    setTransitionPlanId(plan.id);
    try {
      await transitionMitigationPlan(plan.id, { action: action as any, note: '' });
      plansQuery.refetch?.();
    } finally {
      setTransitionPlanId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm font-semibold">Perencanaan Mitigasi</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Buat dan kelola rencana mitigasi berbasis penilaian risiko. Tindakan dapat diserahkan ke instansi terkait untuk pelaksanaan evakuasi dan penanggulangan.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setCreateDialog(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PlayCircle className="h-3.5 w-3.5" /> Buat rencana baru
        </button>
      </div>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plans">Rencana mitigasi</TabsTrigger>
          <TabsTrigger value="recommendations">Rekomendasi risiko</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="panel p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Judul</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Wilayah</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Bahaya</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Anggaran</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Progres</th>
                  <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Belum ada rencana mitigasi.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.id} className="group">
                      <td className="px-3 py-2 font-medium">{plan.title}</td>
                      <td className="px-3 py-2 text-xs">{plan.regionName}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{plan.hazardType}</td>
                      <td className="px-3 py-2">
                        <StatusChip status={plan.status} />
                      </td>
                      <td className="px-3 py-2 font-medium tabular text-muted-foreground">{formatIdr(plan.budgetTotal)}</td>
                      <td className="px-3 py-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div className={`h-full ${plan.progress >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${plan.progress}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{plan.progress}%</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {plan.status === 'draft' && (
                            <button
                              onClick={() => handleTransition(plan, 'submit_review')}
                              disabled={transitionPlanId === plan.id}
                              className="rounded-md px-2 py-1 text-xs border border-primary text-primary hover:bg-primary/10 disabled:opacity-50"
                              title="Ajukan tinjauan"
                            >
                              Ajukan
                            </button>
                          )}
                          {plan.status === 'review' && (
                            <>
                              <button
                                onClick={() => handleTransition(plan, 'approve')}
                                disabled={transitionPlanId === plan.id}
                                className="rounded-md px-2 py-1 text-xs border border-success/30 bg-success/10 text-success hover:bg-success/20 disabled:opacity-50"
                                title="Setujui"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() => handleTransition(plan, 'return_draft')}
                                disabled={transitionPlanId === plan.id}
                                className="rounded-md px-2 py-1 text-xs border border-border bg-card text-muted-foreground hover:bg-secondary disabled:opacity-50"
                                title="Kembalikan ke draf"
                              >
                                Kembalikan
                              </button>
                            </>
                          )}
                          {plan.status === 'approved' && (
                            <button
                              onClick={() => handleTransition(plan, 'publish')}
                              disabled={transitionPlanId === plan.id}
                              className="rounded-md px-2 py-1 text-xs border border-success/30 bg-success/10 text-success hover:bg-success/20 disabled:opacity-50"
                              title="Terbitkan"
                            >
                              Terbitkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="recommendations" className="panel p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Wilayah</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Bahaya</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Skor risiko</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Prioritas</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rasional</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Intervensi yang disarankan</th>
                  <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rencana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recommendations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Belum ada rekomendasi risiko.
                    </td>
                  </tr>
                ) : (
                  recommendations.map((rec) => (
                    <tr key={rec.assessmentId} className="group">
                      <td className="px-3 py-2 font-medium">{rec.regionName}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{rec.hazardType}</td>
                      <td className="px-3 py-2 font-medium tabular">{formatDecimal(rec.riskScore, 1)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          rec.priority === 'immediate' ? 'border-destructive/30 bg-destructive/10 text-destructive' :
                          rec.priority === 'high' ? 'border-warning/40 bg-warning/10 text-warning' :
                          rec.priority === 'planned' ? 'border-info/30 bg-info/10 text-info' :
                          'border-border bg-secondary text-muted-foreground'
                        }`}>
                          {rec.priority === 'immediate' ? 'Segera' : rec.priority === 'high' ? 'Tinggi' : rec.priority === 'planned' ? 'Direncanakan' : 'Pantau'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">{rec.rationale}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs">
                        {rec.suggestedInterventions.map((si, i) => (
                          <div key={i} className="text-[10px]">
                            â€¢ {si.title ?? 'Intervensi mitigasi'}
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {rec.existingPlanId ? (
                          <span className="text-[10px] text-success">Terhubung</span>
                        ) : (
                          <button
                            onClick={() => {
                              setNewPlan((prev) => ({
                                ...prev,
                                title: `Mitigasi ${rec.regionName} â€” ${rec.hazardType}`,
                                regionName: rec.regionName,
                                province: rec.province,
                                hazardType: rec.hazardType,
                              }));
                              setCreateDialog(true);
                            }}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Buat rencana
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {createDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCreateDialog(false)} />
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md shadow-lg">
            <h2 className="text-sm font-semibold mb-4">Buat rencana mitigasi baru</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">Judul rencana</label>
                <input
                  value={newPlan.title}
                  onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                  className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">Wilayah</label>
                  <input
                    value={newPlan.regionName}
                    onChange={(e) => setNewPlan({ ...newPlan, regionName: e.target.value })}
                    className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">Provinsi</label>
                  <input
                    value={newPlan.province}
                    onChange={(e) => setNewPlan({ ...newPlan, province: e.target.value })}
                    className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">Jenis bahaya</label>
                  <select
                    value={newPlan.hazardType}
                    onChange={(e) => setNewPlan({ ...newPlan, hazardType: e.target.value })}
                    className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="flood">Banjir</option>
                    <option value="landslide">Tanah longsor</option>
                    <option value="earthquake">Gempabumi</option>
                    <option value="volcanic">Erupsi gunung api</option>
                    <option value="tsunami">Tsunami</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">Pemimpin</label>
                  <input
                    value={newPlan.leadAgency}
                    onChange={(e) => setNewPlan({ ...newPlan, leadAgency: e.target.value })}
                    className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">Ringkasan publik</label>
                <textarea
                  value={newPlan.publicSummary}
                  onChange={(e) => setNewPlan({ ...newPlan, publicSummary: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">Anggaran (Rp)</label>
                <input
                  type="number"
                  value={newPlan.budgetTotal}
                  onChange={(e) => setNewPlan({ ...newPlan, budgetTotal: e.target.value })}
                  className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setCreateDialog(false)}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Buat rencana
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
