import React, { useState, useEffect } from 'react';
import { useGetLocations, getGetLocationsQueryKey } from '@workspace/api-client-react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Filter, Layers, Box, X } from 'lucide-react';
import DigitalTwin from './DigitalTwin';

// Component to fix leaflet tile rendering issues on mount
function MapFix() {
  const map = useMap();
  useEffect(() => {
    // Delay slightly to ensure container size is computed
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

  const locationList = Array.isArray(locations) ? locations : [];
  const filteredLocations = locationList.filter(loc => 
    !activeFilter || loc.riskLevel === activeFilter
  );

  return (
    <div className="h-[calc(100vh-8rem)] rounded-xl border border-border overflow-hidden relative bg-card">
      <MapContainer 
        center={CENTER} 
        zoom={9} 
        zoomControl={false}
        className="w-full h-full bg-background"
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
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase text-white`} style={{backgroundColor: RISK_COLORS[loc.riskLevel] || RISK_COLORS.normal}}>
                    {loc.riskLevel}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">Elev: {loc.elevation || 0}m</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-100 p-1.5 rounded">
                    <div className="text-gray-500 text-[10px] uppercase">Rainfall</div>
                    <div className="font-mono font-medium">{(Math.random() * 20).toFixed(1)} mm</div>
                  </div>
                  <div className="bg-gray-100 p-1.5 rounded">
                    <div className="text-gray-500 text-[10px] uppercase">Moisture</div>
                    <div className="font-mono font-medium">{Math.floor(Math.random() * 40 + 30)}%</div>
                  </div>
                </div>
                <button 
                  onClick={() => setActive3D(loc.id)}
                  className="w-full mt-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-1.5"
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
        <div className="absolute inset-0 z-[1000] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 lg:p-12 animate-in fade-in zoom-in-95 duration-200">
           <div className="w-full h-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-primary/20">
              <div className="absolute top-4 right-4 z-[1100]">
                 <button 
                   onClick={() => setActive3D(null)} 
                   className="p-2 bg-destructive/10 text-destructive rounded-full hover:bg-destructive hover:text-white transition-colors"
                   title="Tutup Modal"
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

      {/* Overlays */}
      <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2">
        <div className="bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Risk Filter</h3>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setActiveFilter(null)}
              className={`text-left px-3 py-1.5 rounded text-xs font-mono transition-colors ${!activeFilter ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
            >
              ALL LOCATIONS
            </button>
            {Object.entries(RISK_COLORS).map(([level, color]) => (
              <button
                key={level}
                onClick={() => setActiveFilter(level)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors ${activeFilter === level ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="uppercase">{level}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider">Topography</span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-[500] bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-mono text-primary animate-pulse">ACQUIRING SATELLITE TELEMETRY...</span>
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
