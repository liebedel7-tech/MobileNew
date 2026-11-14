import React from 'react';
import {
  RefreshCw,
  LogOut,
  Smartphone,
} from 'lucide-react';
import { StaffUser, SyncState, ActiveScreen } from '../types';
import { OfficialLogo } from './OfficialLogo';
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
  const routeLabel =
    user?.assignedRoutes && user.assignedRoutes.length > 0
      ? user.assignedRoutes.join(', ')
      : user?.zone || 'All Routes';

  return (
    <header className="w-full min-h-[3.5rem] pt-[env(safe-area-inset-top)] flex items-center justify-between gap-2 px-3 sm:px-4 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 select-none sticky top-0 left-0 right-0 z-40 shadow-sm shrink-0 overscroll-none [overscroll-behavior:none] touch-none">
      {/* Brand Identity & Reader Scope */}
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-2.5 cursor-pointer group min-w-0 flex-1 text-left py-1.5"
        title="Tagoloan Water District Field Terminal"
      >
        <OfficialLogo size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white truncate leading-tight">
              Tagoloan Water District
            </h1>
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                wsStatus === 'CONNECTED'
                  ? 'bg-emerald-500'
                  : wsStatus === 'RECONNECTING' || wsStatus === 'CONNECTING'
                  ? 'bg-amber-500'
                  : 'bg-slate-500'
              }`}
              title={`Gateway: ${wsStatus}`}
            />
          </div>

          <p className="text-xs text-slate-300 truncate leading-tight font-medium">
            <span>{user?.name || 'Field Staff'}</span>
            <span className="text-slate-500 mx-1">·</span>
            <span className="text-sky-300 font-mono font-semibold">{routeLabel}</span>
          </p>
        </div>
      </button>

      {/* Streamlined Right-Hand Controls */}
      <div className="flex items-center gap-1.5 shrink-0">

        <button
          type="button"
          onClick={onSyncTrigger}
          disabled={syncState.syncInProgress}
          className="w-9 h-9 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-200 hover:text-white transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center"
          title="Synchronize with Central Server"
          aria-label="Synchronize with Central Server"
        >
          <RefreshCw className={`w-4 h-4 ${syncState.syncInProgress ? 'animate-spin text-sky-400' : ''}`} />
        </button>

        {!isInstalled && (
          <button
            type="button"
            onClick={onOpenApkModal}
            className="h-9 px-2 sm:px-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-300 hover:text-emerald-100 transition active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 whitespace-nowrap"
            title="Install App on Phone"
            aria-label="Install App on Phone"
          >
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Install</span>
          </button>
        )}

        {user && (
          <button
            type="button"
            onClick={onLogout}
            className="w-9 h-9 rounded-lg bg-slate-800/80 hover:bg-rose-950/50 border border-slate-700/80 hover:border-rose-800 text-slate-300 hover:text-rose-300 transition active:scale-95 cursor-pointer flex items-center justify-center"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};

export default WDTHeader;
