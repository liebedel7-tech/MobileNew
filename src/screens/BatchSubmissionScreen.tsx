import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  CloudOff, 
  FileText, 
  Droplet,
  ShieldCheck,
  Check
} from 'lucide-react';
import { MeterReading, SyncState, ActiveScreen } from '../types';
import { formatOdometerReading } from '../constants/routes';
import { SwipeableAlertBanner, AnimatePresence } from '../components/SwipeDismiss';

interface BatchSubmissionScreenProps {
  pendingReadings: MeterReading[];
  syncedReadings: MeterReading[];
  syncState: SyncState;
  onSyncTrigger: () => Promise<any>;
  onNavigate: (screen: ActiveScreen) => void;
}

export const BatchSubmissionScreen: React.FC<BatchSubmissionScreenProps> = ({
  pendingReadings,
  syncedReadings,
  syncState,
  onSyncTrigger,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'SYNCED'>('PENDING');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);

  const handleSubmitBatch = async () => {
    setIsSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await onSyncTrigger();
      if (res && res.success) {
        setSubmitResult(`Successfully uploaded ${res.syncedReadingsCount} readings to Tagoloan Central Office.`);
      } else {
        setSubmitResult(res?.message || 'Submission completed with notices.');
      }
    } catch (err: any) {
      setSubmitResult(`Submission error: ${err.message || 'Check network connectivity'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3.5 sm:p-5 max-w-4xl mx-auto w-full space-y-4 pb-20">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition py-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <span className="text-xs font-medium text-slate-400">
          Sync Queue
        </span>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          Batch Submission
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Upload offline field meter readings to Central Admin
        </p>
      </div>

      {/* Sync Status Banner Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                pendingReadings.length > 0
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}
            >
              {pendingReadings.length > 0 ? (
                <Clock className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>

            <div className="min-w-0">
              <div className="font-extrabold text-sm text-white">
                {pendingReadings.length} Readings in Offline Queue
              </div>
              <p className="text-xs text-slate-400">
                {syncState.isOnline
                  ? 'Connection to Central Server is established.'
                  : 'Offline mode active. Data safely stored locally.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleSubmitBatch}
            disabled={isSubmitting || pendingReadings.length === 0 || !syncState.isOnline}
            className="px-5 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap cursor-pointer"
          >
            <Send className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
            <span>
              {isSubmitting
                ? 'Uploading Batch...'
                : `Upload Batch (${pendingReadings.length})`}
            </span>
          </button>
        </div>

        <AnimatePresence>
          {submitResult && (
            <SwipeableAlertBanner
              key="batch-submit-result"
              onDismiss={() => setSubmitResult(null)}
              showCloseButton
              className="p-3 bg-sky-950/70 border border-sky-800 rounded-xl text-xs text-sky-200 flex items-center justify-between gap-2"
            >
              <span>{submitResult}</span>
            </SwipeableAlertBanner>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'PENDING'
              ? 'bg-sky-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Pending ({pendingReadings.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('SYNCED')}
          className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'SYNCED'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Synced ({syncedReadings.length})</span>
        </button>
      </div>

      {/* Readings List (Unified Clean Surface) */}
      <div>
        {activeTab === 'PENDING' ? (
          pendingReadings.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-8 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-400" />
              <div className="font-semibold text-sm text-slate-200">All Readings Synchronized</div>
              <p className="text-xs text-slate-500">
                No pending readings in local offline queue.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800/90 rounded-2xl divide-y divide-slate-800/70 overflow-hidden">
              {pendingReadings.map((reading) => (
                <div
                  key={reading.id}
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-semibold text-[15px] text-white leading-snug truncate">
                      {reading.consumerName}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono flex-wrap">
                      <span className="text-sky-400 font-semibold">{reading.accountNumber}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="tabular-nums">
                        {formatOdometerReading(reading.previousReading)} → {formatOdometerReading(reading.currentReading)}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-emerald-400 font-semibold tabular-nums">+{reading.consumption} cu.m.</span>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Queued</span>
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          syncedReadings.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-8 text-center text-slate-400 text-xs">
              No synced readings yet in this session.
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800/90 rounded-2xl divide-y divide-slate-800/70 overflow-hidden">
              {syncedReadings.map((reading) => (
                <div
                  key={reading.id}
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-semibold text-[15px] text-white leading-snug truncate">
                      {reading.consumerName}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono flex-wrap">
                      <span className="text-sky-400 font-semibold">{reading.accountNumber}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>{reading.readingDate}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-emerald-400 font-semibold tabular-nums">+{reading.consumption} cu.m.</span>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Synced</span>
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
