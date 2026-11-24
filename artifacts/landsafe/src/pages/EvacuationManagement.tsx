import React, { useState, useMemo } from 'react';
import {
  useGetEvacuationRoutes,
  useGetEvacuationRoute,
  useCreateEvacuationRoute,
  useUpdateEvacuationRoute,
  useDeleteEvacuationRoute,
  useTransitionEvacuationRoute,
  useCreateRouteSegment,
  useUpdateRouteSegment,
  useDeleteRouteSegment,
  useCreateRouteVerification,
  useGetEvacuationScenarios,
  useCreateEvacuationScenario,
  useDeleteEvacuationScenario,
  useGetMitigationFacilities,
  useUpdateFacility,
  useGetResources,
  useGetAuditLogs,
} from '@workspace/api-client-react';
import type {
  EvacuationRouteFull,
  EvacuationRouteDetail,
  RouteSegmentItem,
  RouteVerificationItem,
  EvacuationScenarioItem,
  Facility,
  ResourceItem,
  CreateEvacuationRouteInput,
} from '@workspace/api-client-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '@/contexts/AuthContext';
import {
  ShieldAlert,
  Route,
  Navigation,
  Compass,
  MapPin,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Plus,
  Trash2,
  Edit3,
  FileCheck2,
  Camera,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  ExternalLink,
  ShieldCheck,
  History,
  AlertOctagon,
  Eye,
  Sliders,
  ChevronRight,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import {
  HAZARD_LABELS,
  hazardLabel,
  hazardExposureMeta,
  routeTypeMeta,
  routeStatusMeta,
  roadConditionMeta,
  formatDate,
  formatDateTime,
  formatNumber,
} from '@/lib/risk-ui';

const DEFAULT_CENTER: [number, number] = [-7.35, 109.65];

export const isValidCoordinate = (lat?: number | null, lng?: number | null): lat is number =>
  typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);

export function parseRouteGeometry(raw: unknown): [number, number][] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is [number, number] =>
        Array.isArray(item) &&
        item.length >= 2 &&
        typeof item[0] === 'number' &&
        !isNaN(item[0]) &&
        typeof item[1] === 'number' &&
        !isNaN(item[1])
    );
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parseRouteGeometry(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function MapController({ center, zoom, bounds }: { center?: [number, number]; zoom?: number; bounds?: [number, number][] }) {
  const map = useMap();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch (err) {
        // ignore if map unmounted
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);

  React.useEffect(() => {
    try {
      const size = map.getSize();
      if (!size || size.x < 30 || size.y < 30) {
        return;
      }

      if (bounds && bounds.length > 1) {
        const validBounds = bounds.filter(
          (pt) => Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && !isNaN(pt[0]) && typeof pt[1] === 'number' && !isNaN(pt[1])
        );
        if (validBounds.length > 1) {
          map.fitBounds(validBounds, { padding: [30, 30], maxZoom: 14 });
          return;
        }
      }

      if (center && typeof center[0] === 'number' && !isNaN(center[0]) && typeof center[1] === 'number' && !isNaN(center[1])) {
        map.flyTo(center, zoom ?? 12, { duration: 1.0 });
      }
    } catch (err) {
      console.warn('MapController bounds error caught:', err);
    }
  }, [center, zoom, bounds, map]);

  return null;
}

const HAZARD_OPTIONS = [
  { value: 'all', label: 'Semua Bencana' },
  { value: 'landslide', label: 'Tanah Longsor' },
  { value: 'flood', label: 'Banjir' },
  { value: 'earthquake', label: 'Gempabumi' },
  { value: 'tsunami', label: 'Tsunami' },
  { value: 'volcanic', label: 'Erupsi Gunung Api' },
];

function EvacuationManagementContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<string>('routes');

  // Filter states
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedHazard, setSelectedHazard] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected route state
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [showSegmentModal, setShowSegmentModal] = useState<boolean>(false);
  const [showScenarioModal, setShowScenarioModal] = useState<boolean>(false);
  const [showFacilityModal, setShowFacilityModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Queries
  const routesQuery = useGetEvacuationRoutes(
    {
      regionName: selectedRegion !== 'all' ? selectedRegion : undefined,
      hazardType: selectedHazard !== 'all' ? selectedHazard : undefined,
      routeStatus: selectedStatus !== 'all' ? selectedStatus : undefined,
    },
    { query: { queryKey: ['admin-evacuation-routes', selectedRegion, selectedHazard, selectedStatus] } }
  );

  const routeDetailQuery = useGetEvacuationRoute(
    selectedRouteId ?? 0,
    { query: { enabled: !!selectedRouteId, queryKey: ['admin-route-detail', selectedRouteId] } }
  );

  const facilitiesQuery = useGetMitigationFacilities(
    undefined,
    { query: { queryKey: ['admin-facilities'] } }
  );

  const scenariosQuery = useGetEvacuationScenarios(
    {
      regionName: selectedRegion !== 'all' ? selectedRegion : undefined,
      hazardType: selectedHazard !== 'all' ? selectedHazard : undefined,
    },
    { query: { queryKey: ['admin-scenarios', selectedRegion, selectedHazard] } }
  );

  const auditLogsQuery = useGetAuditLogs(
    { limit: 25 },
    { query: { enabled: isAdmin, queryKey: ['evacuation-audit-logs'] } }
  );

  // Mutations
  const createRouteMutation = useCreateEvacuationRoute();
  const transitionMutation = useTransitionEvacuationRoute();
  const deleteRouteMutation = useDeleteEvacuationRoute();
  const createVerificationMutation = useCreateRouteVerification();
  const createSegmentMutation = useCreateRouteSegment();
  const deleteSegmentMutation = useDeleteRouteSegment();
  const createScenarioMutation = useCreateEvacuationScenario();
  const deleteScenarioMutation = useDeleteEvacuationScenario();
  const updateFacilityMutation = useUpdateFacility();

  const routes: EvacuationRouteFull[] = Array.isArray(routesQuery.data) ? routesQuery.data : [];
  const facilities: Facility[] = Array.isArray(facilitiesQuery.data) ? facilitiesQuery.data : [];
  const scenarios: EvacuationScenarioItem[] = Array.isArray(scenariosQuery.data) ? scenariosQuery.data : [];
  const activeRoute = routeDetailQuery.data;

  // Available regions for dropdown
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    routes.forEach((r) => r.regionName && set.add(r.regionName));
    facilities.forEach((f) => f.regionName && set.add(f.regionName));
    return Array.from(set).sort();
  }, [routes, facilities]);

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      const q = searchQuery.toLowerCase();
      return (
        q === '' ||
        r.name.toLowerCase().includes(q) ||
        r.routeCode.toLowerCase().includes(q) ||
        r.originName.toLowerCase().includes(q) ||
        r.destinationName.toLowerCase().includes(q) ||
        r.regionName.toLowerCase().includes(q)
      );
    });
  }, [routes, searchQuery]);

  // Set first route as selected if none selected
  React.useEffect(() => {
    if (!selectedRouteId && filteredRoutes.length > 0) {
      setSelectedRouteId(filteredRoutes[0].id);
    }
  }, [filteredRoutes, selectedRouteId]);

  // Map center & bounds
  const mapCenter = useMemo((): [number, number] => {
    if (activeRoute && isValidCoordinate(activeRoute.originLatitude, activeRoute.originLongitude)) {
      return [activeRoute.originLatitude, activeRoute.originLongitude];
    }
    return DEFAULT_CENTER;
  }, [activeRoute]);

  const mapBounds = useMemo(() => {
    if (activeRoute) {
      const parsed = parseRouteGeometry(activeRoute.routeGeometry);
      if (parsed.length > 1) {
        return parsed;
      }
    }
    return undefined;
  }, [activeRoute]);

  // Capacity Deficit Calculation across shelters
  const shelterCapacityAnalysis = useMemo(() => {
    let totalCap = 0;
    let totalOcc = 0;
    const atRiskShelters: Facility[] = [];

    facilities
      .filter((f) => f.type === 'shelter' || f.type === 'assembly_point')
      .forEach((f) => {
        totalCap += f.capacity;
        totalOcc += f.occupancy;
        const ratio = f.capacity > 0 ? f.occupancy / f.capacity : 0;
        if (ratio >= 0.85 || f.status === 'full' || f.status === 'limited') {
          atRiskShelters.push(f);
        }
      });

    return {
      totalCapacity: totalCap,
      totalOccupancy: totalOcc,
      occupancyRate: totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0,
      atRiskCount: atRiskShelters.length,
      atRiskShelters,
    };
  }, [facilities]);

  // Handler for Workflow Transitions
  const handleTransition = async (action: string) => {
    if (!selectedRouteId) return;
    setStatusMessage(null);
    try {
      await transitionMutation.mutateAsync({
        id: selectedRouteId,
        data: { action: action as any },
      });
      setStatusMessage({ text: `Status rute berhasil diperbarui (${action})`, type: 'success' });
      routesQuery.refetch();
      routeDetailQuery.refetch();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal mengubah status rute', type: 'error' });
    }
  };

  // Handler for Deleting Draft Route
  const handleDeleteRoute = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus draf rute evakuasi ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await deleteRouteMutation.mutateAsync({ id });
      setStatusMessage({ text: 'Draf rute berhasil dihapus.', type: 'success' });
      setSelectedRouteId(null);
      routesQuery.refetch();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal menghapus rute', type: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top BPBD Command Center Banner */}
      <div className="bg-[#102A4C] text-white p-4 rounded-xl border border-[#183B63] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#2563EB] text-white text-[10px] font-bold uppercase tracking-wider">
              BPBD Command Center
            </span>
            <span className="text-xs text-white/60">Sistem Intelijen Rute Evakuasi & Manajemen Kedaruratan</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Compass className="h-5 w-5 text-[#2563EB]" />
            Pusat Pengendalian Rute Evakuasi Bencana (BPBD)
          </h1>
          <p className="text-xs text-white/70 max-w-3xl leading-relaxed">
            Perencanaan rute GIS, optimasi jaringan jalan alternatif, verifikasi lapangan tergeotag, deteksi defisit shelter, dan alur bertingkat pengesahan rute resmi masyarakat.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-[#2563EB] hover:bg-blue-600 text-white text-xs h-8 gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Rencanakan Rute Baru</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowScenarioModal(true)}
            className="border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs h-8 gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Simulasi Skenario</span>
          </Button>
        </div>
      </div>

      {/* Capacity & Operational Risk Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-[#DCE4EF] bg-white">
          <CardContent className="p-3.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Rute Terdaftar</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#102A4C]">{routes.length}</span>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {routes.filter((r) => r.routeStatus === 'published').length} Terbit Publik
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#DCE4EF] bg-white">
          <CardContent className="p-3.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kapasitas Shelter Total</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#102A4C]">
                {formatNumber(shelterCapacityAnalysis.totalCapacity)}
              </span>
              <span className="text-[11px] text-slate-500">Jiwa tertampung</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#DCE4EF] bg-white">
          <CardContent className="p-3.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Okupansi Pengungsi Aktif</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#2563EB]">
                {shelterCapacityAnalysis.occupancyRate}%
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {formatNumber(shelterCapacityAnalysis.totalOccupancy)} jiwa
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${shelterCapacityAnalysis.atRiskCount > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-[#DCE4EF] bg-white'}`}>
          <CardContent className="p-3.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Defisit / Konflik Shelter</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className={`text-2xl font-bold ${shelterCapacityAnalysis.atRiskCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {shelterCapacityAnalysis.atRiskCount} Fasilitas
              </span>
              <span className="text-[11px] font-medium text-amber-700">
                {shelterCapacityAnalysis.atRiskCount > 0 ? 'Kapasitas Kritis' : 'Normal'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications / Alerts banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold ml-2">
            âœ•
          </button>
        </div>
      )}

      {/* Functional Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-[#DCE4EF] p-1 h-auto min-h-10 w-full justify-start overflow-x-auto scrollbar-hide flex flex-nowrap space-x-2">
          <TabsTrigger value="routes" className="data-[state=active]:bg-[#102A4C] data-[state=active]:text-white text-xs gap-1.5">
            <Route className="h-3.5 w-3.5" />
            <span>Perencanaan & Optimasi Rute ({filteredRoutes.length})</span>
          </TabsTrigger>
          <TabsTrigger value="shelters" className="data-[state=active]:bg-[#102A4C] data-[state=active]:text-white text-xs gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span>Shelter & Alokasi Daya Tampung ({facilities.length})</span>
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="data-[state=active]:bg-[#102A4C] data-[state=active]:text-white text-xs gap-1.5">
            <Sliders className="h-3.5 w-3.5" />
            <span>Simulasi Skenario Bencana ({scenarios.length})</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="audit" className="data-[state=active]:bg-[#102A4C] data-[state=active]:text-white text-xs gap-1.5">
              <History className="h-3.5 w-3.5" />
              <span>Log Audit Persetujuan BPBD</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* TAB 1: Route Planning, Optimization, GIS Workspace, and Workflow Transition */}
        <TabsContent value="routes" className="mt-4 space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3 rounded-lg border border-[#DCE4EF] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Cari rute, kode, wilayah..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs border-[#DCE4EF]"
                />
              </div>

              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="h-8 border border-[#DCE4EF] rounded px-2 text-xs bg-white text-slate-800"
              >
                <option value="all">Semua Wilayah</option>
                {availableRegions.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>

              <select
                value={selectedHazard}
                onChange={(e) => setSelectedHazard(e.target.value)}
                className="h-8 border border-[#DCE4EF] rounded px-2 text-xs bg-white text-slate-800"
              >
                {HAZARD_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-8 border border-[#DCE4EF] rounded px-2 text-xs bg-white text-slate-800"
              >
                <option value="all">Semua Status Rute</option>
                <option value="draft">Draf (Draft)</option>
                <option value="analysis">Analisis Teknis</option>
                <option value="field_verification">Verifikasi Lapangan</option>
                <option value="review">Peninjauan Pimpinan</option>
                <option value="approved">Disetujui (Approved)</option>
                <option value="published">Terbit Publik (Published)</option>
                <option value="archived">Diarsipkan</option>
              </select>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => routesQuery.refetch()}
              className="h-8 text-xs gap-1 border-[#DCE4EF]"
            >
              <RefreshCw className="h-3 w-3" /> Segarkan
            </Button>
          </div>

          {/* Master-Detail Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 4 Cols: Route List Table */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-[#DCE4EF] overflow-hidden flex flex-col h-[380px] lg:h-[650px] shadow-sm">
              <div className="p-3 border-b border-[#DCE4EF] bg-slate-50 flex items-center justify-between shrink-0">
                <span className="font-bold text-xs text-[#102A4C]">Daftar Rute Evakuasi ({filteredRoutes.length})</span>
                <span className="text-[10px] text-slate-500">Pilih rute untuk detail & optimasi</span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5">
                {filteredRoutes.map((route) => {
                  const isSelected = route.id === selectedRouteId;
                  const statusMeta = routeStatusMeta(route.routeStatus);
                  const isPrimary = route.routeType === 'primary';

                  return (
                    <div
                      key={route.id}
                      onClick={() => setSelectedRouteId(route.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all border ${
                        isSelected
                          ? 'border-[#2563EB] bg-blue-50/50 shadow-sm ring-1 ring-[#2563EB]/20'
                          : 'border-[#DCE4EF] hover:border-slate-300 hover:bg-slate-50/50 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1 rounded">
                          {route.routeCode}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${statusMeta.chip}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">{route.name}</h4>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>
                          {route.originName} â†’ {route.destinationName}
                        </span>
                        <span className="font-semibold text-slate-700">{route.distanceKm} km</span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] pt-1 border-t border-slate-100">
                        <span className="text-slate-500 font-medium">{hazardLabel(route.hazardType)}</span>
                        <span className="text-slate-400">v{route.version} Â· {formatDate(route.updatedAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 8 Cols: GIS Workspace, Multi-Criteria Optimization, and Approval Workflow */}
            <div className="lg:col-span-8 space-y-4">
              {activeRoute ? (
                <>
                  {/* Top Bar for Selected Route: Lifecycle Tracker & Action Transitions */}
                  <Card className="border-[#DCE4EF] bg-white shadow-sm">
                    <CardHeader className="p-4 border-b border-[#DCE4EF] pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-[#102A4C] text-white px-1.5 py-0.5 rounded">
                              {activeRoute.routeCode}
                            </span>
                            <span className="text-xs font-bold text-slate-500">
                              Wilayah: {activeRoute.regionName}, {activeRoute.province}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${routeStatusMeta(activeRoute.routeStatus).chip}`}>
                              {routeStatusMeta(activeRoute.routeStatus).label}
                            </span>
                          </div>
                          <CardTitle className="text-base font-bold text-[#102A4C] mt-1">
                            {activeRoute.name}
                          </CardTitle>
                        </div>

                        {/* Transition Buttons depending on current state */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {activeRoute.routeStatus === 'draft' && (
                            <Button
                              size="sm"
                              onClick={() => handleTransition('submit_analysis')}
                              disabled={transitionMutation.isPending}
                              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Ajukan Analisis GIS â†’
                            </Button>
                          )}

                          {activeRoute.routeStatus === 'analysis' && (
                            <Button
                              size="sm"
                              onClick={() => handleTransition('submit_verification')}
                              disabled={transitionMutation.isPending}
                              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                            >
                              Kirim ke Verifikasi Lapangan â†’
                            </Button>
                          )}

                          {activeRoute.routeStatus === 'field_verification' && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowVerifyModal(true)}
                                className="h-8 text-xs gap-1 border-amber-300 text-amber-800 bg-amber-50"
                              >
                                <Camera className="h-3.5 w-3.5" /> Catat Inspeksi Fisik
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => handleTransition('submit_review')}
                                disabled={transitionMutation.isPending}
                                className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                              >
                                Ajukan Peninjauan BPBD â†’
                              </Button>
                            </div>
                          )}

                          {activeRoute.routeStatus === 'review' && isAdmin && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => handleTransition('approve')}
                                disabled={transitionMutation.isPending}
                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> Setujui (Approve)
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTransition('return_draft')}
                                disabled={transitionMutation.isPending}
                                className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                              >
                                Kembalikan ke Draf
                              </Button>
                            </div>
                          )}

                          {activeRoute.routeStatus === 'approved' && isAdmin && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => handleTransition('publish')}
                                disabled={transitionMutation.isPending}
                                className="h-8 text-xs bg-green-700 hover:bg-green-800 text-white gap-1 font-bold shadow-sm"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" /> Terbitkan ke Publik (Publish)
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTransition('return_draft')}
                                disabled={transitionMutation.isPending}
                                className="h-8 text-xs text-slate-600"
                              >
                                Batal / Tarik
                              </Button>
                            </div>
                          )}

                          {activeRoute.routeStatus === 'published' && isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTransition('archive')}
                              disabled={transitionMutation.isPending}
                              className="h-8 text-xs text-slate-500 border-slate-300 hover:bg-slate-100"
                            >
                              Arsipkan Rute
                            </Button>
                          )}

                          {activeRoute.routeStatus === 'draft' && isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteRoute(activeRoute.id)}
                              className="h-8 text-xs text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 6-Step Visual Lifecycle Stepper */}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="grid grid-cols-6 gap-1 text-center">
                          {[
                            { key: 'draft', label: '1. Draf' },
                            { key: 'analysis', label: '2. Analisis GIS' },
                            { key: 'field_verification', label: '3. Verifikasi Lapangan' },
                            { key: 'review', label: '4. Peninjauan' },
                            { key: 'approved', label: '5. Disetujui' },
                            { key: 'published', label: '6. Terbit Publik' },
                          ].map((step, idx) => {
                            const stepsOrder = ['draft', 'analysis', 'field_verification', 'review', 'approved', 'published'];
                            const currentIdx = stepsOrder.indexOf(activeRoute.routeStatus);
                            const isPast = currentIdx >= idx;
                            const isCurrent = activeRoute.routeStatus === step.key;

                            return (
                              <div
                                key={step.key}
                                className={`py-1 px-1 rounded text-[10px] font-bold ${
                                  isCurrent
                                    ? 'bg-[#102A4C] text-white ring-1 ring-[#102A4C]'
                                    : isPast
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {step.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Route Attributes & GIS Network Evaluation */}
                    <CardContent className="p-4 space-y-4">
                      {/* Evaluation Metrics Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Jarak Rute</span>
                          <span className="text-sm font-bold text-slate-800">{activeRoute.distanceKm} km</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Waktu Tempuh</span>
                          <span className="text-sm font-bold text-slate-800">{activeRoute.estimatedTimeMinutes} menit</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Daya Tampung Alur</span>
                          <span className="text-sm font-bold text-slate-800">{formatNumber(activeRoute.maxCapacityPersons)} org</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Paparan Bahaya</span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded inline-block mt-0.5 ${hazardExposureMeta(activeRoute.hazardExposure).badge}`}>
                            {hazardExposureMeta(activeRoute.hazardExposure).label}
                          </span>
                        </div>
                      </div>

                      {/* Map Inspection Canvas */}
                      <div className="h-[280px] w-full rounded-lg overflow-hidden border border-[#DCE4EF] relative">
                        <MapContainer
                          center={mapCenter}
                          zoom={12}
                          zoomControl={false}
                          className="w-full h-full isolate"
                        >
                          <MapController center={mapCenter} bounds={mapBounds} />
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; OpenStreetMap | LANDSAFE BPBD'
                          />
                          <ZoomControl position="bottomright" />

                          {(() => {
                            const activeCoords = parseRouteGeometry(activeRoute.routeGeometry);
                            return (
                              <>
                                {activeCoords.length >= 2 && (
                                  <Polyline
                                    positions={activeCoords}
                                    pathOptions={{
                                      color: activeRoute.routeType === 'primary' ? '#2563EB' : '#7C3AED',
                                      weight: 6,
                                      opacity: 0.9,
                                    }}
                                  />
                                )}
                                {isValidCoordinate(activeRoute.originLatitude, activeRoute.originLongitude) && (
                                  <CircleMarker
                                    center={[activeRoute.originLatitude, activeRoute.originLongitude]}
                                    radius={7}
                                    pathOptions={{ fillColor: '#F59E0B', color: '#FFFFFF', weight: 2, fillOpacity: 1 }}
                                  />
                                )}
                                {isValidCoordinate(activeRoute.destinationLatitude, activeRoute.destinationLongitude) && (
                                  <CircleMarker
                                    center={[activeRoute.destinationLatitude, activeRoute.destinationLongitude]}
                                    radius={8}
                                    pathOptions={{ fillColor: '#2563EB', color: '#FFFFFF', weight: 2, fillOpacity: 1 }}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </MapContainer>
                      </div>

                      {/* Road Segments & Road Condition Table */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[#102A4C] flex items-center gap-1.5">
                            <Navigation className="h-4 w-4 text-blue-600" />
                            Rincian Segmen Jaringan Jalan ({activeRoute.segments?.length || 0} Segmen)
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowSegmentModal(true)}
                            className="h-7 text-xs border-[#DCE4EF]"
                          >
                            + Tambah Segmen Ruas
                          </Button>
                        </div>

                        {activeRoute.segments && activeRoute.segments.length > 0 ? (
                          <div className="border border-[#DCE4EF] rounded-lg overflow-hidden">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-[#DCE4EF]">
                                <tr>
                                  <th className="p-2.5">Urutan</th>
                                  <th className="p-2.5">Nama Ruas</th>
                                  <th className="p-2.5">Panjang</th>
                                  <th className="p-2.5">Kondisi Jalan</th>
                                  <th className="p-2.5">Status Rintangan</th>
                                  <th className="p-2.5">Catatan Kerawanan</th>
                                  <th className="p-2.5 text-right">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {activeRoute.segments.map((seg: RouteSegmentItem) => {
                                  const condMeta = roadConditionMeta(seg.roadCondition);
                                  return (
                                    <tr key={seg.id} className={seg.isBlocked ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}>
                                      <td className="p-2.5 font-bold font-mono text-slate-600">{seg.segmentOrder}</td>
                                      <td className="p-2.5 font-medium text-slate-800">{seg.name}</td>
                                      <td className="p-2.5">{seg.distanceKm} km</td>
                                      <td className="p-2.5">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${condMeta.chip}`}>
                                          {condMeta.label}
                                        </span>
                                      </td>
                                      <td className="p-2.5">
                                        {seg.isBlocked ? (
                                          <span className="text-[10px] font-bold text-red-700 bg-red-100 border border-red-300 px-1.5 py-0.5 rounded flex items-center gap-1 w-max">
                                            <AlertTriangle className="h-3 w-3" /> Terputus: {seg.blockageReason || 'Tertutup'}
                                          </span>
                                        ) : (
                                          <span className="text-emerald-700 text-[10px] font-medium flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> Lancar
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2.5 text-slate-500 text-[11px]">{seg.hazardNotes || 'â€”'}</td>
                                      <td className="p-2.5 text-right">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={async () => {
                                            if (window.confirm('Hapus segmen jalan ini?')) {
                                              await deleteSegmentMutation.mutateAsync({ routeId: activeRoute.id, id: seg.id });
                                              routeDetailQuery.refetch();
                                            }
                                          }}
                                          className="h-6 w-6 p-0 text-red-500"
                                        >
                                          âœ•
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500 rounded-lg">
                            Belum ada pembagian segmen jalan. Tambahkan segmen untuk memetakan ruas rawan atau terputus secara mendalam.
                          </div>
                        )}
                      </div>

                      {/* Field Inspection Verifications Section */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[#102A4C] flex items-center gap-1.5">
                            <FileCheck2 className="h-4 w-4 text-emerald-600" />
                            Catatan Verifikasi Lapangan BPBD ({activeRoute.verifications?.length || 0} Laporan)
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowVerifyModal(true)}
                            className="h-7 text-xs border-[#DCE4EF]"
                          >
                            + Input Hasil Survei Lapangan
                          </Button>
                        </div>

                        {activeRoute.verifications && activeRoute.verifications.length > 0 ? (
                          <div className="space-y-2">
                            {activeRoute.verifications.map((ver: RouteVerificationItem) => (
                              <div key={ver.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="font-bold text-slate-800 flex items-center gap-2">
                                    <span>Petugas: {ver.inspectorName}</span>
                                    <span className="text-[10px] font-normal text-slate-400">
                                      Tanggal: {formatDateTime(ver.inspectionDate)}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-[10px]">
                                    Kondisi Fisik: {ver.overallCondition}
                                  </Badge>
                                </div>

                                <p className="text-slate-700 text-xs leading-relaxed">{ver.findings}</p>

                                {ver.recommendations && (
                                  <div className="text-[11px] text-blue-900 bg-blue-50 p-2 rounded border border-blue-200">
                                    <strong>Rekomendasi Tindak Lanjut:</strong> {ver.recommendations}
                                  </div>
                                )}

                                {/* Inspection Checklist Flags */}
                                <div className="flex flex-wrap gap-2 text-[10px]">
                                  <span className={`px-2 py-0.5 rounded border ${ver.roadAccessible ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                                    {ver.roadAccessible ? 'âœ“ Akses Jalan Siaga' : 'âœ• Akses Jalan Terkendala'}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded border ${ver.signageAdequate ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                    {ver.signageAdequate ? 'âœ“ Rambu Evakuasi Terpasang' : 'âœ• Rambu Minim'}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded border ${ver.shelterReady ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                    {ver.shelterReady ? 'âœ“ Shelter Siap Huni' : 'âœ• Shelter Belum Siap'}
                                  </span>
                                </div>

                                {/* Geotagged Photos */}
                                {Array.isArray(ver.geotagPhotos) && ver.geotagPhotos.length > 0 && (
                                  <div className="pt-1 flex gap-2 overflow-x-auto">
                                    {ver.geotagPhotos.map((photo: any, pIdx: number) => (
                                      <div key={pIdx} className="w-36 rounded border border-slate-200 overflow-hidden bg-white shrink-0">
                                        <img src={photo.url} alt={photo.caption} className="w-full h-20 object-cover" />
                                        <div className="p-1 text-[9px] text-slate-600 truncate" title={photo.caption}>
                                          {photo.caption}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded text-center text-xs">
                            Belum ada catatan verifikasi fisik lapangan. Catat hasil survei untuk memenuhi syarat pengajuan persetujuan rute.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="h-[400px] flex items-center justify-center bg-white rounded-xl border border-slate-200 text-slate-400 text-sm">
                  Pilih salah satu rute di sebelah kiri untuk melihat peta interaktif, alur verifikasi, dan optimasi segmen jalan.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Shelter and Population Allocation Management */}
        <TabsContent value="shelters" className="mt-4 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#DCE4EF] space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE4EF] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#102A4C]">Daftar Fasilitas Shelter, Titik Kumpul & Rumah Sakit</h3>
                <p className="text-xs text-slate-500">
                  Pantau kapasitas daya tampung dan alokasi populasi pengungsi secara berkala untuk mencegah penumpukan di lokasi tertentu.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowFacilityModal(true)} className="h-8 text-xs bg-[#102A4C] hover:bg-[#183B63] text-white">
                + Tambah Fasilitas Baru
              </Button>
            </div>

            {/* Shelter Deficit Warning Alert */}
            {shelterCapacityAnalysis.atRiskCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                <AlertOctagon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Peringatan Defisit Daya Tampung Shelter:</strong> Ditemukan{' '}
                  <strong>{shelterCapacityAnalysis.atRiskCount} fasilitas</strong> dengan tingkat okupansi mendekati atau melebihi 85% kapasitas resmi. Lakukan pengalihan rute alternatif ke lokasi terdekat.
                </div>
              </div>
            )}

            {/* Facilities Data Table */}
            <div className="border border-[#DCE4EF] rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-[#DCE4EF]">
                  <tr>
                    <th className="p-3">Nama Fasilitas</th>
                    <th className="p-3">Tipe</th>
                    <th className="p-3">Wilayah</th>
                    <th className="p-3">Kapasitas Resmi</th>
                    <th className="p-3">Okupansi Nyata</th>
                    <th className="p-3">Beban Kapasitas</th>
                    <th className="p-3">Status Operasional</th>
                    <th className="p-3 text-right">Update Okupansi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {facilities.map((fac) => {
                    const ratio = fac.capacity > 0 ? fac.occupancy / fac.capacity : 0;
                    const isHigh = ratio >= 0.85;

                    return (
                      <tr key={fac.id} className={isHigh ? 'bg-amber-50/50' : 'hover:bg-slate-50/50'}>
                        <td className="p-3 font-bold text-slate-900">{fac.name}</td>
                        <td className="p-3">
                          <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {fac.type}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{fac.regionName}</td>
                        <td className="p-3 font-semibold text-slate-800">{formatNumber(fac.capacity)} jiwa</td>
                        <td className="p-3 font-semibold text-slate-800">{formatNumber(fac.occupancy)} jiwa</td>
                        <td className="p-3">
                          <div className="w-28 space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span>{Math.round(ratio * 100)}%</span>
                              {isHigh && <span className="text-amber-700 font-bold">Kritis</span>}
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isHigh ? 'bg-amber-500' : 'bg-blue-600'}`}
                                style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              fac.status === 'operational'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : fac.status === 'limited'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                            }`}
                          >
                            {fac.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const newOcc = prompt(`Update jumlah pengungsi di ${fac.name}:`, fac.occupancy.toString());
                              if (newOcc !== null && !isNaN(Number(newOcc))) {
                                await updateFacilityMutation.mutateAsync({
                                  id: fac.id,
                                  data: { occupancy: Number(newOcc) } as any,
                                });
                                facilitiesQuery.refetch();
                              }
                            }}
                            className="h-7 text-xs border-[#DCE4EF]"
                          >
                            Ubah
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: Scenario Management & What-If Simulation */}
        <TabsContent value="scenarios" className="mt-4 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#DCE4EF] space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE4EF] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold uppercase tracking-wider">
                    Simulasi Internal (Non-Instruksi Resmi)
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#102A4C] mt-1">Skenario Kontingensi & Evaluasi Rute Alternatif</h3>
                <p className="text-xs text-slate-500">
                  Data simulasi dipisahkan secara ketat dari rute publik. Gunakan untuk merencanakan kapasitas dan rekayasa jalur darurat sebelum terjadi bencana.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setShowScenarioModal(true)}
                className="h-8 text-xs bg-[#102A4C] hover:bg-[#183B63] text-white gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Buat Skenario Simulasi
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scenarios.map((scen) => (
                <Card key={scen.id} className="border-[#DCE4EF] bg-slate-50/50">
                  <CardHeader className="p-3.5 border-b border-slate-200 bg-white">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">
                        {hazardLabel(scen.hazardType)}
                      </Badge>
                      <span className="text-[10px] text-slate-400 font-mono">Dibuat: {formatDate(scen.createdAt)}</span>
                    </div>
                    <CardTitle className="text-sm font-bold text-[#102A4C] mt-1">{scen.name}</CardTitle>
                    <div className="text-xs text-slate-500">{scen.description}</div>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-3">
                    {/* Candidate Routes Multi-Criteria Table */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Evaluasi Komparasi Rute Kandidat
                      </div>
                      <div className="border border-[#DCE4EF] rounded bg-white overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-[#DCE4EF]">
                            <tr>
                              <th className="p-2">Kandidat Rute</th>
                              <th className="p-2">Skor GIS</th>
                              <th className="p-2">Waktu</th>
                              <th className="p-2">Paparan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Array.isArray(scen.candidateRoutes) &&
                              scen.candidateRoutes.map((cand: any, cIdx: number) => (
                                <tr key={cIdx}>
                                  <td className="p-2 font-medium text-slate-800">{cand.name}</td>
                                  <td className="p-2 font-bold text-blue-700">{cand.score} / 100</td>
                                  <td className="p-2">{cand.travelTime} mnt</td>
                                  <td className="p-2 text-[10px]">{cand.hazardExposure}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {scen.recommendation && (
                      <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-xs text-blue-900">
                        <strong className="block text-blue-950 mb-0.5">Rekomendasi Strategi BPBD:</strong>
                        {scen.recommendation}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (window.confirm('Hapus skenario simulasi ini?')) {
                            await deleteScenarioMutation.mutateAsync({ id: scen.id });
                            scenariosQuery.refetch();
                          }
                        }}
                        className="h-7 text-xs text-red-600 hover:bg-red-50"
                      >
                        Hapus Skenario
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: Audit Logs for Administrator */}
        {isAdmin && (
          <TabsContent value="audit" className="mt-4 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-[#DCE4EF] space-y-3 shadow-sm">
              <div className="border-b border-[#DCE4EF] pb-2">
                <h3 className="text-sm font-bold text-[#102A4C]">Log Audit Sistem Evakuasi & Persetujuan Pejabat</h3>
                <p className="text-xs text-slate-500">
                  Rekam jejak setiap aksi penerbitan rute, modifikasi segmen jalan, dan perubahan status untuk kepatuhan tata kelola kedaruratan.
                </p>
              </div>

              <div className="border border-[#DCE4EF] rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-[#DCE4EF]">
                    <tr>
                      <th className="p-2.5">Waktu</th>
                      <th className="p-2.5">Aktor / Personel</th>
                      <th className="p-2.5">Aksi Tindakan</th>
                      <th className="p-2.5">Tipe Entitas</th>
                      <th className="p-2.5">Rincian Perubahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(auditLogsQuery.data) &&
                      auditLogsQuery.data
                        .filter((log: any) => log.action?.includes('evacuation') || log.entityType?.includes('route'))
                        .map((log: any) => (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 text-slate-500 font-mono text-[11px]">{formatDateTime(log.createdAt)}</td>
                            <td className="p-2.5 font-bold text-slate-800">User #{log.userId}</td>
                            <td className="p-2.5">
                              <span className="font-mono text-[10px] font-bold bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                                {log.action}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-600">{log.entityType} #{log.entityId}</td>
                            <td className="p-2.5 text-slate-600 text-[11px] truncate max-w-xs">{log.details || 'â€”'}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Modal: Create Candidate Route */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#102A4C]">Rencanakan Rute Evakuasi Baru</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Buat rute draf awal. Rute akan melalui alur analisis GIS dan inspeksi lapangan sebelum disetujui pimpinan.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              try {
                await createRouteMutation.mutateAsync({
                  data: {
                    name: formData.get('name') as string,
                    routeCode: formData.get('routeCode') as string,
                    originName: formData.get('originName') as string,
                    originLatitude: Number(formData.get('originLatitude')),
                    originLongitude: Number(formData.get('originLongitude')),
                    destinationName: formData.get('destinationName') as string,
                    destinationLatitude: Number(formData.get('destinationLatitude')),
                    destinationLongitude: Number(formData.get('destinationLongitude')),
                    regionName: formData.get('regionName') as string,
                    province: (formData.get('province') as string) || 'Central Java',
                    hazardType: formData.get('hazardType') as any,
                    routeType: formData.get('routeType') as any,
                    distanceKm: Number(formData.get('distanceKm') || 0),
                    estimatedTimeMinutes: Number(formData.get('estimatedTimeMinutes') || 0),
                    maxCapacityPersons: Number(formData.get('maxCapacityPersons') || 0),
                    roadSurface: formData.get('roadSurface') as string,
                    isAccessible: formData.get('isAccessible') === 'on',
                    publicDescription: formData.get('publicDescription') as string,
                    routeGeometry: [
                      [Number(formData.get('originLatitude')), Number(formData.get('originLongitude'))],
                      [Number(formData.get('destinationLatitude')), Number(formData.get('destinationLongitude'))],
                    ],
                  },
                });
                setShowCreateModal(false);
                setStatusMessage({ text: 'Draf rute evakuasi berhasil dibuat.', type: 'success' });
                routesQuery.refetch();
              } catch (err: any) {
                alert(err.message || 'Gagal membuat rute');
              }
            }}
            className="space-y-3 py-2 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nama Rute Evakuasi</label>
              <Input name="name" required placeholder="Contoh: Jalur Utama Evakuasi Dusun Sijeruk - Shelter Batur" className="h-8 text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Kode Rute (Unik)</label>
                <Input name="routeCode" required placeholder="Contoh: EVR-BJN-004" className="h-8 text-xs font-mono" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Wilayah / Kabupaten</label>
                <Input name="regionName" required placeholder="Contoh: Banjarnegara Utara" className="h-8 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Jenis Ancaman</label>
                <select name="hazardType" className="w-full h-8 border border-slate-300 rounded px-2 text-xs">
                  <option value="landslide">Tanah Longsor</option>
                  <option value="flood">Banjir</option>
                  <option value="earthquake">Gempabumi</option>
                  <option value="tsunami">Tsunami</option>
                  <option value="volcanic">Erupsi Gunung Api</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Klasifikasi Rute</label>
                <select name="routeType" className="w-full h-8 border border-slate-300 rounded px-2 text-xs">
                  <option value="primary">Rute Utama (Primary)</option>
                  <option value="alternative">Rute Alternatif</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 border rounded">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Titik Awal (Desa / Pemukiman)</label>
                <Input name="originName" required placeholder="Nama dusun asal" className="h-7 text-xs" />
                <div className="grid grid-cols-2 gap-1">
                  <Input name="originLatitude" type="number" step="any" placeholder="Latitude" defaultValue="-7.362" className="h-7 text-[10px]" />
                  <Input name="originLongitude" type="number" step="any" placeholder="Longitude" defaultValue="109.625" className="h-7 text-[10px]" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Titik Tujuan (Shelter / Gedung)</label>
                <Input name="destinationName" required placeholder="Nama shelter tujuan" className="h-7 text-xs" />
                <div className="grid grid-cols-2 gap-1">
                  <Input name="destinationLatitude" type="number" step="any" placeholder="Latitude" defaultValue="-7.34" className="h-7 text-[10px]" />
                  <Input name="destinationLongitude" type="number" step="any" placeholder="Longitude" defaultValue="109.66" className="h-7 text-[10px]" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Jarak (km)</label>
                <Input name="distanceKm" type="number" step="0.1" defaultValue="5.0" className="h-8 text-xs" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Waktu (menit)</label>
                <Input name="estimatedTimeMinutes" type="number" defaultValue="20" className="h-8 text-xs" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Kapasitas (jiwa)</label>
                <Input name="maxCapacityPersons" type="number" defaultValue="1000" className="h-8 text-xs" />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Deskripsi & Petunjuk Evakuasi</label>
              <Textarea name="publicDescription" placeholder="Petunjuk khusus bagi warga saat melewati jalur ini..." className="text-xs" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" name="isAccessible" className="rounded" />
              <span className="text-xs text-slate-700 font-medium">Akses Ramah Disabilitas & Lansia</span>
            </label>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} className="text-xs h-8">
                Batal
              </Button>
              <Button type="submit" disabled={createRouteMutation.isPending} className="text-xs h-8 bg-[#102A4C] hover:bg-[#183B63] text-white">
                Simpan Sebagai Draf Rute
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Record Field Inspection / Verification */}
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#102A4C]">Catat Hasil Verifikasi Fisik Lapangan</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Formulir verifikasi fisik kelayakan jalan, rambu penunjuk arah, dan kesiapan shelter oleh petugas BPBD.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedRouteId) return;
              const fd = new FormData(e.currentTarget);
              try {
                await createVerificationMutation.mutateAsync({
                  routeId: selectedRouteId,
                  data: {
                    inspectorName: (fd.get('inspectorName') as string) || user?.name || 'Petugas TRC BPBD',
                    overallCondition: fd.get('overallCondition') as any,
                    roadAccessible: fd.get('roadAccessible') === 'on',
                    signageAdequate: fd.get('signageAdequate') === 'on',
                    shelterReady: fd.get('shelterReady') === 'on',
                    lightingAvailable: fd.get('lightingAvailable') === 'on',
                    drainageAdequate: fd.get('drainageAdequate') === 'on',
                    findings: fd.get('findings') as string,
                    recommendations: fd.get('recommendations') as string,
                    geotagPhotos: [
                      {
                        url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
                        latitude: activeRoute?.originLatitude || -7.35,
                        longitude: activeRoute?.originLongitude || 109.65,
                        caption: 'Dokumentasi kondisi permukaan jalan dan rambu evakuasi',
                      },
                    ],
                  },
                });
                setShowVerifyModal(false);
                setStatusMessage({ text: 'Verifikasi lapangan berhasil dicatat.', type: 'success' });
                routeDetailQuery.refetch();
              } catch (err: any) {
                alert(err.message || 'Gagal menyimpan hasil verifikasi');
              }
            }}
            className="space-y-3 py-2 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nama Petugas Pemeriksa</label>
              <Input name="inspectorName" defaultValue={user?.name || 'Tim Reaksi Cepat BPBD'} required className="h-8 text-xs" />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Kondisi Fisik Keseluruhan</label>
              <select name="overallCondition" className="w-full h-8 border border-slate-300 rounded px-2 text-xs">
                <option value="good">Baik / Layak Penuh</option>
                <option value="fair">Cukup / Ada Bagian Waspada</option>
                <option value="poor">Buruk / Butuh Perbaikan</option>
                <option value="damaged">Rusak Berat</option>
              </select>
            </div>

            <div className="space-y-1.5 p-2.5 bg-slate-50 border rounded text-xs">
              <span className="font-bold text-slate-700 block mb-1">Daftar Uji Kelayakan:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="roadAccessible" defaultChecked className="rounded" />
                <span>Badan jalan bebas longsoran / pohon tumbang</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="signageAdequate" defaultChecked className="rounded" />
                <span>Rambu evakuasi fluorescent terpasang jelas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="shelterReady" defaultChecked className="rounded" />
                <span>Fasilitas shelter tujuan siap menampung pengungsi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="lightingAvailable" className="rounded" />
                <span>Penerangan jalan / lampu surya darurat memadai</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="drainageAdequate" className="rounded" />
                <span>Saluran drainase samping jalan lancar</span>
              </label>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Temuan Lapangan</label>
              <Textarea name="findings" required placeholder="Catatan hasil inspeksi menyeluruh..." className="text-xs" />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Rekomendasi Perbaikan Teknis</label>
              <Input name="recommendations" placeholder="Tindakan yang perlu diselesaikan..." className="h-8 text-xs" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowVerifyModal(false)} className="text-xs h-8">
                Batal
              </Button>
              <Button type="submit" disabled={createVerificationMutation.isPending} className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800 text-white">
                Simpan & Validasi Hasil Verifikasi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Create Road Segment */}
      <Dialog open={showSegmentModal} onOpenChange={setShowSegmentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#102A4C]">Tambah Segmen Ruas Jalan</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Petakan ruas-ruas spesifik sepanjang jalur evakuasi untuk memantau titik rawan atau terputus.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedRouteId) return;
              const fd = new FormData(e.currentTarget);
              try {
                await createSegmentMutation.mutateAsync({
                  routeId: selectedRouteId,
                  data: {
                    name: fd.get('name') as string,
                    startLatitude: Number(fd.get('startLatitude')),
                    startLongitude: Number(fd.get('startLongitude')),
                    endLatitude: Number(fd.get('endLatitude')),
                    endLongitude: Number(fd.get('endLongitude')),
                    distanceKm: Number(fd.get('distanceKm') || 1.0),
                    roadCondition: fd.get('roadCondition') as any,
                    isBlocked: fd.get('isBlocked') === 'on',
                    blockageReason: fd.get('blockageReason') as string,
                    hazardNotes: fd.get('hazardNotes') as string,
                  },
                });
                setShowSegmentModal(false);
                routeDetailQuery.refetch();
              } catch (err: any) {
                alert(err.message || 'Gagal menambahkan segmen');
              }
            }}
            className="space-y-3 py-2 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nama Ruas Jalan</label>
              <Input name="name" required placeholder="Contoh: Ruas Jembatan Kali Blimbing" className="h-8 text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Kondisi Jalan</label>
                <select name="roadCondition" className="w-full h-8 border border-slate-300 rounded px-2 text-xs">
                  <option value="good">Baik</option>
                  <option value="fair">Cukup</option>
                  <option value="damaged">Rusak Berat</option>
                  <option value="impassable">Terputus Total</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Panjang (km)</label>
                <Input name="distanceKm" type="number" step="0.1" defaultValue="1.5" className="h-8 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Start Point Lat/Lng</label>
                <div className="grid grid-cols-2 gap-1">
                  <Input name="startLatitude" defaultValue={activeRoute?.originLatitude || -7.35} className="h-7 text-[10px]" />
                  <Input name="startLongitude" defaultValue={activeRoute?.originLongitude || 109.65} className="h-7 text-[10px]" />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">End Point Lat/Lng</label>
                <div className="grid grid-cols-2 gap-1">
                  <Input name="endLatitude" defaultValue={activeRoute?.destinationLatitude || -7.34} className="h-7 text-[10px]" />
                  <Input name="endLongitude" defaultValue={activeRoute?.destinationLongitude || 109.66} className="h-7 text-[10px]" />
                </div>
              </div>
            </div>

            <div className="p-2 bg-red-50 border border-red-200 rounded space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-red-900 font-bold">
                <input type="checkbox" name="isBlocked" className="rounded" />
                <span>Tandai Sebagai Segmen Terputus / Tak Dapat Dilalui</span>
              </label>
              <Input name="blockageReason" placeholder="Penyebab hambatan (misal: jembatan runtuh, amblas 40cm)" className="h-7 text-xs bg-white" />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Catatan Kerawanan Khusus</label>
              <Input name="hazardNotes" placeholder="Misal: tikungan tajam, tebing curam di sisi kiri" className="h-8 text-xs" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSegmentModal(false)} className="text-xs h-8">
                Batal
              </Button>
              <Button type="submit" disabled={createSegmentMutation.isPending} className="text-xs h-8 bg-[#102A4C] hover:bg-[#183B63] text-white">
                Simpan Segmen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Create Disaster Scenario */}
      <Dialog open={showScenarioModal} onOpenChange={setShowScenarioModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#102A4C]">Buat Skenario Simulasi Baru</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Simulasi dampak bencana hipotesis untuk membandingkan strategi evakuasi dan mendeteksi defisit shelter.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await createScenarioMutation.mutateAsync({
                  data: {
                    name: fd.get('name') as string,
                    description: fd.get('description') as string,
                    hazardType: fd.get('hazardType') as any,
                    regionName: fd.get('regionName') as string,
                    candidateRoutes: [
                      {
                        name: 'Rute Alternatif Skenario A',
                        score: 82.5,
                        travelTime: 25,
                        hazardExposure: 'low',
                        notes: 'Rute prioritas hasil kalkulasi jaringan jalan',
                      },
                    ],
                    recommendation: fd.get('recommendation') as string,
                  },
                });
                setShowScenarioModal(false);
                scenariosQuery.refetch();
                setStatusMessage({ text: 'Skenario simulasi berhasil dibuat.', type: 'success' });
              } catch (err: any) {
                alert(err.message || 'Gagal membuat skenario');
              }
            }}
            className="space-y-3 py-2 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">Judul Skenario Simulasi</label>
              <Input name="name" required placeholder="Contoh: Simulasi Gempa Sesar Opak Magnitudo 7.2" className="h-8 text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Jenis Ancaman</label>
                <select name="hazardType" className="w-full h-8 border border-slate-300 rounded px-2 text-xs">
                  <option value="earthquake">Gempabumi</option>
                  <option value="landslide">Tanah Longsor</option>
                  <option value="flood">Banjir</option>
                  <option value="tsunami">Tsunami</option>
                  <option value="volcanic">Erupsi Gunung Api</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Wilayah Terdampak</label>
                <Input name="regionName" required placeholder="Contoh: Bantul Selatan" className="h-8 text-xs" />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Deskripsi Kondisi Hipotetis</label>
              <Textarea name="description" placeholder="Parameter skenario (misal: jembatan terputus, cuaca hujan badai)..." className="text-xs" />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Rekomendasi Rute Evakuasi Awal</label>
              <Input name="recommendation" placeholder="Instruksi pengalihan alur darurat..." className="h-8 text-xs" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowScenarioModal(false)} className="text-xs h-8">
                Batal
              </Button>
              <Button type="submit" disabled={createScenarioMutation.isPending} className="text-xs h-8 bg-[#102A4C] hover:bg-[#183B63] text-white">
                Simpan Skenario Simulasi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EvacuationManagement() {
  return (
    <ErrorBoundary fallbackTitle="Manajemen Rute Evakuasi Sementara Mengalami Kendala">
      <EvacuationManagementContent />
    </ErrorBoundary>
  );
}

