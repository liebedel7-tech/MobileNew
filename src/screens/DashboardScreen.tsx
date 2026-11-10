import React from 'react';
import { 
  CheckCircle2, 
  Camera, 
  Users, 
  Send, 
  Smartphone, 
  FileText, 
  ChevronRight, 
  Zap, 
  RefreshCw, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  CloudUpload, 
  Layers, 
  Sliders,
  Activity,
  History,
  Lock,
  PowerOff
} from 'lucide-react';
import { Consumer, MeterReading, StaffUser, SyncState, ActiveScreen } from '../types';
import { 
  formatOdometerReading, 
  isValidatedForFieldReading, 
  isConsumerDisconnected, 
  isConsumerUnverified 
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
  onSyncTrigger,
  onOpenApkModal,
}) => {
  // Deduplicate consumers by accountNumber with stable sorting by sequence number and name
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
    // Stable order: preserve deterministic sequence
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

  // Deduplicate readings by accountNumber so each consumer appears strictly once in reading summaries and recent list
  const deduplicatedReadings = React.useMemo(() => {
    const sorted = [...readings].sort((a, b) => {
      const timeA = new Date(a.approvedAt || `${a.readingDate}T${a.readingTime || '00:00:00'}`).getTime();
      const timeB = new Date(b.approvedAt || `${b.readingDate}T${b.readingTime || '00:00:00'}`).getTime();
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
  const flaggedCount = deduplicatedReadings.filter(isReadingRejected).length;

  const recentReadings = deduplicatedReadings.slice(0, 5);

  return (
    <div className="flex-1 p-3.5 sm:p-5 max-w-4xl mx-auto w-full space-y-4 pb-20">
      {/* FIELD TERMINAL MODULES (Header Block) */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Field Terminal Modules</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[9px] font-mono font-bold border border-emerald-800">
                  ACTIVE
                </span>
              </h2>
              <p className="text-[10.5px] text-slate-400 font-mono mt-0.5">
                Authorized Reader: <span className="text-slate-300 font-semibold">{user?.name || 'Field Staff'}</span> · <span className="text-sky-400">{user?.assignedRoutes && user.assignedRoutes.length > 0 ? user.assignedRoutes.join(', ') : (user?.zone || 'All Routes')}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('system_connection')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/90 hover:bg-sky-900 border border-sky-800 text-sky-300 text-[10px] font-mono font-bold transition cursor-pointer active:scale-95 shadow-sm"
            title="Open System Connection Gateway"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Gateway: Connected</span>
          </button>
        </div>

        {/* 6 Responsive Grid Module Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {/* Module 1: Optical Odometer Vision Scanner */}
          <button
            type="button"
            onClick={() => onNavigate('scan_meter')}
            className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-900/60 transition-all flex flex-col items-start gap-2.5 group text-left active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block group-hover:text-sky-300 transition">
                Optical Odometer Scanner
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Camera OCR & 5-digit capture
              </span>
            </div>
          </button>

          {/* Module 2: Zone Consumer Directory */}
          <button
            type="button"
            onClick={() => onNavigate('consumers')}
            className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900/60 transition-all flex flex-col items-start gap-2.5 group text-left active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block group-hover:text-emerald-300 transition">
                Zone Consumer Directory
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                12-zone route sequence & tags
              </span>
            </div>
          </button>

          {/* Module 3: Manual Reading Entry */}
          <button
            type="button"
            onClick={() => onNavigate('reading_entry')}
            className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-900/60 transition-all flex flex-col items-start gap-2.5 group text-left active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block group-hover:text-amber-300 transition">
                Manual Reading Entry
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Direct index logging & remarks
              </span>
            </div>
          </button>

          {/* Module 4: Central Batch Sync Gateway */}
          <button
            type="button"
            onClick={() => onNavigate('batch_submission')}
            className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/60 hover:bg-slate-900/60 transition-all flex flex-col items-start gap-2.5 group text-left active:scale-[0.98] shadow-sm relative cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <CloudUpload className="w-4 h-4" />
            </div>
            {syncState.pendingCount > 0 && (
              <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-sm">
                {syncState.pendingCount}
              </span>
            )}
            <div>
              <span className="text-sm font-bold text-white block group-hover:text-purple-300 transition">
                Central Batch Sync
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                Upload pending readings
              </span>
            </div>
          </button>

          {/* Module 5: Reading Logs & Submittal History */}
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-900/60 transition-all flex flex-col items-start gap-2.5 group text-left active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-white block group-hover:text-sky-300 transition">
                Reading Logs & Status
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                Review and status log
              </span>
            </div>
          </button>

          {/* Module 6: Diagnostics & System Settings */}
          <button
            type="button"
            onClick={() => onNavigate('debug')}
            className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-900/60 transition-all flex flex-col items-start gap-2.5 group text-left active:scale-[0.98] shadow-sm cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-white block group-hover:text-sky-300 transition">
                Device & Diagnostics
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                Offline database & health
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* READING STATUS SUMMARIES (Standardized Responsive 4-Card Grid) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Reading Status Summaries</span>
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            Shift Completion: <strong className="text-emerald-400">{percentComplete}%</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Summary Card 1: Assigned Meters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-sm space-y-1.5 hover:border-slate-700/80 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                Assigned
              </span>
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                {totalAssigned}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                meters
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 truncate">
              {unreadCount} remaining unread
            </p>
          </div>

          {/* Summary Card 2: Completed / Read This Month */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-sm space-y-1.5 hover:border-slate-700/80 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] uppercase font-bold text-emerald-400 tracking-wider">
                Completed
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tracking-tight">
                {readCount}
              </span>
              <span className="text-[11px] font-mono text-emerald-500/80">
                {percentComplete}% rate
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 truncate">
              Captured on terminal
            </p>
          </div>

          {/* Summary Card 3: Pending Admin Approval */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-sm space-y-1.5 hover:border-slate-700/80 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] uppercase font-bold text-amber-400 tracking-wider">
                Pending Approval
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-400 tracking-tight">
                {pendingCount}
              </span>
              <span className="text-[11px] font-mono text-amber-500/80">
                in review
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 truncate">
              Awaiting admin billing
            </p>
          </div>

          {/* Summary Card 4: Approved */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-sm space-y-1.5 hover:border-slate-700/80 transition">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] uppercase font-bold text-sky-400 tracking-wider">
                Approved
              </span>
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-sky-300 tracking-tight">
                {approvedCount}
              </span>
              <span className="text-[11px] font-mono text-sky-400/80">
                verified
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 truncate">
              Baseline updated
            </p>
          </div>
        </div>
      </section>

      {/* SHIFT PROGRESS CARD WITH VISUAL PROGRESS BAR */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Shift Route Progress · {user?.assignedRoutes && user.assignedRoutes.length > 0 ? user.assignedRoutes.join(', ') : (user?.zone || 'All Routes')}
            </h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Assigned coverage route meters
            </p>
          </div>

          <span className="text-emerald-400 font-mono font-bold text-xs sm:text-sm bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
            {percentComplete}% Complete
          </span>
        </div>

        <div className="flex items-end justify-between">
          <span className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
            {readCount}
            <span className="text-xs sm:text-sm text-slate-500 font-normal"> / {totalAssigned} meters</span>
          </span>
          <div className="flex items-center gap-4 text-right font-mono">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Dispatched</span>
              <span className="text-sm font-bold text-sky-400">{readCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Remaining</span>
              <span className="text-sm font-bold text-slate-200">{unreadCount}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-500 transition-all duration-500 rounded-full"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </section>

      {/* RECENT METER SUBMISSIONS (Standardized with 3-Column Odometer Grid) */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Recent Meter Submissions & Status
              </h2>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Dispatched to Central Admin Dashboard · Live verification tracking
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs font-bold text-sky-400 hover:text-sky-300 transition flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({readings.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentReadings.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 text-center text-slate-400 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-xs">No meter readings recorded on this terminal yet. Select a consumer to begin.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentReadings.map((reading) => {
              const isApproved = isReadingApproved(reading);
              const isRejected = isReadingRejected(reading);
              const isPending = isReadingPending(reading);

              return (
                <div
                  key={reading.id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 transition shadow-sm"
                >
                  {/* Account, Name & Status Badge with Fixed Height */}
                  <div className="flex items-center justify-between gap-2 min-h-[28px] h-7 w-full overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 flex-1 h-full">
                      <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/80 px-2.5 py-0.5 rounded border border-sky-800/60 shrink-0">
                        {reading.accountNumber}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-white truncate min-w-0" title={reading.consumerName}>
                        {reading.consumerName}
                      </span>
                    </div>
                    
                    {isPending && (
                      <span className="text-[10px] px-2 py-0.5 bg-amber-950/80 text-amber-400 border border-amber-800/80 rounded font-mono font-bold flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>Pending Admin Approval</span>
                      </span>
                    )}

                    {isApproved && (
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 rounded font-mono font-bold flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Approved</span>
                      </span>
                    )}

                    {isRejected && (
                      <span className="text-[10px] px-2 py-0.5 bg-rose-950/80 text-rose-400 border border-rose-800/80 rounded font-mono font-bold flex items-center gap-1 shrink-0">
                        <AlertCircle className="w-3 h-3" />
                        <span>Flagged / Rejected</span>
                      </span>
                    )}
                  </div>

                  {/* Standardized 3-Column Odometer Breakdown with Fixed Dimensions & Zero Layout Shift */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-900 rounded-xl p-3 border border-slate-800 text-center font-mono min-h-[72px] h-[72px] items-center">
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

                    <div className="flex flex-col justify-center min-w-[75px] h-full">
                      <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider block min-h-[16px] leading-tight">
                        CONSUMPTION
                      </span>
                      <span className="text-sm sm:text-base font-black text-emerald-400 block min-h-[24px] leading-tight mt-1 truncate">
                        +{reading.consumption} cu.m.
                      </span>
                    </div>
                  </div>

                  <div className="text-[10.5px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono">
                    <span>{reading.readingDate} {reading.readingTime}</span>
                    <span className="text-slate-600">·</span>
                    <span>Tag: <strong className="text-slate-300">{reading.meterSerial}</strong></span>
                    {isApproved && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>Admin Verified</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* QUICK ACTIONS PANEL (Field Shortcuts) */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>Field Terminal Shortcuts</span>
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">Quick Access</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Action 1: Camera Meter Scan */}
          <button
            type="button"
            onClick={() => onNavigate('scan_meter')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 transition-all flex flex-col items-center justify-center gap-2 group text-center active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-white block group-hover:text-sky-300 transition">
                Scan Meter
              </span>
              <span className="text-xs text-slate-400">Camera Scan</span>
            </div>
          </button>

          {/* Action 2: Consumer's List */}
          <button
            type="button"
            onClick={() => onNavigate('consumers')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col items-center justify-center gap-2 group text-center active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-white block group-hover:text-emerald-300 transition">
                Consumers
              </span>
              <span className="text-xs text-slate-400">Directory</span>
            </div>
          </button>

          {/* Action 3: Sync Queue / Upload */}
          <button
            type="button"
            onClick={() => onNavigate('batch_submission')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 transition-all flex flex-col items-center justify-center gap-2 group text-center active:scale-[0.98] relative cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Send className="w-5 h-5" />
            </div>
            {syncState.pendingCount > 0 && (
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-sm">
                {syncState.pendingCount}
              </span>
            )}
            <div>
              <span className="text-xs sm:text-sm font-bold text-white block group-hover:text-amber-300 transition">
                Sync Queue
              </span>
              <span className="text-xs text-slate-400">Batch Upload</span>
            </div>
          </button>

          {/* Action 4: Reading History */}
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition-all flex flex-col items-center justify-center gap-2 group text-center active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <History className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-white block group-hover:text-purple-300 transition">
                Readings
              </span>
              <span className="text-xs text-slate-400">Status History</span>
            </div>
          </button>
        </div>
      </section>

      {/* QUEUED READINGS TABLE / CONSUMER ROSTER FEED */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm">
        {/* Section Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="font-bold text-white text-base">
              Consumer Roster
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Assigned accounts for meter reading & billing
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg text-[10px] font-bold font-mono">
              {consumers.length} Accounts
            </span>
          </div>
        </div>

        {/* Table Viewport */}
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full text-left border-collapse bg-slate-950 text-slate-200">
            <thead className="bg-slate-950/90 text-[10px] uppercase text-slate-400 font-bold sticky top-0 z-10 backdrop-blur-md border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Account / Name</th>
                <th className="px-4 py-3">Meter Tag / SN</th>
                <th className="px-3 py-3 text-center">Previous Reading</th>
                <th className="px-3 py-3 text-center">Present Reading</th>
                <th className="px-3 py-3 text-center">Consumption</th>
                <th className="px-4 py-3 text-right">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {deduplicatedConsumers.map((consumer: Consumer, index: number) => {
                const isReadyForReading = isValidatedForFieldReading(consumer);
                const isDisconnected = isConsumerDisconnected(consumer);
                const isUnverified = isConsumerUnverified(consumer);
                const isNext = isReadyForReading && !consumer.isReadThisMonth && index === deduplicatedConsumers.findIndex((c: Consumer) => isValidatedForFieldReading(c) && !c.isReadThisMonth);
                const isApprovedReading = consumer.currentMonthReading && (consumer.currentMonthReading.approvalStatus === 'approved' || consumer.currentMonthReading.status === 'APPROVED');
                const isPendingReading = consumer.isReadThisMonth && !isApprovedReading && consumer.currentMonthReading?.approvalStatus !== 'rejected';
                
                const displayedPrevious =
                  consumer.isReadThisMonth && consumer.currentMonthReading?.previousReading !== undefined
                    ? consumer.currentMonthReading.previousReading
                    : consumer.previousReading;

                return (
                  <tr
                    key={consumer.id}
                    onClick={() => {
                      if (!isReadyForReading) return; // Disconnected or unverified accounts are not clickable
                      if (onSelectConsumer) {
                        onSelectConsumer(consumer);
                      }
                    }}
                    className={`transition-colors border-b border-slate-800/60 ${
                      !isReadyForReading
                        ? 'bg-slate-950/40 opacity-60 cursor-not-allowed select-none'
                        : isNext
                        ? 'bg-sky-950/20 font-medium cursor-pointer hover:bg-slate-800/70'
                        : consumer.isReadThisMonth
                        ? 'opacity-85 cursor-pointer hover:bg-slate-800/70'
                        : 'bg-slate-900/40 cursor-pointer hover:bg-slate-800/70'
                    }`}
                    title={
                      !isReadyForReading
                        ? isDisconnected
                          ? 'Service Disconnected by Central Admin'
                          : 'Pending Admin ID Issuance'
                        : `Click to view ${consumer.name}'s past readings ledger`
                    }
                  >
                    {/* Account & Name */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold font-mono text-slate-100">
                          {consumer.accountNumber}
                        </p>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          #{consumer.sequenceNo}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-[150px] sm:max-w-xs">
                        {consumer.name}
                      </p>
                    </td>

                    {/* Serial */}
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                      <span className="text-sky-300 font-bold block">{consumer.meterNumber || 'TAG-N/A'}</span>
                      <span className="text-[10px] text-slate-500 block">{consumer.meterSerial}</span>
                    </td>

                    {/* Previous Reading */}
                    <td className="px-3 py-3.5 text-sm font-mono text-center">
                      <span className="text-slate-200 font-bold">{formatOdometerReading(displayedPrevious)}</span>
                    </td>

                    {/* Present Reading */}
                    <td className="px-3 py-3.5 text-sm font-mono text-center">
                      {consumer.isReadThisMonth && consumer.currentMonthReading ? (
                        <span className="text-sky-400 font-bold bg-sky-950/60 px-2.5 py-1 rounded border border-sky-800/60 inline-block">
                          {formatOdometerReading(consumer.currentMonthReading.currentReading)}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs italic">Pending</span>
                      )}
                    </td>

                    {/* Consumption */}
                    <td className="px-3 py-3.5 text-sm font-mono text-center">
                      {consumer.isReadThisMonth && consumer.currentMonthReading ? (
                        <span className="text-emerald-400 font-black bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/60 inline-block">
                          +{consumer.currentMonthReading.consumption}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-mono">—</span>
                      )}
                    </td>

                    {/* Status / Action Button */}
                    <td className="px-4 py-3.5 text-right">
                      {!isReadyForReading ? (
                        <span className="inline-flex items-center gap-1 text-rose-300 text-xs font-bold bg-rose-950/80 border border-rose-800/80 px-2.5 py-1 rounded-md">
                          <Lock className="w-3 h-3 text-rose-400" />
                          <span>{isDisconnected ? 'Disconnected' : 'Unverified'}</span>
                        </span>
                      ) : isApprovedReading ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approved</span>
                        </span>
                      ) : isPendingReading ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md" title="Awaiting admin approval. Cannot re-read.">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pending Approval</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onStartReading) onStartReading(consumer);
                          }}
                          className="inline-flex items-center gap-1 text-sky-300 text-xs font-bold bg-sky-600 hover:bg-sky-500 px-3 py-1 rounded-lg transition active:scale-95 cursor-pointer shadow-sm text-white"
                        >
                          <span>Enter</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default DashboardScreen;
