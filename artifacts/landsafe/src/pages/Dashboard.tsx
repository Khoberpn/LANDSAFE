import React, { useState } from 'react';
import { useLocation } from 'wouter';
import {
  useGetDashboardStats,
  useGetDashboardActivity,
  useGetDashboardRiskSummary,
  useGetLocations,
  getGetLocationsQueryKey
} from '@workspace/api-client-react';
import {
  Activity, Radio, MapPin, AlertTriangle, AlertOctagon, Map as MapIcon,
  Droplets, Bell, FileText, ChevronRight, Download, RefreshCcw, CheckCircle2, Zap,
  ShieldCheck, ClipboardCheck
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardMap from './DashboardMap';

const RISK_COLORS = {
  danger: '#b91c1c',
  alert: '#c2410c',
  watch: '#ca8a04',
  normal: '#14532d',
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [selectedProvince, setSelectedProvince] = useState('all');
  const [selectedHazard, setSelectedHazard] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const { data: stats, isLoading: statsLoading, refetch } = useGetDashboardStats();
  const { data: activities, isLoading: activityLoading } = useGetDashboardActivity({ limit: 10 });
  const { data: riskSummary, isLoading: riskLoading } = useGetDashboardRiskSummary();
  const { data: mapLocations, isError: mapError, refetch: refetchLocations } = useGetLocations({
    query: { queryKey: getGetLocationsQueryKey(), refetchInterval: 30000 }
  });

  if (statsLoading || riskLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-28 sm:h-32 bg-card rounded-2xl sm:rounded-3xl border border-border ${i === 0 ? 'sm:col-span-2' : ''}`}></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="h-80 sm:h-96 bg-card rounded-2xl sm:rounded-3xl border border-border lg:col-span-2"></div>
          <div className="h-80 sm:h-96 bg-card rounded-2xl sm:rounded-3xl border border-border"></div>
        </div>
      </div>
    );
  }

  const s = stats || {
    totalSensors: 20,
    onlineSensors: 18,
    offlineSensors: 2,
    highRiskLocations: 3,
    activeWarnings: 15,
    normalLocations: 45,
    avgRainfall: 12.5,
    avgSoilMoisture: 42.1,
    systemHealth: 'healthy',
    dbStatus: 'connected',
    aiEngineStatus: 'active',
    networkStatus: 'stable'
  };

  const r = riskSummary || { danger: 3, alert: 7, watch: 12, normal: 45, trend: 'stable' };
  const totalZones = r.danger + r.alert + r.watch + r.normal;

  const riskData = [
    { name: 'Awas (Danger)', key: 'Awas', value: r.danger, color: RISK_COLORS.danger },
    { name: 'Siaga (Alert)', key: 'Siaga', value: r.alert, color: RISK_COLORS.alert },
    { name: 'Waspada (Watch)', key: 'Waspada', value: r.watch, color: RISK_COLORS.watch },
    { name: 'Aman (Normal)', key: 'Aman', value: r.normal, color: RISK_COLORS.normal },
  ];

  const isHealthy = s.systemHealth === 'healthy';

  const activityVisual = (priority?: string) => {
    if (priority === 'critical') return { icon: AlertOctagon, chip: 'bg-destructive/10 text-destructive' };
    if (priority === 'high') return { icon: Zap, chip: 'bg-[#c2410c]/10 text-[#c2410c]' };
    return { icon: CheckCircle2, chip: 'bg-primary/10 text-primary' };
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Evidence & Provenance Bar (PRD Section 5.1 & Section 9) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card rounded-2xl p-3 sm:p-4 border border-primary/5 shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)]">
        <div className="flex items-center gap-2 text-xs text-primary/70">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-semibold text-primary">Multi-Hazard Intelligence:</span>
          <span className="truncate">Sumber: BMKG, InaRISK, PVMBG & IoT Telemetri</span>
          <span className="hidden sm:inline text-primary/40">•</span>
          <span className="hidden sm:inline font-mono text-[11px] text-primary/60">Wilayah Pilot: Jateng, Sumbar, Sulut</span>
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <select
            value={selectedProvince}
            onChange={(e) => setSelectedProvince(e.target.value)}
            className="px-2.5 py-1 rounded-full border border-primary/10 bg-background text-xs font-medium text-primary focus:outline-none"
          >
            <option value="all">Semua Wilayah Pilot</option>
            <option value="jateng">Jawa Tengah</option>
            <option value="sumbar">Sumatera Barat</option>
            <option value="sulut">Sulawesi Utara</option>
          </select>
          <select
            value={selectedHazard}
            onChange={(e) => setSelectedHazard(e.target.value)}
            className="px-2.5 py-1 rounded-full border border-primary/10 bg-background text-xs font-medium text-primary focus:outline-none"
          >
            <option value="all">Semua Bahaya</option>
            <option value="landslide">Tanah Longsor</option>
            <option value="flood">Banjir</option>
            <option value="earthquake">Gempa Bumi</option>
          </select>
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-2.5 py-1 rounded-full border border-primary/10 bg-background text-xs font-medium text-primary focus:outline-none"
          >
            <option value="24h">24 Jam Terakhir</option>
            <option value="7d">7 Hari Terakhir</option>
            <option value="30d">30 Hari Terakhir</option>
          </select>
        </div>
      </div>

      {/* KPI Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* System Status — hero card */}
        <div className="col-span-1 sm:col-span-2 bg-primary text-primary-foreground rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-lg shadow-primary/20 relative overflow-hidden flex flex-col justify-between group">
          <div className="absolute -right-6 -top-6 text-white/5 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
            <Activity size={120} strokeWidth={1} />
          </div>
          <div className="flex items-center gap-2 mb-3 sm:mb-4 z-10">
            <div className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHealthy ? 'bg-green-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isHealthy ? 'bg-green-500' : 'bg-amber-500'}`}></span>
            </div>
            <span className="text-xs sm:text-sm font-medium tracking-wide uppercase text-primary-foreground/80">System Status</span>
          </div>
          <div className="z-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight capitalize">{isHealthy ? 'Operational' : s.systemHealth}</h2>
            <p className="text-xs sm:text-sm text-primary-foreground/70 mt-1">
              {isHealthy ? 'All core systems functioning normally' : 'Attention required on core systems'}
            </p>
          </div>
        </div>

        {[
          {
            label: 'High Risk Zones', value: s.highRiskLocations, icon: AlertOctagon,
            tone: '#b91c1c', sub: 'Requires immediate attention', subTone: '#b91c1c'
          },
          {
            label: 'Active Alerts', value: s.activeWarnings, icon: AlertTriangle,
            tone: '#c2410c', sub: 'Across all monitored sectors', subTone: '#c2410c'
          },
          {
            label: 'Sensor Health', value: `${s.onlineSensors}`, suffix: `/${s.totalSensors}`, icon: Radio,
            tone: '#14532d', sub: s.offlineSensors > 0 ? `${s.offlineSensors} sensors offline` : 'All sensors online', subTone: '#ca8a04'
          },
          {
            label: 'Avg Rainfall', value: `${s.avgRainfall}`, suffix: ' mm', icon: Droplets,
            tone: '#14532d', sub: `Soil moisture ${s.avgSoilMoisture}%`, subTone: undefined
          },
        ].map((kpi, i) => (
          <div key={i} className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)] border border-primary/5 flex flex-col justify-between hover:-translate-y-0.5 transition-transform duration-300">
            <div className="flex justify-between items-start mb-3 gap-2">
              <span className="text-[11px] sm:text-xs font-semibold tracking-wide uppercase text-primary/60">{kpi.label}</span>
              <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${kpi.tone}1a`, color: kpi.tone }}>
                <kpi.icon size={16} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl sm:text-3xl font-bold" style={{ color: kpi.tone }}>{kpi.value}</span>
                {kpi.suffix && <span className="text-base sm:text-lg font-medium text-primary/40">{kpi.suffix}</span>}
              </div>
              <p className="text-[11px] sm:text-xs font-medium mt-1 truncate" style={{ color: kpi.subTone ? `${kpi.subTone}cc` : undefined }}>
                <span className={kpi.subTone ? '' : 'text-primary/60'}>{kpi.sub}</span>
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Map & Risk Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-card rounded-2xl sm:rounded-3xl shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)] border border-primary/5 overflow-hidden flex flex-col">
          <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-primary/5 flex flex-wrap gap-2 sm:gap-3 justify-between items-center">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-primary">Geospatial Overview</h3>
              <p className="text-xs sm:text-sm font-medium text-primary/60">Central Java Sector — Live Feed</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { void refetch(); void refetchLocations(); }}
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-background text-primary text-xs sm:text-sm font-bold border border-primary/10 hover:bg-primary/5 hover:border-primary/20 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <RefreshCcw size={13} /> Refresh
              </button>
              <button
                type="button"
                onClick={() => setLocation('/live-map')}
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-bold shadow-md shadow-primary/20 hover:-translate-y-0.5 hover:shadow-lg transition-all active:translate-y-0 active:scale-95 flex items-center gap-1.5 group"
              >
                Full Map <ChevronRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="relative min-h-[280px] sm:min-h-[340px] flex-1">
            <DashboardMap locations={mapLocations ?? []} />
            {mapError && (
              <div className="absolute left-3 top-3 z-[500] rounded-lg bg-white/95 px-3 py-1.5 text-xs text-destructive shadow">
                Gagal memuat lokasi dari API.
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 right-3 sm:bottom-6 sm:right-4 z-[500] rounded-xl sm:rounded-2xl border border-primary/10 bg-white/95 p-2 sm:p-3 shadow-lg max-w-[calc(100%-1.5rem)]">
              <h4 className="mb-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-primary/60">Legend</h4>
              <div className="grid grid-cols-2 sm:grid-cols-1 gap-1 sm:space-y-0.5">
                {riskData.map(item => (
                  <div key={item.key} className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-primary">
                    <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-card rounded-2xl sm:rounded-3xl shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)] border border-primary/5 p-4 sm:p-6 flex flex-col">
          <h3 className="text-base sm:text-lg font-bold text-primary mb-1">Risk Distribution</h3>
          <p className="text-xs sm:text-sm font-medium text-primary/60 mb-4 sm:mb-6">Aggregate zone status across sectors</p>

          <div className="flex-1 relative min-h-[200px] sm:min-h-[220px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData}
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={6}
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 600, color: '#14532d' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl sm:text-4xl font-bold text-primary">{totalZones}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary/50">Total Zones</span>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-2 sm:gap-3">
            {riskData.map((item, i) => (
              <div key={i} className="bg-background p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex flex-col gap-1 border border-white shadow-[inset_0_2px_4px_0_rgba(255,255,255,0.8),0_1px_2px_0_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-xs font-bold text-primary">{item.key}</span>
                </div>
                <span className="text-lg sm:text-xl font-bold text-primary pl-3.5 sm:pl-4">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity & Quick Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-card rounded-2xl sm:rounded-3xl shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)] border border-primary/5 overflow-hidden flex flex-col">
          <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-primary/5 flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-primary/5 p-2 rounded-xl text-primary">
                <Bell size={18} />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-primary">Recent Activity</h3>
            </div>
            <button
              type="button"
              onClick={() => setLocation('/alerts')}
              className="text-xs sm:text-sm font-bold text-primary/60 hover:text-primary transition-colors"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-primary/5 p-1 sm:p-2">
            {activityLoading ? (
              <div className="text-sm font-medium text-primary/60 text-center py-8">Loading telemetry…</div>
            ) : Array.isArray(activities) && activities.length > 0 ? (
              activities.slice(0, 5).map((act) => {
                const v = activityVisual(act.priority);
                return (
                  <div key={act.id} className="p-3 sm:p-4 hover:bg-background/60 rounded-xl sm:rounded-2xl transition-colors flex items-start gap-3 sm:gap-4">
                    <div className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shrink-0 mt-0.5 ${v.chip}`}>
                      <v.icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap justify-between items-start gap-1 mb-1">
                        <h4 className="font-bold text-foreground text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">{act.message}</h4>
                        <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          act.priority === 'critical'
                            ? 'text-destructive bg-destructive/10'
                            : 'text-primary/50'
                        }`}>
                          {new Date(act.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-primary/70 flex items-center gap-1">
                        <MapPin size={13} /> {act.locationName || 'System'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm font-medium text-primary/60 text-center py-8">No recent activity</div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-primary rounded-2xl sm:rounded-3xl shadow-lg shadow-primary/20 p-4 sm:p-6 flex flex-col justify-between text-primary-foreground relative overflow-hidden group">
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors duration-700 pointer-events-none"></div>

          <div>
            <h3 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">Quick Actions</h3>
            <p className="text-primary-foreground/70 text-xs sm:text-sm font-medium mb-4 sm:mb-6">Frequently used tools and reporting functions.</p>
          </div>

          <div className="space-y-2.5 sm:space-y-3 relative z-10">
            {[
              { label: 'Operasi Insiden', icon: AlertOctagon, iconBg: 'bg-white/10', to: '/incidents' },
              { label: 'Kaji Cepat Lapangan', icon: ClipboardCheck, iconBg: 'bg-white/10', to: '/field-reports' },
              { label: 'Open Command Map', icon: MapIcon, iconBg: 'bg-white/10', to: '/live-map' },
              { label: 'Generate Report', icon: Download, iconBg: 'bg-white/10', to: '/reports' },
            ].map((qa, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLocation(qa.to)}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between transition-all hover:-translate-y-0.5 group/btn active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className={`${qa.iconBg} p-2 rounded-xl text-white`}>
                    <qa.icon size={16} />
                  </div>
                  <span className="font-bold text-xs sm:text-sm tracking-wide">{qa.label}</span>
                </div>
                <ChevronRight size={16} className="text-white/50 group-hover/btn:translate-x-1 group-hover/btn:text-white transition-all" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Telemetry table */}
      <section className="bg-card rounded-2xl sm:rounded-3xl shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)] border border-primary/5 p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primary/5 p-2 rounded-xl text-primary">
            <FileText size={18} />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-primary">System Telemetry Log</h3>
        </div>
        {Array.isArray(activities) && activities.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-primary/10 text-xs uppercase tracking-wider text-primary/50 text-left">
                  <th className="pb-2 font-bold">Timestamp</th>
                  <th className="pb-2 font-bold">Level</th>
                  <th className="pb-2 font-bold">Location</th>
                  <th className="pb-2 font-bold">Event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {activities.map(act => (
                  <tr key={act.id} className="hover:bg-background/60 transition-colors">
                    <td className="py-2.5 text-primary/60 font-medium tabular-nums">{new Date(act.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        act.priority === 'critical' ? 'bg-destructive/10 text-destructive' :
                        act.priority === 'high' ? 'bg-[#c2410c]/10 text-[#c2410c]' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {act.priority}
                      </span>
                    </td>
                    <td className="py-2.5 font-bold text-foreground">{act.locationName || 'System'}</td>
                    <td className="py-2.5 font-medium text-primary/70">{act.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm font-medium text-primary/60 text-center py-4">No telemetry data</div>
        )}
      </section>
    </div>
  );
}
