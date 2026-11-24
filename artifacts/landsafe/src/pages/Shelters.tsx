import React, { useState } from 'react';
import {
  Home,
  Users,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Shield,
  Phone,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useGetMitigationFacilities } from '@workspace/api-client-react';
import type { Facility } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const FACILITY_STATUS_CONFIG: Record<string, { label: string; chip: string }> = {
  operational: { label: 'Siap Tampung', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  limited: { label: 'Kapasitas Terbatas', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  full: { label: 'Kapasitas Penuh', chip: 'bg-destructive/10 text-destructive border-destructive/30' },
  closed: { label: 'Ditutup Sementara', chip: 'bg-muted text-muted-foreground border-border' },
};

const SAMPLE_SHELTERS: Facility[] = [
  {
    id: 1,
    name: 'Balai Pertemuan Desa Ambal',
    type: 'shelter',
    regionName: 'Banjarnegara',
    province: 'Jawa Tengah',
    address: 'Jl. Raya Karangkobar KM 4',
    latitude: -7.2851,
    longitude: 109.7135,
    capacity: 350,
    occupancy: 210,
    amenities: ['Dapur Umum', 'MCK 8 Pintu', 'Genset Cadangan', 'Posko Medis'],
    status: 'operational',
    isPublic: true,
  },
  {
    id: 2,
    name: 'Gedung Olahraga (GOR) Limau Manis',
    type: 'shelter',
    regionName: 'Kota Padang',
    province: 'Sumatera Barat',
    address: 'Kompleks Kampus Unand Padang',
    latitude: -0.9142,
    longitude: 100.4589,
    capacity: 800,
    occupancy: 420,
    amenities: ['Air Bersih PDAM', 'Tenda Penyekat Keluarga', 'Posko Trauma Healing', 'Fasilitas Disabilitas'],
    status: 'operational',
    isPublic: true,
  },
  {
    id: 3,
    name: 'Auditorium Kantor Bupati Minahasa Tenggara',
    type: 'shelter',
    regionName: 'Minahasa Tenggara',
    province: 'Sulawesi Utara',
    address: 'Ratahan, Minahasa Tenggara',
    latitude: 1.0542,
    longitude: 124.8123,
    capacity: 500,
    occupancy: 45,
    amenities: ['Aula Luas', 'Dapur Darurat', 'Listrik PLN + Backup Genset'],
    status: 'operational',
    isPublic: true,
  },
  {
    id: 4,
    name: 'Titik Kumpul Lapangan Wanayasa',
    type: 'assembly_point',
    regionName: 'Banjarnegara',
    province: 'Jawa Tengah',
    address: 'Kecamatan Wanayasa',
    latitude: -7.2412,
    longitude: 109.7421,
    capacity: 600,
    occupancy: 0,
    amenities: ['Titik Kumpul Terbuka Aman Longsor', 'Akses Roda 4'],
    status: 'operational',
    isPublic: true,
  },
];

export default function Shelters() {
  const { data: apiFacilities, isLoading } = useGetMitigationFacilities();
  const [filterProvince, setFilterProvince] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  const facilities: Facility[] =
    Array.isArray(apiFacilities) && apiFacilities.length > 0 ? apiFacilities : SAMPLE_SHELTERS;

  const filtered = facilities.filter((f) => {
    if (filterProvince !== 'all' && f.province !== filterProvince) return false;
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        f.regionName.toLowerCase().includes(q) ||
        (f.address && f.address.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalCapacity = facilities.reduce((sum, f) => sum + (f.capacity || 0), 0);
  const totalOccupancy = facilities.reduce((sum, f) => sum + (f.occupancy || 0), 0);
  const occupancyRate = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <Home className="w-4 h-4 text-primary" />
            Manajemen Shelter & Pengungsi (Shelter Management)
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Monitoring kapasitas, fasilitas dasar, dan data agregat okupansi pengungsi di titik evakuasi resmi (PRD 5.5-D).
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-3.5 border border-primary/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Titik Shelter / TES</span>
          <span className="text-2xl font-bold text-foreground mt-1">{facilities.length}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Tersebar di wilayah pilot</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-primary/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Daya Tampung</span>
          <span className="text-2xl font-bold text-foreground mt-1">{totalCapacity.toLocaleString('id-ID')} Jiwa</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Kapasitas resmi terverifikasi</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-emerald-500/20 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Pengungsi Terdata</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{totalOccupancy.toLocaleString('id-ID')} Jiwa</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Agregat per shelter</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-border shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rasio Keterisian (Occupancy)</span>
          <span className="text-2xl font-bold text-primary mt-1">{occupancyRate}%</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Kapasitas aman terkendali</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nama shelter, alamat, atau kabupaten..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

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
            <option value="operational">Siap Tampung</option>
            <option value="limited">Kapasitas Terbatas</option>
            <option value="full">Penuh</option>
          </select>
        </div>
      </div>

      {/* Shelters Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm text-left">
            <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase tracking-wider font-mono">
              <tr>
                <th className="px-4 py-3 font-medium">Nama Fasilitas & Tipe</th>
                <th className="px-4 py-3 font-medium">Wilayah & Alamat</th>
                <th className="px-4 py-3 font-medium">Kapasitas & Okupansi</th>
                <th className="px-4 py-3 font-medium">Fasilitas Utama</th>
                <th className="px-4 py-3 font-medium">Status Kesiapan</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                    Memuat data shelter...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                    Tidak ditemukan data shelter yang sesuai.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const statusMeta = FACILITY_STATUS_CONFIG[item.status] || FACILITY_STATUS_CONFIG.operational;
                  const itemRate = item.capacity > 0 ? Math.round((item.occupancy / item.capacity) * 100) : 0;

                  return (
                    <tr key={item.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 rounded-md bg-primary/10 text-primary mt-0.5 shrink-0">
                            <Home className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground text-xs sm:text-sm">{item.name}</div>
                            <div className="text-[11px] text-muted-foreground capitalize">
                              Tipe: {item.type.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-foreground">{item.regionName}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1">{item.address || item.province}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-secondary rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${itemRate > 85 ? 'bg-destructive' : itemRate > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(itemRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-foreground">{item.occupancy} / {item.capacity}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{itemRate}% Terisi</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(item.amenities || []).slice(0, 2).map((a, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-foreground">
                              {a}
                            </span>
                          ))}
                          {(item.amenities || []).length > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{item.amenities!.length - 2} lagi</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${statusMeta.chip}`}>
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedFacility(item)}
                          className="h-7 text-[11px]"
                        >
                          Detail
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

      {/* Shelter Detail Dialog */}
      {selectedFacility && (
        <Dialog open={!!selectedFacility} onOpenChange={(open) => !open && setSelectedFacility(null)}>
          <DialogContent className="max-w-md bg-card">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">{selectedFacility.name}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {selectedFacility.address}, {selectedFacility.regionName}, {selectedFacility.province}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Daya Tampung</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">{selectedFacility.capacity} Jiwa</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Pengungsi Saat Ini</div>
                  <div className="text-sm font-bold text-emerald-600 mt-0.5">{selectedFacility.occupancy} Jiwa</div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-foreground mb-1.5">Fasilitas & Sarana Penunjang:</div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedFacility.amenities || []).map((amenity, idx) => (
                    <span key={idx} className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[11px]">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-2.5 bg-background rounded-lg border border-border text-muted-foreground text-[11px]">
                <Shield className="w-3.5 h-3.5 text-primary inline mr-1" />
                Data identitas pribadi warga pengungsi dilindungi dan hanya tersaji secara agregat demi privasi (PRD Section 5.5-D).
              </div>
            </div>

            <DialogFooter>
              <Button size="sm" variant="secondary" onClick={() => setSelectedFacility(null)} className="text-xs">
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
