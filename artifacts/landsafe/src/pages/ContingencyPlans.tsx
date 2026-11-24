import React, { useState } from 'react';
import {
  FileText,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  Plus,
  Search,
  BookOpen,
  Calendar,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ContingencyPlanItem {
  id: string;
  code: string;
  title: string;
  hazardType: string;
  province: string;
  district: string;
  version: string;
  status: 'active' | 'draft' | 'under_revision';
  effectiveDate: string;
  activationCriteria: string;
  leadAgency: string;
  scenariosCount: number;
  description: string;
}

const SAMPLE_PLANS: ContingencyPlanItem[] = [
  {
    id: 'renkon-01',
    code: 'RENKON-2026-BAN-01',
    title: 'Rencana Kontingensi Banjir DAS Batang Kuranji',
    hazardType: 'Banjir Luapan Sungai',
    province: 'Sumatera Barat',
    district: 'Kota Padang',
    version: 'v2.1',
    status: 'active',
    effectiveDate: '1 Oktober 2026 - 30 September 2027',
    activationCriteria: 'TMA Bendung Koto Tuo > 200 cm (Level Awas) atau curah hujan hulu > 150 mm/6 jam.',
    leadAgency: 'BPBD Kota Padang & Balai Wilayah Sungai (BWS) Sumatera V',
    scenariosCount: 3,
    description: 'Pedoman mobilisasi 14 kelurahan terdampak di sepanjang bantaran DAS Kuranji meliputi evakuasi, logistik darurat, dan manajemen shelter.',
  },
  {
    id: 'renkon-02',
    code: 'RENKON-2026-LON-02',
    title: 'Rencana Kontingensi Gerakan Tanah Lereng Perbukitan Karangkobar',
    hazardType: 'Tanah Longsor',
    province: 'Jawa Tengah',
    district: 'Banjarnegara',
    version: 'v3.0',
    status: 'active',
    effectiveDate: '15 September 2026 - 14 September 2027',
    activationCriteria: 'Sensor ekstensometer > 5 mm/jam atau curah hujan kumulatif 3 hari > 250 mm.',
    leadAgency: 'BPBD Kabupaten Banjarnegara & Dinas ESDM Prov. Jateng',
    scenariosCount: 2,
    description: 'Protokol penanganan cepat pengosongan zona merah lereng, pengalihan jalur jalan kabupaten, dan pembagian peran posko komando.',
  },
  {
    id: 'renkon-03',
    code: 'RENKON-2026-VUL-03',
    title: 'Rencana Kontingensi Erupsi & Ancaman Bahaya Gunung Soputan',
    hazardType: 'Aktivitas Vulkanik',
    province: 'Sulawesi Utara',
    district: 'Minahasa Tenggara & Selatan',
    version: 'v1.4',
    status: 'under_revision',
    effectiveDate: '1 Januari 2026 - 31 Desember 2026',
    activationCriteria: 'Kenaikan status PVMBG ke Level III (Siaga) dengan potensi awan panas guguran.',
    leadAgency: 'BPBD Provinsi Sulawesi Utara & PVMBG',
    scenariosCount: 4,
    description: 'Pengaturan jalur evakuasi warga lereng timur dan barat menuju titik kumpul zona aman di luar radius 6.5 km.',
  },
];

export default function ContingencyPlans() {
  const [plans] = useState<ContingencyPlanItem[]>(SAMPLE_PLANS);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = plans.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.district.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Rencana Kontingensi (Contingency Plans)
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dokumen kesiapsiagaan operasional menghadapi skenario kedaruratan spesifik per jenis bahaya dan otoritas (PRD Section 5.4).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map((plan) => (
          <div key={plan.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-primary/30 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {plan.code}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold uppercase">
                  {plan.version} • {plan.status}
                </span>
              </div>
              <h3 className="font-semibold text-foreground text-sm leading-snug">{plan.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>

              <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Wilayah:</span>
                  <span className="font-medium text-foreground">{plan.district}, {plan.province}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Instansi Pembina:</span>
                  <span className="font-medium text-foreground truncate max-w-[160px]">{plan.leadAgency}</span>
                </div>
                <div className="bg-secondary/40 p-2 rounded-lg mt-2">
                  <span className="text-[10px] font-semibold text-foreground block">Kriteria Aktivasi Otoritas:</span>
                  <span className="text-muted-foreground text-[10px]">{plan.activationCriteria}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Berlaku: {plan.effectiveDate}
              </span>
              <Button size="sm" variant="secondary" className="h-7 text-xs">
                Buka Dokumen
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
