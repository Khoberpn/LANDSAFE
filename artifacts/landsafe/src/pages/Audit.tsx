import React from 'react';
import { useGetAuditLogs } from '@workspace/api-client-react';

export default function Audit() {
  const { data: logs, isLoading } = useGetAuditLogs({ limit: 50 });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30 shrink-0">
        <h2 className="text-sm font-semibold font-mono tracking-widest uppercase">System Audit Trail</h2>
        <div className="text-xs text-muted-foreground">Last 50 events</div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-background sticky top-0 z-10 text-muted-foreground text-xs uppercase tracking-wider font-mono shadow-sm">
            <tr>
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">Operator</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Retrieving logs...</td></tr>
            ) : Array.isArray(logs) && logs.map(log => (
              <tr key={log.id} className="hover:bg-muted/10 font-mono text-xs">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 19)}
                </td>
                <td className="px-4 py-3">{log.userName || `SYS-${log.userId}`}</td>
                <td className="px-4 py-3">
                  <span className={`px-1.5 py-0.5 rounded border ${
                    log.action.includes('delete') ? 'bg-destructive/10 text-destructive border-destructive/20' :
                    log.action.includes('update') ? 'bg-warning/10 text-warning border-warning/20' :
                    'bg-info/10 text-info border-info/20'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{log.entityType} {log.entityId ? `#${log.entityId}` : ''}</td>
                <td className="px-4 py-3 text-muted-foreground truncate max-w-xs" title={log.details || ''}>{log.details || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
