import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft, 
  PlusCircle, 
  Droplet,
  Smartphone
} from 'lucide-react';
import { Consumer, ActiveScreen } from '../types';

interface ConsumersScreenProps {
  consumers: Consumer[];
  onSelectConsumer: (consumer: Consumer) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onStartReading: (consumer: Consumer) => void;
}

export const ConsumersScreen: React.FC<ConsumersScreenProps> = ({
  consumers,
  onSelectConsumer,
  onNavigate,
  onStartReading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'READ' | 'UNREAD'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Extract unique barangays in Tagoloan
  const barangays = useMemo(() => {
    const list = Array.from(new Set(consumers.map((c) => c.barangay))).filter(Boolean);
    return ['ALL', ...list.sort()];
  }, [consumers]);

  // Filtered Consumers
  const filteredConsumers = useMemo(() => {
    return consumers.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.meterSerial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.meterNumber && c.meterNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        c.address.toLowerCase().includes(searchTerm.toLowerCase());

      const matchBarangay = selectedBarangay === 'ALL' || c.barangay === selectedBarangay;
      const matchCategory = categoryFilter === 'ALL' || c.category === categoryFilter;

      let matchReadStatus = true;
      if (filterStatus === 'READ') matchReadStatus = !!c.isReadThisMonth;
      if (filterStatus === 'UNREAD') matchReadStatus = !c.isReadThisMonth;

      return matchSearch && matchBarangay && matchCategory && matchReadStatus;
    });
  }, [consumers, searchTerm, selectedBarangay, categoryFilter, filterStatus]);

  return (
    <div className="p-3 sm:p-4 max-w-5xl mx-auto w-full space-y-3 pb-16">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
        <span className="text-xs font-semibold text-slate-400">
          Showing {filteredConsumers.length} of {consumers.length} Consumers
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white uppercase tracking-tight">
          Consumer Accounts Directory
        </h2>
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
          placeholder="Search by Account No, Name, Meter Serial or Address..."
          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition shadow-inner font-sans"
        />
      </div>

      {/* Filter Tabs / Pills */}
      <div className="flex flex-wrap gap-2 pt-1">
        {/* Status Filter */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              filterStatus === 'ALL'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('UNREAD')}
            className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
              filterStatus === 'UNREAD'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3 h-3" />
            Unread
          </button>
          <button
            onClick={() => setFilterStatus('READ')}
            className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
              filterStatus === 'READ'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </button>
        </div>

        {/* Barangay Dropdown */}
        <select
          value={selectedBarangay}
          onChange={(e) => setSelectedBarangay(e.target.value)}
          aria-label="Filter by Tagoloan Barangay"
          className="bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-sky-500"
        >
          {barangays.map((b) => (
            <option key={b} value={b}>
              {b === 'ALL' ? 'All Barangays' : `Brgy. ${b}`}
            </option>
          ))}
        </select>
      </div>

      {/* Consumers List */}
      <div className="space-y-2.5 pt-2">
        {filteredConsumers.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-500" />
            <div className="font-bold text-sm text-slate-300">No Consumers Found</div>
            <p className="text-xs text-slate-500">
              No matching records found for "{searchTerm}" in {selectedBarangay}.
            </p>
          </div>
        ) : (
          filteredConsumers.map((consumer) => (
            <div
              key={consumer.id}
              className={`bg-slate-900/90 border rounded-2xl p-3.5 transition shadow-sm hover:border-sky-600/60 cursor-pointer ${
                consumer.isReadThisMonth
                  ? 'border-emerald-900/50 bg-emerald-950/10'
                  : 'border-slate-800'
              }`}
              onClick={() => onSelectConsumer(consumer)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                      {consumer.accountNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.5 bg-slate-800 rounded">
                      Seq #{consumer.sequenceNo}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        consumer.category === 'Residential'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                          : consumer.category === 'Industrial'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800/60'
                          : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                      }`}
                    >
                      {consumer.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-white truncate">{consumer.name}</h3>

                  <div className="text-xs text-slate-400 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                    <span className="truncate">{consumer.address}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 font-mono pt-1">
                    <span>Tag/Meter: <strong className="text-sky-300">{consumer.meterNumber || consumer.meterSerial}</strong></span>
                    <span>Prev: <strong className="text-slate-200">{consumer.previousReading} cu.m.</strong></span>
                    <span>Avg: <strong className="text-slate-200">{consumer.averageConsumption} cu.m.</strong></span>
                  </div>
                </div>

                {/* Right Side Action Button */}
                <div className="flex flex-col items-end justify-between shrink-0 h-full space-y-2">
                  {consumer.isReadThisMonth ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      READ
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      PENDING
                    </span>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartReading(consumer);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm ${
                      consumer.isReadThisMonth
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        : 'bg-sky-600 hover:bg-sky-500 text-white'
                    }`}
                  >
                    <span>{consumer.isReadThisMonth ? 'Re-read' : 'Enter Reading'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
