import React, { useState } from 'react';
import {
  ClipboardCheck,
  MapPin,
  Camera,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Plus,
  Filter,
  Search,
  FileCheck2,
  XCircle,
  HelpCircle,
  Smartphone,
  Eye,
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

export interface FieldReportItem {
  id: string;
  reportCode: string;
  hazardType: 'landslide' | 'flood' | 'earthquake' | 'wildfire';
  province: string;
  district: string;
  coordinates: [number, number];
  locationDescription: string;
  reporterName: string;
  reporterAgency: string;
  status: 'draft' | 'submitted' | 'under_verification' | 'verified' | 'needs_clarification' | 'rejected';
  submittedAt: string;
  verifiedAt?: string;
  verifierName?: string;
  verificationNotes?: string;
  damages: {
    housesDamaged: number;
    roadBlocked: boolean;
    bridgesDamaged: number;
    facilitiesAffected: string;
  };
  urgentNeeds: string[];
  evidencePhotos: { name: string; hash: string; timestamp: string }[];
  fieldNotes: string;
}

const INITIAL_REPORTS: FieldReportItem[] = [
  {
    id: 'fld-01',
    reportCode: 'FLD-2026-11-081',
    hazardType: 'landslide',
    province: 'Jawa Tengah',
    district: 'Banjarnegara',
    coordinates: [-7.2845, 109.7121],
    locationDescription: 'Jalan Desa Ambal KM 2, Karangkobar',
    reporterName: 'Suryanto (TRC)',
    reporterAgency: 'BPBD Banjarnegara',
    status: 'verified',
    submittedAt: '2026-11-23T09:40:00Z',
    verifiedAt: '2026-11-23T10:15:00Z',
    verifierName: 'Koordinator Pusdalops',
    verificationNotes: 'Dikonfirmasi melalui survei visual drone dan pengukuran teodolit darurat.',
    damages: {
      housesDamaged: 6,
      roadBlocked: true,
      bridgesDamaged: 0,
      facilitiesAffected: 'Tiang listrik PLN patah 2 unit',
    },
    urgentNeeds: ['Terpal lereng', 'Penerangan darurat', 'Makanan siap saji', 'Alat berat mini'],
    evidencePhotos: [
      { name: 'retakan_lereng_ambal.jpg', hash: 'e3b0c44298fc1c149afbf4c8996fb924', timestamp: '2026-11-23 09:35 WIB' },
      { name: 'bahu_jalan_terputus.jpg', hash: '8f4c2b9921e4a1129bcfe332194ad821', timestamp: '2026-11-23 09:38 WIB' },
    ],
    fieldNotes: 'Akses jalan penghubung Karangkobar-Wanayasa terputus total tertutup material tanah dan batu setebal 1.5 meter.',
  },
  {
    id: 'fld-02',
    reportCode: 'FLD-2026-11-082',
    hazardType: 'flood',
    province: 'Sumatera Barat',
    district: 'Kota Padang',
    coordinates: [-0.9123, 100.4182],
    locationDescription: 'Kawasan Perumahan Limau Manis RT 03/RW 04',
    reporterName: 'Rahmat Hidayat',
    reporterAgency: 'Keltana Padang',
    status: 'under_verification',
    submittedAt: '2026-11-23T12:15:00Z',
    damages: {
      housesDamaged: 45,
      roadBlocked: true,
      bridgesDamaged: 0,
      facilitiesAffected: 'Puskesmas Pembantu tergenang 60 cm',
    },
    urgentNeeds: ['Perahu karet', 'Pompa alkon', 'Air bersih', 'Obat-obatan gatal & diare'],
    evidencePhotos: [
      { name: 'banjir_kuranji_rt03.jpg', hash: 'c52b89a42ffbc92429a1b8321049ea21', timestamp: '2026-11-23 12:10 WIB' },
    ],
    fieldNotes: 'Arus cukup deras di persimpangan jalan utama. 15 lansia telah dievakuasi ke musholla terdekat.',
  },
  {
    id: 'fld-03',
    reportCode: 'FLD-2026-11-083',
    hazardType: 'landslide',
    province: 'Sulawesi Utara',
    district: 'Minahasa Selatan',
    coordinates: [1.2145, 124.7188],
    locationDescription: 'Tebing Ruas Jalan Desa Tumpaan',
    reporterName: 'Meidy Tumewu',
    reporterAgency: 'Relawan RAPI',
    status: 'submitted',
    submittedAt: '2026-11-23T14:10:00Z',
    damages: {
      housesDamaged: 0,
      roadBlocked: false,
      bridgesDamaged: 0,
      facilitiesAffected: 'Talud pengaman longsor runtuh sebagian',
    },
    urgentNeeds: ['Rambu peringatan', 'Karung pasir penahan erosi'],
    evidencePhotos: [
      { name: 'talud_tumpaan.jpg', hash: 'd91a27e491bc92a83bcf3381a95c8120', timestamp: '2026-11-23 14:05 WIB' },
    ],
    fieldNotes: 'Kendaraan roda 4 masih dapat melintas satu arah secara bergantian.',
  },
];

const STATUS_BADGES: Record<string, { label: string; chip: string }> = {
  draft: { label: 'Draft Lokal', chip: 'bg-muted text-muted-foreground border-border' },
  submitted: { label: 'Terkirim', chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  under_verification: { label: 'Proses Verifikasi', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  verified: { label: 'Terverifikasi Lapangan', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  needs_clarification: { label: 'Butuh Klarifikasi', chip: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  rejected: { label: 'Ditolak / Duplikat', chip: 'bg-destructive/10 text-destructive border-destructive/30' },
};

export default function FieldReports() {
  const [reports, setReports] = useState<FieldReportItem[]>(INITIAL_REPORTS);
  const [selectedReport, setSelectedReport] = useState<FieldReportItem | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterHazard, setFilterHazard] = useState('all');
  const [filterProvince, setFilterProvince] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formHazard, setFormHazard] = useState<'landslide' | 'flood' | 'earthquake' | 'wildfire'>('landslide');
  const [formProvince, setFormProvince] = useState('Jawa Tengah');
  const [formDistrict, setFormDistrict] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formReporter, setFormReporter] = useState('');
  const [formAgency, setFormAgency] = useState('TRC BPBD');
  const [formDamagedHouses, setFormDamagedHouses] = useState('0');
  const [formRoadBlocked, setFormRoadBlocked] = useState(false);
  const [formNeeds, setFormNeeds] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const filteredReports = reports.filter((r) => {
    if (filterHazard !== 'all' && r.hazardType !== filterHazard) return false;
    if (filterProvince !== 'all' && r.province !== filterProvince) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.reportCode.toLowerCase().includes(q) ||
        r.locationDescription.toLowerCase().includes(q) ||
        r.reporterName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreateReport = () => {
    if (!formLocation.trim() || !formReporter.trim()) return;

    const newRep: FieldReportItem = {
      id: `fld-${Date.now()}`,
      reportCode: `FLD-2026-11-${String(reports.length + 80).padStart(3, '0')}`,
      hazardType: formHazard,
      province: formProvince,
      district: formDistrict || 'Kabupaten Pilot',
      coordinates: [-7.28, 109.71],
      locationDescription: formLocation,
      reporterName: formReporter,
      reporterAgency: formAgency,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      damages: {
        housesDamaged: Number(formDamagedHouses) || 0,
        roadBlocked: formRoadBlocked,
        bridgesDamaged: 0,
        facilitiesAffected: 'Ditinjau di lapangan',
      },
      urgentNeeds: formNeeds ? formNeeds.split(',').map((s) => s.trim()) : ['Tenda darurat', 'Air bersih'],
      evidencePhotos: [
        {
          name: `dokumentasi_lapangan_${Date.now()}.jpg`,
          hash: 'a1f3c8829efb1c149afbf4c8896fb330',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        },
      ],
      fieldNotes: formNotes || 'Laporan kaji cepat awal dikirimkan dari aplikasi lapangan.',
    };

    setReports([newRep, ...reports]);
    setCreateDialogOpen(false);
    setFormLocation('');
    setFormReporter('');
    setFormDamagedHouses('0');
    setFormNeeds('');
    setFormNotes('');
  };

  const handleVerify = (id: string, decision: 'verified' | 'rejected') => {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            status: decision,
            verifiedAt: new Date().toISOString(),
            verifierName: 'Petugas Verifikator Pusdalops',
            verificationNotes: decision === 'verified' ? 'Telah ditelaah sesuai kaidah SOP verifikasi' : 'Data belum memenuhi kriteria validitas',
          };
        }
        return r;
      })
    );
    if (selectedReport?.id === id) {
      setSelectedReport(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            Kaji Cepat & Pelaporan Lapangan (Field Reporting)
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pencatatan kaji cepat multi-hazard dari petugas lapangan dengan geotagging, bukti foto terhash, dan verifikasi berlapis (PRD 5.5-B).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Kirim Kaji Cepat Baru
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-3.5 border border-primary/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Kaji Cepat</span>
          <span className="text-2xl font-bold text-foreground mt-1">{reports.length}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Tercatat di sistem</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-emerald-500/20 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Terverifikasi</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {reports.filter((r) => r.status === 'verified').length}
          </span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Label ground truth sahih</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-amber-500/20 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Menunggu Verifikasi</span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {reports.filter((r) => r.status === 'submitted' || r.status === 'under_verification').length}
          </span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Dalam antrean peninjauan</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-border shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-emerald-500" /> Mode Mobile / Offline
          </span>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">Siap Sinkronisasi</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">Penyimpanan lokal aktif</span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari kode laporan, lokasi, atau pelapor..."
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
            <option value="all">Semua Bahaya</option>
            <option value="landslide">Tanah Longsor</option>
            <option value="flood">Banjir</option>
            <option value="earthquake">Gempa Bumi</option>
          </select>

          <select
            value={filterProvince}
            onChange={(e) => setFilterProvince(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="all">Semua Provinsi</option>
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
            <option value="verified">Terverifikasi</option>
            <option value="under_verification">Proses Verifikasi</option>
            <option value="submitted">Terkirim</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm text-left">
            <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase tracking-wider font-mono">
              <tr>
                <th className="px-4 py-3 font-medium">Laporan & Bahaya</th>
                <th className="px-4 py-3 font-medium">Lokasi Geotag</th>
                <th className="px-4 py-3 font-medium">Pelapor / Instansi</th>
                <th className="px-4 py-3 font-medium">Kondisi Dampak</th>
                <th className="px-4 py-3 font-medium">Status Verifikasi</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                    Tidak ditemukan laporan kaji cepat yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredReports.map((rep) => {
                  const badge = STATUS_BADGES[rep.status] || STATUS_BADGES.submitted;

                  return (
                    <tr key={rep.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 rounded-md bg-primary/10 text-primary mt-0.5 shrink-0">
                            <ClipboardCheck className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-primary">{rep.reportCode}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(rep.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                              </span>
                            </div>
                            <div className="font-medium text-foreground text-xs sm:text-sm capitalize mt-0.5">
                              Bahaya: {rep.hazardType}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Camera className="w-3 h-3 text-muted-foreground" /> {rep.evidencePhotos.length} Bukti Foto
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-foreground line-clamp-1">{rep.locationDescription}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-muted-foreground" /> {rep.district}, {rep.province}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-foreground">{rep.reporterName}</div>
                        <div className="text-[11px] text-muted-foreground">{rep.reporterAgency}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-foreground">
                          {rep.damages.housesDamaged > 0 ? `${rep.damages.housesDamaged} Rumah Rusak` : 'Tidak ada rumah rusak'}
                        </div>
                        <div className={`text-[11px] font-semibold mt-0.5 ${rep.damages.roadBlocked ? 'text-destructive' : 'text-emerald-600'}`}>
                          {rep.damages.roadBlocked ? 'Akses Jalan Terputus' : 'Akses Jalan Normal'}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.chip}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedReport(rep)}
                          className="h-7 text-[11px]"
                        >
                          <Eye className="w-3 h-3 mr-1" /> Periksa
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
          <DialogContent className="max-w-xl bg-card">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {selectedReport.reportCode}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_BADGES[selectedReport.status]?.chip}`}>
                  {STATUS_BADGES[selectedReport.status]?.label}
                </span>
              </div>
              <DialogTitle className="text-base font-semibold mt-1">Detail Kaji Cepat Lapangan</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Pelapor: {selectedReport.reporterName} ({selectedReport.reporterAgency}) • {selectedReport.locationDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase">Koordinat Geotag</div>
                  <div className="font-mono text-xs text-foreground mt-0.5">
                    {selectedReport.coordinates[0].toFixed(4)}, {selectedReport.coordinates[1].toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase">Status Jalan</div>
                  <div className={`font-semibold text-xs mt-0.5 ${selectedReport.damages.roadBlocked ? 'text-destructive' : 'text-emerald-600'}`}>
                    {selectedReport.damages.roadBlocked ? 'Terputus Total' : 'Dapat Dilalui'}
                  </div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-foreground mb-1">Catatan Pengamatan Lapangan:</div>
                <div className="p-2.5 bg-background rounded-lg border border-border text-muted-foreground leading-relaxed">
                  {selectedReport.fieldNotes}
                </div>
              </div>

              <div>
                <div className="font-semibold text-foreground mb-1">Kebutuhan Mendesak Teridentifikasi:</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedReport.urgentNeeds.map((need, idx) => (
                    <span key={idx} className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[11px] font-medium">
                      {need}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-semibold text-foreground mb-1.5 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-primary" /> Bukti Foto & Integritas Hash:
                </div>
                <div className="space-y-1.5">
                  {selectedReport.evidencePhotos.map((photo, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg border border-border bg-background">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground text-xs truncate">{photo.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">SHA256: {photo.hash}</div>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{photo.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedReport.verificationNotes && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-300">Catatan Verifikator:</div>
                  <div className="text-muted-foreground text-xs mt-0.5">
                    {selectedReport.verificationNotes} ({selectedReport.verifierName})
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between sm:justify-between items-center border-t border-border pt-3">
              <div className="flex gap-1.5">
                {selectedReport.status !== 'verified' && (
                  <Button
                    size="sm"
                    onClick={() => handleVerify(selectedReport.id, 'verified')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Sahkan Verifikasi
                  </Button>
                )}
                {selectedReport.status !== 'rejected' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleVerify(selectedReport.id, 'rejected')}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs h-8"
                  >
                    Tolak Laporan
                  </Button>
                )}
              </div>
              <Button size="sm" variant="secondary" onClick={() => setSelectedReport(null)} className="text-xs h-8">
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Kirim Kaji Cepat Lapangan Baru</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Formulir terstruktur kaji cepat untuk petugas TRC dan relawan penanggulangan bencana.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">Jenis Bahaya</label>
                <select
                  value={formHazard}
                  onChange={(e) => setFormHazard(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="landslide">Tanah Longsor</option>
                  <option value="flood">Banjir</option>
                  <option value="earthquake">Gempa Bumi</option>
                  <option value="wildfire">Kebakaran Hutan/Lahan</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">Provinsi</label>
                <select
                  value={formProvince}
                  onChange={(e) => setFormProvince(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="Jawa Tengah">Jawa Tengah</option>
                  <option value="Sumatera Barat">Sumatera Barat</option>
                  <option value="Sulawesi Utara">Sulawesi Utara</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">Nama Pelapor</label>
                <input
                  type="text"
                  placeholder="Nama lengkap petugas"
                  value={formReporter}
                  onChange={(e) => setFormReporter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">Instansi / Organisasi</label>
                <input
                  type="text"
                  placeholder="Contoh: TRC BPBD / PMI"
                  value={formAgency}
                  onChange={(e) => setFormAgency(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">Detail Lokasi Pengamatan</label>
              <input
                type="text"
                placeholder="Contoh: Desa Ambal RT 03 RW 01, Kec. Karangkobar"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">Estimasi Rumah Rusak</label>
                <input
                  type="number"
                  value={formDamagedHouses}
                  onChange={(e) => setFormDamagedHouses(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="roadBlocked"
                  checked={formRoadBlocked}
                  onChange={(e) => setFormRoadBlocked(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="roadBlocked" className="text-xs font-semibold text-foreground cursor-pointer">
                  Akses Jalan Terputus
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">Kebutuhan Mendesak (Pisahkan koma)</label>
              <input
                type="text"
                placeholder="Contoh: Terpal, Selimut, Makanan Siap Saji, Genset"
                value={formNeeds}
                onChange={(e) => setFormNeeds(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1">Catatan Lapangan & Rekomendasi</label>
              <textarea
                rows={3}
                placeholder="Tuliskan temuan penting terkait kondisi lapangan..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(false)} className="text-xs">
              Batal
            </Button>
            <Button size="sm" onClick={handleCreateReport} className="bg-primary text-primary-foreground text-xs">
              Kirim Kaji Cepat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
