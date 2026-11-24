import React, { useState } from 'react';
import { useGetAlerts, useUpdateAlert, Alert as AlertType } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, CheckCircle2, CheckSquare } from 'lucide-react';
import { getGetAlertsQueryKey } from '@workspace/api-client-react';
import { useAuth } from '../contexts/AuthContext';

export default function Alerts() {
  const [filter, setFilter] = useState('active');
  const { data: alerts, isLoading } = useGetAlerts({ limit: 100 });
  const updateAlert = useUpdateAlert();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Anonymous visitors and the public role get a read-only alert feed.
  const canManage = user?.role === 'operator' || user?.role === 'admin';

  const alertList = Array.isArray(alerts) ? alerts : [];
  const filteredAlerts = alertList.filter(a => {
    if (filter === 'all') return true;
    if (['active', 'acknowledged', 'resolved'].includes(filter)) return a.status === filter;
    if (['critical', 'high', 'medium', 'low'].includes(filter)) return a.priority === filter;
    return true;
  });

  const handleAction = (id: number, status: 'acknowledged' | 'resolved') => {
    updateAlert.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey({ limit: 100 }) });
        }
      }
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'high': return 'bg-warning/20 text-warning border-warning/30';
      case 'medium': return 'bg-info/20 text-info border-info/30';
      default: return 'bg-secondary text-foreground border-border';
    }
  };

  const filters = ['all', 'active', 'acknowledged', 'resolved', 'critical', 'high'];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex bg-card border border-border rounded-lg p-1 overflow-x-auto shrink-0 scrollbar-hide max-w-full">
          {filters.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="text-xs font-mono text-muted-foreground flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" /> Live Updating
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-xs sm:text-sm text-muted-foreground">Memuat peringatan...</div>
        ) : filteredAlerts && filteredAlerts.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-colors hover:bg-secondary/20 ${alert.status === 'active' && alert.priority === 'critical' ? 'bg-destructive/5' : ''}`}>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    alert.priority === 'critical' ? 'bg-destructive/20 text-destructive' :
                    alert.priority === 'high' ? 'bg-warning/20 text-warning' :
                    'bg-info/20 text-info'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${getPriorityColor(alert.priority)}`}>
                        {alert.priority}
                      </span>
                      <span className="font-semibold text-xs sm:text-sm text-foreground">{alert.locationName || 'System'}</span>
                      <span className="text-[11px] text-muted-foreground font-mono">{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">{alert.message}</p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="uppercase font-mono text-[10px] sm:text-xs tracking-wider">{alert.alertType.replace('_', ' ')}</span>
                      <span>•</span>
                      <span className={
                        alert.status === 'active' ? 'text-destructive font-semibold' :
                        alert.status === 'acknowledged' ? 'text-warning font-semibold' : 'text-success font-semibold'
                      }>{alert.status.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0 border-t border-border pt-3 sm:border-0 sm:pt-0 w-full sm:w-auto">
                  {!canManage && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground self-center">
                      Mode baca
                    </span>
                  )}
                  {canManage && alert.status === 'active' && (
                    <button 
                      type="button"
                      onClick={() => handleAction(alert.id, 'acknowledged')}
                      className="min-h-[38px] px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors flex-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5" /> Konfirmasi
                    </button>
                  )}
                  {canManage && alert.status !== 'resolved' && (
                    <button 
                      type="button"
                      onClick={() => handleAction(alert.id, 'resolved')}
                      className="min-h-[38px] px-3 py-1.5 rounded-md bg-success/20 hover:bg-success/30 text-success border border-success/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors flex-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Selesaikan
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center text-muted-foreground">
            <Bell className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-xs sm:text-sm">Tidak ada peringatan yang cocok dengan filter saat ini.</p>
          </div>
        )}
      </div>
    </div>
  );
}
