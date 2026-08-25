import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  History, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Droplet,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { MeterReading, ActiveScreen } from '../types';

interface HistoryScreenProps {
  readings: MeterReading[];
  onNavigate: (screen: ActiveScreen) => void;
  onReload?: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  readings,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApproval, setFilterApproval] = useState<'ALL' | 'pending' | 'approved' | 'rejected'>('ALL');

  const pendingCount = readings.filter(
    (r) => r.approvalStatus === 'pending_approval' || (r.status === 'PENDING_SYNC' && r.approvalStatus !== 'approved' && r.approvalStatus !== 'rejected')
  ).length;
  const approvedCount = readings.filter(
    (r) => r.approvalStatus === 'approved' || r.status === 'SYNCED'
  ).length;
  const rejectedCount = readings.filter(
    (r) => r.approvalStatus === 'rejected'
  ).length;

  const filteredReadings = useMemo(() => {
    return readings.filter((r) => {
      const matchSearch =
        r.consumerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.meterSerial.toLowerCase().includes(searchTerm.toLowerCase());

      const status = r.approvalStatus || (r.status === 'SYNCED' ? 'approved' : 'pending_approval');
      const matchApproval =
        filterApproval === 'ALL' ||
        (filterApproval === 'pending' && (status === 'pending_approval' || (r.status === 'PENDING_SYNC' && status !== 'approved' && status !== 'rejected'))) ||
        (filterApproval === 'approved' && status === 'approved') ||
        (filterApproval === 'rejected' && status === 'rejected');

      return matchSearch && matchApproval;
    });
  }, [readings, searchTerm, filterApproval]);

  return (
    <div className="p-3 sm:p-4 max-w-4xl mx-auto w-full space-y-4 pb-20">
      {/* Header Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <span className="text-xs text-slate-400">
          Total Logged: <strong className="text-white">{readings.length}</strong>
        </span>
      </div>

      <div>
        <h2 className="text-lg font-black text-white uppercase tracking-tight">
          Field Meter Readings Log
        </h2>
        <p className="text-xs text-slate-400">
          History of recorded meter readings and central approval verification status
        </p>
      </div>

      {/* Approval Status Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterApproval('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
            filterApproval === 'ALL'
              ? 'bg-sky-600 text-white border-sky-500'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          All ({readings.length})
        </button>

        <button
          type="button"
          onClick={() => setFilterApproval('pending')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
            filterApproval === 'pending'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-900 text-amber-400 border-slate-800 hover:border-amber-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Approval ({pendingCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterApproval('approved')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
            filterApproval === 'approved'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-slate-900 text-emerald-400 border-slate-800 hover:border-emerald-700'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Approved ({approvedCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterApproval('rejected')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
            filterApproval === 'rejected'
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-slate-900 text-rose-400 border-slate-800 hover:border-rose-700'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
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
          placeholder="Search history by Account #, Name, or Meter Serial..."
          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-sans"
        />
      </div>

      {/* Readings Archive List */}
      <div className="space-y-2.5">
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
            const isPending = reading.approvalStatus === 'pending_approval' || (reading.status === 'PENDING_SYNC' && reading.approvalStatus !== 'approved' && reading.approvalStatus !== 'rejected');
            const isApproved = reading.approvalStatus === 'approved' || reading.status === 'SYNCED';
            const isRejected = reading.approvalStatus === 'rejected';

            return (
              <div
                key={reading.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition"
              >
                <div className="space-y-1 flex-1 min-w-0 pr-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                      {reading.accountNumber}
                    </span>

                    {isPending && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Pending Admin Approval</span>
                      </span>
                    )}

                    {isApproved && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Approved & Billed</span>
                      </span>
                    )}

                    {isRejected && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>Flagged / Rejected</span>
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-xs text-white truncate">{reading.consumerName}</h4>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 font-mono">
                    <span>PREVIOUS: <strong className="text-slate-300">{reading.previousReading}</strong></span>
                    <span>•</span>
                    <span>PRESENT: <strong className="text-sky-300">{reading.currentReading}</strong></span>
                    <span>•</span>
                    <span>CONSUMPTION: <strong className="text-emerald-400">{reading.consumption}</strong></span>
                  </div>

                  <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1 font-mono">
                    <span>{reading.readingDate} {reading.readingTime}</span>
                    <span>•</span>
                    <span>Reader: {reading.readerName || reading.readerId}</span>
                    {reading.remarks && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400 italic">Note: {reading.remarks}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
