import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Search, 
  History, 
  FileText, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Droplet,
  Printer
} from 'lucide-react';
import { MeterReading, ActiveScreen } from '../types';

interface HistoryScreenProps {
  readings: MeterReading[];
  onNavigate: (screen: ActiveScreen) => void;
  onViewReceipt: (reading: MeterReading) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  readings,
  onNavigate,
  onViewReceipt,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const filteredReadings = useMemo(() => {
    return readings.filter((r) => {
      const matchSearch =
        r.consumerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.meterSerial.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat = filterCategory === 'ALL' || r.category === filterCategory;

      return matchSearch && matchCat;
    });
  }, [readings, searchTerm, filterCategory]);

  return (
    <div className="p-3 sm:p-4 max-w-4xl mx-auto w-full space-y-4 pb-16">
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
          Field Meter Readings History
        </h2>
        <p className="text-xs text-slate-400">
          Archived meter readings, consumption calculations, and printable notices
        </p>
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
            <div className="font-bold text-sm text-slate-300">No Readings In History</div>
            <p className="text-xs text-slate-500">
              Readings collected in the field will be cataloged and archived here.
            </p>
          </div>
        ) : (
          filteredReadings.map((reading) => (
            <div
              key={reading.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between shadow-sm hover:border-slate-700 transition"
            >
              <div className="space-y-1 flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                    {reading.accountNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      reading.status === 'SYNCED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {reading.status}
                  </span>
                </div>

                <h4 className="font-bold text-xs text-white truncate">{reading.consumerName}</h4>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 font-mono">
                  <span>Reading: <strong className="text-slate-200">{reading.currentReading} cu.m.</strong></span>
                  <span>Used: <strong className="text-sky-400">{reading.consumption} cu.m.</strong></span>
                  <span>Total: <strong className="text-emerald-400">₱{reading.billCalculation.totalAmountDue.toFixed(2)}</strong></span>
                </div>

                <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                  <span>{reading.readingDate} {reading.readingTime}</span>
                  <span>•</span>
                  <span>Reader: {reading.readerId}</span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={() => onViewReceipt(reading)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print Receipt</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
