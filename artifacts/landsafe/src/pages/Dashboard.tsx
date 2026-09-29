import React from 'react';
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
  Droplets, Bell, FileText, ChevronRight, Download, RefreshCcw, CheckCircle2, Zap
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
  const { data: stats, isLoading: statsLoading, refetch } = useGetDashboardStats();
  const { data: activities, isLoading: activityLoading } = useGetDashboardActivity({ limit: 10 });
  const { data: riskSummary, isLoading: riskLoading } = useGetDashboardRiskSummary();
  const { data: mapLocations, isError: mapError, refetch: refetchLocations } = useGetLocations({
    query: { queryKey: getGetLocationsQueryKey(), refetchInterval: 30000 }
  });

  if (statsLoading || riskLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-32 bg-card rounded-3xl border border-border ${i === 0 ? 'col-span-2' : ''}`}></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 bg-card rounded-3xl border border-border lg:col-span-2"></div>
          <div className="h-96 bg-card rounded-3xl border border-border"></div>
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
    <div className="space-y-6">
      {/* KPI Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* System Status — hero card */}
        <div className="col-span-2 bg-primary text-primary-foreground rounded-3xl p-5 shadow-lg shadow-primary/20 relative overflow-hidden flex flex-col justify-between group">
          <div className="absolute -right-6 -top-6 text-white/5 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
            <Activity size={120} strokeWidth={1} />
          </div>
          <div className="flex items-center gap-2 mb-4 z-10">
            <div className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHealthy ? 'bg-green-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isHealthy ? 'bg-green-500' : 'bg-amber-500'}`}></span>
            </div>
            <span className="text-sm font-medium tracking-wide uppercase text-primary-foreground/80">System Status</span>
          </div>
          <div className="z-10">
            <h2 className="text-3xl font-bold tracking-tight capitalize">{isHealthy ? 'Operational' : s.systemHealth}</h2>
            <p className="text-sm text-primary-foreground/70 mt-1">
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
          <div key={i} className="bg-card rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)] border border-primary/5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4 gap-2">
              <span className="text-xs font-semibold tracking-wide uppercase text-primary/60">{kpi.label}</span>
              <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${kpi.tone}1a`, color: kpi.tone }}>
                <kpi.icon size={16} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-3xl font-bold" style={{ color: kpi.tone }}>{kpi.value}</span>
                {kpi.suffix && <span className="text-lg font-medium text-primary/40">{kpi.suffix}</span>}
              </div>
              <p className="text-xs font-medium mt-1" style={{ color: kpi.subTone ? `${kpi.subTone}cc` : undefined }}>
                <span className={kpi.subTone ? '' : 'text-primary/60'}>{kpi.sub}</span>
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Map & Risk Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-3xl shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)] border border-primary/5 overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-primary/5 flex flex-wrap gap-3 justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-primary">Geospatial Overview</h3>
              <p className="text-sm font-medium text-primary/60">Central Java Sector — Live Feed</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { void refetch(); void refetchLocations(); }}
                className="px-4 py-2 rounded-full bg-background text-primary text-sm font-bold border border-primary/10 hover:bg-primary/5 hover:border-primary/20 transition-all flex items-center gap-2 active:scale-95"
              >
                <RefreshCcw size={14} /> Refresh
              </button>
              <button
                onClick={() => setLocation('/live-map')}
                className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/20 hover:-translate-y-0.5 hover:shadow-lg transition-all active:translate-y-0 active:scale-95 flex items-center gap-2 group"
              >
                Full Map <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="relative min-h-[340px] flex-1">
            <DashboardMap locations={mapLocations ?? []} />
            {mapError && (
              <div className="absolute left-4 top-4 z-[500] rounded-lg bg-white/95 px-3 py-2 text-xs text-destructive shadow">
                Gagal memuat lokasi dari API.
              </div>
            )}
            <div className="pointer-events-none absolute bottom-6 right-4 z-[500] rounded-2xl border border-primary/10 bg-white/95 p-3 shadow-lg">
              <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary/60">Legend</h4>
              <div className="space-y-1">
                {riskData.map(item => (
                  <div key={item.key} className="flex items-center gap-2 text-xs font-medium text-primary">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-card rounded-3xl shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)] border border-primary/5 p-6 flex flex-col">
          <h3 className="text-lg font-bold text-primary mb-1">Risk Distribution</h3>
          <p className="text-sm font-medium text-primary/60 mb-6">Aggregate zone status across sectors</p>

          <div className="flex-1 relative min-h-[220px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData}
                  innerRadius={70}
                  outerRadius={100}
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
              <span className="text-4xl font-bold text-primary">{totalZones}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary/50">Total Zones</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {riskData.map((item, i) => (
              <div key={i} className="bg-background p-3 rounded-2xl flex flex-col gap-1 border border-white shadow-[inset_0_2px_4px_0_rgba(255,255,255,0.8),0_1px_2px_0_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-xs font-bold text-primary">{item.key}</span>
                </div>
                <span className="text-xl font-bold text-primary pl-4">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity & Quick Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-3xl shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)] border border-primary/5 overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-primary/5 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-primary/5 p-2 rounded-xl text-primary">
                <Bell size={18} />
              </div>
              <h3 className="text-lg font-bold text-primary">Recent Activity</h3>
            </div>
            <button
              onClick={() => setLocation('/alerts')}
              className="text-sm font-bold text-primary/60 hover:text-primary transition-colors"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-primary/5 p-2">
            {activityLoading ? (
              <div className="text-sm font-medium text-primary/60 text-center py-8">Loading telemetry…</div>
            ) : Array.isArray(activities) && activities.length > 0 ? (
              activities.slice(0, 5).map((act) => {
                const v = activityVisual(act.priority);
                return (
                  <div key={act.id} className="p-4 hover:bg-background/60 rounded-2xl transition-colors flex items-start gap-4">
                    <div className={`p-2.5 rounded-2xl shrink-0 mt-1 ${v.chip}`}>
                      <v.icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="font-bold text-foreground text-base truncate">{act.message}</h4>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md shrink-0 ${
                          act.priority === 'critical'
                            ? 'text-destructive bg-destructive/10'
                            : 'text-primary/50'
                        }`}>
                          {new Date(act.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-primary/70 flex items-center gap-1.5">
                        <MapPin size={14} /> {act.locationName || 'System'}
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
        <div className="bg-primary rounded-3xl shadow-lg shadow-primary/20 p-6 flex flex-col justify-between text-primary-foreground relative overflow-hidden group">
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors duration-700 pointer-events-none"></div>

          <div>
            <h3 className="text-xl font-bold mb-2">Quick Actions</h3>
            <p className="text-primary-foreground/70 text-sm font-medium mb-6">Frequently used tools and reporting functions.</p>
          </div>

          <div className="space-y-3 relative z-10">
            {[
              { label: 'Generate Report', icon: Download, iconBg: 'bg-white/10', to: '/reports' },
              { label: 'Open Command Map', icon: MapIcon, iconBg: 'bg-white/10', to: '/live-map' },
              { label: 'Broadcast Alert', icon: Radio, iconBg: 'bg-[#b91c1c]/80', to: '/alerts' },
            ].map((qa, i) => (
              <button
                key={i}
                onClick={() => setLocation(qa.to)}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all hover:-translate-y-1 group/btn active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className={`${qa.iconBg} p-2 rounded-xl text-white`}>
                    <qa.icon size={18} />
                  </div>
                  <span className="font-bold text-sm tracking-wide">{qa.label}</span>
                </div>
                <ChevronRight size={16} className="text-white/50 group-hover/btn:translate-x-1 group-hover/btn:text-white transition-all" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Telemetry table */}
      <section className="bg-card rounded-3xl shadow-[0_4px_20px_-2px_rgba(20,83,45,0.05)] border border-primary/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primary/5 p-2 rounded-xl text-primary">
            <FileText size={18} />
          </div>
          <h3 className="text-lg font-bold text-primary">System Telemetry Log</h3>
        </div>
        {Array.isArray(activities) && activities.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
