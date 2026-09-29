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
    return <div className="animate-pulse space-y-4">
      <div className="h-20 bg-card rounded-xl border border-border"></div>
      <div className="h-96 bg-card rounded-xl border border-border"></div>
    </div>;
  }

  const probColor = selectedAnalysis?.probability && selectedAnalysis.probability > 70 
    ? 'hsl(var(--destructive))' 
    : selectedAnalysis?.probability && selectedAnalysis.probability > 40 
      ? 'hsl(var(--warning))' 
      : 'hsl(var(--success))';

  const chartData = [{ name: 'Prob', value: selectedAnalysis?.probability || 0, fill: probColor }];

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      
      {/* Left List */}
      <div className="w-1/3 bg-card border border-border rounded-xl flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-border bg-secondary/20">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-primary" /> Active Model Predictions
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {list.map((item) => (
            <button
              key={item.locationId}
              onClick={() => setSelectedId(item.locationId)}
              className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between ${
                selectedId === item.locationId
                  ? 'bg-primary/10 border-primary/30 shadow-sm'
                  : 'bg-background border-border hover:border-primary/50'
              }`}
            >
              <div>
                <div className="font-medium text-sm">{item.locationName}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  Prob: <span className={
                    item.probability > 70 ? 'text-destructive font-bold' : 
                    item.probability > 40 ? 'text-warning font-bold' : 'text-success'
                  }>{item.probability}%</span>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 ${selectedId === item.locationId ? 'text-primary' : 'text-muted-foreground'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Right Detail */}
      {selectedAnalysis ? (
        <div className="flex-1 bg-card border border-border rounded-xl p-6 overflow-y-auto">
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold tracking-tight">{selectedAnalysis.locationName}</h1>
                <span className={`px-2.5 py-0.5 rounded text-xs font-mono uppercase tracking-wider ${
                  selectedAnalysis.riskLevel === 'danger' ? 'bg-destructive/20 text-destructive border border-destructive/30' :
                  selectedAnalysis.riskLevel === 'alert' ? 'bg-warning/20 text-warning border border-warning/30' :
                  'bg-success/20 text-success border border-success/30'
                }`}>
                  {selectedAnalysis.riskLevel}
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-mono">Last Computed: {new Date(selectedAnalysis.analyzedAt).toLocaleString()}</p>
            </div>
            {selectedAnalysis.evacuationSuggested && (
              <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive animate-pulse">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-bold tracking-wider uppercase text-sm">Evacuation Suggested</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Gauge */}
            <div className="bg-background border border-border rounded-xl p-6 flex flex-col items-center justify-center relative">
              <h3 className="text-xs font-mono text-muted-foreground uppercase absolute top-4 left-4">Event Probability</h3>
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={15} data={chartData} startAngle={180} endAngle={0}>
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar background={{ fill: 'hsl(var(--secondary))' }} dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                <span className="text-4xl font-bold" style={{ color: probColor }}>{selectedAnalysis.probability}%</span>
                <span className="text-xs text-muted-foreground mt-1">Confidence: {selectedAnalysis.confidence}%</span>
              </div>
            </div>

            {/* Triggers */}
            <div className="bg-background border border-border rounded-xl p-6">
              <h3 className="text-xs font-mono text-muted-foreground uppercase mb-4">Potential Triggers Identified</h3>
              <ul className="space-y-3">
                {selectedAnalysis.potentialTriggers?.map((trigger, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Activity className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <span className="text-sm">{trigger}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Historical Pattern Match</span>
                <span className="font-mono font-medium">{selectedAnalysis.historicalSimilarEvents} events</span>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mb-8">
            <h3 className="text-xs font-mono text-primary uppercase mb-2">XGBoost Summary</h3>
            <p className="text-sm leading-relaxed">{selectedAnalysis.explanation}</p>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-xs font-mono text-muted-foreground uppercase mb-4">Recommended Operator Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedAnalysis.recommendedActions?.map((action, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg">
                  <ShieldCheck className="w-4 h-4 text-info" />
                  <span className="text-sm">{action}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="flex-1 bg-card border border-border rounded-xl flex items-center justify-center text-muted-foreground">
          Select a location to view AI analysis
        </div>
      )}
    </div>
  );
}
