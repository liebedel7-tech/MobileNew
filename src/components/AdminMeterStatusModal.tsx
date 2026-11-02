import React, { useState, useEffect } from 'react';
import { 
  X, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  Wrench, 
  PowerOff, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  RefreshCw, 
  Send, 
  Search,
  Sparkles,
  Radio,
  FileCheck2,
  Building2,
  Gauge,
  Phone,
  Clock,
  MapPin,
  Camera,
  Layers,
  Ban,
  Check,
  AlertCircle
} from 'lucide-react';
import { universalApiFetch } from '../services/apiConfig';
import { WebSocketService } from '../services/websocketService';
import { formatOdometerReading } from '../constants/routes';

export interface AdminMeterStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
  currentReaderRoutes?: string[];
  initialTab?: 'readings_approval' | 'meter_readers' | 'meters' | 'consumers' | 'issue_ids';
}

export const AdminMeterStatusModal: React.FC<AdminMeterStatusModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
  currentReaderRoutes = [],
  initialTab = 'readings_approval',
}) => {
  const [activeTab, setActiveTab] = useState<'readings_approval' | 'meter_readers' | 'meters' | 'consumers' | 'issue_ids'>(initialTab);
  const [meters, setMeters] = useState<any[]>([]);
  const [consumers, setConsumers] = useState<any[]>([]);
  const [pendingConsumers, setPendingConsumers] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [readers, setReaders] = useState<any[]>([]);
  const [readingsFilter, setReadingsFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [readersFilter, setReadersFilter] = useState<'all' | 'active' | 'terminated'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Reader termination modal state
  const [terminatingReader, setTerminatingReader] = useState<any | null>(null);
  const [terminationReason, setTerminationReason] = useState('Account terminated by administrator');

  // Reading rejection modal state
  const [rejectingReading, setRejectingReading] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Unclear photo or index verification required');

  const loadData = async () => {
    setLoading(true);
    try {
      const [metersRes, consumersRes, pendingRes, readingsRes, readersRes] = await Promise.all([
        universalApiFetch('/api/meters').catch(() => null),
        universalApiFetch('/api/consumers?includeInactive=true').catch(() => null),
        universalApiFetch('/api/consumers/pending').catch(() => null),
        universalApiFetch('/api/readings').catch(() => null),
        universalApiFetch('/api/readers').catch(() => null),
      ]);

      if (metersRes && metersRes.ok) {
        const data = await metersRes.json();
        setMeters(data.meters || data.data || []);
      }

      if (consumersRes && consumersRes.ok) {
        const data = await consumersRes.json();
        setConsumers(data.consumers || data.data || []);
      }

      if (pendingRes && pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingConsumers(data.pendingConsumers || data.consumers || []);
      }

      if (readingsRes && readingsRes.ok) {
        const data = await readingsRes.json();
        setReadings(data.readings || data.data || []);
      }

      if (readersRes && readersRes.ok) {
        const data = await readersRes.json();
        setReaders(data.readers || data.staff || []);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Subscribe to real-time events to refresh list
  useEffect(() => {
    if (!isOpen) return;

    const unsub = WebSocketService.subscribe((msg) => {
      if (
        msg.type === 'READER_REGISTERED_ACTIVE' ||
        msg.type === 'READING_SUBMITTED_FOR_APPROVAL' ||
        msg.type === 'READING_APPROVED_BILL_ISSUED' ||
        msg.type === 'METER_STATUS_UPDATED' ||
        msg.type === 'CONSUMER_STATUS_CHANGED' ||
        msg.type === 'READER_ACCOUNT_TERMINATED'
      ) {
        loadData();
      }
    });

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Handle Reading Approval
  const handleApproveReading = async (readingId: string) => {
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await universalApiFetch(`/api/readings/${encodeURIComponent(readingId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedBy: 'Admin Billing Supervisor',
        }),
      });

      if (res.ok) {
        setActionMessage(`✅ Reading ${readingId} approved. Billing statement issued & baseline advanced.`);
        await loadData();
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage(`❌ Approval failed: ${err.message || 'Server error'}`);
      }
    } catch (err: any) {
      setActionMessage(`❌ Approval error: ${err.message}`);
    } finally {
      setIsUpdating(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // 2. Handle Reading Rejection / Flag
  const handleConfirmRejectReading = async () => {
    if (!rejectingReading) return;
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await universalApiFetch(`/api/readings/${encodeURIComponent(rejectingReading.id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectionReason,
          rejectedBy: 'Admin Billing Supervisor',
        }),
      });

      if (res.ok) {
        setActionMessage(`⚠️ Reading for Account ${rejectingReading.accountNumber} flagged for re-inspection.`);
        setRejectingReading(null);
        await loadData();
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage(`❌ Flagging failed: ${err.message || 'Server error'}`);
      }
    } catch (err: any) {
      setActionMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsUpdating(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // 3. Handle Reader Termination
  const handleConfirmTerminateReader = async () => {
    if (!terminatingReader) return;
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await universalApiFetch(`/api/readers/${encodeURIComponent(terminatingReader.id)}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: terminationReason,
          terminatedBy: 'Admin Operations Supervisor',
        }),
      });

      if (res.ok) {
        setActionMessage(`⛔ Reader ${terminatingReader.name} (${terminatingReader.employeeId}) has been TERMINATED. Mobile terminal locked out.`);
        setTerminatingReader(null);
        await loadData();
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage(`❌ Termination failed: ${err.message || 'Server error'}`);
      }
    } catch (err: any) {
      setActionMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsUpdating(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  // 4. Handle Reader Reactivation
  const handleReactivateReader = async (readerId: string, name: string) => {
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await universalApiFetch(`/api/readers/${encodeURIComponent(readerId)}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activatedBy: 'Admin Operations Supervisor',
        }),
      });

      if (res.ok) {
        setActionMessage(`✅ Reader ${name} reactivated. Status is ACTIVE.`);
        await loadData();
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage(`❌ Reactivation failed: ${err.message || 'Server error'}`);
      }
    } catch (err: any) {
      setActionMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsUpdating(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // 5. Handle Water Meter Status Change
  const handleUpdateMeterStatus = async (
    meterNumber: string, 
    newStatus: 'active' | 'inactive' | 'damaged' | 'maintenance',
    remarks?: string
  ) => {
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await universalApiFetch(`/api/meters/${encodeURIComponent(meterNumber)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          remarks: remarks || `Status changed to ${newStatus.toUpperCase()} by Admin in Water Meters module`,
          updatedBy: 'Admin Billing Supervisor',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionMessage(`✅ Meter ${meterNumber} updated to ${newStatus.toUpperCase()}. Real-time sync dispatched.`);
        await loadData();
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage(`❌ Failed to update meter: ${err.message || 'Server error'}`);
      }
    } catch (err: any) {
      setActionMessage(`❌ Update error: ${err.message}`);
    } finally {
      setIsUpdating(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // 6. Handle Consumer Status Change
  const handleUpdateConsumerStatus = async (
    consumerId: string,
    newStatus: 'Active' | 'Inactive' | 'Disconnected',
    reason?: string
  ) => {
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await universalApiFetch(`/api/consumers/${encodeURIComponent(consumerId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          statusReason: reason || `Account changed to ${newStatus} by Admin`,
          updatedBy: 'Admin Billing Supervisor',
        }),
      });

      if (res.ok) {
        setActionMessage(`✅ Account ${consumerId} updated to ${newStatus}. Real-time sync dispatched.`);
        await loadData();
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage(`❌ Failed to update account: ${err.message || 'Server error'}`);
      }
    } catch (err: any) {
      setActionMessage(`❌ Update error: ${err.message}`);
    } finally {
      setIsUpdating(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // 7. Handle Issuing Account # and Tag # to Pending Applicant
  const handleIssueIds = async (pendingId: string) => {
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const res = await universalApiFetch(`/api/consumers/${encodeURIComponent(pendingId)}/issue-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuedBy: 'Admin Billing Supervisor',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionMessage(`🎉 IDs Issued for ${data.consumer?.name}: Acc #${data.consumer?.accountNumber}, Tag #${data.consumer?.meterNumber}. Synced to mobile reader!`);
        await loadData();
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage(`❌ Failed to issue IDs: ${err.message || 'Server error'}`);
      }
    } catch (err: any) {
      setActionMessage(`❌ Issuance error: ${err.message}`);
    } finally {
      setIsUpdating(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const pendingReadingsCount = readings.filter(r => (r.approvalStatus || 'pending_approval') === 'pending_approval').length;
  const activeReadersCount = readers.filter(r => r.status === 'active').length;
  const terminatedReadersCount = readers.filter(r => r.status === 'terminated').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-950 border border-sky-600/60 flex items-center justify-center text-sky-400">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <span>Central Admin Operations Hub</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-400 font-bold">
                  WEB PORTAL REAL-TIME
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Water Meters • Reading Approvals • Meter Readers • Consumers • ID Issuance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
              title="Refresh Records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Feedback Toast */}
        {actionMessage && (
          <div className="px-4 py-2 bg-sky-950/90 border-b border-sky-800 text-xs font-semibold text-sky-200 animate-in slide-in-from-top-1 flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-3 pt-2 gap-1 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('readings_approval')}
            className={`px-3 py-2 rounded-t-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'readings_approval'
                ? 'bg-slate-900 border-t-2 border-sky-500 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Reading Approvals</span>
            {pendingReadingsCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black">
                {pendingReadingsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('meter_readers')}
            className={`px-3 py-2 rounded-t-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'meter_readers'
                ? 'bg-slate-900 border-t-2 border-sky-500 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Meter Readers</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {readers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('meters')}
            className={`px-3 py-2 rounded-t-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'meters'
                ? 'bg-slate-900 border-t-2 border-sky-500 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            <span>Water Meters ({meters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('consumers')}
            className={`px-3 py-2 rounded-t-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'consumers'
                ? 'bg-slate-900 border-t-2 border-sky-500 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Consumers ({consumers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('issue_ids')}
            className={`px-3 py-2 rounded-t-xl transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'issue_ids'
                ? 'bg-slate-900 border-t-2 border-sky-500 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Issue IDs ({pendingConsumers.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-slate-900/60">
          
          {/* ============================================================== */}
          {/* TAB 1: READING APPROVALS MODULE                                */}
          {/* ============================================================== */}
          {activeTab === 'readings_approval' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setReadingsFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                      readingsFilter === 'pending' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Pending Approval</span>
                    <span className="font-mono text-[10px]">({pendingReadingsCount})</span>
                  </button>
                  <button
                    onClick={() => setReadingsFilter('approved')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      readingsFilter === 'approved' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Approved & Billed
                  </button>
                  <button
                    onClick={() => setReadingsFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      readingsFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Readings ({readings.length})
                  </button>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Approving updates consumer baseline index & issues bill</span>
                </div>
              </div>

              {readings.length === 0 ? (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-2">
                  <FileCheck2 className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="font-bold text-sm text-slate-300">No Readings in Ledger</p>
                  <p className="text-xs text-slate-500">
                    When mobile meter readers submit dial readings, they appear here for verification and billing approval.
                  </p>
                </div>
              ) : (
                readings
                  .filter(r => {
                    if (readingsFilter === 'pending') return (r.approvalStatus || 'pending_approval') === 'pending_approval';
                    if (readingsFilter === 'approved') return r.approvalStatus === 'approved';
                    return true;
                  })
                  .map((r) => {
                    const isPending = (r.approvalStatus || 'pending_approval') === 'pending_approval';
                    const isApproved = r.approvalStatus === 'approved';
                    const isRejected = r.approvalStatus === 'rejected';

                    return (
                      <div
                        key={r.id}
                        className={`bg-slate-950 border rounded-xl p-3.5 space-y-2 transition ${
                          isPending
                            ? 'border-amber-700/60 bg-amber-950/10'
                            : isApproved
                            ? 'border-emerald-800/60 bg-emerald-950/10'
                            : 'border-rose-900/60 bg-rose-950/10'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                                {r.accountNumber}
                              </span>
                              <span className="text-xs font-bold text-white">{r.consumerName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Tag #{r.meterNumber || r.meterSerial}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2">
                              <span>Reader: <strong className="text-slate-300">{r.readerName}</strong></span>
                              <span>•</span>
                              <span>Date: <strong>{r.readingDate} {r.readingTime || ''}</strong></span>
                              <span>•</span>
                              <span>Route: <strong>{r.route || r.barangay || 'Poblacion'}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isPending && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                PENDING APPROVAL
                              </span>
                            )}
                            {isApproved && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                APPROVED & BILLED
                              </span>
                            )}
                            {isRejected && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                                <Ban className="w-3 h-3" />
                                REJECTED / FLAGGED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dial Progression Chain */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                          <div>
                            <span className="text-[9.5px] uppercase text-slate-500 font-sans block">Previous Baseline</span>
                            <span className="font-bold text-slate-300 text-sm">{formatOdometerReading(r.previousReading)} cu.m.</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] uppercase text-slate-500 font-sans block">Present Reading</span>
                            <span className="font-bold text-sky-300 text-sm">{formatOdometerReading(r.currentReading)} cu.m.</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] uppercase text-slate-500 font-sans block">Net Consumption</span>
                            <span className="font-bold text-emerald-400 text-sm">+{r.consumption} cu.m.</span>
                          </div>
                          <div>
                            <span className="text-[9.5px] uppercase text-slate-500 font-sans block">Bill Amount</span>
                            <span className="font-bold text-amber-300 text-sm">
                              ₱{r.billCalculation?.totalAmountDue ? r.billCalculation.totalAmountDue.toFixed(2) : (r.consumption * 28).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Photo Preview Thumbnail & Rejection Reason if any */}
                        {r.photoUrl && (
                          <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                            <Camera className="w-3.5 h-3.5 text-sky-400" />
                            <span>Photo captured by reader</span>
                            <img src={r.photoUrl} alt="Meter Dial" className="w-8 h-8 rounded border border-slate-700 object-cover" />
                          </div>
                        )}

                        {r.rejectionReason && (
                          <div className="p-2 bg-rose-950/40 border border-rose-900 rounded-lg text-xs text-rose-300">
                            <strong>Flag Note:</strong> {r.rejectionReason}
                          </div>
                        )}

                        {/* Action Buttons */}
                        {isPending && (
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => setRejectingReading(r)}
                              disabled={isUpdating}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 border border-slate-700 hover:border-rose-700 text-rose-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Flag / Reject</span>
                            </button>
                            <button
                              onClick={() => handleApproveReading(r.id)}
                              disabled={isUpdating}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-950 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve & Issue Bill</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: METER READERS MODULE                                    */}
          {/* ============================================================== */}
          {activeTab === 'meter_readers' && (
            <div className="space-y-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-xs text-white block">
                    Automatic Mobile Enrollment & Status Management
                  </span>
                  <p className="text-[11px] text-slate-400">
                    When readers register on the mobile app, they automatically sync into this roster in real time. Terminating an account revokes mobile access instantly.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setReadersFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      readersFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({readers.length})
                  </button>
                  <button
                    onClick={() => setReadersFilter('active')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      readersFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Active ({activeReadersCount})
                  </button>
                  <button
                    onClick={() => setReadersFilter('terminated')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      readersFilter === 'terminated' ? 'bg-rose-900 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Terminated ({terminatedReadersCount})
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {readers
                  .filter(r => {
                    if (readersFilter === 'active') return r.status === 'active';
                    if (readersFilter === 'terminated') return r.status === 'terminated';
                    return true;
                  })
                  .map((reader) => {
                    const isTerminated = reader.status === 'terminated';

                    return (
                      <div
                        key={reader.id || reader.username}
                        className={`bg-slate-950 border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                          isTerminated
                            ? 'border-rose-900/60 bg-rose-950/15'
                            : 'border-slate-800'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                              {reader.employeeId || reader.id}
                            </span>
                            <span className="font-bold text-sm text-white">{reader.name}</span>
                            <span className="text-xs text-slate-400 font-mono">@{reader.username}</span>

                            {isTerminated ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 uppercase flex items-center gap-1">
                                <Ban className="w-3 h-3" />
                                TERMINATED / REVOKED
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                ACTIVE
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-400 pt-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                              <span className="truncate">
                                Routes: <strong className="text-slate-200">{Array.isArray(reader.assignedRoutes) ? reader.assignedRoutes.join(', ') : reader.zone || 'Poblacion'}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 truncate">
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{reader.contactNumber || 'No phone recorded'}</span>
                            </div>

                            <div className="flex items-center gap-1.5 truncate">
                              <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">
                                Enrolled: <strong className="text-slate-300">{reader.createdAt ? new Date(reader.createdAt).toLocaleDateString() : 'Auto-registered'}</strong>
                              </span>
                            </div>
                          </div>

                          {isTerminated && reader.terminationReason && (
                            <p className="text-[11px] text-rose-300 bg-rose-950/50 p-2 rounded-lg border border-rose-900/60 mt-1">
                              <strong>Termination Note:</strong> {reader.terminationReason}
                            </p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isTerminated ? (
                            <button
                              onClick={() => handleReactivateReader(reader.id, reader.name)}
                              disabled={isUpdating}
                              className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Reactivate Account</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setTerminatingReader(reader)}
                              disabled={isUpdating}
                              className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 text-xs font-bold transition flex items-center gap-1 shadow cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-400" />
                              <span>Terminate Reader</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: WATER METERS HARDWARE INVENTORY                         */}
          {/* ============================================================== */}
          {activeTab === 'meters' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Manage physical water meter operational statuses. Changing status to <strong>Inactive</strong>, <strong>Damaged</strong>, or <strong>Maintenance</strong> instantly excludes the linked consumer from mobile reader field scanning.
              </p>

              <div className="space-y-2">
                {meters.map((meter) => {
                  const status = (meter.status || 'active').toLowerCase();
                  return (
                    <div
                      key={meter.meterNumber}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                            {meter.meterNumber}
                          </span>
                          <span className="text-xs font-mono text-slate-400">SN: {meter.serialNumber}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            status === 'active'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : status === 'damaged'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : status === 'maintenance'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 font-semibold truncate">
                          Linked: {meter.consumerName || 'Unassigned'} ({meter.linkedAccountNumber || 'No Account'})
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Brgy. {meter.barangay} • Size: {meter.size} • Brand: {meter.brand} • {meter.remarks || 'Normal'}
                        </div>
                      </div>

                      {/* Status Action Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {status !== 'active' && (
                          <button
                            onClick={() => handleUpdateMeterStatus(meter.meterNumber, 'active', 'Re-activated by Admin')}
                            disabled={isUpdating}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 transition"
                          >
                            Set Active
                          </button>
                        )}
                        {status !== 'damaged' && (
                          <button
                            onClick={() => handleUpdateMeterStatus(meter.meterNumber, 'damaged', 'Dial cracked or mechanism damaged')}
                            disabled={isUpdating}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 transition"
                          >
                            Damaged
                          </button>
                        )}
                        {status !== 'maintenance' && (
                          <button
                            onClick={() => handleUpdateMeterStatus(meter.meterNumber, 'maintenance', 'Under periodic calibration / repair')}
                            disabled={isUpdating}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 transition"
                          >
                            Maintenance
                          </button>
                        )}
                        {status !== 'inactive' && (
                          <button
                            onClick={() => handleUpdateMeterStatus(meter.meterNumber, 'inactive', 'Temporarily deactivated by Admin')}
                            disabled={isUpdating}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: CONSUMER ACCOUNTS                                       */}
          {/* ============================================================== */}
          {activeTab === 'consumers' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Manage consumer connection statuses. Deactivating or disconnecting an account immediately halts reader reading entry.
              </p>

              <div className="space-y-2">
                {consumers.slice(0, 15).map((c) => {
                  const isAct = c.status === 'Active';
                  return (
                    <div
                      key={c.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                            {c.accountNumber}
                          </span>
                          <span className="font-bold text-xs text-white truncate">{c.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            isAct
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          Tag #{c.meterNumber || c.meterSerial} • Brgy. {c.barangay} • Prev: {formatOdometerReading(c.previousReading)} cu.m.
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isAct ? (
                          <button
                            onClick={() => handleUpdateConsumerStatus(c.id, 'Active', 'Reconnected by Admin')}
                            disabled={isUpdating}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 transition"
                          >
                            Activate
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleUpdateConsumerStatus(c.id, 'Inactive', 'Temporary deactivation')}
                              disabled={isUpdating}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
                            >
                              Deactivate
                            </button>
                            <button
                              onClick={() => handleUpdateConsumerStatus(c.id, 'Disconnected', 'Disconnection order executed')}
                              disabled={isUpdating}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 transition"
                            >
                              Disconnect
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: ISSUE IDS HUB (PENDING APPLICANTS)                      */}
          {/* ============================================================== */}
          {activeTab === 'issue_ids' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Pending applicants are strictly withheld from mobile field reader sync until an official Account Number and Meter Tag # are issued by the Administrator.
              </p>

              {pendingConsumers.length === 0 ? (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-300">All Applicants Processed</p>
                  <p className="text-xs text-slate-500">No applicants are currently waiting for ID issuance.</p>
                </div>
              ) : (
                pendingConsumers.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-950 border border-purple-900/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-bold">
                          APP #{p.applicationNo || p.id}
                        </span>
                        <span className="font-bold text-xs text-white">{p.name}</span>
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800">
                          PENDING ID ISSUANCE
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {p.address} • Brgy. {p.barangay} • Category: {p.category}
                      </p>
                    </div>

                    <button
                      onClick={() => handleIssueIds(p.id)}
                      disabled={isUpdating}
                      className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition shrink-0 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Issue Account & Tag #</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Real-time WebSocket Broadcast active</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition"
          >
            Close
          </button>
        </div>

        {/* ============================================================== */}
        {/* SUB-MODAL: CONFIRM READER TERMINATION                          */}
        {/* ============================================================== */}
        {terminatingReader && (
          <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-rose-600 w-full max-w-md rounded-2xl p-4 space-y-3 text-white animate-in zoom-in-95 shadow-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-600 flex items-center justify-center text-rose-400 shrink-0">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">
                    Terminate Meter Reader Account?
                  </h4>
                  <p className="text-xs text-rose-300">
                    {terminatingReader.name} ({terminatingReader.employeeId})
                  </p>
                </div>
              </div>

              <div className="bg-rose-950/40 p-2.5 rounded-xl border border-rose-900/60 text-xs text-rose-200 space-y-1">
                <span className="font-bold block">⚠️ Immediate Mobile Lockout:</span>
                <p className="text-[11px] leading-tight text-rose-200/90">
                  This action immediately broadcasts a termination signal. If this reader is currently in the field, their mobile terminal will be immediately locked out, preventing any further reading entries.
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Reason for Account Termination:
                </label>
                <input
                  type="text"
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  placeholder="e.g. End of contract, disciplinary revocation, reassigned"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTerminatingReader(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTerminateReader}
                  disabled={isUpdating}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{isUpdating ? 'Terminating...' : 'Confirm Termination'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUB-MODAL: CONFIRM READING REJECTION / FLAG                    */}
        {/* ============================================================== */}
        {rejectingReading && (
          <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-amber-600 w-full max-w-md rounded-2xl p-4 space-y-3 text-white animate-in zoom-in-95 shadow-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-600 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">
                    Flag Reading for Re-Inspection
                  </h4>
                  <p className="text-xs text-amber-300">
                    Account #{rejectingReading.accountNumber} ({rejectingReading.consumerName})
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Reason for Flagging / Re-inspection:
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Unclear dial photo, gear slip anomaly"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingReading(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectReading}
                  disabled={isUpdating}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{isUpdating ? 'Flagging...' : 'Confirm Flag'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
