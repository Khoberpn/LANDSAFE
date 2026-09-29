import React, { useState } from 'react';
import { useGetAlerts, useUpdateAlert, Alert as AlertType } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Info, Bell, CheckCircle2, CheckSquare } from 'lucide-react';
import { getGetAlertsQueryKey } from '@workspace/api-client-react';

export default function Alerts() {
  const [filter, setFilter] = useState('active');
  const { data: alerts, isLoading } = useGetAlerts({ limit: 100 });
  const updateAlert = useUpdateAlert();
  const queryClient = useQueryClient();

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-card border border-border rounded-lg p-1 overflow-x-auto shrink-0">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
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

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading alerts...</div>
        ) : filteredAlerts && filteredAlerts.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-secondary/20 ${alert.status === 'active' && alert.priority === 'critical' ? 'bg-destructive/5' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    alert.priority === 'critical' ? 'bg-destructive/20 text-destructive' :
                    alert.priority === 'high' ? 'bg-warning/20 text-warning' :
                    'bg-info/20 text-info'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${getPriorityColor(alert.priority)}`}>
                        {alert.priority}
                      </span>
                      <span className="font-semibold text-sm">{alert.locationName || 'System'}</span>
                      <span className="text-xs text-muted-foreground font-mono">{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-foreground/90">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="uppercase font-mono tracking-wider">{alert.alertType.replace('_', ' ')}</span>
                      <span>•</span>
                      <span className={
                        alert.status === 'active' ? 'text-destructive font-medium' :
                        alert.status === 'acknowledged' ? 'text-warning font-medium' : 'text-success'
                      }>{alert.status.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0 border-t border-border pt-4 sm:border-0 sm:pt-0">
                  {alert.status === 'active' && (
                    <button 
                      onClick={() => handleAction(alert.id, 'acknowledged')}
                      className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium flex items-center justify-center gap-2 transition-colors flex-1"
                    >
                      <CheckSquare className="w-3 h-3" /> Acknowledge
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button 
                      onClick={() => handleAction(alert.id, 'resolved')}
                      className="px-3 py-1.5 rounded-md bg-success/20 hover:bg-success/30 text-success border border-success/30 text-xs font-medium flex items-center justify-center gap-2 transition-colors flex-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground">
            <Bell className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No alerts match the current filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
