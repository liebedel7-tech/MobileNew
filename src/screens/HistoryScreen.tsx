import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  History, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  Lock
} from 'lucide-react';
import { MeterReading, ActiveScreen, Consumer } from '../types';
import { 
  formatOdometerReading, 
  parseReadingTimestamp, 
  isValidatedForFieldReading, 
  isConsumerDisconnected, 
  isConsumerUnverified 
} from '../constants/routes';
import { SyncService } from '../services/syncService';

export const isReadingApproved = (r: MeterReading) => r.approvalStatus === 'approved' || r.status === 'APPROVED';
export const isReadingRejected = (r: MeterReading) => r.approvalStatus === 'rejected' || r.status === 'REJECTED';
export const isReadingPending = (r: MeterReading) => !isReadingApproved(r) && !isReadingRejected(r);

export interface ReadingHistoryRowProps {
  reading: MeterReading;
  consumer?: Consumer;
  onSelectConsumer?: (consumer: Consumer) => void;
}

/**
 * Memoized single reading row component.
 * Prevents visual jitter and avoids re-rendering unaffected cards across the list
 * when an individual reading status is updated or approved.
 */
export const ReadingHistoryRow: React.FC<ReadingHistoryRowProps> = React.memo(
  ({ reading, consumer, onSelectConsumer }) => {
    const isApproved = isReadingApproved(reading);
    const isRejected = isReadingRejected(reading);
    const isPending = isReadingPending(reading);

    const isAccountActiveAndVerified = Boolean(consumer && isValidatedForFieldReading(consumer));
    const isAccountDisconnected = Boolean(consumer && isConsumerDisconnected(consumer));
    const isAccountUnverified = Boolean(consumer && isConsumerUnverified(consumer));

    const handleRowClick = () => {
      if (isAccountActiveAndVerified && consumer && onSelectConsumer) {
        onSelectConsumer(consumer);
      }
    };

    return (
      <div
        onClick={handleRowClick}
        title={
          isAccountActiveAndVerified && consumer
            ? `Click to view ${consumer.name}'s complete past readings history`
            : consumer
            ? `Account is ${isAccountDisconnected ? 'disconnected' : 'unverified'} in Central Admin. Reading history is locked until activated.`
            : 'Consumer record not loaded'
        }
        className={`bg-slate-900 border rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-sm transition ${
          isAccountActiveAndVerified
            ? 'border-slate-800/90 hover:border-sky-500/80 hover:bg-slate-900/90 cursor-pointer active:scale-[0.99]'
            : 'border-slate-800/80 opacity-75 cursor-not-allowed select-none'
        }`}
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

        {/* Consumer Name & Meter Tag Wrapper with Fixed Height and Min Dimensions */}
        <div className="flex items-center justify-between gap-2 min-h-[28px] h-7 w-full overflow-hidden">
          <div className="min-w-0 flex-1 h-full flex items-center">
            <h4 className="font-bold text-sm text-white tracking-tight truncate w-full" title={reading.consumerName}>
              {reading.consumerName}
            </h4>
          </div>
          <div className="min-w-[120px] max-w-[160px] h-full flex items-center justify-end shrink-0">
            <span className="text-xs font-mono text-slate-400 truncate text-right">
              Tag: {reading.meterSerial}
            </span>
          </div>
        </div>

        {/* Standardized 3-Column Odometer Breakdown with Fixed Dimensions & Zero Layout Shift */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/80 rounded-xl p-3 border border-slate-800/70 text-center font-mono min-h-[72px] h-[72px] items-center">
          <div className="flex flex-col justify-center min-w-[75px] h-full">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block min-h-[16px] leading-tight">
              PREVIOUS
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-200 block min-h-[24px] leading-tight mt-1 truncate">
              {formatOdometerReading(reading.previousReading)} cu.m.
            </span>
          </div>

          <div className="flex flex-col justify-center min-w-[75px] h-full">
            <span className="text-xs uppercase font-bold text-sky-400 tracking-wider block min-h-[16px] leading-tight">
              PRESENT
            </span>
            <span className="text-sm sm:text-base font-black text-sky-300 block min-h-[24px] leading-tight mt-1 truncate">
              {formatOdometerReading(reading.currentReading)} cu.m.
            </span>
          </div>

          {/* Consumption Container with Fixed Height and Min Dimensions */}
          <div className="flex flex-col justify-center min-w-[75px] h-full">
            <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider block min-h-[16px] leading-tight">
              CONSUMPTION
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-400 block min-h-[24px] leading-tight mt-1 truncate">
              +{reading.consumption} cu.m.
            </span>
          </div>
        </div>

        {/* Footer Metadata & Clickable Ledger Cue */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-[10.5px] text-slate-400 font-mono pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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

          {isAccountActiveAndVerified ? (
            <span className="text-sky-400 hover:text-sky-300 font-sans font-semibold text-xs flex items-center gap-1">
              <span>Past Readings Ledger</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          ) : isAccountDisconnected ? (
            <span className="text-rose-400 font-sans font-semibold text-[11px] flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Disconnected (Locked)</span>
            </span>
          ) : isAccountUnverified ? (
            <span className="text-amber-400 font-sans font-semibold text-[11px] flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Unverified in Admin</span>
            </span>
          ) : null}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if the specific reading or consumer props change
    const r1 = prevProps.reading;
    const r2 = nextProps.reading;
    const c1 = prevProps.consumer;
    const c2 = nextProps.consumer;

    if (r1.id !== r2.id) return false;
    if (r1.approvalStatus !== r2.approvalStatus) return false;
    if (r1.status !== r2.status) return false;
    if (r1.currentReading !== r2.currentReading) return false;
    if (r1.previousReading !== r2.previousReading) return false;
    if (r1.consumption !== r2.consumption) return false;
    if (r1.approvedBy !== r2.approvedBy) return false;
    if (r1.approvedAt !== r2.approvedAt) return false;
    if (r1.remarks !== r2.remarks) return false;
    if (r1.readingDate !== r2.readingDate) return false;
    if (r1.readingTime !== r2.readingTime) return false;

    // Check consumer status differences
    if (c1?.id !== c2?.id) return false;
    if (c1?.meterStatus !== c2?.meterStatus) return false;
    if (c1?.status !== c2?.status) return false;
    if (Boolean(c1 && isConsumerDisconnected(c1)) !== Boolean(c2 && isConsumerDisconnected(c2))) return false;
    if (Boolean(c1 && isConsumerUnverified(c1)) !== Boolean(c2 && isConsumerUnverified(c2))) return false;
    if (Boolean(c1 && isValidatedForFieldReading(c1)) !== Boolean(c2 && isValidatedForFieldReading(c2))) return false;

    if (prevProps.onSelectConsumer !== nextProps.onSelectConsumer) return false;

    return true;
  }
);

ReadingHistoryRow.displayName = 'ReadingHistoryRow';

interface HistoryScreenProps {
  readings: MeterReading[];
  consumers?: Consumer[];
  onNavigate: (screen: ActiveScreen) => void;
  onSelectConsumer?: (consumer: Consumer) => void;
  onReload?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  readings,
  consumers = [],
  onNavigate,
  onSelectConsumer,
  onReload,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApproval, setFilterApproval] = useState<'ALL' | 'pending' | 'approved' | 'rejected'>('ALL');
  const [isCheckingApprovals, setIsCheckingApprovals] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Auto-sync approvals from Central Admin once on screen mount
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
  }, []);

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

  // Fast O(1) consumer lookup map to avoid linear scans during row rendering
  const consumerMap = useMemo(() => {
    const map = new Map<string, Consumer>();
    for (const c of consumers) {
      if (c.accountNumber) map.set(c.accountNumber.trim().toLowerCase(), c);
      if (c.id) map.set(c.id.toLowerCase(), c);
      if (c.meterSerial) map.set(c.meterSerial.trim().toLowerCase(), c);
    }
    return map;
  }, [consumers]);

  // Deduplicate readings by account number so each consumer name appears strictly once (latest reading)
  // with rock-solid deterministic sorting to guarantee zero layout shifts or name swapping
  const deduplicatedReadings = useMemo(() => {
    const sorted = [...readings].sort((a, b) => {
      const timeA = parseReadingTimestamp(a);
      const timeB = parseReadingTimestamp(b);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      // Deterministic tie-breaker: sort alphabetically by account number then reading id
      const accA = a.accountNumber || a.consumerName || a.id;
      const accB = b.accountNumber || b.consumerName || b.id;
      return accA.localeCompare(accB);
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
            const accKey = (reading.accountNumber || '').trim().toLowerCase();
            const idKey = (reading.consumerId || '').toLowerCase();
            const tagKey = (reading.meterSerial || '').trim().toLowerCase();
            const consumer = consumerMap.get(accKey) || consumerMap.get(idKey) || consumerMap.get(tagKey);

            return (
              <ReadingHistoryRow
                key={reading.id}
                reading={reading}
                consumer={consumer}
                onSelectConsumer={onSelectConsumer}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default HistoryScreen;
