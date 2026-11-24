import React from 'react';
import {
  useGetPublicOverview,
  useGetPublicMitigationPlans,
  useGetPublicEvacuationFacilities,
  useGetPublicGuidelines,
} from '@workspace/api-client-react';
import type { PublicMitigationPlan, PublicFacility, PublicGuideline } from '@workspace/api-client-react';
import {
  ShieldAlert,
  MapPin,
  Building2,
  FileText,
  Clock,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatNumber,
  formatDecimal,
  formatDateTime,
  planStatusMeta,
  facilityTypeMeta,
} from '@/lib/risk-ui';

function StatusChip({ status }: { status?: string | null }) {
  const meta = planStatusMeta(status);
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.chip}`}>
      {meta.label}
    </span>
  );
}

export default function PublicMitigation() {
  const overviewQuery = useGetPublicOverview({ query: { queryKey: [] as any } });
  const plansQuery = useGetPublicMitigationPlans({ query: { queryKey: [] as any } });
  const facilitiesQuery = useGetPublicEvacuationFacilities({ query: { queryKey: [] as any } });
  const guidelinesQuery = useGetPublicGuidelines({ query: { queryKey: [] as any } });

  const overview = overviewQuery.data;
  const plans = Array.isArray(plansQuery.data) ? plansQuery.data : [];
  const facilities = Array.isArray(facilitiesQuery.data) ? facilitiesQuery.data : [];
  const guidelines = Array.isArray(guidelinesQuery.data) ? guidelinesQuery.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm font-semibold">Mitigasi Publik</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Informasi rencana mitigasi, fasilitas evakuasi, dan pedoman bencana untuk masyarakat. Data ini bersifat publik dan tidak memerlukan autentikasi.
        </p>
      </div>

      {overview && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rencana terbit</div>
            <div className="mt-1 text-2xl font-semibold tabular">{formatNumber(overview.publishedPlans)}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Wilayah tercakup</div>
            <div className="mt-1 text-2xl font-semibold tabular">{formatNumber(overview.regionsCovered)}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Fasilitas evakuasi</div>
            <div className="mt-1 text-2xl font-semibold tabular">{formatNumber(overview.shelters)}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Kapasitas shelter</div>
            <div className="mt-1 text-2xl font-semibold tabular">{formatNumber(overview.totalShelterCapacity)}</div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Rencana mitigasi publik</h2>
          </div>
          <div className="space-y-3">
            {plans.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Belum ada rencana mitigasi publik.
              </div>
            ) : (
              plans.map((plan) => (
                <div key={plan.id} className="border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-medium">{plan.title}</h3>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {plan.regionName} · {plan.province} · {plan.hazardType}
                  </div>
                  {plan.publicSummary && (
                    <p className="text-xs text-foreground line-clamp-2">{plan.publicSummary}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    <span className="text-muted-foreground">Pengelola:</span>
                    <span className="font-medium">{plan.leadAgency}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    <span className="text-muted-foreground">Diterbitkan:</span>
                    <span className="font-medium">{plan.publishedAt ? formatDateTime(plan.publishedAt) : '—'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Fasilitas evakuasi</h2>
          </div>
          <div className="space-y-3">
            {facilities.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Belum ada fasilitas evakuasi terdaftar.
              </div>
            ) : (
              facilities.map((facility) => {
                const meta = facilityTypeMeta(facility.type);
                return (
                  <div key={facility.id} className="border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-sm font-medium">{facility.name}</h3>
                      <span className={`text-[10px] font-medium rounded border px-2 py-0.5 ${meta.color === '#2563EB' ? 'border-blue/30 bg-blue/10 text-blue' : meta.color === '#0EA5A5' ? 'border-cyan/30 bg-cyan/10 text-cyan' : meta.color === '#B91C1C' ? 'border-destructive/30 bg-destructive/10 text-destructive' : meta.color === '#C2410C' ? 'border-orange/30 bg-orange/10 text-orange' : 'border-border bg-secondary text-muted-foreground'}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {facility.regionName} · {facility.province ?? ''}
                    </div>
                    {facility.address && (
                      <div className="text-xs text-muted-foreground mb-1">{facility.address}</div>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[10px]">
                      <span className="text-muted-foreground">Kapasitas:</span>
                      <span className="font-medium">{formatNumber(facility.capacity)}</span>
                      <span className="text-muted-foreground">· Status:</span>
                      <span className="font-medium">{facility.status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Pedoman bencana</h2>
        </div>
        <div className="space-y-2">
          {guidelines.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Belum ada pedoman tersedia.
            </div>
          ) : (
            guidelines.map((guideline) => (
              <div key={guideline.id} className="border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors group">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-medium group-hover:text-primary transition-colors">{guideline.title}</h3>
                  <span className="text-[10px] text-muted-foreground">{guideline.category}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{guideline.summary}</p>
                <div className="mt-2 flex items-center gap-1 text-[10px]">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Diperbarui: {formatDateTime(guideline.updatedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="mt-6 rounded-lg border border-warning/40 bg-warning/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-warning">SIMULASI — bukan prediksi</h3>
            <p className="mt-0.5 text-xs text-warning/80">
              Semua data di halaman ini adalah data simulasi untuk demonstrasi. Untuk pengambilan keputusan evakuasi nyata,
              selalu merujuk pada pengumuman resmi dari BMKG, PVMBG, BNPB, atau BPBD setempat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}