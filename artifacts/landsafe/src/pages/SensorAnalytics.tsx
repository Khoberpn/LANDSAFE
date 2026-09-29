import { useEffect, useMemo, useState } from 'react';
import {
  useGetLocations, useGetSensors, useGetSensorReadings,
  getGetSensorsQueryKey, getGetSensorReadingsQueryKey,
} from '@workspace/api-client-react';
import { Activity, MapPin, Wifi, Battery, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const metrics = [
  { key: 'rainfall', label: 'Curah hujan', unit: 'mm', base: 8, swing: 6 },
  { key: 'soilMoisture', label: 'Kelembapan tanah', unit: '%', base: 62, swing: 10 },
  { key: 'tiltAngle', label: 'Kemiringan tanah', unit: 'derajat', base: 0.35, swing: 0.08 },
  { key: 'temperature', label: 'Suhu', unit: 'C', base: 28, swing: 3 },
  { key: 'humidity', label: 'Kelembapan udara', unit: '%', base: 74, swing: 9 },
  { key: 'batteryVoltage', label: 'Tegangan baterai', unit: 'V', base: 12.3, swing: 0.3 },
  { key: 'signalQuality', label: 'Kualitas sinyal', unit: '%', base: 79, swing: 12 },
] as const;
type MetricKey = (typeof metrics)[number]['key'];
type ChartPoint = { time: string; value: number };

function samplePoints(metric: MetricKey, hours: number, sensorId: number | null): ChartPoint[] {
  const config = metrics.find(item => item.key === metric)!;
  const count = hours === 1 ? 12 : hours === 6 ? 24 : hours === 24 ? 48 : 42;
  const phase = (sensorId ?? 1) * 0.37;
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(index * 0.43 + phase) * 0.7 + Math.sin(index * 0.17 + phase * 2) * 0.3;
    const value = Math.max(0, config.base + config.swing * wave);
    const timestamp = new Date(now - (count - index - 1) * hours * 3600000 / count);
    return {
      time: timestamp.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      value: Number(value.toFixed(metric === 'tiltAngle' ? 3 : 1)),
    };
  });
}

export default function SensorAnalytics() {
  const { data: locations } = useGetLocations();
  const [locationId, setLocationId] = useState<number | null>(null);
  const [sensorId, setSensorId] = useState<number | null>(null);
  const [metric, setMetric] = useState<MetricKey>('rainfall');
  const [hours, setHours] = useState(24);
  const [demoMode, setDemoMode] = useState(true);
  const { data: sensors, isLoading: sensorsLoading, isError: sensorsError } = useGetSensors(
    { locationId: locationId ?? undefined },
    { query: { queryKey: getGetSensorsQueryKey({ locationId: locationId ?? undefined }), refetchInterval: 30000 } }
  );
  const from = useMemo(() => new Date(Date.now() - hours * 3600000).toISOString(), [hours]);
  const { data: readings, isLoading: readingsLoading, isError: readingsError } = useGetSensorReadings(
    sensorId ?? 0, { from },
    { query: {
      queryKey: getGetSensorReadingsQueryKey(sensorId ?? 0, { from }),
      enabled: sensorId !== null && !demoMode,
      refetchInterval: 30000,
    } }
  );

  useEffect(() => {
    if (locations?.length && locationId === null) setLocationId(locations[0].id);
  }, [locations, locationId]);
  useEffect(() => {
    if (!sensors?.some(sensor => sensor.id === sensorId)) setSensorId(sensors?.[0]?.id ?? null);
  }, [sensors, sensorId]);

  const selected = sensors?.find(sensor => sensor.id === sensorId);
  const config = metrics.find(item => item.key === metric)!;
  const demoPoints = useMemo(() => samplePoints(metric, hours, sensorId), [metric, hours, sensorId]);
  const realPoints = useMemo(() => [...(readings ?? [])].reverse()
    .filter(row => row[metric] !== null && row[metric] !== undefined)
    .map(row => ({
      time: new Date(row.timestamp).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      value: row[metric] as number,
    })), [readings, metric]);
  const points = demoMode ? demoPoints : realPoints;
  const latest = points.at(-1)?.value;
  const minimum = points.length ? Math.min(...points.map(point => point.value)) : null;
  const maximum = points.length ? Math.max(...points.map(point => point.value)) : null;
  const ageMinutes = selected?.lastSeen ? Math.round((Date.now() - new Date(selected.lastSeen).getTime()) / 60000) : null;
  const condition = !selected ? 'Belum dipilih'
    : selected.status === 'maintenance' ? 'Pemeliharaan'
    : selected.status === 'calibration' ? 'Kalibrasi'
    : ageMinutes === null ? 'Belum ada komunikasi'
    : ageMinutes > 15 ? 'Tidak ada komunikasi terbaru'
    : selected.batteryLevel <= 20 ? 'Baterai rendah'
    : selected.signalStrength <= 20 ? 'Sinyal lemah'
    : 'Aktif';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
        Kontrol daya fisik ESP32 belum tersedia. Kondisi sensor berasal dari API; grafik pada mode Data contoh adalah simulasi dan tidak tersimpan sebagai pengukuran.
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="rounded-xl border border-border bg-card p-4 text-sm">
          <span className="mb-2 flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4" /> Lokasi</span>
          <select value={locationId ?? ''} onChange={event => { setLocationId(Number(event.target.value)); setSensorId(null); }} className="min-h-11 w-full rounded-md border border-border bg-background px-3">
            {locations?.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
        </label>
        <label className="rounded-xl border border-border bg-card p-4 text-sm">
          <span className="mb-2 flex items-center gap-2 font-semibold"><Activity className="h-4 w-4" /> Sensor</span>
          <select value={sensorId ?? ''} onChange={event => setSensorId(Number(event.target.value))} disabled={!sensors?.length} className="min-h-11 w-full rounded-md border border-border bg-background px-3">
            {sensors?.map(sensor => <option key={sensor.id} value={sensor.id}>{sensor.sensorCode} / {sensor.sensorType.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <span className="font-semibold">Kondisi sensor dari API</span>
          <p className="mt-2 text-lg font-semibold">{condition}</p>
          <p className="text-muted-foreground">Status tercatat: {selected?.status ?? '-'}</p>
        </div>
      </div>
      {sensorsLoading && <p role="status">Memuat sensor...</p>}
      {sensorsError && <p role="alert" className="text-destructive">Gagal memuat daftar sensor.</p>}
      {sensors && sensors.length === 0 && <p>Tidak ada sensor di lokasi ini.</p>}
      {selected && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Komunikasi terakhir</span><strong className="mt-2 block">{selected.lastSeen ? new Date(selected.lastSeen).toLocaleString('id-ID') : 'Belum ada'}</strong></div>
          <div className="rounded-xl border border-border bg-card p-4"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Battery className="h-4 w-4" /> Baterai tercatat</span><strong className="mt-2 block">{selected.batteryLevel}%</strong></div>
          <div className="rounded-xl border border-border bg-card p-4"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Wifi className="h-4 w-4" /> Sinyal</span><strong className="mt-2 block">{selected.signalStrength}%</strong></div>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Grafik pengukuran</h2>
            <p className="text-sm text-muted-foreground">{demoMode ? 'Data contoh deterministik untuk pratinjau.' : 'Pembacaan asli dari API LANDSAFE.'}</p>
          </div>
          <div className="flex rounded-lg border border-border p-1" role="group" aria-label="Sumber data grafik">
            <button type="button" onClick={() => setDemoMode(true)} aria-pressed={demoMode} className={'min-h-11 rounded-md px-4 text-sm ' + (demoMode ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}>Data contoh</button>
            <button type="button" onClick={() => setDemoMode(false)} aria-pressed={!demoMode} className={'min-h-11 rounded-md px-4 text-sm ' + (!demoMode ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}>Data asli</button>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">Pengukuran
            <select value={metric} onChange={event => setMetric(event.target.value as MetricKey)} className="mt-1 block min-h-11 rounded-md border border-border bg-background px-3">
              {metrics.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-sm">Rentang
            <select value={hours} onChange={event => setHours(Number(event.target.value))} className="mt-1 block min-h-11 rounded-md border border-border bg-background px-3">
              <option value={1}>1 jam</option><option value={6}>6 jam</option><option value={24}>24 jam</option><option value={168}>7 hari</option>
            </select>
          </label>
          {demoMode && <span className="rounded-full bg-warning/15 px-3 py-2 text-xs font-semibold text-warning">SIMULASI / BUKAN DATA SENSOR</span>}
        </div>
        {demoMode || (!readingsLoading && !readingsError) ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-background p-3 text-sm">Terbaru <strong className="block text-lg">{latest ?? '-'} {latest === undefined ? '' : config.unit}</strong></div>
            <div className="rounded-lg bg-background p-3 text-sm">Minimum <strong className="block text-lg">{minimum ?? '-'} {minimum === null ? '' : config.unit}</strong></div>
            <div className="rounded-lg bg-background p-3 text-sm">Maksimum <strong className="block text-lg">{maximum ?? '-'} {maximum === null ? '' : config.unit}</strong></div>
          </div>
        ) : null}
        {!demoMode && readingsLoading && <p role="status">Memuat pembacaan...</p>}
        {!demoMode && readingsError && <p role="alert" className="text-destructive">Gagal memuat pembacaan.</p>}
        {!demoMode && !readingsLoading && !readingsError && points.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Belum ada data {config.label.toLowerCase()} pada rentang ini.</p>}
        {points.length > 0 && <div className="h-80" aria-label={'Grafik ' + config.label + (demoMode ? ' data contoh' : ' data asli')}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Area type="monotone" dataKey="value" name={config.label} stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" /></AreaChart>
          </ResponsiveContainer>
        </div>}
      </div>
    </div>
  );
}
