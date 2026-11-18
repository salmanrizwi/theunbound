import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

const CHUNK_RELOAD_STORAGE_KEY = 'theunbound_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 15000;

function isStaleModuleGraphError(error: Error | null): boolean {
  const message = (error?.message || '').toLowerCase();
  return (
    message.includes("reading 'usestate'") ||
    message.includes("reading 'useeffect'") ||
    message.includes("reading 'useref'") ||
    message.includes("reading 'usecontext'") ||
    message.includes("reading 'usememo'") ||
    message.includes("reading 'usecallback'") ||
    message.includes('invalid hook call') ||
    message.includes('outdated optimize dep') ||
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed')
  );
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Caught unexpected component error:', error, errorInfo);
    if (typeof window !== 'undefined' && isStaleModuleGraphError(error)) {
      try {
        const now = Date.now();
        const lastReloadRaw = window.sessionStorage?.getItem(CHUNK_RELOAD_STORAGE_KEY);
        const lastReloadAt = lastReloadRaw ? Number(lastReloadRaw) : 0;
        if (!lastReloadAt || Number.isNaN(lastReloadAt) || now - lastReloadAt > CHUNK_RELOAD_COOLDOWN_MS) {
          window.sessionStorage?.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
          window.location.reload();
          return;
        }
      } catch {
        // Ignore storage errors and show fallback UI
      }
    }
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.removeItem('theunbound_chunk_reload_at');
      } catch {
        // Ignore storage errors
      }
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.removeItem('theunbound_chunk_reload_at');
      } catch {
        // Ignore storage errors
      }
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFB] flex flex-col items-center justify-center p-6 text-slate-800">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto mb-5 text-[#00C6A6]">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h1 className="text-xl font-bold text-slate-900 mb-2">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h1>

            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              {this.props.fallbackSubtitle || 
                'An unexpected error occurred while loading this section of TheUnbound portal. Please reload or return to the main dashboard.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00B094] text-white font-semibold text-sm shadow-sm transition-all duration-150 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all duration-150 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Homepage</span>
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-400">
              TheUnbound DMC Portal &bull; Enterprise Operations
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
