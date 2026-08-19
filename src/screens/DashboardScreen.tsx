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
  RefreshCw
} from 'lucide-react';
import { Consumer, MeterReading, StaffUser, SyncState, ActiveScreen } from '../types';

interface DashboardScreenProps {
  user: StaffUser;
  consumers: Consumer[];
  readings: MeterReading[];
  syncState: SyncState;
  onNavigate: (screen: ActiveScreen) => void;
  onSyncTrigger: () => void;
  onOpenApkModal?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  consumers,
  readings,
  syncState,
  onNavigate,
  onSyncTrigger,
  onOpenApkModal,
}) => {
  const totalAssigned = consumers.length;
  const readCount = consumers.filter((c) => c.isReadThisMonth).length;
  const unreadCount = Math.max(0, totalAssigned - readCount);
  const percentComplete = totalAssigned > 0 ? Math.round((readCount / totalAssigned) * 100) : 0;

  return (
    <div className="flex-1 p-3.5 sm:p-5 lg:p-7 flex flex-col gap-4 max-w-7xl mx-auto w-full">
      {/* Shift Progress Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Shift Progress • {user.zone}
            </h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Assigned Field Reading Route
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
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Pending Sync</span>
              <span className="text-sm font-semibold text-amber-400 font-mono">{syncState.pendingCount}</span>
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

      {/* Restored Quick Actions Panel */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>Quick Actions</span>
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">Field Shortcuts</span>
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

          {/* Action 2: Route Consumers */}
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
                Find Consumer
              </span>
              <span className="text-[10px] text-slate-400">Route Directory</span>
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

          {/* Action 4: Mobile App / Flutter Config */}
          <button
            type="button"
            onClick={() => (onOpenApkModal ? onOpenApkModal() : onNavigate('flutter_config'))}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition-all flex flex-col items-center justify-center gap-2 group text-center active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block group-hover:text-purple-300 transition">
                Mobile APK
              </span>
              <span className="text-[10px] text-slate-400">Android Build</span>
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
              Assigned Consumer Route
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Sequential walking order for meter reading & billing
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
                <th className="px-4 py-3">Meter Serial</th>
                <th className="px-4 py-3">Previous Reading</th>
                <th className="px-4 py-3 text-right">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {consumers.map((consumer, index) => {
                const isNext = !consumer.isReadThisMonth && index === consumers.findIndex((c) => !c.isReadThisMonth);
                
                return (
                  <tr
                    key={consumer.id}
                    onClick={() => onNavigate('consumers')}
                    className={`transition-colors cursor-pointer hover:bg-slate-800/60 ${
                      isNext ? 'bg-sky-500/5 font-medium' : consumer.isReadThisMonth ? 'opacity-80' : ''
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
                      <p className="text-xs text-slate-400 truncate max-w-[180px] sm:max-w-xs">
                        {consumer.name}
                      </p>
                    </td>

                    {/* Serial */}
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                      {consumer.meterSerial}
                    </td>

                    {/* Last Reading */}
                    <td className="px-4 py-3.5 text-xs font-mono">
                      <span className="text-slate-100 font-semibold">{consumer.previousReading} m³</span>
                      <span className="text-slate-500 text-[10px] block font-sans">
                        Avg: {consumer.averageConsumption} m³
                      </span>
                    </td>

                    {/* Status / Action Button */}
                    <td className="px-4 py-3.5 text-right">
                      {consumer.isReadThisMonth ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Billed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sky-400 text-xs font-bold bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-md hover:bg-sky-500/20 transition">
                          <span>Read</span>
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
