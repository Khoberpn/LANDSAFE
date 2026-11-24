import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[450px] p-6 text-center bg-white rounded-xl border border-slate-200 m-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">
            {this.props.fallbackTitle || 'Terjadi Kendala Memuat Komponen'}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mb-4 leading-relaxed">
            Halaman mengalami kesalahan saat memproses data tampilan peta atau antarmuka. Anda dapat mencoba memuat ulang halaman ini.
          </p>
          {this.state.error && (
            <div className="text-[11px] font-mono text-red-600 bg-red-50 border border-red-200 p-2.5 rounded max-w-lg mb-5 overflow-auto text-left">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={this.handleReset}
              className="bg-[#102A4C] hover:bg-[#183B63] text-white text-xs h-9 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Muat Ulang Halaman
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (window.location.href = '/live-map')}
              className="text-xs h-9 gap-1.5 border-slate-300"
            >
              <Home className="h-3.5 w-3.5" /> Kembali ke Peta Utama
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
