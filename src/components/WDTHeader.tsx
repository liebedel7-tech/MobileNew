import React from 'react';
import { 
  RefreshCw, 
  LogOut, 
  Send,
  Smartphone,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { StaffUser, SyncState, ActiveScreen } from '../types';
import { OfficialLogo } from './OfficialLogo';
import { APP_OFFICIAL_TITLE } from '../constants/branding';
import { useDeviceInstallStatus } from '../services/installService';

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
  onOpenApkModal,
  wsStatus = 'CONNECTED',
}) => {
  const { isInstalled } = useDeviceInstallStatus();

  return (
    <header className="w-full h-14 flex items-center justify-between px-3 sm:px-4 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 select-none sticky top-0 left-0 right-0 z-40 shadow-sm shrink-0 overscroll-none [overscroll-behavior:none] touch-none">
      {/* Brand Identity & Reader Scope */}
      <div 
        onClick={() => onNavigate('landing')}
        className="flex items-center gap-2.5 cursor-pointer group min-w-0"
        title="Tagoloan Water District Field Terminal"
      >
        <OfficialLogo size="sm" glow />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white truncate leading-tight">
              Tagoloan Water District
            </h1>
            {/* Subtle Connection Status Dot */}
            <span 
              className="relative flex h-2 w-2 shrink-0" 
              title={`Connection Status: ${wsStatus}`}
            >
              {wsStatus === 'CONNECTED' ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </>
              ) : wsStatus === 'RECONNECTING' || wsStatus === 'CONNECTING' ? (
                <>
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500" />
              )}
            </span>
          </div>

          <p className="text-[10px] text-slate-400 truncate leading-tight flex items-center gap-1">
            <span className="font-medium text-slate-300">
              {user?.name || 'Field Staff'}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-sky-400 font-mono text-[9.5px]">
              {user?.assignedRoutes && user.assignedRoutes.length > 0 
                ? user.assignedRoutes.join(', ') 
                : (user?.zone || 'All Routes')}
            </span>
          </p>
        </div>
      </div>

      {/* Streamlined Right-Hand Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Pending Queue Count Pill (Only shown when pending readings exist) */}
        {syncState.pendingCount > 0 && (
          <button
            type="button"
            onClick={() => onNavigate('batch_submission')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-bold hover:bg-amber-500/25 transition active:scale-95"
            title={`${syncState.pendingCount} pending field reading(s) queued for sync`}
          >
            <Send className="w-3 h-3 shrink-0" />
            <span>{syncState.pendingCount}</span>
          </button>
        )}

        {/* Sync Button */}
        <button
          type="button"
          onClick={onSyncTrigger}
          disabled={syncState.syncInProgress}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-slate-200 hover:text-white transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
          title="Synchronize Database with Central Server"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncState.syncInProgress ? 'animate-spin text-sky-400' : ''}`} />
        </button>

        {/* Install Mobile WebAPK Button (Only if not installed) */}
        {!isInstalled && (
          <button
            type="button"
            onClick={onOpenApkModal}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 text-emerald-400 hover:text-emerald-300 transition active:scale-95 cursor-pointer shadow-sm"
            title="Download Android APK / Install App"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        )}

        {/* User Sign Out */}
        {user && (
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-950/50 border border-slate-700/80 hover:border-rose-800 text-slate-400 hover:text-rose-300 transition active:scale-95 cursor-pointer shadow-sm"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};

export default WDTHeader;
