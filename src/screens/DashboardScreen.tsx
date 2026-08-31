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
  CheckCheck,
  UserCheck,
  CloudUpload,
  Layers,
  Sliders
} from 'lucide-react';
import { Consumer, MeterReading, StaffUser, SyncState, ActiveScreen } from '../types';

interface DashboardScreenProps {
  user: StaffUser;
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
  const totalAssigned = consumers.length;
  const readCount = consumers.filter((c: Consumer) => c.isReadThisMonth).length;
  const unreadCount = Math.max(0, totalAssigned - readCount);
  const percentComplete = totalAssigned > 0 ? Math.round((readCount / totalAssigned) * 100) : 0;

  // Filter pending and recent readings for field reader tracking
  const pendingApprovalReadings = readings.filter(
    (r: MeterReading) => r.approvalStatus === 'pending_approval' || (r.status === 'PENDING_SYNC' && r.approvalStatus !== 'approved' && r.approvalStatus !== 'rejected')
  );

  const recentReadings = [...readings].slice(0, 5);

  return (
    <div className="flex-1 p-3.5 sm:p-5 lg:p-7 flex flex-col gap-4 max-w-7xl mx-auto w-full">
      {/* FIELD TERMINAL MODULES (Prominently Showcased on Sign In) */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Field Terminal Modules</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-400 text-[9px] font-mono font-bold border border-emerald-800">
                  ACTIVE
                </span>
              </h2>
              <p className="text-[10.5px] text-slate-400 font-mono">
                Authorized Reader: {user.name} • {user.zone}
              </p>
            </div>
          </div>

          <span className="text-[10px] text-sky-400 font-mono bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800 hidden sm:inline-block">
            6 Operational Modules
          </span>
        </div>

        {/* 6 Grid Module Cards */}
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
                Direct odometer index logging & remarks
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
              <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black animate-pulse">
                {syncState.pendingCount}
              </span>
            )}
            <div>
              <span className="text-xs font-bold text-white block group-hover:text-purple-300 transition">
                Central Batch Sync
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                WebSocket ledger sync & upload
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
              <span className="text-xs font-bold text-white block group-hover:text-sky-300 transition">
                Reading Logs & Status
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Admin review & approval history
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
              <span className="text-xs font-bold text-white block group-hover:text-sky-300 transition">
                Device & Diagnostics
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Offline database & sync health
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Shift Progress Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Shift Progress • {user.zone}
            </h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Assigned Consumer Accounts
            </p>
          </div>

          <span className="text-emerald-400 font-mono font-bold text-xs sm:text-sm bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
            {percentComplete}% Complete
          </span>
        </div>

        <div className="flex items-end justify-between mb-2">
          <span className="text-2xl sm:text-3xl font-light text-white tracking-tight">
            {readCount}
            <span className="text-sm sm:text-base text-slate-500 font-normal"> / {totalAssigned} meters</span>
          </span>
          <div className="flex items-center gap-3 sm:gap-4 text-right">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Sent to Admin</span>
              <span className="text-sm font-semibold text-sky-400 font-mono">{readCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Remaining</span>
              <span className="text-sm font-semibold text-slate-200 font-mono">{unreadCount}</span>
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
      </div>

      {/* Field Submission Status Tracker (Read-Only Status for Reader) */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Recent Meter Submissions & Status
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Dispatched to Central Admin Dashboard • Live status tracking
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs font-bold text-sky-400 hover:text-sky-300 transition flex items-center gap-1"
          >
            <span>View All ({readings.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentReadings.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-center text-slate-400 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-xs">No meter readings recorded on this terminal yet. Select a consumer to begin.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentReadings.map((reading) => {
              const isPending = reading.approvalStatus === 'pending_approval' || (reading.status === 'PENDING_SYNC' && reading.approvalStatus !== 'approved' && reading.approvalStatus !== 'rejected');
              const isApproved = reading.approvalStatus === 'approved' || reading.status === 'SYNCED';
              const isRejected = reading.approvalStatus === 'rejected';

              return (
                <div
                  key={reading.id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                        {reading.accountNumber}
                      </span>
                      <span className="text-xs font-bold text-white truncate">{reading.consumerName}</span>
                      
                      {isPending && (
                        <span className="text-[10px] px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/80 rounded-full font-mono font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Pending Admin Approval</span>
                        </span>
                      )}

                      {isApproved && (
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-full font-mono font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approved by Admin</span>
                        </span>
                      )}

                      {isRejected && (
                        <span className="text-[10px] px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800/80 rounded-full font-mono font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Flagged by Admin</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 font-mono">
                      <span>Reading: <strong className="text-slate-200">{reading.currentReading} m³</strong></span>
                      <span>Used: <strong className="text-sky-400">{reading.consumption} m³</strong></span>
                      <span className="text-[11px] text-slate-500">{reading.readingDate} • {reading.readingTime}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Actions Panel */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>Field Terminal Actions</span>
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">Shortcuts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Action 1: Camera Meter Scan */}
          <button
            type="button"
            onClick={() => onNavigate('scan_meter')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 transition-all flex flex-col items-center justify-center gap-2 group text-center active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block group-hover:text-sky-300 transition">
                Scan Meter
              </span>
              <span className="text-[10px] text-slate-400">Camera OCR</span>
            </div>
          </button>

          {/* Action 2: Consumer's List */}
          <button
            type="button"
            onClick={() => onNavigate('consumers')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col items-center justify-center gap-2 group text-center active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block group-hover:text-emerald-300 transition">
                Consumer's List
              </span>
              <span className="text-[10px] text-slate-400">Directory</span>
            </div>
          </button>

          {/* Action 3: Sync Queue / Upload */}
          <button
            type="button"
            onClick={() => onNavigate('batch_submission')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 transition-all flex flex-col items-center justify-center gap-2 group text-center active:scale-[0.98] relative"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Send className="w-5 h-5" />
            </div>
            {syncState.pendingCount > 0 && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black animate-pulse">
                {syncState.pendingCount}
              </span>
            )}
            <div>
              <span className="text-xs font-bold text-white block group-hover:text-amber-300 transition">
                Sync Queue
              </span>
              <span className="text-[10px] text-slate-400">Batch Upload</span>
            </div>
          </button>

          {/* Action 4: Reading History */}
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition-all flex flex-col items-center justify-center gap-2 group text-center active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block group-hover:text-purple-300 transition">
                Reading Logs
              </span>
              <span className="text-[10px] text-slate-400">History & Status</span>
            </div>
          </button>
        </div>
      </section>

      {/* Queued Readings Table / Sector Feed */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm flex-1">
        {/* Section Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="font-bold text-white text-base">
              Consumer's List
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Assigned accounts for meter reading & billing
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-sky-500/10 text-sky-400 rounded-full text-[10px] font-bold uppercase tracking-tighter">
              {consumers.length} Accounts
            </span>
          </div>
        </div>

        {/* Table Viewport */}
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950/70 text-[10px] uppercase text-slate-500 font-bold sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3">Account / Name</th>
                <th className="px-4 py-3">Meter Tag / SN</th>
                <th className="px-3 py-3 text-center">Previous Reading</th>
                <th className="px-3 py-3 text-center">Present Reading</th>
                <th className="px-3 py-3 text-center">Consumption</th>
                <th className="px-4 py-3 text-right">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {consumers.map((consumer: Consumer, index: number) => {
                const isNext = !consumer.isReadThisMonth && index === consumers.findIndex((c: Consumer) => !c.isReadThisMonth);
                
                return (
                  <tr
                    key={consumer.id}
                    onClick={() => {
                      if (onStartReading) {
                        onStartReading(consumer);
                      } else if (onSelectConsumer) {
                        onSelectConsumer(consumer);
                      }
                    }}
                    className={`transition-colors cursor-pointer hover:bg-slate-800/60 ${
                      isNext ? 'bg-sky-500/5 font-medium' : consumer.isReadThisMonth ? 'opacity-90' : ''
                    }`}
                  >
                    {/* Account & Name */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold font-mono text-white">
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
                      <span className="text-slate-200 font-bold">{consumer.previousReading}</span>
                    </td>

                    {/* Present Reading */}
                    <td className="px-3 py-3.5 text-sm font-mono text-center">
                      {consumer.isReadThisMonth && consumer.currentMonthReading ? (
                        <span className="text-sky-400 font-bold bg-sky-950/60 px-2.5 py-1 rounded border border-sky-800/60 inline-block">
                          {consumer.currentMonthReading.currentReading}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs italic">Pending</span>
                      )}
                    </td>

                    {/* Consumption */}
                    <td className="px-3 py-3.5 text-sm font-mono text-center">
                      {consumer.isReadThisMonth && consumer.currentMonthReading ? (
                        <span className="text-emerald-400 font-black bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/60 inline-block">
                          {consumer.currentMonthReading.consumption}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-mono">
                          {consumer.previousConsumption ? `${consumer.previousConsumption} (Prev)` : '—'}
                        </span>
                      )}
                    </td>

                    {/* Status / Action Button */}
                    <td className="px-4 py-3.5 text-right">
                      {consumer.isReadThisMonth ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Logged</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sky-400 text-xs font-bold bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-md hover:bg-sky-500/20 transition">
                          <span>Enter Reading</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
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
