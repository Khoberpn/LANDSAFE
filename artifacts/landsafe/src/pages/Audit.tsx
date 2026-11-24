import React from 'react';
import { useGetAuditLogs } from '@workspace/api-client-react';
import { Shield } from 'lucide-react';

export default function Audit() {
  const { data: logs, isLoading } = useGetAuditLogs({ limit: 50 });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[calc(100vh-8.5rem)] md:h-[calc(100vh-8rem)] shadow-sm">
      <div className="p-3.5 sm:p-4 border-b border-border flex items-center justify-between bg-secondary/30 shrink-0">
        <h2 className="text-xs sm:text-sm font-semibold font-mono tracking-wider sm:tracking-widest uppercase flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Jejak Audit Sistem
        </h2>
        <div className="text-[11px] sm:text-xs text-muted-foreground font-mono">50 catatan terakhir</div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[640px] text-xs sm:text-sm text-left">
          <thead className="bg-background sticky top-0 z-10 text-muted-foreground text-[10px] sm:text-xs uppercase tracking-wider font-mono shadow-xs border-b border-border">
            <tr>
              <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-semibold">Waktu</th>
              <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-semibold">Operator</th>
              <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-semibold">Aksi</th>
              <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-semibold">Entitas</th>
              <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-semibold">Rincian</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-xs sm:text-sm text-muted-foreground">Mengambil log audit...</td></tr>
            ) : Array.isArray(logs) && logs.length > 0 ? (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-secondary/20 font-mono text-xs transition-colors">
                  <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-muted-foreground whitespace-nowrap tabular-nums">
                    {new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 19)}
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-foreground">{log.userName || `SYS-${log.userId}`}</td>
                  <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold border ${
                      log.action.includes('delete') ? 'bg-destructive/10 text-destructive border-destructive/20' :
                      log.action.includes('update') ? 'bg-warning/10 text-warning border-warning/20' :
                      'bg-info/10 text-info border-info/20'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-muted-foreground whitespace-nowrap">{log.entityType} {log.entityId ? `#${log.entityId}` : ''}</td>
                  <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-muted-foreground truncate max-w-xs font-sans text-xs" title={log.details || ''}>{log.details || '-'}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} className="p-8 text-center text-xs sm:text-sm text-muted-foreground">Belum ada log audit tercatat.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
