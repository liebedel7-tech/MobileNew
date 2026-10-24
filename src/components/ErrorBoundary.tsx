import React, { Component, ErrorInfo, ReactNode } from 'react';
import { 
  ShieldAlert, 
  RotateCcw, 
  RefreshCw, 
  Home, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Cpu, 
  Activity,
  LifeBuoy
} from 'lucide-react';
import { LoggerService } from '../services/loggerService';

interface AppErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  incidentId: string;
  timestamp: string;
  copied: boolean;
  isDetailsOpen: boolean;
  rebooting: boolean;
  crashCount: number;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      incidentId: '',
      timestamp: '',
      copied: false,
      isDetailsOpen: false,
      rebooting: false,
      crashCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    const incidentId = `INC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    return {
      hasError: true,
      error,
      incidentId,
      timestamp: new Date().toLocaleTimeString(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState((prev) => ({
      errorInfo,
      crashCount: prev.crashCount + 1,
    }));

    // Record incident into Tagoloan Audit Log & console
    console.error('[CRASH_SHIELD] Uncaught UI exception caught by AppErrorBoundary:', error, errorInfo);
    LoggerService.log(
      'APP_CRASH_INTERCEPTED',
      `Application crash intercepted [${this.state.incidentId}]: ${error.message}`,
      'SYSTEM_SHIELD',
      'Production Error Boundary'
    ).catch(() => {});
  }

  handleHotReboot = () => {
    this.setState({ rebooting: true });
    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        rebooting: false,
      });
      if (this.props.onReset) {
        this.props.onReset();
      }
    }, 400);
  };

  handleSafeModeLanding = () => {
    this.setState({ rebooting: true });
    try {
      if (typeof window !== 'undefined') {
        window.location.hash = 'landing';
      }
    } catch {
      // ignore
    }
    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        rebooting: false,
      });
      if (this.props.onReset) {
        this.props.onReset();
      }
    }, 400);
  };

  handleHardReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleCopyIncidentReport = () => {
    const report = {
      incidentId: this.state.incidentId,
      timestamp: this.state.timestamp,
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      href: typeof window !== 'undefined' ? window.location.href : '',
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2500);
      });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-rose-500/30 font-sans">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
            {/* Top Security Glow Header */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600 animate-pulse" />
            
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-rose-400 font-bold px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800">
                    Survival Shield Active
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    #{this.state.incidentId.slice(0, 10)}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white mt-1 leading-snug">
                  Application Crash Safely Caught
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  The runtime shield intercepted an unhandled state exception. Your stored local readings and database remain 100% intact.
                </p>
              </div>
            </div>

            {/* Error Message Summary Box */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-4 font-mono text-xs text-rose-300 break-words">
              <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-sans">
                <span>Exception Detail</span>
                <span>{this.state.timestamp}</span>
              </div>
              <p className="line-clamp-3">
                {this.state.error?.message || 'Unknown runtime render exception'}
              </p>
            </div>

            {/* Survival & Reboot Primary Action Buttons */}
            <div className="space-y-2 mb-4">
              <button
                onClick={this.handleHotReboot}
                disabled={this.state.rebooting}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-[0.98] transition cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 ${this.state.rebooting ? 'animate-spin' : ''}`} />
                <span>{this.state.rebooting ? 'Rebooting Terminal Engine...' : 'Hot-Reboot Terminal (Recommended)'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={this.handleSafeModeLanding}
                  disabled={this.state.rebooting}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5 text-sky-400" />
                  <span>Safe Mode (Landing)</span>
                </button>

                <button
                  onClick={this.handleHardReload}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reload Page</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Actions & Details */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <button
                onClick={this.handleCopyIncidentReport}
                className="flex items-center gap-1.5 hover:text-slate-200 transition text-[11px] font-mono cursor-pointer"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied Incident Log!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Incident Log</span>
                  </>
                )}
              </button>

              <button
                onClick={() => this.setState({ isDetailsOpen: !this.state.isDetailsOpen })}
                className="flex items-center gap-1 hover:text-slate-200 transition text-[11px] cursor-pointer"
              >
                <span>Diagnostic Stack</span>
                {this.state.isDetailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {/* Collapsible Stack Trace */}
            {this.state.isDetailsOpen && (
              <div className="mt-3 p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-400 max-h-40 overflow-y-auto whitespace-pre-wrap select-text">
                <div className="text-slate-500 mb-1">// Incident: {this.state.incidentId}</div>
                <div>{this.state.error?.stack || 'No stack trace captured.'}</div>
                {this.state.errorInfo?.componentStack && (
                  <div className="mt-2 text-slate-500 border-t border-slate-900 pt-1">
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// -------------------------------------------------------------
// Isolated Screen Error Boundary: Protects individual screens so
// a failure on one tab doesn't kill the entire application!
// -------------------------------------------------------------
interface ScreenErrorBoundaryProps {
  screenName: string;
  children: ReactNode;
  onRecoverToDashboard?: () => void;
}

interface ScreenErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorTime: string;
}

export class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, ScreenErrorBoundaryState> {
  constructor(props: ScreenErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorTime: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ScreenErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorTime: new Date().toLocaleTimeString(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[SCREEN_SHIELD] Exception caught in screen "${this.props.screenName}":`, error, errorInfo);
    LoggerService.log(
      'SCREEN_CRASH_ISOLATED',
      `Screen "${this.props.screenName}" encountered error: ${error.message}. Navigation isolated safely.`,
      'SCREEN_SHIELD',
      this.props.screenName
    ).catch(() => {});
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorTime: '',
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 sm:p-6 w-full flex items-center justify-center min-h-[360px]">
          <div className="max-w-md w-full bg-slate-900/95 border border-amber-500/30 rounded-2xl p-5 shadow-xl text-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <LifeBuoy className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                  Screen Isolation Shield
                </span>
                <h3 className="text-sm font-bold text-white truncate">
                  Module &quot;{this.props.screenName}&quot; Intercepted
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              An unexpected render issue occurred in this specific module. The bottom navigation, status bar, and other screens remain fully functional.
            </p>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 mb-4 text-[11px] font-mono text-amber-300 break-words">
              {this.state.error?.message || 'Unexpected module state'}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reboot {this.props.screenName}</span>
              </button>

              {this.props.onRecoverToDashboard && (
                <button
                  onClick={this.props.onRecoverToDashboard}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5 text-sky-400" />
                  <span>Dashboard</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
