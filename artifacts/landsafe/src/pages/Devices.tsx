import React from 'react';
import { useLocation } from 'wouter';
import { useGetDevices } from '@workspace/api-client-react';
import { Cpu, Battery, Wifi, Activity, Clock, Settings2 } from 'lucide-react';

export default function Devices() {
  const { data: devices, isLoading } = useGetDevices();
  const [, navigate] = useLocation();

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading device registry...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.isArray(devices) && devices.map(device => (
          <div key={device.id} className="bg-card border border-border rounded-xl p-4 flex flex-col hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center border border-border shrink-0">
                  <Cpu className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold tracking-wider">{device.deviceId}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-1">{device.locationName}</p>
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                device.status === 'online' ? 'bg-success shadow-[0_0_8px_var(--color-success)]' :
                device.status === 'offline' ? 'bg-destructive' : 'bg-warning'
              }`} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 flex-1">
              <div className="bg-background border border-border rounded-md p-2 flex flex-col justify-between">
                <div className="flex items-center gap-1 mb-1 text-muted-foreground">
                  <Battery className="w-3 h-3" />
                  <span className="text-[10px] uppercase">Power</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${device.batteryLevel > 20 ? 'bg-success' : 'bg-destructive'}`} style={{ width: `${device.batteryLevel}%` }} />
                  </div>
                  <span className="text-xs font-mono">{device.batteryLevel}%</span>
                </div>
              </div>

              <div className="bg-background border border-border rounded-md p-2 flex flex-col justify-between">
                <div className="flex items-center gap-1 mb-1 text-muted-foreground">
                  <Wifi className="w-3 h-3" />
                  <span className="text-[10px] uppercase">Signal</span>
                </div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(bars => (
                    <div key={bars} className={`w-1 flex-1 rounded-sm ${bars * 20 <= device.signalStrength ? 'bg-info' : 'bg-secondary'}`} style={{ height: `${bars * 20}%` }} />
                  ))}
                  <span className="text-xs font-mono ml-1">{device.signalStrength}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono">{new Date(device.lastCommunication).toLocaleTimeString()}</span>
              </div>
              <button onClick={() => navigate("/sensor-analytics")} aria-label="Lihat kondisi sensor" title="Lihat kondisi sensor" className="min-h-11 min-w-11 p-2 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
