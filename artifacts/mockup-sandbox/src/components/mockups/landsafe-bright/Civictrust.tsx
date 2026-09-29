import React, { useState, useEffect } from 'react';
import { 
  Shield, Clock, Map, AlertTriangle, Radio, Activity, 
  CheckCircle2, ChevronRight, Bell, FileText, Settings, 
  Download, Search, AlertOctagon, MapPin, Wind, Zap, RefreshCcw
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const riskData = [
  { name: 'Danger (Awas)', value: 3, color: '#b91c1c' }, // earth red
  { name: 'Alert (Siaga)', value: 7, color: '#c2410c' }, // rust orange
  { name: 'Watch (Waspada)', value: 12, color: '#ca8a04' }, // ochre yellow
  { name: 'Normal (Aman)', value: 45, color: '#14532d' }, // deep green
];

export function Civictrust() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Jakarta'
  }) + ' WIB';

  const formattedDate = time.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Jakarta'
  });

  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#1e293b] font-sans selection:bg-[#14532d] selection:text-[#F7F4EE]" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        
        .shadow-soft {
          box-shadow: 0 4px 20px -2px rgba(20, 83, 45, 0.05), 0 0 3px rgba(20, 83, 45, 0.02);
        }
        
        .shadow-inner-light {
          box-shadow: inset 0 2px 4px 0 rgba(255, 255, 255, 0.8), 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        
        .map-grid {
          background-size: 40px 40px;
          background-image: linear-gradient(to right, rgba(20, 83, 45, 0.05) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(20, 83, 45, 0.05) 1px, transparent 1px);
        }
      `}</style>

      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-[#F7F4EE]/80 backdrop-blur-md border-b border-[#14532d]/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#14532d] text-[#F7F4EE] p-2 rounded-xl shadow-lg shadow-[#14532d]/20 flex items-center justify-center">
            <Shield size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#14532d] leading-none">LANDSAFE</h1>
            <p className="text-xs font-medium text-[#14532d]/60 mt-0.5 tracking-wide uppercase">Badan Nasional Penanggulangan Bencana</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-full border border-[#14532d]/10 shadow-sm">
            <MapPin size={14} className="text-[#14532d]/60" />
            <span className="text-sm font-medium text-[#14532d]">Sektor Jawa Tengah</span>
          </div>
          
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-[#14532d]/10 shadow-sm shadow-[#14532d]/5">
            <Clock size={16} className="text-[#14532d]" />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#14532d] leading-none tabular-nums">{formattedTime}</span>
              <span className="text-[10px] text-[#14532d]/60 font-medium uppercase mt-0.5">{formattedDate}</span>
            </div>
          </div>
          
          <button className="group relative p-2.5 bg-white rounded-full border border-[#14532d]/10 shadow-sm shadow-[#14532d]/5 hover:-translate-y-0.5 hover:shadow-md transition-all active:translate-y-0 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#14532d] focus:ring-offset-2 focus:ring-offset-[#F7F4EE]">
            <Settings size={18} className="text-[#14532d] group-hover:rotate-45 transition-transform duration-300" />
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        
        {/* KPI Grid */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          {/* Status - Spans 2 cols on md */}
          <div className="col-span-2 bg-[#14532d] text-[#F7F4EE] rounded-3xl p-5 shadow-lg shadow-[#14532d]/20 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute -right-6 -top-6 text-white/5 group-hover:scale-110 transition-transform duration-700">
              <Activity size={120} strokeWidth={1} />
            </div>
            <div className="flex items-center gap-2 mb-4 z-10">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ade80] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22c55e]"></span>
              </div>
              <span className="text-sm font-medium tracking-wide uppercase text-[#F7F4EE]/80">System Status</span>
            </div>
            <div className="z-10">
              <h2 className="text-3xl font-bold tracking-tight">Operational</h2>
              <p className="text-sm text-[#F7F4EE]/70 mt-1">All core systems functioning normally</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-soft border border-[#14532d]/5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold tracking-wide uppercase text-[#14532d]/60">High Risk Zones</span>
              <div className="bg-[#b91c1c]/10 p-1.5 rounded-lg text-[#b91c1c]">
                <AlertOctagon size={16} />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#b91c1c]">3</div>
              <p className="text-xs font-medium text-[#b91c1c]/80 mt-1">Requires immediate attention</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-soft border border-[#14532d]/5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold tracking-wide uppercase text-[#14532d]/60">Active Alerts</span>
              <div className="bg-[#c2410c]/10 p-1.5 rounded-lg text-[#c2410c]">
                <AlertTriangle size={16} />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#c2410c]">15</div>
              <p className="text-xs font-medium text-[#c2410c]/80 mt-1">+2 from previous hour</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-soft border border-[#14532d]/5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold tracking-wide uppercase text-[#14532d]/60">Locations Monitored</span>
              <div className="bg-[#14532d]/10 p-1.5 rounded-lg text-[#14532d]">
                <Map size={16} />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#14532d]">10</div>
              <p className="text-xs font-medium text-[#14532d]/60 mt-1">Across 3 provinces</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-soft border border-[#14532d]/5 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold tracking-wide uppercase text-[#14532d]/60">Sensor Health</span>
              <div className="bg-[#ca8a04]/10 p-1.5 rounded-lg text-[#ca8a04]">
                <Radio size={16} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[#14532d]">18</span>
                <span className="text-lg font-medium text-[#14532d]/40">/20</span>
              </div>
              <p className="text-xs font-medium text-[#ca8a04] mt-1">2 sensors offline</p>
            </div>
          </div>
        </section>

        {/* Middle Section: Map & Donut */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Map Panel */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-soft border border-[#14532d]/5 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-[#14532d]/5 flex justify-between items-center bg-white z-10 relative">
              <div>
                <h3 className="text-lg font-bold text-[#14532d]">Geospatial Overview</h3>
                <p className="text-sm font-medium text-[#14532d]/60">Central Java Sector — Live Feed</p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-full bg-[#F7F4EE] text-[#14532d] text-sm font-bold border border-[#14532d]/10 hover:bg-[#14532d]/5 hover:border-[#14532d]/20 transition-all flex items-center gap-2 active:scale-95">
                  <RefreshCcw size={14} /> Refresh
                </button>
                <button className="px-4 py-2 rounded-full bg-[#14532d] text-[#F7F4EE] text-sm font-bold shadow-md shadow-[#14532d]/20 hover:-translate-y-0.5 hover:shadow-lg transition-all active:translate-y-0 active:scale-95 flex items-center gap-2 group">
                  Full Map <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 min-h-[400px] relative bg-[#f1f5f9] map-grid">
              {/* Fake Map Content */}
              <div className="absolute inset-0 opacity-40 mix-blend-multiply pointer-events-none" 
                   style={{
                     backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100%25\' height=\'100%25\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M100 200 Q 150 150 200 250 T 350 200 T 500 300 T 650 150 T 800 250\' fill=\'none\' stroke=\'%2314532d\' stroke-width=\'2\' stroke-dasharray=\'4 4\'/%3E%3Cpath d=\'M50 100 Q 200 50 300 150 T 500 100 T 700 200\' fill=\'none\' stroke=\'%23ca8a04\' stroke-width=\'1\'/%3E%3C/svg%3E")'
                   }} 
              />
              
              {/* Map Points */}
              <div className="absolute top-[30%] left-[25%] group cursor-pointer">
                <div className="relative">
                  <span className="animate-ping absolute -inset-2 rounded-full bg-[#b91c1c] opacity-40"></span>
                  <div className="w-4 h-4 bg-[#b91c1c] rounded-full border-2 border-white shadow-md relative z-10"></div>
                </div>
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white px-3 py-1.5 rounded-lg shadow-lg border border-black/5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                  <p className="text-xs font-bold text-[#14532d]">Banjarnegara</p>
                  <p className="text-[10px] text-[#b91c1c] font-bold">Awas - Soil Movement</p>
                </div>
              </div>

              <div className="absolute top-[45%] left-[60%] group cursor-pointer">
                <div className="relative">
                  <div className="w-3.5 h-3.5 bg-[#c2410c] rounded-full border-2 border-white shadow-md relative z-10 hover:scale-125 transition-transform"></div>
                </div>
                <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-white px-3 py-1.5 rounded-lg shadow-lg border border-black/5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                  <p className="text-xs font-bold text-[#14532d]">Merapi Selatan</p>
                  <p className="text-[10px] text-[#c2410c] font-bold">Siaga - Sensor SNS-014</p>
                </div>
              </div>

              <div className="absolute top-[65%] left-[40%] group cursor-pointer">
                <div className="relative">
                  <div className="w-3.5 h-3.5 bg-[#ca8a04] rounded-full border-2 border-white shadow-md relative z-10 hover:scale-125 transition-transform"></div>
                </div>
              </div>

              <div className="absolute top-[20%] left-[70%] group cursor-pointer">
                <div className="relative">
                  <div className="w-3 h-3 bg-[#14532d] rounded-full border-2 border-white shadow-md relative z-10 hover:scale-125 transition-transform"></div>
                </div>
              </div>

              {/* Map Legend Overlay */}
              <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-[#14532d]/10">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#14532d]/60 mb-2 px-1">Legend</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Awas (Danger)', color: 'bg-[#b91c1c]' },
                    { label: 'Siaga (Alert)', color: 'bg-[#c2410c]' },
                    { label: 'Waspada (Watch)', color: 'bg-[#ca8a04]' },
                    { label: 'Aman (Normal)', color: 'bg-[#14532d]' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-medium text-[#14532d]">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.color}`}></div>
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Donut Chart Panel */}
          <div className="bg-white rounded-3xl shadow-soft border border-[#14532d]/5 p-6 flex flex-col">
            <h3 className="text-lg font-bold text-[#14532d] mb-1">Risk Distribution</h3>
            <p className="text-sm font-medium text-[#14532d]/60 mb-6">Aggregate zone status across sectors</p>
            
            <div className="flex-1 relative min-h-[200px] flex items-center justify-center">
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
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ fontWeight: 600, color: '#14532d' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-bold text-[#14532d]">67</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#14532d]/50">Total Zones</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {riskData.map((item, i) => (
                <div key={i} className="bg-[#F7F4EE] p-3 rounded-2xl flex flex-col gap-1 border border-white shadow-inner-light">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs font-bold text-[#14532d]">{item.name.split(' ')[0]}</span>
                  </div>
                  <span className="text-xl font-bold text-[#14532d] pl-4">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom Section: Recent Activity & Actions */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-soft border border-[#14532d]/5 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-[#14532d]/5 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="bg-[#14532d]/5 p-2 rounded-xl text-[#14532d]">
                  <Bell size={18} />
                </div>
                <h3 className="text-lg font-bold text-[#14532d]">Recent Activity</h3>
              </div>
              <button className="text-sm font-bold text-[#14532d]/60 hover:text-[#14532d] transition-colors">
                View All
              </button>
            </div>
            
            <div className="divide-y divide-[#14532d]/5 p-2">
              {/* Activity Item 1 */}
              <div className="group p-4 hover:bg-[#F7F4EE]/50 rounded-2xl transition-colors flex items-start gap-4">
                <div className="bg-[#b91c1c]/10 p-2.5 rounded-2xl text-[#b91c1c] shrink-0 mt-1">
                  <AlertOctagon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className="font-bold text-[#1e293b] text-base truncate">Pergerakan tanah terdeteksi</h4>
                    <span className="text-xs font-bold text-[#b91c1c] bg-[#b91c1c]/10 px-2.5 py-1 rounded-md shrink-0">10m ago</span>
                  </div>
                  <p className="text-sm font-medium text-[#14532d]/70 mb-3 flex items-center gap-1.5">
                    <MapPin size={14} /> Banjarnegara, Sektor 4
                  </p>
                  <div className="flex gap-2">
                    <button className="px-4 py-1.5 rounded-full bg-[#b91c1c] text-white text-xs font-bold shadow-sm shadow-[#b91c1c]/30 hover:-translate-y-0.5 transition-all active:scale-95">
                      Acknowledge
                    </button>
                    <button className="px-4 py-1.5 rounded-full bg-white text-[#14532d] border border-[#14532d]/10 text-xs font-bold shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-95">
                      View Details
                    </button>
                  </div>
                </div>
              </div>

              {/* Activity Item 2 */}
              <div className="group p-4 hover:bg-[#F7F4EE]/50 rounded-2xl transition-colors flex items-start gap-4">
                <div className="bg-[#c2410c]/10 p-2.5 rounded-2xl text-[#c2410c] shrink-0 mt-1">
                  <Zap size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className="font-bold text-[#1e293b] text-base truncate">Sensor SNS-014 offline</h4>
                    <span className="text-xs font-medium text-[#14532d]/50 shrink-0">45m ago</span>
                  </div>
                  <p className="text-sm font-medium text-[#14532d]/70 mb-3 flex items-center gap-1.5">
                    <Radio size={14} /> Merapi Selatan, Pos B
                  </p>
                  <div className="flex gap-2">
                    <button className="px-4 py-1.5 rounded-full bg-[#F7F4EE] text-[#14532d] border border-[#14532d]/10 text-xs font-bold shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-95">
                      Dispatch Tech
                    </button>
                  </div>
                </div>
              </div>

              {/* Activity Item 3 */}
              <div className="group p-4 hover:bg-[#F7F4EE]/50 rounded-2xl transition-colors flex items-start gap-4">
                <div className="bg-[#14532d]/10 p-2.5 rounded-2xl text-[#14532d] shrink-0 mt-1">
                  <CheckCircle2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className="font-bold text-[#1e293b] text-base truncate">Laporan harian di-generate</h4>
                    <span className="text-xs font-medium text-[#14532d]/50 shrink-0">2h ago</span>
                  </div>
                  <p className="text-sm font-medium text-[#14532d]/70 flex items-center gap-1.5">
                    <FileText size={14} /> System Auto-Task
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#14532d] rounded-3xl shadow-lg shadow-[#14532d]/20 p-6 flex flex-col justify-between text-[#F7F4EE] relative overflow-hidden group">
            {/* Decorative background element */}
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors duration-700 pointer-events-none"></div>
            
            <div>
              <h3 className="text-xl font-bold mb-2">Quick Actions</h3>
              <p className="text-[#F7F4EE]/70 text-sm font-medium mb-6">Frequently used tools and reporting functions.</p>
            </div>

            <div className="space-y-3 relative z-10">
              <button className="w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all hover:-translate-y-1 group/btn active:scale-[0.98]">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-white">
                    <Download size={18} />
                  </div>
                  <span className="font-bold text-sm tracking-wide">Generate Report</span>
                </div>
                <ChevronRight size={16} className="text-white/50 group-hover/btn:translate-x-1 group-hover/btn:text-white transition-all" />
              </button>

              <button className="w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all hover:-translate-y-1 group/btn active:scale-[0.98]">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-xl text-white">
                    <Map size={18} />
                  </div>
                  <span className="font-bold text-sm tracking-wide">Open Command Map</span>
                </div>
                <ChevronRight size={16} className="text-white/50 group-hover/btn:translate-x-1 group-hover/btn:text-white transition-all" />
              </button>

              <button className="w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl p-4 flex items-center justify-between transition-all hover:-translate-y-1 group/btn active:scale-[0.98]">
                <div className="flex items-center gap-3">
                  <div className="bg-[#b91c1c]/80 p-2 rounded-xl text-white">
                    <Radio size={18} />
                  </div>
                  <span className="font-bold text-sm tracking-wide">Broadcast Alert</span>
                </div>
                <ChevronRight size={16} className="text-white/50 group-hover/btn:translate-x-1 group-hover/btn:text-white transition-all" />
              </button>
            </div>
          </div>

        </section>

      </main>
    </div>
  );
}
