import React, { useState } from 'react';
import {
  useGetDataSources,
  useGetIntegrationLogs,
  useGetDataQuality,
  updateDataSource,
  syncDataSource,
  getGetDataSourcesQueryKey,
  getGetIntegrationLogsQueryKey,
  getGetDataQualityQueryKey,
} from '@workspace/api-client-react';
import type { DataSource, IntegrationLogEntry, DataQualityReport } from '@workspace/api-client-react';
import {
  DatabaseZap,
  RefreshCw,
  Link,
  AlertTriangle,
  CheckCircle2,
  Server,
  PlugZap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  hazardLabel,
  formatNumber,
  formatDecimal,
  formatDateTime,
  sourceStatusMeta,
  AGENCY_LABELS,
} from '@/lib/risk-ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function StatusChip({ status }: { status?: string | null }) {
  const meta = sourceStatusMeta(status);
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.chip}`}>
      {meta.label}
    </span>
  );
}

export default function DataHub() {
  const [syncSourceId, setSyncSourceId] = useState<number | null>(null);

  const sourcesQuery = useGetDataSources({
    query: { queryKey: getGetDataSourcesQueryKey() },
  });
  const logsQuery = useGetIntegrationLogs({ limit: 50 }, {
    query: { queryKey: getGetIntegrationLogsQueryKey({ limit: 50 }) },
  });
  const qualityQuery = useGetDataQuality({
    query: { queryKey: getGetDataQualityQueryKey() },
  });

  const sources = Array.isArray(sourcesQuery.data) ? sourcesQuery.data : [];
  const logs = Array.isArray(logsQuery.data) ? logsQuery.data : [];
  const quality = qualityQuery.data as DataQualityReport | undefined;

  const handleSync = async (source: DataSource) => {
    setSyncSourceId(source.id);
    try {
      await syncDataSource(source.id);
      sourcesQuery.refetch?.();
    } finally {
      setSyncSourceId(null);
    }
  };

  const handleToggleStatus = async (source: DataSource) => {
    try {
      await updateDataSource(source.id, {
        status: source.status === 'connected' ? 'unavailable' : 'connected',
        description: source.description ?? undefined,
        updateFrequency: source.updateFrequency,
      });
      sourcesQuery.refetch?.();
    } catch {
      // error surfaced by toast if available
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm font-semibold">Hub Integrasi Data Pemerintah & Multi-Sumber</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pusat integrasi data resmi bencana Indonesia (BMKG, BNPB/BPBD, BIG, PVMBG/ESDM, BPS, dan Telemetri Sensor IoT) dengan verifikasi sumber dan rekonsiliasi otomatis.
        </p>
      </div>

      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sources">Sumber data</TabsTrigger>
          <TabsTrigger value="logs">Log integrasi</TabsTrigger>
          <TabsTrigger value="quality">Kualitas data</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="panel p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Kode</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Nama</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Agensi</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Kategori</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rekor</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Lengkap</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Duplikat</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Terakhir sinkronisasi</th>
                  <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sources.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Belum ada sumber data terdaftar.
                    </td>
                  </tr>
                ) : (
                  sources.map((source) => (
                    <tr key={source.id} className="group hover:bg-accent/50">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{source.code}</td>
                      <td className="px-3 py-2 font-medium">{source.name}</td>
                      <td className="px-3 py-2 text-xs">{AGENCY_LABELS[source.agency] || source.agency}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{source.category}</td>
                      <td className="px-3 py-2">
                        <StatusChip status={source.status} />
                      </td>
                      <td className="px-3 py-2 font-medium tabular">{formatNumber(source.recordsAvailable)}</td>
                      <td className="px-3 py-2 font-medium tabular text-muted-foreground">
                        {formatDecimal(source.completeness, 1)}%
                      </td>
                      <td className="px-3 py-2 font-medium tabular text-muted-foreground">
                        {formatDecimal(source.duplicateRate, 1)}%
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {source.lastSyncAt ? formatDateTime(source.lastSyncAt) : 'â€”'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleSync(source)}
                            disabled={syncSourceId === source.id}
                            className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                              syncSourceId === source.id
                                ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                                : 'border border-border bg-card text-foreground hover:bg-secondary'
                            }`}
                            title="Sinkronisasi ulang"
                          >
                            {syncSourceId === source.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleToggleStatus(source)}
                            className="rounded-md px-2.5 py-1.5 text-xs border border-border bg-card text-foreground hover:bg-secondary"
                            title="Ubah status"
                          >
                            <Link className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Data resmi disinkronisasi langsung dari endpoint pemerintah Republik Indonesia. Seluruh asal-usul (provenance) dan jejak audit tersimpan dalam basis data.
          </p>
        </TabsContent>

        <TabsContent value="logs" className="panel p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Waktu</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Sumber</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tingkat</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Acara</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Pesan</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rekor</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Durasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Belum ada log integrasi.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="group">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                      <td className="px-3 py-2 text-xs">{log.sourceName ?? 'â€”'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-medium uppercase ${
                          log.level === 'error' ? 'text-destructive' : log.level === 'warn' ? 'text-warning' : 'text-muted-foreground'
                        }`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{log.event}</td>
                      <td className="px-3 py-2 text-xs">{log.message}</td>
                      <td className="px-3 py-2 font-medium tabular text-muted-foreground">
                        {formatNumber(log.recordsProcessed)}
                      </td>
                      <td className="px-3 py-2 font-medium tabular text-muted-foreground">
                        {log.durationMs != null ? `${log.durationMs} ms` : 'â€”'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="panel p-5">
          {quality ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total pemeriksaan</div>
                  <div className="mt-1 text-2xl font-semibold tabular">{formatNumber(quality.summary.total)}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Lulus</div>
                  <div className="mt-1 text-2xl font-semibold tabular text-success">{formatNumber(quality.summary.passed)}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Peringatan</div>
                  <div className="mt-1 text-2xl font-semibold tabular text-warning">{formatNumber(quality.summary.warnings)}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Gagal</div>
                  <div className="mt-1 text-2xl font-semibold tabular text-destructive">{formatNumber(quality.summary.failed)}</div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold">Detail pemeriksaan</h3>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-background">
                        <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Pemeriksaan</th>
                        <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                        <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Detail</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Terdampak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {quality.checks.map((check) => (
                        <tr key={check.id}>
                          <td className="px-3 py-2 font-medium">{check.label}</td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] font-semibold uppercase rounded border px-2 py-0.5 ${
                              check.status === 'pass' ? 'border-success/30 bg-success/10 text-success' :
                              check.status === 'warn' ? 'border-warning/40 bg-warning/10 text-warning' :
                              'border-destructive/30 bg-destructive/10 text-destructive'
                            }`}>
                              {check.status === 'pass' ? 'Lulus' : check.status === 'warn' ? 'Peringatan' : 'Gagal'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{check.detail}</td>
                          <td className="px-3 py-2 font-medium tabular text-muted-foreground">{formatNumber(check.affected)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold">Per sumber data</h3>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-background">
                        <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Sumber</th>
                        <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Kode</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rekor</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Lengkap</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Duplikat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {quality.datasets.map((ds) => (
                        <tr key={ds.sourceId}>
                          <td className="px-3 py-2 font-medium">{ds.name}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{ds.code}</td>
                          <td className="px-3 py-2 font-medium tabular">{formatNumber(ds.records)}</td>
                          <td className="px-3 py-2 font-medium tabular text-muted-foreground">{formatDecimal(ds.completeness, 1)}%</td>
                          <td className="px-3 py-2 font-medium tabular text-muted-foreground">{formatDecimal(ds.duplicateRate, 1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">Belum ada laporan kualitas data</h3>
              <p className="mt-0.5 text-xs text-muted-foreground max-w-xs mx-auto">
                Jalankan sinkronisasi sumber data untuk menghasilkan laporan kualitas.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
