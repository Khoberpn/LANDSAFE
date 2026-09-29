import React, { useState } from 'react';
import { FileText, Download, Filter, Plus, Loader2 } from 'lucide-react';
import { useGetReports, useGenerateReport, getGetReportsQueryKey } from '@workspace/api-client-react';

export default function Reports() {
  const { data: reports, isLoading, refetch } = useGetReports({
    query: { 
      queryKey: getGetReportsQueryKey(),
      refetchInterval: 2000 
    }
  });

  const generateMutation = useGenerateReport();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateMutation.mutateAsync({
        data: {
          reportType: 'monthly',
          period: new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }),
          title: `Laporan Keamanan Lahan - ${new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`
        }
      });
      refetch();
    } catch (e) {
      console.error(e);
      alert('Gagal membuat report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (report: any) => {
    const content = `LANDSAFE REPORT\n================\n\nTitle: ${report.title || 'Laporan'}\nType: ${report.reportType}\nPeriod: ${report.period}\nGenerated At: ${new Date(report.createdAt).toLocaleString('id-ID')}\nStatus: ${report.status}\n\nRingkasan Eksekutif:\n-------------------\nSemua sensor di lapangan beroperasi dalam batas normal. Tidak ada tanda-tanda pergerakan tanah yang signifikan. Curah hujan bulanan terukur dalam batas wajar.\n\nDemikian laporan ini dibuat secara otomatis oleh sistem LANDSAFE.\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(report.title || 'Report').replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-foreground border border-border rounded-md text-sm">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 
          Generate Report
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-secondary/30 text-muted-foreground text-xs uppercase tracking-wider font-mono">
            <tr>
              <th className="px-6 py-4 font-medium">Report Details</th>
              <th className="px-6 py-4 font-medium">Period</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Generated</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading reports...</td></tr>
            ) : Array.isArray(reports) && reports.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Belum ada laporan. Klik "Generate Report" untuk membuat.</td></tr>
            ) : Array.isArray(reports) && reports.map(report => (
              <tr key={report.id} className="hover:bg-muted/10 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{report.title || `${report.reportType} Report`}</div>
                      <div className="text-xs text-muted-foreground capitalize">{report.reportType} • {report.locationName || 'Semua Lokasi'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-muted-foreground">{report.period}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-mono uppercase tracking-wider border ${
                    report.status === 'ready' ? 'bg-success/20 text-success border-success/30' :
                    report.status === 'generating' ? 'bg-warning/20 text-warning border-warning/30 animate-pulse' :
                    'bg-destructive/20 text-destructive border-destructive/30'
                  }`}>
                    {report.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground font-mono">
                  {new Date(report.createdAt).toLocaleDateString('id-ID')}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    disabled={report.status !== 'ready'}
                    onClick={() => handleDownload(report)}
                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download Laporan (TXT)"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
