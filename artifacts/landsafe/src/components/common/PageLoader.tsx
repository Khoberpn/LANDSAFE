import React from 'react';

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full p-8 space-y-3">
      <div className="relative">
        <div className="w-10 h-10 border-3 border-slate-200 border-t-[#2563EB] rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#102A4C]" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-slate-700 tracking-wide">Memuat Sistem LANDSAFE...</p>
        <p className="text-[11px] text-slate-400">Menyiapkan modul dan data spasial</p>
      </div>
    </div>
  );
}
