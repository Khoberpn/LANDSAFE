import React, { useState } from 'react';
import { useGetRiskAnalysisList } from '@workspace/api-client-react';
import { BrainCircuit, AlertTriangle, ShieldCheck, ChevronRight, Activity } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

export default function AiRisk() {
  const { data: analysisList, isLoading } = useGetRiskAnalysisList();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const list = Array.isArray(analysisList) ? analysisList : [];
  const selectedAnalysis = list.find(a => a.locationId === selectedId) || list[0];

  React.useEffect(() => {
    if (list.length > 0 && !selectedId) {
      setSelectedId(list[0].locationId);
    }
  }, [list, selectedId]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-16 sm:h-20 bg-card rounded-xl border border-border"></div>
        <div className="h-80 sm:h-96 bg-card rounded-xl border border-border"></div>
      </div>
    );
  }

  const probColor = selectedAnalysis?.probability && selectedAnalysis.probability > 70 
    ? 'hsl(var(--destructive))' 
    : selectedAnalysis?.probability && selectedAnalysis.probability > 40 
      ? 'hsl(var(--warning))' 
      : 'hsl(var(--success))';

  const chartData = [{ name: 'Prob', value: selectedAnalysis?.probability || 0, fill: probColor }];

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-8rem)] gap-4 sm:gap-6">
      
      {/* Left List */}
      <div className="w-full lg:w-1/3 bg-card border border-border rounded-xl flex flex-col overflow-hidden shrink-0 max-h-56 lg:max-h-none shadow-sm">
        <div className="p-3 sm:p-4 border-b border-border bg-secondary/20">
          <h2 className="text-xs sm:text-sm font-semibold flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-primary" /> Prediksi Model Aktif ({list.length})
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {list.map((item) => (
            <button
              key={item.locationId}
              type="button"
              onClick={() => setSelectedId(item.locationId)}
              className={`w-full text-left p-2.5 sm:p-3 rounded-lg border transition-colors flex items-center justify-between cursor-pointer ${
                selectedId === item.locationId
                  ? 'bg-primary/10 border-primary/30 shadow-sm'
                  : 'bg-background border-border hover:border-primary/50'
              }`}
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="font-medium text-xs sm:text-sm truncate">{item.locationName}</div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  Probabilitas: <span className={
                    item.probability > 70 ? 'text-destructive font-bold' : 
                    item.probability > 40 ? 'text-warning font-bold' : 'text-success font-bold'
                  }>{item.probability}%</span>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 ${selectedId === item.locationId ? 'text-primary' : 'text-muted-foreground'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Right Detail */}
      {selectedAnalysis ? (
        <div className="w-full flex-1 bg-card border border-border rounded-xl p-4 sm:p-6 overflow-y-auto shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{selectedAnalysis.locationName}</h1>
                <span className={`px-2.5 py-0.5 rounded text-[10px] sm:text-xs font-mono uppercase tracking-wider ${
                  selectedAnalysis.riskLevel === 'danger' ? 'bg-destructive/20 text-destructive border border-destructive/30' :
                  selectedAnalysis.riskLevel === 'alert' ? 'bg-warning/20 text-warning border border-warning/30' :
                  'bg-success/20 text-success border border-success/30'
                }`}>
                  {selectedAnalysis.riskLevel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">Dianalisis: {new Date(selectedAnalysis.analyzedAt).toLocaleString()}</p>
            </div>
            {selectedAnalysis.evacuationSuggested && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive animate-pulse self-start">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-bold tracking-wider uppercase text-xs sm:text-sm">Evakuasi Disarankan</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
            {/* Gauge */}
            <div className="bg-background border border-border rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center relative min-h-[220px]">
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase absolute top-3 left-3 sm:top-4 sm:left-4">Probabilitas Longsor</h3>
              <div className="w-40 h-40 sm:w-48 sm:h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={14} data={chartData} startAngle={180} endAngle={0}>
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar background={{ fill: 'hsl(var(--secondary))' }} dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
                <span className="text-3xl sm:text-4xl font-bold" style={{ color: probColor }}>{selectedAnalysis.probability}%</span>
                <span className="text-xs text-muted-foreground mt-1">Keyakinan: {selectedAnalysis.confidence}%</span>
              </div>
            </div>

            {/* Triggers */}
            <div className="bg-background border border-border rounded-xl p-4 sm:p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-[11px] font-mono text-muted-foreground uppercase mb-3">Faktor Pemicu Terdeteksi</h3>
                <ul className="space-y-2.5">
                  {selectedAnalysis.potentialTriggers?.map((trigger, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Activity className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm text-foreground">{trigger}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pola Historis Serupa</span>
                <span className="font-mono font-medium">{selectedAnalysis.historicalSimilarEvents} peristiwa</span>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 sm:p-5 mb-6">
            <h3 className="text-[11px] font-mono text-primary uppercase mb-1.5 font-bold">Ringkasan Analisis AI XGBoost</h3>
            <p className="text-xs sm:text-sm leading-relaxed text-foreground/90">{selectedAnalysis.explanation}</p>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-[11px] font-mono text-muted-foreground uppercase mb-3">Rekomendasi Tindakan Operator BPBD</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {selectedAnalysis.recommendedActions?.map((action, i) => (
                <div key={i} className="flex items-center gap-2.5 p-3 bg-background border border-border rounded-lg">
                  <ShieldCheck className="w-4 h-4 text-info shrink-0" />
                  <span className="text-xs sm:text-sm font-medium">{action}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="flex-1 bg-card border border-border rounded-xl p-8 flex items-center justify-center text-muted-foreground text-sm">
          Pilih lokasi untuk melihat analisis AI
        </div>
      )}
    </div>
  );
}
