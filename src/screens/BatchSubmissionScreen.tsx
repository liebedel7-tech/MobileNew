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

interface BatchSubmissionScreenProps {
  pendingReadings: MeterReading[];
  syncedReadings: MeterReading[];
  syncState: SyncState;
  onSyncTrigger: () => Promise<any>;
  onNavigate: (screen: ActiveScreen) => void;
  onViewReceipt: (reading: MeterReading) => void;
}

export const BatchSubmissionScreen: React.FC<BatchSubmissionScreenProps> = ({
  pendingReadings,
  syncedReadings,
  syncState,
  onSyncTrigger,
  onNavigate,
  onViewReceipt,
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
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
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

            <div>
              <div className="font-extrabold text-sm text-white">
                {pendingReadings.length} Readings in Offline Queue
              </div>
              <p className="text-xs text-slate-400">
                {syncState.isOnline
                  ? 'Connection to Central Server is established.'
                  : 'Offline mode active. Data safely stored locally in encrypted SQLite vault.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleSubmitBatch}
            disabled={isSubmitting || pendingReadings.length === 0 || !syncState.isOnline}
            className="px-5 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99]"
          >
            <Send className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
            <span>
              {isSubmitting
                ? 'Uploading Batch...'
                : `Upload Batch (${pendingReadings.length})`}
            </span>
          </button>
        </div>

        {submitResult && (
          <div className="p-3 bg-sky-950/70 border border-sky-800 rounded-xl text-xs text-sky-200">
            {submitResult}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-2 ${
            activeTab === 'PENDING'
              ? 'bg-sky-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Upload Queue ({pendingReadings.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('SYNCED')}
          className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-2 ${
            activeTab === 'SYNCED'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Synced Batches ({syncedReadings.length})</span>
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
                className="bg-slate-900 border border-amber-900/40 rounded-2xl p-3.5 flex items-center justify-between shadow-sm"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-sky-400">
                      {reading.accountNumber}
                    </span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                      QUEUED
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-white">{reading.consumerName}</h4>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Reading: {reading.currentReading} cu.m. • Used: {reading.consumption} cu.m. • ₱{reading.billCalculation.totalAmountDue.toFixed(2)}
                  </div>
                </div>

                <button
                  onClick={() => onViewReceipt(reading)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Receipt</span>
                </button>
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
                className="bg-slate-900 border border-emerald-900/40 rounded-2xl p-3.5 flex items-center justify-between shadow-sm"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-sky-400">
                      {reading.accountNumber}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      SYNCED
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-white">{reading.consumerName}</h4>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Batch: {reading.batchId || 'SYNC-AUTO'} • {reading.readingDate}
                  </div>
                </div>

                <button
                  onClick={() => onViewReceipt(reading)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Receipt</span>
                </button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
