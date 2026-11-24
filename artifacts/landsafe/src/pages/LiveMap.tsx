import React, { useState, useEffect } from 'react';
import { useGetLocations, getGetLocationsQueryKey } from '@workspace/api-client-react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Filter, Layers, Box, X, ChevronDown, ChevronUp } from 'lucide-react';
import DigitalTwin from './DigitalTwin';

// Component to fix leaflet tile rendering issues on mount
function MapFix() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// Central Java rough center
const CENTER: [number, number] = [-7.150975, 110.140259];

const RISK_COLORS: Record<string, string> = {
  danger: '#b91c1c',
  alert: '#c2410c',
  watch: '#ca8a04',
  normal: '#14532d'
};

export default function LiveMap() {
  // Add polling interval for real-time updates (every 5 seconds)
  const { data: locations, isLoading } = useGetLocations({
    query: { 
      queryKey: getGetLocationsQueryKey(),
      refetchInterval: 5000 
    }
  });
  
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [active3D, setActive3D] = useState<number | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Default filter open on larger screens, collapsed on small screens
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsFilterOpen(true);
    }
  }, []);

  const locationList = Array.isArray(locations) ? locations : [];
  const filteredLocations = locationList.filter(loc => 
    !activeFilter || loc.riskLevel === activeFilter
  );

  return (
    <div className="h-[calc(100vh-8.5rem)] md:h-[calc(100vh-8rem)] rounded-xl border border-border overflow-hidden relative bg-card">
      <MapContainer 
        center={CENTER} 
        zoom={9} 
        zoomControl={false}
        className="w-full h-full bg-background isolate"
        style={{ background: '#f1f5f9' }}
      >
        <MapFix />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ZoomControl position="bottomright" />

        {filteredLocations.map(loc => (
          <CircleMarker
            key={loc.id}
            center={[loc.latitude, loc.longitude]}
            radius={8}
            pathOptions={{ 
              fillColor: RISK_COLORS[loc.riskLevel] || RISK_COLORS.normal, 
              color: RISK_COLORS[loc.riskLevel] || RISK_COLORS.normal,
              weight: 2,
              opacity: 0.8,
              fillOpacity: 0.5
            }}
          >
            <Popup className="custom-popup">
              <div className="p-1">
                <h3 className="font-semibold text-sm mb-1">{loc.name}</h3>
                <div className="text-xs text-gray-500 mb-2">{loc.district}, {loc.province}</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase text-white" style={{backgroundColor: RISK_COLORS[loc.riskLevel] || RISK_COLORS.normal}}>
                    {loc.riskLevel}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">Elev: {loc.elevation || 0}m</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-100 p-1.5 rounded">
                    <div className="text-gray-500 text-[10px] uppercase">Curah Hujan</div>
                    <div className="font-mono font-medium">{((loc as any).rainfall !== undefined ? (loc as any).rainfall : 12.8).toFixed(1)} mm</div>
                  </div>
                  <div className="bg-gray-100 p-1.5 rounded">
                    <div className="text-gray-500 text-[10px] uppercase">Kelembapan</div>
                    <div className="font-mono font-medium">{Math.round((loc as any).soilMoisture !== undefined ? (loc as any).soilMoisture : 68)}%</div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setActive3D(loc.id)}
                  className="w-full mt-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Box className="w-3.5 h-3.5" />
                  Lihat 3D Lapangan
                </button>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* 3D Modal Overlay */}
      {active3D && (
        <div className="absolute inset-0 z-[1000] bg-background/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 lg:p-12 animate-in fade-in zoom-in-95 duration-200">
           <div className="w-full h-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-primary/20">
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[1100]">
                 <button 
                   type="button"
                   onClick={() => setActive3D(null)} 
                   className="p-2 bg-destructive/10 text-destructive rounded-full hover:bg-destructive hover:text-white transition-colors"
                   title="Tutup Modal"
                   aria-label="Tutup pratinjau 3D"
                 >
                   <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="flex-1 overflow-hidden relative [&>div]:h-full [&>div]:border-none [&>div]:rounded-none">
                 <DigitalTwin />
              </div>
           </div>
        </div>
      )}

      {/* Overlays / Collapsible Filter Panel */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-[400] flex flex-col gap-2 max-w-[calc(100%-1.5rem)] sm:max-w-xs">
        <div className="bg-card/95 backdrop-blur border border-border rounded-lg shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="w-full flex items-center justify-between gap-2 p-2.5 text-left hover:bg-secondary/40 transition-colors"
            aria-expanded={isFilterOpen}
            aria-label="Toggle filter risiko"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Filter Risiko {activeFilter && `(${activeFilter})`}
              </span>
            </div>
            {isFilterOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>

          {isFilterOpen && (
            <div className="p-3 pt-1 border-t border-border flex flex-col gap-1.5 animate-in fade-in duration-150">
              <button 
                type="button"
                onClick={() => { setActiveFilter(null); }}
                className={`text-left px-3 py-1.5 rounded text-xs font-mono transition-colors ${!activeFilter ? 'bg-secondary text-foreground font-bold' : 'text-muted-foreground hover:bg-secondary/50'}`}
              >
                SEMUA LOKASI ({locationList.length})
              </button>
              {Object.entries(RISK_COLORS).map(([level, color]) => {
                const count = locationList.filter(l => l.riskLevel === level).length;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => { setActiveFilter(level); }}
                    className={`flex items-center justify-between px-3 py-1.5 rounded text-xs font-mono transition-colors ${activeFilter === level ? 'bg-secondary text-foreground font-bold' : 'text-muted-foreground hover:bg-secondary/50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="uppercase">{level}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-1.5 shadow-sm inline-flex items-center gap-2 self-start">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Topografi Aktif</span>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-[500] bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs sm:text-sm font-mono text-primary animate-pulse">ACQUIRING SATELLITE TELEMETRY...</span>
          </div>
        </div>
      )}
      
      {/* CSS for leaflet popup dark mode adjustment */}
      <style>{`
        .leaflet-popup-content-wrapper {
          background-color: hsl(var(--card));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
        }
        .leaflet-popup-tip {
          background-color: hsl(var(--card));
          border-top: 1px solid hsl(var(--border));
          border-left: 1px solid hsl(var(--border));
        }
        .custom-popup .bg-gray-100 {
          background-color: hsl(var(--background));
          border: 1px solid hsl(var(--border));
        }
        .custom-popup .text-gray-500 {
          color: hsl(var(--muted-foreground));
        }
        .leaflet-container {
          font-family: var(--font-sans);
        }
      `}</style>
    </div>
  );
}
