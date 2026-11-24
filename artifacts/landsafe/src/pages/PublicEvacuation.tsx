import React, { useState, useMemo } from 'react';
import {
  useGetPublicEvacuationRoutes,
  useGetPublicEvacuationRoute,
  useGetPublicEvacuationFacilities,
  useGetPublicGuidelines,
} from '@workspace/api-client-react';
import type { PublicEvacuationRoute, PublicFacility, PublicGuideline } from '@workspace/api-client-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ShieldCheck,
  MapPin,
  Route,
  Navigation,
  Clock,
  ArrowRight,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  Building,
  HeartPulse,
  Flag,
  Accessibility,
  Eye,
  Compass,
  BookOpen,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
  Shield,
  HelpCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import {
  HAZARD_LABELS,
  hazardLabel,
  hazardExposureMeta,
  routeTypeMeta,
  roadConditionMeta,
  formatDate,
  formatNumber,
} from '@/lib/risk-ui';

// Center of Central Java
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
      console.warn('MapController bounds handling warning:', err);
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

function PublicEvacuationContent() {
  const [selectedHazard, setSelectedHazard] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [showGuidelinesDialog, setShowGuidelinesDialog] = useState<boolean>(false);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showShelters, setShowShelters] = useState<boolean>(true);
  const [showHazardsOverlay, setShowHazardsOverlay] = useState<boolean>(true);
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');

  // Queries for public data
  const routesQuery = useGetPublicEvacuationRoutes(
    {
      regionName: selectedRegion !== 'all' ? selectedRegion : undefined,
      hazardType: selectedHazard !== 'all' ? selectedHazard : undefined,
    },
    { query: { queryKey: ['public-evacuation-routes', selectedRegion, selectedHazard] } }
  );

  const routeDetailQuery = useGetPublicEvacuationRoute(
    selectedRouteId ?? 0,
    { query: { enabled: !!selectedRouteId, queryKey: ['public-route-detail', selectedRouteId] } }
  );

  const facilitiesQuery = useGetPublicEvacuationFacilities({ query: { queryKey: ['public-facilities'] } });
  const guidelinesQuery = useGetPublicGuidelines({ query: { queryKey: ['public-guidelines'] } });

  const routes: PublicEvacuationRoute[] = Array.isArray(routesQuery.data) ? routesQuery.data : [];
  const facilities: PublicFacility[] = Array.isArray(facilitiesQuery.data) ? facilitiesQuery.data : [];
  const guidelines: PublicGuideline[] = Array.isArray(guidelinesQuery.data) ? guidelinesQuery.data : [];
  const activeDetail = routeDetailQuery.data;

  // Extract unique regions
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    routes.forEach((r) => r.regionName && set.add(r.regionName));
    facilities.forEach((f) => f.regionName && set.add(f.regionName));
    return Array.from(set).sort();
  }, [routes, facilities]);

  // Filter routes by search query
  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      const matchesSearch =
        searchQuery === '' ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.originName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.destinationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.regionName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [routes, searchQuery]);

  // Selected route or first route
  const activeRoute = useMemo(() => {
    if (selectedRouteId) {
      return routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;
    }
    return routes[0] ?? null;
  }, [selectedRouteId, routes]);

  // Filter facilities with valid coordinates
  const validFacilities = useMemo(() => {
    return facilities.filter((f) => f && isValidCoordinate(f.latitude, f.longitude));
  }, [facilities]);

  // Compute map bounds or center safely
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

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] -m-3 sm:-m-4 md:-m-6 overflow-hidden bg-[#F4F7FB]">
      {/* Top Banner / Public Notice */}
      <div className="bg-[#102A4C] text-white px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#183B63] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#2563EB]/30 ring-1 ring-[#2563EB]/50">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-wide uppercase flex items-center gap-2">
              <span>Portal Jalur Evakuasi Publik LANDSAFE</span>
              <span className="text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                Resmi & Terverifikasi BPBD
              </span>
            </div>
            <div className="text-[11px] text-white/70">
              Menampilkan rute evakuasi resmi yang telah disahkan oleh Badan Penanggulangan Bencana Daerah.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowGuidelinesDialog(true)}
            className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5"
          >
            <BookOpen className="h-3.5 w-3.5 text-blue-300" />
            <span>Panduan Kesiapsiagaan Bencana</span>
          </Button>
        </div>
      </div>

            {/* Mobile Tab Switcher */}
      <div className="flex md:hidden border-b border-[#DCE4EF] bg-white p-1 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'list'
              ? 'bg-[#102A4C] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Route className="h-3.5 w-3.5" />
          <span>Daftar Rute ({filteredRoutes.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'map'
              ? 'bg-[#102A4C] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Peta Jalur Aman</span>
        </button>
      </div>

      {/* Main Split Layout: Left Controls/List (420px), Right Interactive Full-Width Map */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side Panel: Search, Filters, and Verified Routes Cards */}
        <div className={`w-full md:w-[440px] flex-col bg-white border-r border-[#DCE4EF] z-10 shrink-0 shadow-md ${mobileTab === 'list' ? 'flex flex-1 md:flex-initial' : 'hidden md:flex'}`}>
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-[#DCE4EF] bg-slate-50/70 space-y-3 shrink-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari desa asal, tujuan, atau wilayah..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs bg-white border-[#DCE4EF] focus-visible:ring-[#102A4C]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Region & Disaster Filter Dropdowns */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Wilayah / Daerah
                </label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full h-8 text-xs bg-white border border-[#DCE4EF] rounded-md px-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#102A4C]"
                >
                  <option value="all">Semua Wilayah</option>
                  {availableRegions.map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Jenis Ancaman Bencana
                </label>
                <select
                  value={selectedHazard}
                  onChange={(e) => setSelectedHazard(e.target.value)}
                  className="w-full h-8 text-xs bg-white border border-[#DCE4EF] rounded-md px-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#102A4C]"
                >
                  {HAZARD_OPTIONS.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active summary counts */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
              <span>
                Menemukan <strong className="text-slate-900">{filteredRoutes.length}</strong> rute terverifikasi
              </span>
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-3 w-3" /> Status Sah BPBD
              </span>
            </div>
          </div>

          {/* Route Cards Scrollable Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-100">
            {routesQuery.isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Memuat rute evakuasi resmi...</div>
            ) : filteredRoutes.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Route className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold text-slate-700">Tidak ada rute sesuai filter</div>
                <div className="text-xs text-slate-400 max-w-[260px] mx-auto">
                  Coba ubah pilihan wilayah atau ancaman bencana pada filter di atas.
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedHazard('all');
                    setSelectedRegion('all');
                    setSearchQuery('');
                  }}
                  className="text-xs h-7 mt-2"
                >
                  Reset Filter
                </Button>
              </div>
            ) : (
              filteredRoutes.map((route) => {
                const isSelected = route.id === selectedRouteId || (!selectedRouteId && route.id === filteredRoutes[0]?.id);
                const exposureMeta = hazardExposureMeta(route.hazardExposure);
                const typeMeta = routeTypeMeta(route.routeType);

                return (
                  <div
                    key={route.id}
                    onClick={() => { setSelectedRouteId(route.id); setMobileTab('map'); }}
                    className={`pt-2.5 first:pt-0 cursor-pointer rounded-lg p-3 transition-all border ${
                      isSelected
                        ? 'bg-blue-50/60 border-[#2563EB] shadow-sm ring-1 ring-[#2563EB]/20'
                        : 'bg-white border-[#DCE4EF] hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Header: Code & Type */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {route.routeCode}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            route.routeType === 'primary'
                              ? 'bg-[#102A4C] text-white'
                              : 'bg-purple-100 text-purple-800 border border-purple-300'
                          }`}
                        >
                          {route.routeType === 'primary' ? 'â˜… Rute Utama' : 'Rute Alternatif'}
                        </span>
                        <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          Terbit v{route.version}
                        </span>
                      </div>
                    </div>

                    {/* Route Title */}
                    <h3 className="text-xs font-bold text-slate-900 leading-snug mb-1">
                      {route.name}
                    </h3>

                    {/* Origin -> Destination Line */}
                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mb-2">
                      <span className="truncate max-w-[140px] font-medium text-slate-800" title={route.originName}>
                        {route.originName}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px] font-bold text-[#102A4C]" title={route.destinationName}>
                        {route.destinationName}
                      </span>
                    </div>

                    {/* Quick Specs: Distance, Time, Hazard */}
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-100/70 p-2 rounded text-[11px] font-medium text-slate-700 mb-2">
                      <div>
                        <span className="text-[9px] uppercase text-slate-400 block font-bold">Jarak</span>
                        <span>{route.distanceKm} km</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-slate-400 block font-bold">Estimasi</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {route.estimatedTimeMinutes} mnt
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-slate-400 block font-bold">Ancaman</span>
                        <span className="truncate block font-semibold text-slate-800">
                          {hazardLabel(route.hazardType)}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Accessibility & Verification note */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        {route.isAccessible ? (
                          <span className="text-emerald-700 flex items-center gap-1 font-medium">
                            <Accessibility className="h-3 w-3 text-emerald-600" /> Ramah Disabilitas/Lansia
                          </span>
                        ) : (
                          <span className="text-slate-400">Roda 4 / Siaga Khusus</span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {route.publishedAt ? formatDate(route.publishedAt) : 'Terverifikasi'}
                      </span>
                    </div>

                    {/* Public Description if selected */}
                    {isSelected && route.publicDescription && (
                      <div className="mt-2 text-[11px] text-slate-700 bg-white p-2 rounded border border-blue-200/60 leading-relaxed">
                        <strong className="text-blue-900 block mb-0.5">Petunjuk BPBD:</strong>
                        {route.publicDescription}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Security Assurance Note */}
          <div className="p-3 bg-slate-50 border-t border-[#DCE4EF] text-[10px] text-slate-500 shrink-0">
            <div className="flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Akses Publik Aman:</strong> Hanya rute resmi yang telah disahkan tim BPBD ditampilkan. Untuk instruksi kedaruratan, ikuti arahan petugas lapangan.
              </span>
            </div>
          </div>
        </div>

        {/* Right Map Canvas (Interactive Leaflet) */}
        <div className={`flex-1 h-full w-full relative ${mobileTab === 'map' ? 'flex' : 'hidden md:flex'}`}>{mobileTab === 'map' && (<button type="button" onClick={() => setMobileTab('list')} className="md:hidden absolute top-3 left-3 z-[400] flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-[#102A4C] shadow-md border border-slate-200 cursor-pointer"><span>&larr; Daftar Rute</span></button>)}
          <MapContainer
            center={mapCenter}
            zoom={11}
            zoomControl={false}
            className="w-full h-full isolate"
            style={{ background: '#E2E8F0' }}
          >
            <MapController center={mapCenter} bounds={mapBounds} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | LANDSAFE BPBD'
            />
            <ZoomControl position="bottomright" />

            {/* Render All Published Routes */}
            {filteredRoutes.map((route) => {
              const isSelected = activeRoute?.id === route.id;
              const isPrimary = route.routeType === 'primary';
              const coords = parseRouteGeometry(route.routeGeometry);
              if (coords.length < 2) return null;

              return (
                <React.Fragment key={route.id}>
                  {/* Route Polyline */}
                  <Polyline
                    positions={coords}
                    eventHandlers={{
                      click: () => setSelectedRouteId(route.id),
                    }}
                    pathOptions={{
                      color: isSelected
                        ? isPrimary
                          ? '#2563EB'
                          : '#7C3AED'
                        : isPrimary
                        ? '#102A4C'
                        : '#6B7280',
                      weight: isSelected ? 6 : 4,
                      opacity: isSelected ? 0.95 : 0.6,
                      dashArray: isPrimary ? undefined : '8, 8',
                    }}
                  >
                    <Tooltip sticky>
                      <div className="text-xs p-1">
                        <strong>{route.name}</strong> ({route.distanceKm} km, {route.estimatedTimeMinutes} mnt)
                      </div>
                    </Tooltip>
                  </Polyline>

                  {/* Origin Point Marker */}
                  {isValidCoordinate(route.originLatitude, route.originLongitude) && (
                    <CircleMarker
                      center={[route.originLatitude, route.originLongitude]}
                      radius={isSelected ? 7 : 5}
                      pathOptions={{
                        fillColor: '#F59E0B',
                        color: '#FFFFFF',
                        weight: 2,
                        fillOpacity: 1,
                      }}
                    >
                      <Popup>
                        <div className="text-xs p-1">
                          <strong className="text-amber-700 block">Titik Awal Evakuasi</strong>
                          <div>{route.originName}</div>
                          <div className="text-[10px] text-gray-500 mt-1">Rute: {route.routeCode}</div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )}

                  {/* Destination Shelter Marker */}
                  {isValidCoordinate(route.destinationLatitude, route.destinationLongitude) && (
                    <CircleMarker
                      center={[route.destinationLatitude, route.destinationLongitude]}
                      radius={isSelected ? 9 : 6}
                      pathOptions={{
                        fillColor: isPrimary ? '#2563EB' : '#7C3AED',
                        color: '#FFFFFF',
                        weight: 2,
                        fillOpacity: 1,
                      }}
                    >
                      <Popup>
                        <div className="text-xs p-1">
                          <strong className="text-blue-800 block">Tujuan Evakuasi Aman</strong>
                          <div>{route.destinationName}</div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            Jarak: {route.distanceKm} km Â· Waktu: {route.estimatedTimeMinutes} menit
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )}
                </React.Fragment>
              );
            })}

            {/* Approved Evacuation Facilities Layer */}
            {showShelters &&
              validFacilities.map((facility) => {
                const isShelter = facility.type === 'shelter';
                const isHospital = facility.type === 'hospital' || facility.type === 'health_center';
                const isAssembly = facility.type === 'assembly_point';

                const markerColor = isShelter
                  ? '#2563EB'
                  : isHospital
                  ? '#DC2626'
                  : isAssembly
                  ? '#059669'
                  : '#102A4C';

                return (
                  <CircleMarker
                    key={facility.id}
                    center={[facility.latitude, facility.longitude]}
                    radius={isShelter ? 7 : 6}
                    pathOptions={{
                      fillColor: markerColor,
                      color: '#FFFFFF',
                      weight: 2,
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>
                      <div className="p-1 min-w-[180px]">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white inline-block mb-1`}
                          style={{ backgroundColor: markerColor }}
                        >
                          {facility.type === 'shelter'
                            ? 'Shelter Pengungsian'
                            : facility.type === 'hospital'
                            ? 'Rumah Sakit Rujukan'
                            : facility.type === 'health_center'
                            ? 'Puskesmas Darurat'
                            : 'Titik Kumpul Warga'}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900">{facility.name}</h4>
                        <div className="text-[11px] text-slate-500 mb-1">{facility.address}</div>
                        <div className="text-[11px] font-medium text-slate-700">
                          Kapasitas Daya Tampung: <strong>{formatNumber(facility.capacity)} jiwa</strong>
                        </div>
                        {Array.isArray(facility.amenities) && facility.amenities.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {facility.amenities.map((am: string, i: number) => (
                              <span key={i} className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded">
                                {am}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 text-[10px] text-slate-400">
                          Instansi: {facility.operatingAgency || 'BPBD'}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
          </MapContainer>

          {/* Map Layer Overlays & Legend Box (Floating Top Right) */}
          <div className="absolute top-4 right-4 z-[400] space-y-2 pointer-events-auto">
            {/* Quick Map Controls Panel */}
            <div className="bg-white/95 backdrop-blur shadow-lg border border-[#DCE4EF] rounded-lg p-2.5 w-64 text-xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                  <Layers className="h-3.5 w-3.5 text-[#102A4C]" /> Lapisan Peta
                </span>
                <button
                  onClick={() => setShowLegend(!showLegend)}
                  className="text-[10px] text-blue-600 hover:underline"
                >
                  {showLegend ? 'Sembunyikan' : 'Buka Legenda'}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center justify-between cursor-pointer text-[11px] text-slate-700 hover:text-slate-900">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Shelter & Titik Kumpul
                  </span>
                  <input
                    type="checkbox"
                    checked={showShelters}
                    onChange={(e) => setShowShelters(e.target.checked)}
                    className="rounded border-slate-300 text-[#102A4C]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer text-[11px] text-slate-700 hover:text-slate-900">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> Fasilitas Medis / RS
                  </span>
                  <input
                    type="checkbox"
                    checked={showShelters}
                    onChange={(e) => setShowShelters(e.target.checked)}
                    className="rounded border-slate-300 text-[#102A4C]"
                  />
                </label>
              </div>

              {/* Collapsible Map Legend */}
              {showLegend && (
                <div className="pt-2 border-t border-slate-100 text-[10px] space-y-1 text-slate-600">
                  <div className="font-bold text-slate-700 mb-1 uppercase tracking-wider text-[9px]">Keterangan Simbol</div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-1 bg-[#2563EB] rounded" /> Rute Utama Resmi (Solid)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-1 border-b-2 border-dashed border-[#7C3AED]" /> Rute Alternatif (Putus-putus)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" /> Titik Kumpul Awal Dusun
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] border border-white" /> Shelter Gedung Evakuasi
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white" /> Rumah Sakit / Puskesmas
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Floating Active Route Detail Bar */}
          {activeRoute && (
            <div className="absolute bottom-4 left-4 right-16 z-[400] pointer-events-auto bg-white/95 backdrop-blur-md border border-[#DCE4EF] shadow-xl rounded-xl p-3.5 max-w-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={activeRoute.routeType === 'primary' ? 'default' : 'secondary'} className="text-[10px]">
                      {activeRoute.routeType === 'primary' ? 'Rute Utama Resmi' : 'Rute Alternatif'}
                    </Badge>
                    <span className="text-xs font-mono font-bold text-slate-600">{activeRoute.routeCode}</span>
                    <span className="text-xs text-slate-400">Â·</span>
                    <span className="text-xs text-slate-600 font-medium">Wilayah: {activeRoute.regionName}</span>
                    <span className="text-xs text-slate-400">Â·</span>
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Disahkan BPBD
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 truncate">{activeRoute.name}</h3>

                  <div className="flex items-center gap-4 text-xs text-slate-600 pt-0.5">
                    <span>
                      Jarak: <strong>{activeRoute.distanceKm} km</strong>
                    </span>
                    <span>
                      Waktu Tempuh: <strong>{activeRoute.estimatedTimeMinutes} menit</strong>
                    </span>
                    <span>
                      Kondisi Jalan:{' '}
                      <strong className="text-slate-800">
                        {activeRoute.roadSurface || 'Aspal terawat'}
                      </strong>
                    </span>
                    <span>
                      Aksesibilitas:{' '}
                      <strong className={activeRoute.isAccessible ? 'text-emerald-700' : 'text-slate-700'}>
                        {activeRoute.isAccessible ? 'Ramah Disabilitas' : 'Standard'}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="text-[10px] text-slate-400">
                    Disahkan: {activeRoute.publishedAt ? formatDate(activeRoute.publishedAt) : 'Terverifikasi'}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      // Fly to route
                      if (mapBounds) {
                        // Will trigger map effect
                      }
                    }}
                    className="h-8 text-xs bg-[#102A4C] hover:bg-[#183B63] text-white"
                  >
                    Fokus Rute
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Preparedness Guidelines Dialog Modal */}
      <Dialog open={showGuidelinesDialog} onOpenChange={setShowGuidelinesDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#102A4C]">
              <BookOpen className="h-5 w-5 text-[#2563EB]" />
              Panduan Kesiapsiagaan & Tindakan Evakuasi Mandiri
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Instruksi keselamatan resmi BNPB & BPBD bagi masyarakat saat menghadapi ancaman bencana.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {guidelines.map((guide) => (
              <Card key={guide.id} className="border-[#DCE4EF]">
                <CardHeader className="p-3.5 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-[#102A4C]">{guide.title}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      {guide.category}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{guide.summary}</div>
                </CardHeader>
                <CardContent className="p-3.5 space-y-2">
                  <div className="text-xs font-bold text-slate-700">Langkah Tanggap Darurat:</div>
                  <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5 leading-relaxed">
                    {Array.isArray(guide.steps) &&
                      guide.steps.map((step: string, i: number) => (
                        <li key={i} className="pl-1">
                          {step}
                        </li>
                      ))}
                  </ol>
                  <div className="mt-3 text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span>Sumber: {guide.source}</span>
                    {guide.sourceUrl && (
                      <a
                        href={guide.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Portal Resmi <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PublicEvacuation() {
  return (
    <ErrorBoundary fallbackTitle="Peta Rute Evakuasi Sementara Mengalami Kendala">
      <PublicEvacuationContent />
    </ErrorBoundary>
  );
}

