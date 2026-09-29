import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Map, 
  Radio, 
  Activity, 
  CheckCircle2, 
  Cpu, 
  Clock,
  ShieldAlert,
  MapPin,
  FileText,
  ChevronRight,
  ArrowRight,
  SignalHigh,
  SignalLow,
  WifiOff
} from 'lucide-react';

// --- DATA ---
const kpis = [
  { label: 'LOKASI DIPANTAU', value: '10', icon: MapPin, status: 'neutral' },
  { label: 'SENSOR AKTIF', value: '18/20', icon: Radio, status: 'warning' },
  { label: 'PERINGATAN AKTIF', value: '15', icon: AlertTriangle, status: 'danger' },
  { label: 'ZONA RISIKO TINGGI', value: '3', icon: ShieldAlert, status: 'danger' },
  { label: 'PERANGKAT ONLINE', value: '9/10', icon: Cpu, status: 'warning' },
  { label: 'STATUS SISTEM', value: 'OPERASIONAL', icon: CheckCircle2, status: 'good' },
];

const alerts = [
  { id: 1, type: 'danger', message: 'Pergerakan tanah terdeteksi — Banjarnegara', time: '10:42:05 WIB', sector: 'Sektor Tengah' },
  { id: 2, type: 'warning', message: 'Sensor SNS-014 offline — Merapi Selatan', time: '10:15:22 WIB', sector: 'Sektor Selatan' },
  { id: 3, type: 'info', message: 'Kalibrasi rutin selesai — Sektor Utara', time: '09:00:00 WIB', sector: 'Sektor Utara' },
  { id: 4, type: 'danger', message: 'Peningkatan kelembaban tanah ekstrem — Dieng', time: '08:45:11 WIB', sector: 'Sektor Tengah' },
];

const riskData = [
  { name: 'BAHAYA', value: 3, color: '#DC2626' },   // Red
  { name: 'SIAGA', value: 7, color: '#EA580C' },    // Orange
  { name: 'WASPADA', value: 12, color: '#EAB308' }, // Yellow
  { name: 'NORMAL', value: 45, color: '#10B981' },  // Green
];

// --- COMPONENTS ---

// 1. Buttons
const PrimaryButton = ({ children, className = '', ...props }: any) => (
  <button 
    className={`
      group relative inline-flex items-center justify-center gap-2 
      bg-[#0A0F1C] text-white px-4 py-2 text-sm font-medium
      transition-all duration-200 ease-out
      hover:bg-[#1A2333] hover:shadow-md
      active:scale-[0.98] active:bg-[#000000]
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0F1C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAF8]
      ${className}
    `}
    {...props}
  >
    {children}
  </button>
);

const GhostButton = ({ children, className = '', ...props }: any) => (
  <button 
    className={`
      group relative inline-flex items-center justify-center gap-2
      text-[#0A0F1C] px-3 py-1.5 text-sm font-medium
      transition-all duration-200 ease-out
      hover:bg-black/5 active:scale-[0.98]
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0F1C]
      ${className}
    `}
    {...props}
  >
    <span className="relative z-10 flex items-center gap-2">{children}</span>
    <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#0A0F1C] transition-all duration-300 ease-out group-hover:w-full"></span>
  </button>
);

const OutlineButton = ({ children, className = '', ...props }: any) => (
  <button 
    className={`
      group relative inline-flex items-center justify-center gap-2
      border border-[#0A0F1C]/20 text-[#0A0F1C] px-4 py-2 text-sm font-medium
      transition-all duration-200 ease-out bg-white
      hover:border-[#0A0F1C] hover:bg-black/5 active:scale-[0.98]
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0F1C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAF8]
      ${className}
    `}
    {...props}
  >
    {children}
  </button>
);

// 2. Map Placeholder
const MapPlaceholder = () => (
  <div className="relative w-full h-full bg-[#E5E7EB]/40 overflow-hidden flex items-center justify-center">
    {/* Grid background */}
    <div className="absolute inset-0" style={{ 
      backgroundImage: 'linear-gradient(#0A0F1C 1px, transparent 1px), linear-gradient(90deg, #0A0F1C 1px, transparent 1px)', 
      backgroundSize: '40px 40px',
      opacity: 0.05
    }}></div>
    
    {/* Topography lines simulation (SVG) */}
    <svg className="absolute inset-0 w-full h-full text-[#0A0F1C]/10" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
      <path d="M-100,200 Q 150,300 400,100 T 900,400" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M-100,250 Q 150,350 400,150 T 900,450" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M-100,300 Q 150,400 400,200 T 900,500" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M-100,150 Q 150,250 400,50 T 900,350" fill="none" stroke="currentColor" strokeWidth="1" />
      
      {/* Target zones */}
      <circle cx="300" cy="250" r="80" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx="550" cy="380" r="120" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
    </svg>

    {/* Nodes */}
    <div className="absolute top-[30%] left-[25%] group">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-8 h-8 bg-[#DC2626]/20 rounded-full animate-ping"></div>
        <div className="w-3 h-3 bg-[#DC2626] rounded-full border-2 border-[#FAFAF8] shadow-sm relative z-10 transition-transform group-hover:scale-150"></div>
      </div>
      <div className="absolute top-4 left-4 bg-white border border-[#0A0F1C]/10 px-2 py-1 text-[10px] font-mono shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
        <div className="font-bold text-[#DC2626]">KRITIS: BANJARNEGARA</div>
        <div className="text-[#0A0F1C]/60">PERGERAKAN 12mm/jam</div>
      </div>
    </div>

    <div className="absolute top-[60%] left-[65%] group">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-6 h-6 bg-[#EA580C]/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
        <div className="w-3 h-3 bg-[#EA580C] rounded-full border-2 border-[#FAFAF8] shadow-sm relative z-10 transition-transform group-hover:scale-150"></div>
      </div>
    </div>
    
    <div className="absolute top-[45%] left-[45%] group">
      <div className="relative flex items-center justify-center">
        <div className="w-3 h-3 bg-[#10B981] rounded-full border-2 border-[#FAFAF8] shadow-sm relative z-10 transition-transform group-hover:scale-150"></div>
      </div>
    </div>

    <div className="absolute top-[20%] left-[70%] group">
      <div className="relative flex items-center justify-center">
        <div className="w-3 h-3 bg-[#EAB308] rounded-full border-2 border-[#FAFAF8] shadow-sm relative z-10 transition-transform group-hover:scale-150"></div>
      </div>
    </div>

    {/* Map Overlay Controls */}
    <div className="absolute bottom-4 right-4 flex gap-2">
      <button className="w-8 h-8 bg-white border border-[#0A0F1C]/10 flex items-center justify-center text-[#0A0F1C] hover:bg-neutral-50 transition-colors active:scale-95">+</button>
      <button className="w-8 h-8 bg-white border border-[#0A0F1C]/10 flex items-center justify-center text-[#0A0F1C] hover:bg-neutral-50 transition-colors active:scale-95">-</button>
    </div>
  </div>
);

// 3. Simple Donut Chart SVG
const DonutChart = () => {
  const total = riskData.reduce((acc, curr) => acc + curr.value, 0);
  let currentOffset = 0;
  
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {riskData.map((slice, i) => {
          const percentage = (slice.value / total) * 100;
          const strokeDasharray = `${percentage} 100`;
          const strokeDashoffset = -currentOffset;
          currentOffset += percentage;
          
          return (
            <circle
              key={slice.name}
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out hover:stroke-[20px] cursor-pointer origin-center"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-light tabular-nums tracking-tight text-[#0A0F1C]">{total}</span>
        <span className="text-[10px] font-bold text-[#0A0F1C]/50 tracking-wider">TOTAL TITIK</span>
      </div>
    </div>
  );
};

export default function Cleanops() {
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
  const dateString = time.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0A0F1C] font-sans selection:bg-[#0A0F1C] selection:text-white pb-12">
      {/* TOP BAR */}
      <header className="sticky top-0 z-50 bg-[#FAFAF8]/90 backdrop-blur-md border-b border-[#0A0F1C]/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#DC2626] flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" strokeWidth={3} />
            </div>
            <span className="font-bold tracking-widest text-lg leading-none">LANDSAFE</span>
          </div>
          <div className="h-4 w-px bg-[#0A0F1C]/20"></div>
          <span className="text-xs font-mono text-[#0A0F1C]/60 hidden sm:inline-block">BADAN NASIONAL PENANGGULANGAN BENCANA</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-bold tracking-wider text-[#0A0F1C]/50">{mounted ? dateString.toUpperCase() : 'MEMUAT...'}</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"></div>
              <span className="font-mono text-sm font-medium tabular-nums">{mounted ? timeString : '00:00:00 WIB'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-[#0A0F1C]/10 pl-6">
            <button className="relative w-8 h-8 flex items-center justify-center text-[#0A0F1C] hover:bg-black/5 transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0F1C]">
              <AlertTriangle className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#DC2626] rounded-full ring-2 ring-[#FAFAF8]"></span>
            </button>
            <div className="w-8 h-8 bg-[#0A0F1C] text-white flex items-center justify-center text-xs font-bold font-mono">
              OP
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* KPI ROW */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px bg-[#0A0F1C]/10 border border-[#0A0F1C]/10">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div key={i} className="bg-[#FAFAF8] p-5 flex flex-col justify-between group hover:bg-white transition-colors">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-bold tracking-widest text-[#0A0F1C]/60 line-clamp-1">{kpi.label}</span>
                  <Icon className={`w-4 h-4 ${
                    kpi.status === 'danger' ? 'text-[#DC2626]' : 
                    kpi.status === 'warning' ? 'text-[#EA580C]' : 
                    kpi.status === 'good' ? 'text-[#10B981]' : 
                    'text-[#0A0F1C]/40'
                  }`} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-light tabular-nums tracking-tight group-hover:scale-[1.02] transition-transform origin-left">{kpi.value}</span>
                </div>
              </div>
            );
          })}
        </section>

        {/* MIDDLE ROW: MAP & DONUT */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAP */}
          <div className="lg:col-span-2 bg-white border border-[#0A0F1C]/10 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between border-b border-[#0A0F1C]/10 p-4">
              <div>
                <h2 className="text-sm font-bold tracking-wider">TINJAUAN GEOSPASIAL</h2>
                <p className="text-xs text-[#0A0F1C]/60 font-mono mt-0.5">SEKTOR JAWA TENGAH // {mounted ? timeString : ''}</p>
              </div>
              <GhostButton className="hidden sm:flex">
                LAYAR PENUH <Map className="w-3 h-3 ml-1" />
              </GhostButton>
            </div>
            <div className="flex-1 relative bg-[#FAFAF8]">
              <MapPlaceholder />
            </div>
            <div className="border-t border-[#0A0F1C]/10 bg-white p-3 flex items-center gap-6 text-xs font-mono overflow-x-auto whitespace-nowrap">
              <span className="text-[#0A0F1C]/50 font-bold">LEGENDA KONDISI:</span>
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-[#DC2626]"></div> BAHAYA (&gt;10mm/j)</div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-[#EA580C]"></div> SIAGA (5-10mm/j)</div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-[#EAB308]"></div> WASPADA (1-5mm/j)</div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-[#10B981]"></div> NORMAL (&lt;1mm/j)</div>
            </div>
          </div>

          {/* RISK DONUT */}
          <div className="bg-white border border-[#0A0F1C]/10 flex flex-col">
            <div className="flex items-center justify-between border-b border-[#0A0F1C]/10 p-4">
              <h2 className="text-sm font-bold tracking-wider">DISTRIBUSI RISIKO</h2>
              <button className="text-[#0A0F1C]/40 hover:text-[#0A0F1C] transition-colors"><Activity className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <DonutChart />
            </div>
            <div className="border-t border-[#0A0F1C]/10 flex flex-col">
              {riskData.map((item, i) => (
                <div key={item.name} className={`flex items-center justify-between p-3 px-4 text-xs font-mono hover:bg-black/5 transition-colors cursor-pointer ${i !== riskData.length - 1 ? 'border-b border-[#0A0F1C]/5' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2" style={{ backgroundColor: item.color }}></div>
                    <span className="font-bold">{item.name}</span>
                  </div>
                  <span className="tabular-nums font-bold text-sm">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM ROW: RECENT ACTIVITY */}
        <section className="bg-white border border-[#0A0F1C]/10 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#0A0F1C]/10 p-4 gap-4">
            <div>
              <h2 className="text-sm font-bold tracking-wider flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#DC2626] rounded-full animate-pulse"></div>
                LOG AKTIVITAS TERKINI
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <OutlineButton>
                <FileText className="w-3.5 h-3.5" />
                BUAT LAPORAN
              </OutlineButton>
              <PrimaryButton>
                AKUI SEMUA (15)
                <CheckCircle2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              </PrimaryButton>
            </div>
          </div>
          
          <div className="divide-y divide-[#0A0F1C]/5">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-[#FAFAF8] transition-colors group">
                {/* Time & Badge */}
                <div className="flex items-center gap-4 md:w-[220px] shrink-0">
                  <span className="text-xs font-mono text-[#0A0F1C]/50 tabular-nums">{alert.time}</span>
                  <span className={`
                    text-[10px] font-bold px-2 py-0.5 border
                    ${alert.type === 'danger' ? 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20' : 
                      alert.type === 'warning' ? 'bg-[#EA580C]/10 text-[#EA580C] border-[#EA580C]/20' : 
                      'bg-[#0A0F1C]/5 text-[#0A0F1C]/60 border-[#0A0F1C]/10'}
                  `}>
                    {alert.type === 'danger' ? 'KRITIS' : alert.type === 'warning' ? 'PERINGATAN' : 'INFO'}
                  </span>
                </div>

                {/* Message */}
                <div className="flex-1 flex flex-col">
                  <span className={`text-sm font-medium ${alert.type === 'danger' ? 'text-[#DC2626]' : 'text-[#0A0F1C]'}`}>
                    {alert.message}
                  </span>
                  <span className="text-xs text-[#0A0F1C]/60 mt-0.5">{alert.sector}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                  <GhostButton>LIHAT DETAIL</GhostButton>
                  {alert.type !== 'info' && (
                    <button className="bg-white border border-[#0A0F1C]/20 text-[#0A0F1C] px-3 py-1.5 text-xs font-bold hover:bg-[#0A0F1C] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0F1C]">
                      AKUI
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-2 border-t border-[#0A0F1C]/10 bg-[#FAFAF8]">
            <button className="w-full py-2 text-xs font-bold tracking-wider text-[#0A0F1C]/50 hover:text-[#0A0F1C] hover:bg-black/5 transition-all flex items-center justify-center gap-2 group">
              TAMPILKAN SEMUA LOG
              <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>
        
      </main>
    </div>
  );
}
