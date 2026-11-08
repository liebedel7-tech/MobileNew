import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  History, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { MeterReading, ActiveScreen } from '../types';
import { formatOdometerReading } from '../constants/routes';
import { SyncService } from '../services/syncService';

interface HistoryScreenProps {
  readings: MeterReading[];
  onNavigate: (screen: ActiveScreen) => void;
  onReload?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  readings,
  onNavigate,
  onReload,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApproval, setFilterApproval] = useState<'ALL' | 'pending' | 'approved' | 'rejected'>('ALL');
  const [isCheckingApprovals, setIsCheckingApprovals] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Auto-sync approvals from Central Admin on screen load
  useEffect(() => {
    let isMounted = true;
    SyncService.syncNow(true).then(() => {
      if (isMounted && onReload) {
        onReload();
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [onReload]);

  const handleManualCheckApprovals = async () => {
    if (isCheckingApprovals) return;
    setIsCheckingApprovals(true);
    setSyncFeedback(null);
    try {
      const res = await SyncService.syncNow(false);
      if (onReload) await onReload();
      setSyncFeedback(res.message || 'Approvals synchronized from Central Admin.');
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch {
      setSyncFeedback('Unable to reach Central Server. Queue safely stored locally.');
      setTimeout(() => setSyncFeedback(null), 3500);
    } finally {
      setIsCheckingApprovals(false);
    }
  };

  const isReadingApproved = (r: MeterReading) => r.approvalStatus === 'approved' || r.status === 'APPROVED';
  const isReadingRejected = (r: MeterReading) => r.approvalStatus === 'rejected' || r.status === 'REJECTED';
  const isReadingPending = (r: MeterReading) => !isReadingApproved(r) && !isReadingRejected(r);

  // Deduplicate readings by account number so each consumer name appears strictly once (latest reading)
  const deduplicatedReadings = useMemo(() => {
    const sorted = [...readings].sort((a, b) => {
      const timeA = new Date(a.approvedAt || `${a.readingDate}T${a.readingTime || '00:00:00'}`).getTime();
      const timeB = new Date(b.approvedAt || `${b.readingDate}T${b.readingTime || '00:00:00'}`).getTime();
      return timeB - timeA;
    });

    const seen = new Set<string>();
    const list: MeterReading[] = [];
    for (const r of sorted) {
      const key = (r.accountNumber || '').trim().toLowerCase() || (r.consumerId || '').trim().toLowerCase() || r.id;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(r);
      }
    }
    return list;
  }, [readings]);

  const pendingCount = deduplicatedReadings.filter(isReadingPending).length;
  const approvedCount = deduplicatedReadings.filter(isReadingApproved).length;
  const rejectedCount = deduplicatedReadings.filter(isReadingRejected).length;

  const filteredReadings = useMemo(() => {
    return deduplicatedReadings.filter((r) => {
      const matchSearch =
        (r.consumerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.accountNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.meterSerial || '').toLowerCase().includes(searchTerm.toLowerCase());

      const isApproved = isReadingApproved(r);
      const isRejected = isReadingRejected(r);
      const isPending = isReadingPending(r);

      const matchApproval =
        filterApproval === 'ALL' ||
        (filterApproval === 'pending' && isPending) ||
        (filterApproval === 'approved' && isApproved) ||
        (filterApproval === 'rejected' && isRejected);

      return matchSearch && matchApproval;
    });
  }, [deduplicatedReadings, searchTerm, filterApproval]);

  return (
    <div className="p-3.5 sm:p-5 max-w-4xl mx-auto w-full space-y-3.5 pb-20">
      {/* Top Header & Screen Breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualCheckApprovals}
            disabled={isCheckingApprovals}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-800/80 text-sky-300 text-xs font-semibold transition disabled:opacity-50 active:scale-95 cursor-pointer shadow-sm"
            title="Check Central Admin for newly approved readings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingApprovals ? 'animate-spin text-sky-400' : ''}`} />
            <span>{isCheckingApprovals ? 'Syncing...' : 'Sync Approvals'}</span>
          </button>

          <span className="text-xs font-mono text-slate-400">
            Total: <strong className="text-white">{deduplicatedReadings.length}</strong>
          </span>
        </div>
      </div>

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-1 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        </div>
      )}

      {/* Title Section */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          Readings History
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Chronological field records and central administrative approval verification
        </p>
      </div>

      {/* Segmented Filter Control */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl select-none">
        <button
          type="button"
          onClick={() => setFilterApproval('ALL')}
          className={`py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition text-center ${
            filterApproval === 'ALL'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All ({deduplicatedReadings.length})
        </button>

        <button
          type="button"
          onClick={() => setFilterApproval('pending')}
          className={`py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition text-center flex items-center justify-center gap-1 ${
            filterApproval === 'pending'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-amber-300'
          }`}
        >
          <Clock className="w-3 h-3 hidden sm:inline" />
          <span>Pending ({pendingCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterApproval('approved')}
          className={`py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition text-center flex items-center justify-center gap-1 ${
            filterApproval === 'approved'
              ? 'bg-emerald-600 text-white font-bold shadow-sm'
              : 'text-slate-400 hover:text-emerald-300'
          }`}
        >
          <CheckCircle2 className="w-3 h-3 hidden sm:inline" />
          <span>Approved ({approvedCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterApproval('rejected')}
          className={`py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition text-center flex items-center justify-center gap-1 ${
            filterApproval === 'rejected'
              ? 'bg-rose-600 text-white font-bold shadow-sm'
              : 'text-slate-400 hover:text-rose-300'
          }`}
        >
          <AlertCircle className="w-3 h-3 hidden sm:inline" />
          <span>Flagged ({rejectedCount})</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by Account No, Name, or Meter Serial..."
          className="w-full h-10 bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition shadow-inner font-sans"
        />
      </div>

      {/* Readings Cards List */}
      <div className="space-y-3">
        {filteredReadings.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
            <History className="w-8 h-8 mx-auto text-slate-500" />
            <div className="font-bold text-sm text-slate-300">No Readings Found</div>
            <p className="text-xs text-slate-500">
              No matching field readings under the selected filter criteria.
            </p>
          </div>
        ) : (
          filteredReadings.map((reading) => {
            const isApproved = isReadingApproved(reading);
            const isRejected = isReadingRejected(reading);
            const isPending = isReadingPending(reading);

            return (
              <div
                key={reading.id}
                className="bg-slate-900 border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-sm hover:border-slate-700/80 transition"
              >
                {/* Header Row: Account Tag & Mutually Exclusive Status */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/80 px-2.5 py-0.5 rounded border border-sky-800/60">
                    {reading.accountNumber}
                  </span>

                  {isPending && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/60 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Pending Admin Approval</span>
                    </span>
                  )}

                  {isApproved && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Approved</span>
                    </span>
                  )}

                  {isRejected && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/60 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Flagged / Rejected</span>
                    </span>
                  )}
                </div>

                {/* Consumer Name & Meter Tag */}
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="font-bold text-sm text-white tracking-tight truncate">
                    {reading.consumerName}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    Tag: {reading.meterSerial}
                  </span>
                </div>

                {/* Standardized 3-Column Odometer Breakdown */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/70 text-center font-mono">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">
                      PREVIOUS
                    </span>
                    <span className="text-xs font-bold text-slate-300 block mt-0.5">
                      {formatOdometerReading(reading.previousReading)} cu.m.
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase font-bold text-sky-400 tracking-wider block">
                      PRESENT
                    </span>
                    <span className="text-xs font-black text-sky-300 block mt-0.5">
                      {formatOdometerReading(reading.currentReading)} cu.m.
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider block">
                      CONSUMPTION
                    </span>
                    <span className="text-xs font-black text-emerald-400 block mt-0.5">
                      +{reading.consumption} cu.m.
                    </span>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="text-[10.5px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono pt-0.5">
                  <span>{reading.readingDate} {reading.readingTime}</span>
                  <span className="text-slate-600">·</span>
                  <span>Reader: {reading.readerName || reading.readerId}</span>
                  
                  {isApproved && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Admin Verified ({reading.approvedBy || 'Supervisor'})</span>
                      </span>
                    </>
                  )}

                  {reading.remarks && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400 italic">Note: {reading.remarks}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HistoryScreen;
