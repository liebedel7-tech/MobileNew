import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, CloudOff } from 'lucide-react';
import { SyncState } from '../types';

interface SyncStatusBadgeProps {
  syncState: SyncState;
  onSyncTrigger: () => void;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  syncState,
  onSyncTrigger,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="relative">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              syncState.syncInProgress
                ? 'bg-sky-950 text-sky-400 border border-sky-800'
                : !syncState.isOnline
                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                : syncState.pendingCount > 0
                ? 'bg-blue-950 text-blue-400 border border-blue-800'
                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
            }`}
          >
            {syncState.syncInProgress ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : !syncState.isOnline ? (
              <CloudOff className="w-5 h-5" />
            ) : syncState.pendingCount > 0 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          {syncState.isOnline && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {syncState.syncInProgress
                ? 'SYNCHRONIZING READINGS'
                : !syncState.isOnline
                ? 'OFFLINE LOCAL STORAGE'
                : syncState.pendingCount > 0
                ? `${syncState.pendingCount} READINGS READY TO UPLOAD`
                : 'ALL RECORDS SYNCHRONIZED'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate max-w-[260px] sm:max-w-md">
            {syncState.lastSyncMessage}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={onSyncTrigger}
          disabled={syncState.syncInProgress}
          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncState.syncInProgress ? 'animate-spin' : ''}`} />
          <span>{syncState.syncInProgress ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>
    </div>
  );
};
