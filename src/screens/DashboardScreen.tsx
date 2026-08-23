import React, { useState } from 'react';
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
  UserCheck,
  Clock,
  Check,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  CheckCheck
} from 'lucide-react';
import { Consumer, MeterReading, StaffUser, SyncState, ActiveScreen } from '../types';
import { universalApiFetch } from '../services/apiConfig';
import { DatabaseHelper } from '../services/databaseHelper';
import { LoggerService } from '../services/loggerService';

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
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const totalAssigned = consumers.length;
  const readCount = consumers.filter((c) => c.isReadThisMonth).length;
  const unreadCount = Math.max(0, totalAssigned - readCount);
  const percentComplete = totalAssigned > 0 ? Math.round((readCount / totalAssigned) * 100) : 0;

  // Filter pending readings that await admin approval
  const pendingApprovalReadings = readings.filter(
    (r) => r.approvalStatus === 'pending_approval' || (r.status === 'PENDING_SYNC' && r.approvalStatus !== 'approved' && r.approvalStatus !== 'rejected')
  );

  // Handle Admin Approval
  const handleApprove = async (reading: MeterReading) => {
    setProcessingId(reading.id);
    setActionFeedback(null);

    try {
      // 1. Send approval to Central Server
      const res = await universalApiFetch(`/api/readings/${reading.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ approvedBy: user.name }),
      });

      // 2. Update local DB
      await DatabaseHelper.saveReading({
        ...reading,
        approvalStatus: 'approved',
        status: 'SYNCED',
      });

      await LoggerService.log(
        'READING_ADMIN_APPROVED',
        `Admin ${user.name} approved reading ${reading.currentReading} m³ for Account #${reading.accountNumber} (${reading.consumerName}). Billing posted.`,
        user.id,
        user.name
      );

      setActionFeedback(`✓ Approved reading for ${reading.consumerName} (${reading.accountNumber}). Billing statement published.`);
      onSyncTrigger();
    } catch (err: any) {
      // Update locally even if offline
      await DatabaseHelper.saveReading({
        ...reading,
        approvalStatus: 'approved',
        status: 'SYNCED',
      });
      setActionFeedback(`✓ Approved locally: ${reading.accountNumber}`);
      onSyncTrigger();
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Admin Rejection
  const handleReject = async (reading: MeterReading) => {
    const reason = window.prompt(`Enter reason for rejecting reading for ${reading.consumerName}:`, 'Dial number unclear / high consumption variance');
    if (!reason) return;

    setProcessingId(reading.id);
    setActionFeedback(null);

    try {
      await universalApiFetch(`/api/readings/${reading.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ reason, rejectedBy: user.name }),
      });

      await DatabaseHelper.saveReading({
        ...reading,
        approvalStatus: 'rejected',
        remarks: `REJECTED: ${reason}`,
      });

      await LoggerService.log(
        'READING_ADMIN_REJECTED',
        `Admin ${user.name} rejected reading for Account #${reading.accountNumber}. Reason: ${reason}`,
        user.id,
        user.name
      );

      setActionFeedback(`Rejected reading for ${reading.accountNumber}. Flagged for field re-inspection.`);
      onSyncTrigger();
    } catch (err: any) {
      await DatabaseHelper.saveReading({
        ...reading,
        approvalStatus: 'rejected',
        remarks: `REJECTED: ${reason}`,
      });
      setActionFeedback(`Rejected reading for ${reading.accountNumber}`);
      onSyncTrigger();
    } finally {
      setProcessingId(null);
    }
  };

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
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Pending Approval</span>
              <span className="text-sm font-semibold text-amber-400 font-mono">{pendingApprovalReadings.length}</span>
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

      {/* Admin Action Notification Banner */}
      {actionFeedback && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button 
            onClick={() => setActionFeedback(null)}
            className="text-[11px] text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Admin Approval Queue Section */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Field Readings Pending Admin Approval
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Submitted by readers • Verify and Approve to publish consumer billings
              </p>
            </div>
          </div>

          <span className="px-2.5 py-0.5 bg-amber-950/80 border border-amber-800/80 text-amber-400 rounded-full text-xs font-mono font-bold">
            {pendingApprovalReadings.length} Pending
          </span>
        </div>

        {pendingApprovalReadings.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-center text-slate-400 flex items-center justify-center gap-2">
            <CheckCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs">All submitted field meter readings have been approved and posted.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingApprovalReadings.slice(0, 5).map((reading) => (
              <div
                key={reading.id}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                      {reading.accountNumber}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{reading.consumerName}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800/80 rounded-full font-mono font-bold">
                      Pending Approval
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 font-mono">
                    <span>Reading: <strong className="text-slate-200">{reading.currentReading} m³</strong></span>
                    <span>Used: <strong className="text-sky-400">{reading.consumption} m³</strong></span>
                    <span>Tariff: <strong className="text-emerald-400">₱{reading.billCalculation?.totalAmountDue?.toFixed(2) || '0.00'}</strong></span>
                    <span className="text-[11px] text-slate-500">Reader: {reading.readerName || reading.readerId}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleApprove(reading)}
                    disabled={processingId === reading.id}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 shadow-md shadow-emerald-950"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{processingId === reading.id ? 'Approving...' : 'Approve & Post'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReject(reading)}
                    disabled={processingId === reading.id}
                    className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}

            {pendingApprovalReadings.length > 5 && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="text-xs font-bold text-sky-400 hover:text-sky-300 transition"
                >
                  View all {pendingApprovalReadings.length} pending readings in History →
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Quick Actions Panel */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>Quick Actions</span>
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">Field Shortcuts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
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

          {/* Action 4: Staff & Meter Readers Module */}
          <button
            type="button"
            onClick={() => onNavigate('meter_readers')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col items-center justify-center gap-2 group text-center active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block group-hover:text-cyan-300 transition">
                Meter Readers
              </span>
              <span className="text-[10px] text-slate-400">Staff Approval</span>
            </div>
          </button>

          {/* Action 5: Mobile App / Flutter Config */}
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
