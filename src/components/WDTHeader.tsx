import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
  const shouldReduceMotion = useReducedMotion();
  const routeLabel =
    user?.assignedRoutes && user.assignedRoutes.length > 0
      ? user.assignedRoutes.join(', ')
      : user?.zone || 'All Routes';

  const isOffline = !syncState.isOnline || syncState.isSimulatedOffline;
  const isSyncing = !isOffline && syncState.syncInProgress;

  const signalBarsActive = isOffline
    ? 0
    : isSyncing
    ? 4
    : wsStatus === 'CONNECTED'
    ? 4
    : wsStatus === 'CONNECTING' || wsStatus === 'RECONNECTING'
    ? 3
    : 2;

  const signalLabel = isOffline ? 'Offline' : isSyncing ? 'Syncing' : 'Online';
  const signalTooltip = isOffline
    ? 'Offline — Readings queued locally until network returns'
    : isSyncing
    ? 'Syncing with Central Server...'
    : `Online (${syncState.lastSyncMessage || 'Connected'})`;

  return (
    <header className="w-full min-h-[3.5rem] pt-[env(safe-area-inset-top)] flex items-center justify-between gap-2 px-2.5 sm:px-4 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 select-none sticky top-0 left-0 right-0 z-40 shadow-sm shrink-0 overscroll-none [overscroll-behavior:none] touch-none">
      {/* Brand Identity & Reader Scope */}
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group min-w-0 flex-1 text-left py-1.5"
        title="Tagoloan Water District Field Terminal"
      >
        <OfficialLogo size="sm" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[13px] sm:text-sm font-bold tracking-tight text-white truncate leading-tight">
            Tagoloan Water District
          </h1>

          <p className="text-[11px] sm:text-xs text-slate-300 truncate leading-tight font-medium">
            <span>{user?.name || 'Field Staff'}</span>
            <span className="text-slate-500 mx-1">·</span>
            <span className="text-sky-300 font-mono font-semibold">{routeLabel}</span>
          </p>
        </div>
      </button>

      {/* Streamlined Right-Hand Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Network Signal Strength Indicator (Syncing: animated pulse | Offline: solid gray) */}
        <motion.div
          role="status"
          aria-live="polite"
          data-sync-status={isOffline ? 'offline' : isSyncing ? 'syncing' : 'online'}
          title={signalTooltip}
          aria-label={`Network status: ${signalLabel}`}
          animate={
            isSyncing && !shouldReduceMotion
              ? { opacity: [0.8, 1, 0.8] }
              : { opacity: 1 }
          }
          transition={
            isSyncing && !shouldReduceMotion
              ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.15 }
          }
          className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg border flex items-center gap-1.5 text-[11px] font-bold transition-colors shrink-0 ${
            isOffline
              ? 'bg-slate-800/90 border-slate-700 text-slate-400'
              : isSyncing
              ? 'bg-sky-950/90 border-sky-500/70 text-sky-300 animate-pulse'
              : 'bg-emerald-950/70 border-emerald-700/70 text-emerald-300'
          }`}
        >
          <span className="flex items-end gap-[2px] h-3.5" aria-hidden="true">
            {[1, 2, 3, 4].map((bar) => {
              const heightClass =
                bar === 1
                  ? 'h-1.5'
                  : bar === 2
                  ? 'h-2'
                  : bar === 3
                  ? 'h-2.5'
                  : 'h-3.5';

              const barColorClass = isOffline
                ? 'bg-slate-500'
                : isSyncing
                ? 'bg-sky-400 animate-pulse'
                : bar <= signalBarsActive
                ? 'bg-emerald-400'
                : 'bg-slate-600';

              return (
                <motion.span
                  key={bar}
                  animate={
                    isSyncing && !shouldReduceMotion
                      ? { scaleY: [0.65, 1, 0.65], opacity: [0.6, 1, 0.6] }
                      : { scaleY: 1, opacity: 1 }
                  }
                  transition={
                    isSyncing && !shouldReduceMotion
                      ? {
                          duration: 0.9,
                          repeat: Infinity,
                          delay: bar * 0.1,
                          ease: 'easeInOut',
                        }
                      : { duration: 0.15 }
                  }
                  className={`w-[3px] origin-bottom rounded-xs transition-colors ${heightClass} ${barColorClass}`}
                />
              );
            })}
          </span>
          <span className="leading-none tracking-tight">{signalLabel}</span>
        </motion.div>

        <motion.button
          type="button"
          onClick={onSyncTrigger}
          disabled={syncState.syncInProgress}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-200 hover:text-white transition disabled:opacity-50 cursor-pointer flex items-center justify-center"
          title="Synchronize with Central Server"
          aria-label="Synchronize with Central Server"
        >
          <RefreshCw className={`w-4 h-4 ${syncState.syncInProgress ? 'animate-spin text-sky-400' : ''}`} />
        </motion.button>

        {!isInstalled && (
          <motion.button
            type="button"
            onClick={onOpenApkModal}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
            className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-300 hover:text-emerald-100 transition cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 whitespace-nowrap"
            title="Install App on Phone"
            aria-label="Install App on Phone"
          >
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Install</span>
          </motion.button>
        )}

        {user && (
          <motion.button
            type="button"
            onClick={onLogout}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800/80 hover:bg-rose-950/50 border border-slate-700/80 hover:border-rose-800 text-slate-300 hover:text-rose-300 transition cursor-pointer flex items-center justify-center"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </header>
  );
};

export default WDTHeader;
