import React, { useState, useEffect } from 'react';
import { 
  Activity, MapPin, Radio, AlertTriangle, Cpu, 
  Clock, Map as MapIcon, FileText, CheckCircle, Navigation2, ChevronRight, AlertCircle, Bell,
  RefreshCw, Power
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const riskData = [
  { name: 'Bahaya', value: 3, color: '#ef4444' }, // red-500
  { name: 'Siaga', value: 7, color: '#f97316' },  // orange-500
  { name: 'Waspada', value: 12, color: '#fde047' }, // yellow-300
  { name: 'Normal', value: 45, color: '#2dd4bf' }  // teal-400
];

const activities = [
  {
    id: 1,
    title: "Peringatan Dini",
    desc: "Pergerakan tanah terdeteksi melebihi ambang batas — Banjarnegara.",
    time: "10:24 WIB",
    severity: "high",
    icon: AlertTriangle
  },
  {
    id: 2,
    title: "Koneksi Terputus",
    desc: "Sensor SNS-014 offline — Merapi Selatan.",
    time: "09:12 WIB",
    severity: "medium",
    icon: Radio
  },
  {
    id: 3,
    title: "Pembaruan Status",
    desc: "Sektor C-1 kembali ke status Normal setelah inspeksi lapangan.",
    time: "08:45 WIB",
    severity: "low",
    icon: CheckCircle
  },
  {
    id: 4,
    title: "Sistem Log",
    desc: "Sinkronisasi data dengan server BNPB Pusat berhasil.",
    time: "06:00 WIB",
    severity: "low",
    icon: RefreshCw
  }
];

interface BrutalCardProps {
  children: React.ReactNode;
  className?: string;
}

const BrutalCard = ({ children, className = "" }: BrutalCardProps) => (
  <div className={`bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] ${className}`}>
    {children}
  </div>
);

interface BrutalButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'teal' | 'small';
  icon?: React.ElementType;
  onClick?: () => void;
}

const BrutalButton = ({ children, className = "", variant = 'primary', icon: Icon, onClick }: BrutalButtonProps) => {
  const baseClasses = "group inline-flex items-center justify-center gap-2 font-bold px-4 py-2 border-2 border-black transition-all duration-150 rounded-none focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2";
  
  const variants: Record<string, string> = {
    primary: "bg-yellow-300 hover:bg-yellow-400 text-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-y-1 active:translate-x-1 active:shadow-none",
    secondary: "bg-white hover:bg-slate-100 text-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-y-1 active:translate-x-1 active:shadow-none",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-y-1 active:translate-x-1 active:shadow-none",
    teal: "bg-teal-400 hover:bg-teal-500 text-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-y-1 active:translate-x-1 active:shadow-none",
    small: "bg-white hover:bg-slate-100 text-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-y-px active:translate-x-px active:shadow-none px-2 py-1 text-xs"
  };

  return (
    <button className={`${baseClasses} ${variants[variant]} ${className}`} onClick={onClick}>
      {Icon && <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />}
      {children}
    </button>
  );
};

export default function Tactile() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });

  const kpis = [
    { label: "Lokasi Terpantau", value: "10", icon: MapPin, color: "bg-teal-400" },
    { label: "Sensor Aktif", value: "18/20", icon: Radio, color: "bg-yellow-300" },
    { label: "Peringatan Aktif", value: "15", icon: Bell, color: "bg-red-500", text: "text-white" },
    { label: "Zona Risiko Tinggi", value: "3", icon: AlertTriangle, color: "bg-orange-500" },
    { label: "Perangkat Online", value: "9/10", icon: Cpu, color: "bg-blue-400" },
    { label: "Status Sistem", value: "Operasional", icon: Activity, color: "bg-green-400" },
  ];

  return (
    <div className="min-h-screen bg-[#f0f4f8] text-black font-sans selection:bg-yellow-300 selection:text-black p-4 md:p-6 lg:p-8 flex flex-col gap-6" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Bar */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4 relative z-20">
        <div className="flex items-center gap-4">
          <div className="bg-black text-yellow-300 w-12 h-12 flex items-center justify-center font-black text-2xl border-2 border-black rotate-[-2deg] hover:rotate-0 transition-transform">
            LS
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">LANDSAFE</h1>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">Badan Nasional Penanggulangan Bencana</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-yellow-300 border-2 border-black px-3 py-1.5 font-mono font-bold shadow-[2px_2px_0px_0px_#000]">
             <Clock className="w-4 h-4 animate-pulse" />
             <span>{timeString} WIB</span>
           </div>
           <BrutalButton variant="secondary" className="px-3 py-1.5" icon={Power}>
             <span className="hidden sm:inline">Logout</span>
           </BrutalButton>
        </div>
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
        {kpis.map((kpi, index) => (
          <BrutalCard key={index} className="p-4 flex flex-col gap-3 hover:-translate-y-1 transition-transform group">
            <div className={`w-10 h-10 ${kpi.color} border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <kpi.icon className={`w-5 h-5 ${kpi.text || 'text-black'}`} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-500 tracking-tight">{kpi.label}</p>
              <h3 className="text-2xl font-black tracking-tight">{kpi.value}</h3>
            </div>
          </BrutalCard>
        ))}
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Panel */}
        <BrutalCard className="lg:col-span-2 p-0 flex flex-col relative overflow-hidden group/map">
          <div className="border-b-2 border-black p-4 bg-white flex justify-between items-center z-10 relative">
            <h2 className="font-black text-lg uppercase tracking-tight flex items-center gap-2">
              <MapIcon className="w-5 h-5" /> Tinjauan Geospasial
            </h2>
            <BrutalButton variant="small"><Navigation2 className="w-3 h-3 mr-1"/> Buka Peta Penuh</BrutalButton>
          </div>
          <div className="bg-[#e2e8f0] flex-1 relative min-h-[350px] p-4 flex items-center justify-center overflow-hidden">
             {/* Map Placeholder Pattern */}
             <div className="absolute inset-0 opacity-40 transition-transform duration-1000 group-hover/map:scale-105" 
                  style={{ 
                    backgroundImage: 'radial-gradient(#94a3b8 2px, transparent 2px)', 
                    backgroundSize: '24px 24px' 
                  }}>
             </div>
             
             {/* Simulated Map Elements */}
             <div className="absolute top-1/4 left-1/4 w-32 h-32 border-4 border-dashed border-gray-400 rounded-full opacity-30 animate-spin-slow"></div>
             
             {/* Sensor Dots */}
             <div className="absolute top-1/4 left-1/4 group/dot cursor-pointer">
               <div className="w-5 h-5 bg-red-500 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_#000] relative z-10 animate-pulse"></div>
               <div className="absolute w-12 h-12 bg-red-500/20 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping"></div>
               <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white border-2 border-black p-2 text-xs font-bold shadow-[2px_2px_0px_0px_#000] opacity-0 group-hover/dot:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                 Banjarnegara (Bahaya)
               </div>
             </div>

             <div className="absolute top-[35%] left-[55%] group/dot cursor-pointer">
               <div className="w-4 h-4 bg-yellow-300 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_#000] relative z-10 hover:scale-125 transition-transform"></div>
               <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white border-2 border-black p-2 text-xs font-bold shadow-[2px_2px_0px_0px_#000] opacity-0 group-hover/dot:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                 Wonosobo (Waspada)
               </div>
             </div>

             <div className="absolute bottom-[20%] right-[30%] group/dot cursor-pointer">
               <div className="w-4 h-4 bg-teal-400 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_#000] relative z-10 hover:scale-125 transition-transform"></div>
               <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white border-2 border-black p-2 text-xs font-bold shadow-[2px_2px_0px_0px_#000] opacity-0 group-hover/dot:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                 Magelang (Normal)
               </div>
             </div>
             
             <div className="z-10 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-3 max-w-sm absolute bottom-4 left-4 hover:-translate-y-1 transition-transform">
               <h4 className="font-black text-sm mb-1 flex items-center gap-2"><MapPin className="w-4 h-4"/> Sektor Jawa Tengah</h4>
               <p className="text-xs font-medium text-gray-700">3 zona kritis memerlukan pemantauan intensif dalam 24 jam ke depan.</p>
             </div>
          </div>
        </BrutalCard>
        
        {/* Donut Chart Panel */}
        <BrutalCard className="p-0 flex flex-col">
          <div className="border-b-2 border-black p-4 bg-yellow-300 relative z-10">
            <h2 className="font-black text-lg uppercase tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5" /> Distribusi Risiko
            </h2>
          </div>
          <div className="p-6 flex-1 flex flex-col items-center justify-center bg-white relative">
            <div className="absolute top-4 right-4 bg-slate-100 border-2 border-black px-2 py-1 text-xs font-bold font-mono">
              TOTAL: 67
            </div>
            <div className="h-48 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="#000"
                    strokeWidth={2}
                  >
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: 0, 
                      border: '2px solid black', 
                      boxShadow: '4px 4px 0px 0px black', 
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      fontSize: '12px'
                    }}
                    itemStyle={{ color: 'black' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 w-full mt-6">
              {riskData.map(risk => (
                <div key={risk.name} className="flex items-center gap-3 p-2 hover:bg-slate-50 transition-colors border-2 border-transparent hover:border-black cursor-pointer group rounded-sm">
                  <div className="w-4 h-4 border-2 border-black shadow-[2px_2px_0px_0px_#000] shrink-0 group-hover:scale-110 transition-transform" style={{ backgroundColor: risk.color }}></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase text-gray-500 leading-tight">{risk.name}</span>
                    <span className="text-sm font-black leading-tight">{risk.value} Lokasi</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </BrutalCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <BrutalCard className="lg:col-span-2 p-0 flex flex-col h-80">
          <div className="border-b-2 border-black p-4 bg-teal-400 flex justify-between items-center z-10 sticky top-0">
            <h2 className="font-black text-lg uppercase tracking-tight flex items-center gap-2">
              <RefreshCw className="w-5 h-5" /> Aktivitas Terkini
            </h2>
            <div className="bg-white border-2 border-black px-2 py-1 text-xs font-black tracking-widest shadow-[2px_2px_0px_0px_#000] flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              LIVE
            </div>
          </div>
          <div className="p-0 overflow-y-auto flex-1 bg-white flex flex-col">
            {activities.map((activity, i) => (
              <div key={activity.id} className={`p-4 border-b-2 border-black flex gap-4 items-start ${i === 0 ? 'bg-red-50' : 'bg-white'} hover:bg-slate-100 transition-colors group`}>
                <div className={`p-2 border-2 border-black shadow-[2px_2px_0px_0px_#000] shrink-0 group-hover:rotate-12 transition-transform ${
                  activity.severity === 'high' ? 'bg-red-500 text-white' : 
                  activity.severity === 'medium' ? 'bg-orange-500 text-black' : 
                  'bg-teal-400 text-black'
                }`}>
                   <activity.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1 gap-1">
                    <h4 className="font-black text-sm uppercase truncate">{activity.title}</h4>
                    <span className="text-xs font-mono font-bold bg-slate-200 px-1.5 py-0.5 border border-black inline-block w-max">{activity.time}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 line-clamp-2">{activity.desc}</p>
                </div>
                <BrutalButton variant="small" className="shrink-0 hidden sm:flex">
                  Tinjau
                </BrutalButton>
              </div>
            ))}
          </div>
        </BrutalCard>

        {/* Quick Actions */}
        <BrutalCard className="p-0 flex flex-col">
          <div className="border-b-2 border-black p-4 bg-red-500 relative z-10">
            <h2 className="font-black text-lg uppercase tracking-tight text-white flex items-center gap-2 drop-shadow-[1px_1px_0_rgba(0,0,0,1)]">
              <Activity className="w-5 h-5" /> Tindakan Cepat
            </h2>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-4 justify-center bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
            <BrutalButton variant="danger" icon={AlertCircle} className="w-full justify-between px-6 py-4 text-left text-base sm:text-lg">
              <span>Konfirmasi Siaga</span>
              <ChevronRight className="w-5 h-5" />
            </BrutalButton>
            <BrutalButton variant="primary" icon={MapIcon} className="w-full justify-between px-6 py-4 text-left text-base sm:text-lg">
              <span>Lihat Peta Risiko</span>
              <ChevronRight className="w-5 h-5" />
            </BrutalButton>
            <BrutalButton variant="secondary" icon={FileText} className="w-full justify-between px-6 py-4 text-left text-base sm:text-lg">
              <span>Buat Laporan BNPB</span>
              <ChevronRight className="w-5 h-5" />
            </BrutalButton>
          </div>
        </BrutalCard>
      </div>
    </div>
  );
}
