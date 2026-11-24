import React, { useState } from 'react';
import {
  Truck,
  Box,
  Users,
  ShieldCheck,
  Filter,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  Package,
} from 'lucide-react';
import { useGetResources } from '@workspace/api-client-react';
import type { ResourceItem } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  personnel: Users,
  vehicle: Truck,
  equipment: Layers,
  logistics: Package,
  shelter: Box,
};

const ALLOCATION_CONFIG: Record<string, { label: string; chip: string }> = {
  available: { label: 'Tersedia', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  deployed: { label: 'Dikerahkan (Deployed)', chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  allocated: { label: 'Dialokasikan', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  maintenance: { label: 'Perbaikan / Rusak', chip: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const SAMPLE_FALLBACK_RESOURCES: ResourceItem[] = [
  {
    id: 1,
    itemName: 'Tim Reaksi Cepat (TRC) Evakuasi',
    category: 'personnel',
    quantity: 15,
    unit: 'personel',
    regionName: 'Banjarnegara (Jawa Tengah)',
    facilityName: 'Posko Induk BPBD',
    condition: 'good',
    allocationStatus: 'deployed',
    notes: 'Dikerahkan ke Sektor Ambal Karangkobar untuk evakuasi warga lereng',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 2,
    itemName: 'Perahu Karet LCR & Motor Tempel 40 PK',
    category: 'vehicle',
    quantity: 4,
    unit: 'unit',
    regionName: 'Kota Padang (Sumatera Barat)',
    facilityName: 'PUSDALOPS PB Padang',
    condition: 'good',
    allocationStatus: 'deployed',
    notes: '2 unit aktif evakuasi DAS Batang Kuranji',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 3,
    itemName: 'Mobil Tangki Air Bersih 5000 Liter',
    category: 'vehicle',
    quantity: 2,
    unit: 'unit',
    regionName: 'Minahasa Selatan (Sulawesi Utara)',
    facilityName: 'Gudang Logistik BPBD',
    condition: 'good',
    allocationStatus: 'available',
    notes: 'Siap mobilisasi untuk distribusi air bersih pengungsi',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 4,
    itemName: 'Tenda Pengungsi Keluarga 6x12 Meter',
    category: 'shelter',
    quantity: 12,
    unit: 'set',
    regionName: 'Banjarnegara (Jawa Tengah)',
    facilityName: 'Gudang Penyangga Bencana',
    condition: 'good',
    allocationStatus: 'allocated',
    notes: 'Disiapkan pendirian di Lapangan Balai Desa Ambal',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 5,
    itemName: 'Genset Bergerak 15 kVA',
    category: 'equipment',
    quantity: 3,
    unit: 'unit',
    regionName: 'Kota Padang (Sumatera Barat)',
    facilityName: 'Pusdalops Padang',
    condition: 'good',
    allocationStatus: 'available',
    notes: 'Penerangan darurat lokasi shelter',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 6,
    itemName: 'Paket Sembako & Makanan Siap Saji',
    category: 'logistics',
    quantity: 500,
    unit: 'paket',
    regionName: 'Banjarnegara (Jawa Tengah)',
    facilityName: 'Gudang Dinas Sosial',
    condition: 'good',
    allocationStatus: 'available',
    notes: 'Masa kadaluarsa aman sampai Juni 2027',
    lastUpdated: new Date().toISOString(),
  },
];

export default function Resources() {
  const { data: apiResources, isLoading } = useGetResources();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);

  const resourceList: ResourceItem[] =
    Array.isArray(apiResources) && apiResources.length > 0 ? apiResources : SAMPLE_FALLBACK_RESOURCES;

  const filtered = resourceList.filter((r) => {
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    if (filterStatus !== 'all' && r.allocationStatus !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.itemName.toLowerCase().includes(q) ||
        r.regionName.toLowerCase().includes(q) ||
        (r.facilityName && r.facilityName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalItems = resourceList.length;
  const availableItems = resourceList.filter((r) => r.allocationStatus === 'available').length;
  const deployedItems = resourceList.filter((r) => r.allocationStatus === 'deployed').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            Manajemen Sumber Daya & Logistik (Resource Management)
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Registrasi inventaris sumber daya penanggulangan bencana, status pengerahan, dan analisis kesenjangan logistik (PRD 5.5-C).
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-3.5 border border-primary/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Aset Terdata</span>
          <span className="text-2xl font-bold text-foreground mt-1">{totalItems}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Personel, armada, alat, logistik</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-emerald-500/20 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Siap Operasi (Available)</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{availableItems}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Dapat segera dimobilisasi</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-blue-500/20 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Sedang Dikerahkan</span>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{deployedItems}</span>
          <span className="text-[11px] text-muted-foreground mt-0.5">Aktif di lokasi darurat</span>
        </div>
        <div className="bg-card rounded-xl p-3.5 border border-border shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gap Kebutuhan Logistik</span>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">Stok Memadai (92%)</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">Berdasarkan kaji cepat</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nama aset, wilayah, atau fasilitas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="all">Semua Kategori</option>
            <option value="personnel">Personel / Tim SAR</option>
            <option value="vehicle">Armada & Kendaraan</option>
            <option value="equipment">Peralatan Taktis</option>
            <option value="shelter">Tenda / Shelter</option>
            <option value="logistics">Bahan Pangan / Sandang</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="all">Semua Status Alokasi</option>
            <option value="available">Tersedia (Available)</option>
            <option value="deployed">Dikerahkan (Deployed)</option>
            <option value="allocated">Dialokasikan (Allocated)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm text-left">
            <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase tracking-wider font-mono">
              <tr>
                <th className="px-4 py-3 font-medium">Nama Sumber Daya</th>
                <th className="px-4 py-3 font-medium">Kuantitas</th>
                <th className="px-4 py-3 font-medium">Lokasi / Fasilitas</th>
                <th className="px-4 py-3 font-medium">Kondisi</th>
                <th className="px-4 py-3 font-medium">Status Pengerahan</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                    Memuat inventaris sumber daya...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                    Tidak ditemukan aset sumber daya yang sesuai.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const CategoryIcon = CATEGORY_ICONS[item.category] || Box;
                  const allocMeta = ALLOCATION_CONFIG[item.allocationStatus] || ALLOCATION_CONFIG.available;

                  return (
                    <tr key={item.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 rounded-md bg-primary/10 text-primary mt-0.5 shrink-0">
                            <CategoryIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground text-xs sm:text-sm">{item.itemName}</div>
                            <div className="text-[11px] text-muted-foreground capitalize">
                              Kategori: {item.category}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground text-xs">
                          {item.quantity} {item.unit}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-foreground">{item.regionName}</div>
                        <div className="text-[11px] text-muted-foreground">{item.facilityName || 'Gudang Pusat'}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 capitalize font-medium">
                          {item.condition === 'good' ? 'Baik / Siap Pakai' : item.condition}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${allocMeta.chip}`}>
                          {allocMeta.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedResource(item)}
                          className="h-7 text-[11px]"
                        >
                          Rincian
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

      {/* Resource Detail Dialog */}
      {selectedResource && (
        <Dialog open={!!selectedResource} onOpenChange={(open) => !open && setSelectedResource(null)}>
          <DialogContent className="max-w-md bg-card">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">{selectedResource.itemName}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Kategori: {selectedResource.category} • {selectedResource.regionName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Kuantitas</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    {selectedResource.quantity} {selectedResource.unit}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Status Pengerahan</div>
                  <div className="text-xs font-semibold text-primary mt-1">
                    {ALLOCATION_CONFIG[selectedResource.allocationStatus]?.label}
                  </div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-foreground mb-1">Catatan Operasional & Penempatan:</div>
                <div className="p-2.5 bg-background rounded-lg border border-border text-muted-foreground leading-relaxed">
                  {selectedResource.notes || 'Tidak ada catatan tambahan.'}
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground">
                Terakhir diperbarui: {new Date(selectedResource.lastUpdated).toLocaleString('id-ID')}
              </div>
            </div>

            <DialogFooter>
              <Button size="sm" variant="secondary" onClick={() => setSelectedResource(null)} className="text-xs">
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
