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
        setSubmitResult(`Successfully uploaded ${res.syncedReadingsCount} readings to Tagoloan Central Office billing server.`);
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
    <div className="p-3 sm:p-4 max-w-4xl mx-auto w-full space-y-4 pb-16">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <span className="text-xs font-semibold text-slate-400">
          Batch Management
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight">
            Batch Submission Engine
          </h2>
          <p className="text-xs text-slate-400">
            Upload field meter readings directly to WDT Central Billing Server
          </p>
        </div>
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

      {/* Readings List */}
      <div className="space-y-2.5">
        {activeTab === 'PENDING' ? (
          pendingReadings.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
              <div className="font-bold text-sm text-slate-200">All Readings Synchronized</div>
              <p className="text-xs text-slate-500">
                No pending readings in local offline queue. All records are backed up on central servers.
              </p>
            </div>
          ) : (
            pendingReadings.map((reading) => (
              <div
                key={reading.id}
                className="bg-slate-900 border border-amber-900/40 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-extrabold text-sky-400">
                      {reading.accountNumber}
                    </span>
                    <span className="text-[11px] font-bold text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 sm:hidden">
                      Awaiting Sync
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-white leading-snug">{reading.consumerName}</h4>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    Prev: {formatOdometerReading(reading.previousReading)} · Pres: {formatOdometerReading(reading.currentReading)} · Used: +{reading.consumption} cu.m.
                  </div>
                </div>

                <span className="hidden sm:inline-flex text-xs font-mono text-amber-300 bg-amber-950 px-2.5 py-1 rounded-lg border border-amber-800 font-bold shrink-0 whitespace-nowrap">
                  Awaiting Sync
                </span>
              </div>
            ))
          )
        ) : (
          syncedReadings.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
              No synced readings yet in this session.
            </div>
          ) : (
            syncedReadings.map((reading) => (
              <div
                key={reading.id}
                className="bg-slate-900 border border-emerald-900/40 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-extrabold text-sky-400">
                      {reading.accountNumber}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 sm:hidden">
                      Uploaded
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-white leading-snug">{reading.consumerName}</h4>
                  <div className="text-xs text-slate-400 font-mono">
                    Batch: {reading.batchId || 'SYNC-AUTO'} · {reading.readingDate}
                  </div>
                </div>

                <span className="hidden sm:inline-flex text-xs font-mono text-emerald-300 bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800 font-bold shrink-0 whitespace-nowrap">
                  Uploaded
                </span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
