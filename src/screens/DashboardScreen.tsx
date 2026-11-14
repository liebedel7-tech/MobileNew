import React from 'react';
import {
  CheckCircle2,
  Camera,
  FileText,
  ChevronRight,
  Clock,
  AlertCircle,
  CloudUpload,
  History,
  Lock,
  Wifi,
  WifiOff,
  MapPin
} from 'lucide-react';
import { Consumer, MeterReading, StaffUser, SyncState, ActiveScreen } from '../types';
import {
  formatOdometerReading,
  isValidatedForFieldReading,
  isConsumerDisconnected,
  isConsumerUnverified,
  parseReadingTimestamp,
} from '../constants/routes';

interface DashboardScreenProps {
  user: StaffUser | null;
  consumers: Consumer[];
  readings: MeterReading[];
  syncState: SyncState;
  onNavigate: (screen: ActiveScreen) => void;
  onSelectConsumer?: (consumer: Consumer) => void;
  onStartReading?: (consumer: Consumer) => void;
  onSyncTrigger: () => void;
  onOpenApkModal?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  consumers,
  readings,
  syncState,
  onNavigate,
  onSelectConsumer,
  onStartReading,
}) => {
  // Deduplicate consumers by accountNumber with stable route sequence sorting
  const deduplicatedConsumers = React.useMemo(() => {
    const seen = new Set<string>();
    const list: Consumer[] = [];
    for (const c of consumers) {
      const key = (c.accountNumber || '').trim().toLowerCase() || c.id;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(c);
      }
    }
    return list.sort((a, b) => {
      const seqA = a.sequenceNo ?? 99999;
      const seqB = b.sequenceNo ?? 99999;
      if (seqA !== seqB) return seqA - seqB;
      return (a.accountNumber || '').localeCompare(b.accountNumber || '');
    });
  }, [consumers]);

  const totalAssigned = deduplicatedConsumers.length;
  const readCount = deduplicatedConsumers.filter((c: Consumer) => c.isReadThisMonth).length;
  const unreadCount = Math.max(0, totalAssigned - readCount);
  const percentComplete = totalAssigned > 0 ? Math.round((readCount / totalAssigned) * 100) : 0;

  const isReadingApproved = (r: MeterReading) => r.approvalStatus === 'approved' || r.status === 'APPROVED';
  const isReadingRejected = (r: MeterReading) => r.approvalStatus === 'rejected' || r.status === 'REJECTED';
  const isReadingPending = (r: MeterReading) => !isReadingApproved(r) && !isReadingRejected(r);

  // Deduplicate readings by accountNumber (latest reading per consumer)
  const deduplicatedReadings = React.useMemo(() => {
    const sorted = [...readings].sort((a, b) => {
      const timeA = parseReadingTimestamp(a);
      const timeB = parseReadingTimestamp(b);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
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

  const approvedCount = deduplicatedReadings.filter(isReadingApproved).length;
  const pendingCount = deduplicatedReadings.filter(isReadingPending).length;

  // Next 3 unread active meters in route sequence (actionable field queue)
  const nextMetersOnRoute = React.useMemo(() => {
    return deduplicatedConsumers
      .filter((c) => isValidatedForFieldReading(c) && !c.isReadThisMonth)
      .slice(0, 3);
  }, [deduplicatedConsumers]);

  // Latest 3 reading submissions for quick verification status check
  const recentReadings = deduplicatedReadings.slice(0, 3);

  const routeLabel =
    user?.assignedRoutes && user.assignedRoutes.length > 0
      ? user.assignedRoutes.join(', ')
      : user?.zone || 'All Routes';

  // SVG circular progress ring geometry
  const ringRadius = 32;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (percentComplete / 100) * ringCircumference;

  return (
    <div className="flex-1 p-4 sm:p-5 max-w-4xl mx-auto w-full space-y-5 pb-20">
      {/* 1. HERO SHIFT CARD: Progress Ring + Primary Field Action (Zero Redundant Shortcut Tiles) */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/60 border border-slate-800/90 p-5 shadow-lg space-y-4">
        {/* Top Metadata & Gateway Link */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-400 font-medium truncate">
              {user?.name || 'Field Staff'}
              <span className="mx-1.5 text-slate-600">·</span>
              <span className="text-sky-400 font-mono font-semibold">{routeLabel}</span>
            </p>
            <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
              Today&apos;s Field Shift
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('system_connection')}
            className="min-h-[40px] px-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
            title="Check Central Server & Sync Gateway"
          >
            {syncState.isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300">Offline</span>
              </>
            )}
          </button>
        </div>

        {/* Circular Progress Ring + Route Summary */}
        <div className="flex items-center gap-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
              <circle
                cx="40"
                cy="40"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                className="text-slate-800"
              />
              <circle
                cx="40"
                cy="40"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="text-sky-400 transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold font-mono text-white tabular-nums leading-none">
                {percentComplete}%
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-2xl font-extrabold font-mono text-white tabular-nums leading-none">
              {readCount}
              <span className="text-sm font-medium text-slate-400"> / {totalAssigned} meters</span>
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              {unreadCount === 0
                ? 'All assigned route meters captured for this cycle.'
                : `${unreadCount} meter${unreadCount === 1 ? '' : 's'} remaining on your route`}
            </p>
          </div>
        </div>

        {/* Focused Primary & Secondary Field Capture CTAs */}
        <div className="flex items-stretch gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('scan_meter')}
            className="flex-1 min-h-[50px] px-4 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 active:scale-[0.98] cursor-pointer"
          >
            <Camera className="w-5 h-5 shrink-0" />
            <span>Scan Meter</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('reading_entry')}
            className="min-h-[50px] px-4 py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-semibold text-sm transition flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer shrink-0"
            title="Manual Reading Entry"
          >
            <FileText className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Manual</span>
          </button>
        </div>

        {/* Contextual Sync Alert Banner (Only visible when offline queue has unsent items) */}
        {syncState.pendingCount > 0 && (
          <button
            type="button"
            onClick={() => onNavigate('batch_submission')}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CloudUpload className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate tabular-nums">
                {syncState.pendingCount} reading{syncState.pendingCount === 1 ? '' : 's'} waiting in Sync Queue
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
          </button>
        )}
      </section>

      {/* 2. COMPACT 3-METRIC STATUS BAR (Single Non-Redundant Glance Strip) */}
      <section
        aria-label="Reading status overview"
        className="grid grid-cols-3 divide-x divide-slate-800/80 bg-slate-900 border border-slate-800 rounded-2xl py-3.5 px-1 shadow-sm"
      >
        <button
          type="button"
          onClick={() => onNavigate('consumers')}
          className="px-2 flex flex-col items-center justify-center text-center hover:bg-slate-800/40 rounded-l-xl py-1 transition cursor-pointer"
        >
          <span className="text-xl font-bold font-mono text-white tabular-nums leading-none">
            {unreadCount}
          </span>
          <span className="text-xs text-slate-400 font-medium mt-1.5">Unread</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('history')}
          className="px-2 flex flex-col items-center justify-center text-center hover:bg-slate-800/40 py-1 transition cursor-pointer"
        >
          <span className="text-xl font-bold font-mono text-amber-400 tabular-nums leading-none">
            {pendingCount}
          </span>
          <span className="text-xs text-slate-400 font-medium mt-1.5">Pending</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('history')}
          className="px-2 flex flex-col items-center justify-center text-center hover:bg-slate-800/40 rounded-r-xl py-1 transition cursor-pointer"
        >
          <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums leading-none">
            {approvedCount}
          </span>
          <span className="text-xs text-slate-400 font-medium mt-1.5">Approved</span>
        </button>
      </section>

      {/* 3. NEXT METERS UP ON ROUTE (Actionable Queue of Next 3 Unread Accounts) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="text-sm font-bold text-white tracking-tight">
            Next on Route
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('consumers')}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-0.5 cursor-pointer py-1"
          >
            <span>All {totalAssigned} Accounts</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {nextMetersOnRoute.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-white">Route Shift Complete</p>
            <p className="text-xs text-slate-400">
              All verified meters on your route have been read.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden shadow-sm">
            {nextMetersOnRoute.map((consumer) => (
              <div
                key={consumer.id}
                onClick={() => {
                  if (onSelectConsumer) onSelectConsumer(consumer);
                }}
                className="p-4 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition cursor-pointer"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span className="text-sky-400 font-bold">{consumer.accountNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span>Seq #{consumer.sequenceNo}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white leading-snug truncate">
                    {consumer.name}
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{consumer.address}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onStartReading) onStartReading(consumer);
                  }}
                  className="min-h-[44px] px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 shrink-0 transition active:scale-95 cursor-pointer"
                >
                  <span>Read</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. RECENT SUBMISSIONS (Clean Latest 3 Readings) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="text-sm font-bold text-white tracking-tight">
            Recent Readings
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-0.5 cursor-pointer py-1"
          >
            <span>View All ({deduplicatedReadings.length})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {recentReadings.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center text-slate-400 flex items-center justify-center gap-2">
            <History className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-xs">No meter readings logged on this device yet.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentReadings.map((reading) => {
              const isApproved = isReadingApproved(reading);
              const isRejected = isReadingRejected(reading);
              const isPending = isReadingPending(reading);

              const consumer = (consumers || []).find(
                (c) =>
                  (Boolean(c.accountNumber) &&
                    Boolean(reading.accountNumber) &&
                    c.accountNumber.trim().toLowerCase() === reading.accountNumber.trim().toLowerCase()) ||
                  (Boolean(c.id) && Boolean(reading.consumerId) && c.id.toLowerCase() === reading.consumerId.toLowerCase()) ||
                  (Boolean(c.meterSerial) &&
                    Boolean(reading.meterSerial) &&
                    c.meterSerial.trim().toLowerCase() === reading.meterSerial.trim().toLowerCase())
              );

              const isAccountActiveAndVerified = Boolean(consumer && isValidatedForFieldReading(consumer));
              const isAccountDisconnected = Boolean(consumer && isConsumerDisconnected(consumer));
              const isAccountUnverified = Boolean(consumer && isConsumerUnverified(consumer));

              return (
                <div
                  key={reading.id}
                  onClick={() => {
                    if (isAccountActiveAndVerified && consumer && onSelectConsumer) {
                      onSelectConsumer(consumer);
                    }
                  }}
                  title={
                    isAccountActiveAndVerified && consumer
                      ? `View ${consumer.name}'s past readings ledger`
                      : consumer
                      ? `Account is ${isAccountDisconnected ? 'disconnected' : 'unverified'}. Reading history is locked.`
                      : 'Consumer record not loaded'
                  }
                  className={`bg-slate-900 border rounded-2xl p-4 space-y-3 transition shadow-sm ${
                    isAccountActiveAndVerified
                      ? 'border-slate-800 hover:border-sky-500/80 cursor-pointer active:scale-[0.99]'
                      : 'border-slate-800/80 opacity-75 cursor-not-allowed select-none'
                  }`}
                >
                  {/* Top Row: Account # + Single Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400">
                      {reading.accountNumber}
                    </span>

                    {isPending && (
                      <span className="text-xs font-semibold text-amber-300 flex items-center gap-1 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pending Approval</span>
                      </span>
                    )}

                    {isApproved && (
                      <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Approved</span>
                      </span>
                    )}

                    {isRejected && (
                      <span className="text-xs font-semibold text-rose-300 flex items-center gap-1 whitespace-nowrap">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Flagged</span>
                      </span>
                    )}
                  </div>

                  {/* Consumer Name */}
                  <h4 className="text-sm font-bold text-white leading-snug break-words">
                    {reading.consumerName}
                  </h4>

                  {/* Clean 3-Column Odometer Grid */}
                  <div className="grid grid-cols-3 divide-x divide-slate-800/80 bg-slate-950 rounded-xl py-2.5 px-1 border border-slate-800/80 text-center font-mono">
                    <div className="min-w-0 px-1.5 flex flex-col items-center justify-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">
                        Previous
                      </span>
                      <span className="text-sm font-bold text-slate-200 tabular-nums mt-0.5">
                        {formatOdometerReading(reading.previousReading)}
                      </span>
                      <span className="text-[10px] text-slate-500">cu.m.</span>
                    </div>

                    <div className="min-w-0 px-1.5 flex flex-col items-center justify-center">
                      <span className="text-[10px] uppercase font-semibold text-sky-400 tracking-wide">
                        Present
                      </span>
                      <span className="text-sm font-bold text-sky-300 tabular-nums mt-0.5">
                        {formatOdometerReading(reading.currentReading)}
                      </span>
                      <span className="text-[10px] text-slate-500">cu.m.</span>
                    </div>

                    <div className="min-w-0 px-1.5 flex flex-col items-center justify-center">
                      <span className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wide">
                        Consumed
                      </span>
                      <span className="text-sm font-bold text-emerald-400 tabular-nums mt-0.5">
                        +{reading.consumption}
                      </span>
                      <span className="text-[10px] text-slate-500">cu.m.</span>
                    </div>
                  </div>

                  {/* Clean Metadata Footer */}
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-mono text-[11px] truncate">
                      {reading.readingDate} · {reading.meterSerial}
                    </span>

                    {isAccountActiveAndVerified ? (
                      <span className="text-sky-400 font-semibold flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                        <span>Ledger</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    ) : isAccountDisconnected ? (
                      <span className="text-rose-400 font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap">
                        <Lock className="w-3 h-3" />
                        <span>Disconnected</span>
                      </span>
                    ) : isAccountUnverified ? (
                      <span className="text-amber-400 font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap">
                        <Lock className="w-3 h-3" />
                        <span>Unverified</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardScreen;
