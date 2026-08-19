import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  LogOut, 
  Sliders, 
  Send,
  Home
} from 'lucide-react';
import { StaffUser, SyncState, ActiveScreen } from '../types';

interface WDTHeaderProps {
  user: StaffUser | null;
  syncState: SyncState;
  onSyncTrigger: () => void;
  onLogout: () => void;
  onNavigate: (screen: ActiveScreen) => void;
  currentScreen: ActiveScreen;
  isMobileChassis: boolean;
  onToggleChassis: () => void;
  onOpenApkModal: () => void;
  wsStatus?: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
}

export const WDTHeader: React.FC<WDTHeaderProps> = ({
  user,
  syncState,
  onSyncTrigger,
  onLogout,
  onNavigate,
  currentScreen,
  isMobileChassis,
  onToggleChassis,
  onOpenApkModal,
  wsStatus = 'CONNECTED',
}) => {
  const initials = user
    ? user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'WD';

  return (
    <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-slate-900 border-b border-slate-800 text-slate-100 select-none sticky top-0 z-40 shadow-sm shrink-0">
      {/* Brand Identity */}
      <div 
        onClick={() => onNavigate('landing')}
        className="flex items-center gap-2 cursor-pointer group min-w-0"
        title="Go to Tagoloan Water District Portal"
      >
        <div className="w-8 h-8 bg-sky-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-base italic shadow-sm shrink-0 group-hover:scale-105 transition-transform">
          W
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white truncate">
              Tagoloan Water District
            </h1>
            <span className={`inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-mono px-1.5 py-0.2 rounded-full border shrink-0 ${
              wsStatus === 'CONNECTED'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'CONNECTED' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>{wsStatus === 'CONNECTED' ? 'LIVE' : 'OFFLINE'}</span>
            </span>
          </div>
          <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider truncate">
            {user ? `${user.zone} • ${user.name}` : 'Field Reader'}
          </p>
        </div>
      </div>

      {/* Right-Hand Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Pending Queue Badge (if any) */}
        {syncState.pendingCount > 0 && (
          <button
            onClick={() => onNavigate('batch_submission')}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold hover:bg-amber-500/30 transition"
            title="View pending sync queue"
          >
            <Send className="w-3 h-3 shrink-0" />
            <span>{syncState.pendingCount}</span>
          </button>
        )}

        {/* Sync Manual Trigger */}
        <button
          onClick={onSyncTrigger}
          disabled={syncState.syncInProgress}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white transition"
          title="Synchronize Database"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncState.syncInProgress ? 'animate-spin text-sky-400' : ''}`} />
        </button>

        {/* Diagnostics / Settings */}
        <button
          onClick={() => onNavigate('debug')}
          className={`p-2 rounded-lg border transition ${
            currentScreen === 'debug'
              ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
              : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300 hover:text-white'
          }`}
          title="Diagnostics & Settings"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* User initials badge or Logout */}
        {user && (
          <button
            onClick={onLogout}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700 text-slate-400 hover:text-rose-300 transition flex items-center gap-1"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
