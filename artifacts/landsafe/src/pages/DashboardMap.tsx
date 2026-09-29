import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { Location } from '@workspace/api-client-react';
import 'leaflet/dist/leaflet.css';

const CENTER: [number, number] = [-7.150975, 110.140259];
const COLORS: Record<string, string> = {
  danger: '#b91c1c',
  alert: '#c2410c',
  watch: '#ca8a04',
  normal: '#14532d',
};

function MapViewport({ locations }: { locations: Location[] }) {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      const valid = locations.filter(loc => Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude));
      if (valid.length > 0) {
        map.fitBounds(valid.map(loc => [loc.latitude, loc.longitude] as [number, number]), {
          padding: [28, 28],
          maxZoom: 10,
        });
      }
    }, 100);
    return () => window.clearTimeout(timer);
  }, [map, locations]);
  return null;
}

export default function DashboardMap({ locations }: { locations: Location[] }) {
  const [tileFailed, setTileFailed] = useState(false);
  const valid = locations.filter(loc => Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude));
  return (
    <div className="absolute inset-0">
      <MapContainer center={CENTER} zoom={8} zoomControl={false} scrollWheelZoom={false} className="h-full w-full" style={{ background: '#e8efe8' }}>
        <MapViewport locations={valid} />
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTileFailed(true), tileload: () => setTileFailed(false) }}
        />
        {valid.map(loc => (
          <CircleMarker
            key={loc.id}
            center={[loc.latitude, loc.longitude]}
            radius={7}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: COLORS[loc.riskLevel] ?? COLORS.normal,
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <strong>{loc.name}</strong>
              <div>{loc.district}, {loc.province}</div>
              <div>Risiko: {loc.riskLevel}</div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {valid.length === 0 && (
        <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-lg bg-white/95 px-3 py-2 text-xs text-primary shadow">
          Belum ada koordinat lokasi.
        </div>
      )}
      {tileFailed && (
        <div className="pointer-events-none absolute left-4 bottom-8 z-[500] rounded-lg bg-white/95 px-3 py-2 text-xs text-primary shadow">
          Layer peta belum termuat. Periksa koneksi internet.
        </div>
      )}
    </div>
  );
}
