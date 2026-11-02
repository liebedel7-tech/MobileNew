import React, { useState, useMemo, useEffect } from 'react';
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
  Smartphone,
  PowerOff,
  ShieldAlert,
  Wrench,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { Consumer, ActiveScreen, StaffUser } from '../types';
import { 
  TAGOLOAN_BARANGAYS, 
  isValidatedForFieldReading, 
  getConsumerDeactivationReason,
  formatOdometerReading,
} from '../constants/routes';
import { DatabaseHelper } from '../services/databaseHelper';

interface ConsumersScreenProps {
  consumers: Consumer[];
  currentUser?: StaffUser | null;
  onSelectConsumer: (consumer: Consumer) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onStartReading: (consumer: Consumer) => void;
}

export const ConsumersScreen: React.FC<ConsumersScreenProps> = ({
  consumers,
  currentUser,
  onSelectConsumer,
  onNavigate,
  onStartReading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'READY' | 'ALL' | 'READ' | 'UNREAD' | 'DEACTIVATED'>('READY');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [allRouteConsumers, setAllRouteConsumers] = useState<Consumer[]>([]);

  // Load all route consumers (including any deactivated/excluded records) to support the "Deactivated by Admin" filter
  useEffect(() => {
    const routes = currentUser?.assignedRoutes || (currentUser?.zone ? [currentUser.zone] : undefined);
    DatabaseHelper.getAllConsumersForRoute(routes).then((list) => {
      setAllRouteConsumers(list);
    });
  }, [consumers, currentUser]);

  // Use full route dataset if DEACTIVATED or ALL tab is active, otherwise use validated consumers
  const baseConsumerPool = useMemo(() => {
    if (filterStatus === 'DEACTIVATED' || filterStatus === 'ALL') {
      return allRouteConsumers.length > 0 ? allRouteConsumers : consumers;
    }
    // Default: Strictly active validated consumers ready for field readings
    return consumers.filter(isValidatedForFieldReading);
  }, [consumers, allRouteConsumers, filterStatus]);

  // Extract unique barangays in Tagoloan, ensuring all official barangays (including Rosario) are available
  const barangays = useMemo(() => {
    const list = Array.from(new Set([...TAGOLOAN_BARANGAYS, ...baseConsumerPool.map((c) => c.barangay)])).filter(Boolean);
    return ['ALL', ...list.sort()];
  }, [baseConsumerPool]);

  // Count deactivated accounts on current route
  const deactivatedCount = useMemo(() => {
    return allRouteConsumers.filter((c) => !isValidatedForFieldReading(c)).length;
  }, [allRouteConsumers]);

  const readyCount = useMemo(() => {
    return allRouteConsumers.filter(isValidatedForFieldReading).length;
  }, [allRouteConsumers]);

  // Filtered Consumers
  const filteredConsumers = useMemo(() => {
    return baseConsumerPool.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.meterSerial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.meterNumber && c.meterNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        c.address.toLowerCase().includes(searchTerm.toLowerCase());

      const matchBarangay = selectedBarangay === 'ALL' || c.barangay === selectedBarangay;
      const matchCategory = categoryFilter === 'ALL' || c.category === categoryFilter;

      const isReady = isValidatedForFieldReading(c);
      let matchStatus = true;
      if (filterStatus === 'READY') matchStatus = isReady;
      if (filterStatus === 'READ') matchStatus = isReady && !!c.isReadThisMonth;
      if (filterStatus === 'UNREAD') matchStatus = isReady && !c.isReadThisMonth;
      if (filterStatus === 'DEACTIVATED') matchStatus = !isReady;

      return matchSearch && matchBarangay && matchCategory && matchStatus;
    });
  }, [baseConsumerPool, searchTerm, selectedBarangay, categoryFilter, filterStatus]);

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

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-black text-white uppercase tracking-tight">
          Consumer Directory
        </h2>
        {currentUser && (
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-sky-950 border border-sky-700/80 text-sky-300 font-semibold">
            Assigned: {currentUser.assignedRoutes && currentUser.assignedRoutes.length > 0 ? currentUser.assignedRoutes.join(', ') : currentUser.zone}
          </span>
        )}
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
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Status Filter */}
        <div className="flex flex-wrap bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs gap-1">
          <button
            onClick={() => setFilterStatus('READY')}
            className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
              filterStatus === 'READY'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Droplet className="w-3 h-3 text-sky-300" />
            <span>Active to Read ({readyCount})</span>
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
            <span>Unread</span>
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
            <span>Completed</span>
          </button>
          <button
            onClick={() => setFilterStatus('DEACTIVATED')}
            className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1 ${
              filterStatus === 'DEACTIVATED'
                ? 'bg-rose-900 text-rose-100 border border-rose-700'
                : 'text-rose-400 hover:text-rose-200 hover:bg-rose-950/40'
            }`}
          >
            <PowerOff className="w-3 h-3 text-rose-400" />
            <span>Deactivated ({deactivatedCount})</span>
          </button>
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              filterStatus === 'ALL'
                ? 'bg-slate-700 text-white'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            All
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

      {/* Notice when viewing Deactivated Filter */}
      {filterStatus === 'DEACTIVATED' && (
        <div className="bg-rose-950/30 border border-rose-900/60 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-200">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <span className="font-bold">Deactivated / Inactive Accounts Excluded from Field Readings</span>
            <p className="text-[11px] text-rose-300/80">
              These accounts or water meters have been deactivated, disconnected, or set to maintenance by Central Admin. They are withheld from reader scanning until reactivated.
            </p>
          </div>
        </div>
      )}

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
          filteredConsumers.map((consumer) => {
            const isReadyForReading = isValidatedForFieldReading(consumer);
            const deactivationReason = getConsumerDeactivationReason(consumer);

            return (
              <div
                key={consumer.id}
                className={`border rounded-2xl p-3.5 transition shadow-sm ${
                  !isReadyForReading
                    ? 'border-rose-900/50 bg-rose-950/10 cursor-not-allowed'
                    : consumer.isReadThisMonth
                    ? 'border-emerald-900/50 bg-emerald-950/10 hover:border-sky-600/60 cursor-pointer'
                    : 'border-slate-800 bg-slate-900/90 hover:border-sky-600/60 cursor-pointer'
                }`}
                onClick={() => {
                  if (isReadyForReading) {
                    onStartReading(consumer);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
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

                      {/* Status Badges */}
                      {consumer.meterStatus && consumer.meterStatus !== 'active' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/80 uppercase">
                          Meter: {consumer.meterStatus}
                        </span>
                      )}
                      {consumer.status && consumer.status !== 'Active' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/80 uppercase">
                          Account: {consumer.status}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-white truncate">{consumer.name}</h3>

                    <div className="text-xs text-slate-400 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                      <span className="truncate">{consumer.address}</span>
                    </div>

                    {/* Deactivation Banner if not ready */}
                    {!isReadyForReading && (
                      <div className="mt-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-900/60 flex items-start gap-2 text-xs text-rose-200">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-rose-300">
                            🚫 Deactivated by Admin — Not Available for Field Reading
                          </span>
                          <span className="text-[11px] text-rose-300/80">
                            {deactivationReason || 'Account or Water Meter deactivated in Central Admin.'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Reading & Consumption Block */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 bg-slate-950/80 rounded-xl p-3 space-y-2 font-mono text-xs border border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          PREVIOUS READING
                        </span>
                        <span className="font-bold text-slate-200 text-sm">
                          {formatOdometerReading(consumer.previousReading)} cu.m.
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          PRESENT READING
                        </span>
                        <span className={`font-bold text-sm ${
                          consumer.isReadThisMonth ? 'text-sky-300' : 'text-slate-500 italic text-xs'
                        }`}>
                          {consumer.isReadThisMonth && consumer.currentMonthReading
                            ? `${formatOdometerReading(consumer.currentMonthReading.currentReading)} cu.m.`
                            : 'Pending'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                          CONSUMPTION
                        </span>
                        <span className={`font-black text-sm ${
                          consumer.isReadThisMonth ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {consumer.isReadThisMonth && consumer.currentMonthReading
                            ? `+${consumer.currentMonthReading.consumption} cu.m.`
                            : (consumer.previousConsumption ? `${consumer.previousConsumption} cu.m. (Prev)` : '—')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-1">
                      <span>Tag: <strong className="text-sky-300">{consumer.meterNumber || consumer.meterSerial}</strong></span>
                      <span>•</span>
                      <span>Rate: <strong className="text-slate-300">{consumer.rateCode}</strong></span>
                    </div>
                  </div>

                  {/* Right Side Action Button */}
                  <div className="flex flex-col items-end justify-between shrink-0 h-full space-y-2">
                    {!isReadyForReading ? (
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <PowerOff className="w-3 h-3" />
                        DEACTIVATED
                      </span>
                    ) : consumer.isReadThisMonth ? (
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

                    {!isReadyForReading ? (
                      <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-950/40 text-rose-400 border border-rose-900/60 flex items-center gap-1 cursor-not-allowed">
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        <span>Locked</span>
                      </div>
                    ) : (
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
