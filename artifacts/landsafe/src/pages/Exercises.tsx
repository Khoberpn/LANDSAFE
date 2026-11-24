import React, { useState } from 'react';
import {
  Layers,
  PlayCircle,
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  Award,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ExerciseItem {
  id: string;
  code: string;
  title: string;
  exerciseType: 'Tabletop Exercise (TTX)' | 'Gladi Posko' | 'Gladi Lapang (Drill)';
  province: string;
  hazardScenario: string;
  dateConducted: string;
  participantsCount: number;
  participatingAgencies: string[];
  findingsCount: number;
  status: 'completed' | 'scheduled' | 'in_progress';
  summary: string;
}

const SAMPLE_EXERCISES: ExerciseItem[] = [
  {
    id: 'ex-01',
    code: 'TTX-2026-BAN-01',
    title: 'Simulasi Tabletop Kontingensi Banjir Bandang DAS Kuranji',
    exerciseType: 'Tabletop Exercise (TTX)',
    province: 'Sumatera Barat',
    hazardScenario: 'Curah hujan ekstrem 180 mm/4 jam dengan kenaikan muka air cepat di Koto Tuo',
    dateConducted: '18 November 2026',
    participantsCount: 42,
    participatingAgencies: ['BPBD Kota Padang', 'BWS Sumatera V', 'Dinas Sosial', 'Basarnas', 'PMI'],
    findingsCount: 4,
    status: 'completed',
    summary: 'Pengujian rantai komando, koordinasi diseminasi peringatan dini ke tingkat kelurahan, dan sinkronisasi rute evakuasi mandiri.',
  },
  {
    id: 'ex-02',
    code: 'DRILL-2026-LON-02',
    title: 'Gladi Posko & Uji Lapang Jalur Evakuasi Lereng Karangkobar',
    exerciseType: 'Gladi Lapang (Drill)',
    province: 'Jawa Tengah',
    hazardScenario: 'Simulasi retakan tanah aktif 10 cm/jam dengan ancaman longsor masif pemukiman',
    dateConducted: '12 Oktober 2026',
    participantsCount: 85,
    participatingAgencies: ['BPBD Banjarnegara', 'TNI Kodim', 'Polres', 'Dinas Kesehatan', 'Keltana'],
    findingsCount: 3,
    status: 'completed',
    summary: 'Waktu tempuh evakuasi warga rentan (lansia/disabilitas) mencapai titik aman rata-rata 18 menit (target < 20 menit).',
  },
  {
    id: 'ex-03',
    code: 'TTX-2026-SOP-03',
    title: 'Simulasi Koordinasi Kontingensi Ancaman Letusan Soputan',
    exerciseType: 'Tabletop Exercise (TTX)',
    province: 'Sulawesi Utara',
    hazardScenario: 'Peningkatan status vulkanik Soputan ke Level III (Siaga) disertai hembusan abu lebat',
    dateConducted: '28 Desember 2026',
    participantsCount: 35,
    participatingAgencies: ['BPBD Sulut', 'PGA Soputan', 'Dinas Perhubungan', 'Dinkes'],
    findingsCount: 0,
    status: 'scheduled',
    summary: 'Uji kesiapan rencana pengalihan jalur penerbangan dan sterilisasi radius bahaya 6.5 km.',
  },
];

export default function Exercises() {
  const [exercises] = useState<ExerciseItem[]>(SAMPLE_EXERCISES);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Simulasi & Tabletop Exercise (Exercises)
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pengujian berkala kesiapan rencana darurat, gladi posko, dan evaluasi After-Action Review (AAR) lintas sektor (PRD Section 5.4).
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {exercises.map((ex) => (
          <div key={ex.id} className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-primary/30 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {ex.code}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {ex.exerciseType} • {ex.province}
                </span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase border ${
                ex.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-blue-500/10 text-blue-600 border-blue-500/30'
              }`}>
                {ex.status === 'completed' ? 'Selesai & Evaluasi AAR' : 'Dijadwalkan'}
              </span>
            </div>

            <h3 className="font-semibold text-foreground text-sm">{ex.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{ex.summary}</p>

            <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-[11px]">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {ex.dateConducted}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {ex.participantsCount} Peserta</span>
                <span className="flex items-center gap-1"><Award className="w-3 h-3 text-primary" /> {ex.findingsCount} Temuan AAR</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {ex.participatingAgencies.map((agency, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-foreground">
                    {agency}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
