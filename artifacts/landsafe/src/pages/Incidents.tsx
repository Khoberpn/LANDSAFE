import React, { useState } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Filter,
  Plus,
  Search,
  UserCheck,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface IncidentRecord {
  id: string;
  code: string;
  title: string;
  hazardType: 'flood' | 'landslide' | 'earthquake' | 'wildfire' | 'extreme_weather';
  province: string;
  district: string;
  locationDetails: string;
  coordinates: [number, number];
  status: 'draft' | 'unverified' | 'under_review' | 'verified' | 'active' | 'monitoring' | 'closed';
  severity: 'low' | 'moderate' | 'high' | 'critical';
  sourceClass: 'official_alert' | 'field_report' | 'sensor_telemetry' | 'citizen_report';
  reportedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  commander?: string;
  affectedPeople: number;
  evacuatedPeople: number;
  openTasksCount: number;
  description: string;
  commandLog: { time: string; author: string; note: string }[];
}

const INITIAL_INCIDENTS: IncidentRecord[] = [
  {
    id: 'inc-01',
    code: 'INC-2026-11-001',
    title: 'Gerakan Tanah dan Retakan Lereng Karangkobar',
    hazardType: 'landslide',
    province: 'Jawa Tengah',
    district: 'Banjarnegara',
    locationDetails: 'Desa Ambal, Kec. Karangkobar',
    coordinates: [-7.2842, 109.7124],
    status: 'active',
    severity: 'critical',
    sourceClass: 'official_alert',
    reportedAt: '2026-11-23T08:30:00Z',
    verifiedAt: '2026-11-23T09:15:00Z',
    verifiedBy: 'Budi Santoso (BPBD Banjarnegara)',
    commander: 'Mayor Kav. H. Sudirman (Satgas Tanggap Darurat)',
    affectedPeople: 450,
    evacuatedPeople: 320,
    openTasksCount: 3,
    description: 'Pergerakan tanah mahkota lereng sepanjang 120 meter dengan amblesan 40 cm pasca hujan intensitas tinggi >90mm/hari. Mengancam 85 KK di hilir lereng.',
    commandLog: [
      { time: '09:15 WIB', author: 'BPBD Banjarnegara', note: 'Verifikasi visual lapangan mengonfirmasi retakan aktif. Status dinaikkan ke TANGGAP DARURAT.' },
      { time: '10:00 WIB', author: 'Satgas Ops', note: 'Evakuasi mandiri warga sektor B dialihkan ke Balai Desa Ambal.' },
      { time: '11:30 WIB', author: 'TRC BPBD', note: 'Pemasangan rambu penutupan jalur lingkar utara Karangkobar.' },
    ],
  },
  {
    id: 'inc-02',
    code: 'INC-2026-11-002',
    title: 'Banjir Luapan Sungai Batang Kuranji',
    hazardType: 'flood',
    province: 'Sumatera Barat',
    district: 'Kota Padang',
    locationDetails: 'Kel. Limau Manis & Kuranji',
    coordinates: [-0.9123, 100.4182],
    status: 'verified',
    severity: 'high',
    sourceClass: 'field_report',
    reportedAt: '2026-11-23T11:20:00Z',
    verifiedAt: '2026-11-23T12:00:00Z',
    verifiedBy: 'Ahmad Rizal (PUSDALOPS PB Padang)',
    commander: 'Drs. Hendri M. (Kalaksa BPBD Kota Padang)',
    affectedPeople: 1200,
    evacuatedPeople: 410,
    openTasksCount: 4,
    description: 'Tinggi muka air mencapai 120 cm akibat curah hujan ekstrem di hulu Bukit Barisan. Jalur utama tergenang.',
    commandLog: [
      { time: '12:00 WIB', author: 'PUSDALOPS', note: 'Konfirmasi tinggi air TMA bendung Koto Tuo status SIAGA 1.' },
      { time: '12:45 WIB', author: 'Basarnas Padang', note: '2 perahu LCR diterjunkan untuk evakuasi balita dan lansia di Limau Manis.' },
    ],
  },
  {
    id: 'inc-03',
    code: 'INC-2026-11-003',
    title: 'Laporan Amblesan Bahu Jalan Trans Sulawesi',
    hazardType: 'landslide',
    province: 'Sulawesi Utara',
    district: 'Minahasa Selatan',
    locationDetails: 'Ruas Kawangkoan - Tumpaan KM 54',
    coordinates: [1.2145, 124.7188],
    status: 'under_review',
    severity: 'moderate',
    sourceClass: 'citizen_report',
    reportedAt: '2026-11-23T13:45:00Z',
    affectedPeople: 80,
    evacuatedPeople: 0,
    openTasksCount: 2,
    description: 'Laporan masyarakat terkait retakan bahu jalan sedalam 25 cm sepanjang 15 meter setelah hujan deras.',
    commandLog: [
      { time: '14:00 WIB', author: 'Pusdalops Sulut', note: 'Menugaskan Tim Reaksi Cepat BPBD Minsel untuk verifikasi lapangan teknis.' },
    ],
  },
  {
    id: 'inc-04',
    code: 'INC-2026-11-004',
    title: 'Anomali Tekanan Gas & Hembusan Abu Kawah Soputan',
    hazardType: 'extreme_weather',
    province: 'Sulawesi Utara',
    district: 'Minahasa Tenggara',
    locationDetails: 'Radius 4 km Kawah Gunung Soputan',
    coordinates: [1.1124, 124.7371],
    status: 'monitoring',
    severity: 'moderate',
    sourceClass: 'official_alert',
    reportedAt: '2026-11-22T16:00:00Z',
    verifiedAt: '2026-11-22T17:00:00Z',
    verifiedBy: 'PGA Soputan (PVMBG)',
    commander: 'BPBD Sulut',
    affectedPeople: 0,
    evacuatedPeople: 0,
    openTasksCount: 1,
    description: 'Berdasarkan laporan PVMBG MAGMA, terekam 18 gempa hembusan dan peningkatan kegempaan vulkanik dangkal. Status Level II (Waspada).',
    commandLog: [
      { time: '17:00 WIB', author: 'PVMBG', note: 'Rekomendasi sterilisasi radius 1.5 km dari kawah aktif.' },
    ],
  },
];

const STATUS_CONFIG: Record<string, { label: string; chip: string }> = {
  draft: { label: 'Draft', chip: 'bg-muted text-muted-foreground border-border' },
  unverified: { label: 'Belum Terverifikasi', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  under_review: { label: 'Dalam Peninjauan', chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  verified: { label: 'Terverifikasi', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  active: { label: 'Operasi Aktif', chip: 'bg-destructive/15 text-destructive border-destructive/40 font-bold' },
  monitoring: { label: 'Pemantauan', chip: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  closed: { label: 'Ditutup', chip: 'bg-muted text-muted-foreground border-border' },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: 'Kritis (Awas)', color: 'text-destructive font-bold' },
  high: { label: 'Tinggi (Siaga)', color: 'text-[#c2410c] font-semibold' },
  moderate: { label: 'Sedang (Waspada)', color: 'text-[#ca8a04]' },
  low: { label: 'Rendah (Aman)', color: 'text-[#14532d]' },
};

export default function Incidents() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>(INITIAL_INCIDENTS);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [filterHazard, setFilterHazard] = useState<string>('all');
  const [filterProvince, setFilterProvince] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newHazard, setNewHazard] = useState<'flood' | 'landslide' | 'earthquake' | 'wildfire' | 'extreme_weather'>('landslide');
  const [newProvince, setNewProvince] = useState('Jawa Tengah');
  const [newDistrict, setNewDistrict] = useState('');
  const [newLocationDetails, setNewLocationDetails] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const filteredIncidents = incidents.filter((inc) => {
    if (filterHazard !== 'all' && inc.hazardType !== filterHazard) return false;
    if (filterProvince !== 'all' && inc.province !== filterProvince) return false;
    if (filterStatus !== 'all' && inc.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inc.title.toLowerCase().includes(q) ||
        inc.code.toLowerCase().includes(q) ||
        inc.locationDetails.toLowerCase().includes(q) ||
        inc.district.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreateIncident = () => {
    if (!newTitle.trim()) return;
    const newInc: IncidentRecord = {
      id: `inc-${Date.now()}`,
      code: `INC-2026-11-${String(incidents.length + 1).padStart(3, '0')}`,
      title: newTitle,
      hazardType: newHazard,
      province: newProvince,
      district: newDistrict || 'Kabupaten',
      locationDetails: newLocationDetails || 'Lokasi teridentifikasi',
      coordinates: [-7.2, 110.0],
      status: 'unverified',
      severity: 'moderate',
      sourceClass: 'field_report',
      reportedAt: new Date().toISOString(),
      affectedPeople: 0,
      evacuatedPeople: 0,
      openTasksCount: 1,
      description: newDescription,
      commandLog: [
        {
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
          author: 'Petugas Operator (LANDSAFE)',
          note: 'Registrasi insiden baru dari laporan. Menunggu verifikasi berwenang.',
        },
      ],
    };

    setIncidents([newInc, ...incidents]);
    setCreateDialogOpen(false);
    setNewTitle('');
    setNewDistrict('');
    setNewLocationDetails('');
    setNewDescription('');
  };

  const handleVerifyIncident = (id: string) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === id) {
          const updated: IncidentRecord = {
            ...inc,
            status: 'verified',
            verifiedAt: new Date().toISOString(),
            verifiedBy: 'Operator BPBD Terotorisasi',
            commandLog: [
              ...inc.commandLog,
              {
                time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
                author: 'Operator BPBD Terotorisasi',
                note: 'Insiden telah diverifikasi dan siap untuk pengerahan komando operasi.',
              },
            ],
          };
          if (selectedIncident?.id === id) {
            setSelectedIncident(updated);
          }
          return updated;
        }
        return inc;
      })
    );
  };

  const activeCount = incidents.filter((i) => i.status === 'active').length;
  const needVerificationCount = incidents.filter((i) => i.status === 'unverified' || i.status === 'under_review').length;
  const verifiedCount = incidents.filter((i) => i.status === 'verified').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header / PRD Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-primary" />
            Manajemen Insiden & Operasi
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Alur verifikasi dan koordinasi operasional tanggap darurat sesuai PRD LANDSAFE Section 5.5-A.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Registrasi Insiden Baru
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card rounded-xl p-3.5 border border-primary/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Insiden Tercatat</span>
          <span className="text-2xl font-bold text-foreground mt-1">{incidents.length}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Seluruh wilayah pilot</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-destructive/20 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-destructive">Operasi Aktif</span>
          <span className="text-2xl font-bold text-destructive mt-1">{activeCount}</span>
          <span className="text-[11px] text-destructive/80 mt-0.5">Pengerahan tim darurat</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-amber-500/20 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Butuh Verifikasi</span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{needVerificationCount}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Menunggu konfirmasi lapangan</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-emerald-500/20 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Terverifikasi Siaga</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{verifiedCount}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Rencana tindak lanjut siap</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari kode, nama insiden, atau lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

          <select
            value={filterHazard}
            onChange={(e) => setFilterHazard(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="all">Semua Jenis Bahaya</option>
            <option value="landslide">Tanah Longsor</option>
            <option value="flood">Banjir</option>
            <option value="earthquake">Gempa Bumi</option>
            <option value="extreme_weather">Cuaca Ekstrim</option>
          </select>

          <select
            value={filterProvince}
            onChange={(e) => setFilterProvince(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="all">Semua Wilayah Pilot</option>
            <option value="Jawa Tengah">Jawa Tengah</option>
            <option value="Sumatera Barat">Sumatera Barat</option>
            <option value="Sulawesi Utara">Sulawesi Utara</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="all">Semua Status</option>
            <option value="active">Operasi Aktif</option>
            <option value="verified">Terverifikasi</option>
            <option value="under_review">Dalam Peninjauan</option>
            <option value="unverified">Belum Terverifikasi</option>
            <option value="monitoring">Pemantauan</option>
          </select>
        </div>
      </div>

      {/* Incident Table / Registry */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm text-left">
            <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase tracking-wider font-mono">
              <tr>
                <th className="px-4 py-3 font-medium">Kode & Insiden</th>
                <th className="px-4 py-3 font-medium">Wilayah</th>
                <th className="px-4 py-3 font-medium">Tingkat Bahaya</th>
                <th className="px-4 py-3 font-medium">Status Operasi</th>
                <th className="px-4 py-3 font-medium">Terdampak / Evakuasi</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                    Tidak ditemukan catatan insiden yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => {
                  const statusMeta = STATUS_CONFIG[inc.status] || STATUS_CONFIG.unverified;
                  const severityMeta = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.moderate;

                  return (
                    <tr key={inc.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 rounded-md bg-primary/10 text-primary mt-0.5 shrink-0">
                            <ShieldAlert className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-primary">{inc.code}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(inc.reportedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                            <div className="font-medium text-foreground text-xs sm:text-sm line-clamp-1">{inc.title}</div>
                            <div className="text-[11px] text-muted-foreground capitalize">
                              Bahaya: {inc.hazardType} • Sumber: {inc.sourceClass.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-foreground">{inc.district}</div>
                        <div className="text-[11px] text-muted-foreground">{inc.province}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`text-xs ${severityMeta.color}`}>{severityMeta.label}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${statusMeta.chip}`}>
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-foreground">{inc.affectedPeople.toLocaleString('id-ID')} Jiwa</div>
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {inc.evacuatedPeople.toLocaleString('id-ID')} Dievakuasi
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inc.status === 'unverified' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVerifyIncident(inc.id)}
                              className="h-7 text-[11px] text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                              <UserCheck className="w-3 h-3 mr-1" /> Verifikasi
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedIncident(inc)}
                            className="h-7 text-[11px]"
                          >
                            <Eye className="w-3 h-3 mr-1" /> Detail
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incident Detail Dialog */}
      {selectedIncident && (
        <Dialog open={!!selectedIncident} onOpenChange={(open) => !open && setSelectedIncident(null)}>
          <DialogContent className="max-w-2xl bg-card">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {selectedIncident.code}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_CONFIG[selectedIncident.status]?.chip}`}>
                  {STATUS_CONFIG[selectedIncident.status]?.label}
                </span>
              </div>
              <DialogTitle className="text-base sm:text-lg mt-1">{selectedIncident.title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {selectedIncident.locationDetails}, {selectedIncident.district}, {selectedIncident.province}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                <div className="font-semibold text-foreground mb-1">Deskripsi Kejadian & Dampak:</div>
                <p className="text-muted-foreground leading-relaxed">{selectedIncident.description}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-2.5 rounded-lg border border-border bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Terdampak</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">{selectedIncident.affectedPeople} Jiwa</div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-background">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Pengungsi</div>
                  <div className="text-sm font-bold text-emerald-600 mt-0.5">{selectedIncident.evacuatedPeople} Jiwa</div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-background col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Komandan Operasi</div>
                  <div className="text-xs font-medium text-foreground mt-0.5 truncate">{selectedIncident.commander || 'Belum ditunjuk'}</div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Riwayat Log Komando & Koordinasi:
                </div>
                <div className="space-y-2 border-l-2 border-primary/20 pl-3 ml-1">
                  {selectedIncident.commandLog.map((log, idx) => (
                    <div key={idx} className="relative">
                      <div className="text-[10px] font-bold text-primary">{log.time} — {log.author}</div>
                      <div className="text-muted-foreground text-xs mt-0.5">{log.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between items-center border-t border-border pt-3">
              <div className="text-[11px] text-muted-foreground">
                Verifikator: {selectedIncident.verifiedBy || 'Menunggu verifikasi'}
              </div>
              <div className="flex gap-2">
                {selectedIncident.status === 'unverified' && (
                  <Button
                    size="sm"
                    onClick={() => handleVerifyIncident(selectedIncident.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    Sahkan Verifikasi
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setSelectedIncident(null)} className="text-xs">
                  Tutup
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Incident Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Registrasi Insiden Baru</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Catat laporan kejadian baru ke dalam sistem untuk ditindaklanjuti dan diverifikasi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">Judul Insiden</label>
              <input
                type="text"
                placeholder="Contoh: Tanah Longsor Pemukiman Lereng Telomoyo"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">Jenis Bahaya</label>
                <select
                  value={newHazard}
                  onChange={(e) => setNewHazard(e.target.value as any)}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="landslide">Tanah Longsor</option>
                  <option value="flood">Banjir</option>
                  <option value="earthquake">Gempa Bumi</option>
                  <option value="wildfire">Kebakaran Lahan</option>
                  <option value="extreme_weather">Cuaca Ekstrim</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">Provinsi Pilot</label>
                <select
                  value={newProvince}
                  onChange={(e) => setNewProvince(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="Jawa Tengah">Jawa Tengah</option>
                  <option value="Sumatera Barat">Sumatera Barat</option>
                  <option value="Sulawesi Utara">Sulawesi Utara</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">Kabupaten / Kota</label>
                <input
                  type="text"
                  placeholder="Contoh: Banjarnegara"
                  value={newDistrict}
                  onChange={(e) => setNewDistrict(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">Detail Lokasi</label>
                <input
                  type="text"
                  placeholder="Contoh: Desa Ambal RT 02"
                  value={newLocationDetails}
                  onChange={(e) => setNewLocationDetails(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">Deskripsi Ringkas Kejadian</label>
              <textarea
                rows={3}
                placeholder="Jelaskan kondisi awal, dampak yang diketahui, dan kebutuhan respons..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(false)} className="text-xs">
              Batal
            </Button>
            <Button size="sm" onClick={handleCreateIncident} className="bg-primary text-primary-foreground text-xs">
              Simpan Insiden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
