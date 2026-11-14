import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import {
  Search,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Droplet,
  PowerOff,
  ShieldAlert,
  Lock,
  X
} from 'lucide-react';
import { Consumer, ActiveScreen, StaffUser } from '../types';
import {
  TAGOLOAN_BARANGAYS,
  isValidatedForFieldReading,
  getConsumerDeactivationReason,
  isConsumerDisconnected,
  formatOdometerReading,
} from '../constants/routes';
import { DatabaseHelper } from '../services/databaseHelper';

interface ConsumerCardProps {
  consumer: Consumer;
  onSelectConsumer: (consumer: Consumer) => void;
  onStartReading: (consumer: Consumer) => void;
}

const ConsumerDirectoryCard: React.FC<ConsumerCardProps> = React.memo(
  ({ consumer, onSelectConsumer, onStartReading }) => {
    const isReadyForReading = isValidatedForFieldReading(consumer);
    const isDisconnected = isConsumerDisconnected(consumer);
    const deactivationReason = getConsumerDeactivationReason(consumer);

    const displayedPreviousReading =
      consumer.isReadThisMonth && consumer.currentMonthReading?.previousReading !== undefined
        ? consumer.currentMonthReading.previousReading
        : consumer.previousReading;

    const isApproved =
      consumer.currentMonthReading?.approvalStatus === 'approved' ||
      consumer.currentMonthReading?.status === 'APPROVED';
    const isRejected =
      consumer.currentMonthReading?.approvalStatus === 'rejected' ||
      consumer.currentMonthReading?.status === 'REJECTED';
    const isPendingApproval = consumer.isReadThisMonth && !isApproved && !isRejected;

    return (
      <div
        className={`consumer-card border rounded-2xl p-3.5 sm:p-4 space-y-3 transition shadow-sm ${
          !isReadyForReading
            ? 'border-rose-900/40 bg-slate-900/40 opacity-75 cursor-not-allowed select-none'
            : consumer.isReadThisMonth
            ? 'border-emerald-900/50 bg-emerald-950/10 hover:border-sky-500/70 cursor-pointer active:scale-[0.99]'
            : 'border-slate-800 bg-slate-900/90 hover:border-sky-500/70 cursor-pointer active:scale-[0.99]'
        }`}
        onClick={() => {
          if (isReadyForReading) {
            onSelectConsumer(consumer);
          }
        }}
      >
        {/* Row 1: Clean Metadata (Account · Seq · Category) + Single Status Tag */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 text-xs flex-wrap">
            <span className="font-mono font-bold text-sky-300 shrink-0">
              {consumer.accountNumber}
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-400 shrink-0">
              Seq #{consumer.sequenceNo}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 font-medium truncate">
              {consumer.category}
            </span>
          </div>

          {!isReadyForReading ? (
            <span className="text-[11px] font-bold text-rose-300 bg-rose-950 border border-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 whitespace-nowrap">
              <Lock className="w-3 h-3 text-rose-400" />
              <span>{isDisconnected ? 'Disconnected' : 'Unverified'}</span>
            </span>
          ) : isApproved ? (
            <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Approved</span>
            </span>
          ) : isRejected ? (
            <span className="text-[11px] font-bold text-rose-300 bg-rose-950 border border-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 whitespace-nowrap">
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>Flagged</span>
            </span>
          ) : isPendingApproval ? (
            <span className="text-[11px] font-bold text-amber-300 bg-amber-950 border border-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 whitespace-nowrap">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Pending</span>
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
              Unread
            </span>
          )}
        </div>

        {/* Row 2: Consumer Name & Address (Full Width, No Fixed Height Clipping) */}
        <div className="space-y-1">
          <h3 className="font-bold text-base text-white leading-snug break-words">
            {consumer.name}
          </h3>
          <div className="text-xs text-slate-400 flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{consumer.address}</span>
          </div>
        </div>

        {/* Deactivation Alert if Inactive */}
        {!isReadyForReading && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-900/60 flex items-start gap-2 text-xs text-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-bold block text-rose-300">
                {isDisconnected
                  ? 'Service Disconnected — Withheld from Reading'
                  : 'Unverified — Awaiting Admin ID Issuance'}
              </span>
              <span className="text-xs text-rose-300/80 block mt-0.5">
                {deactivationReason || 'Unavailable until reactivated by Central Admin.'}
              </span>
            </div>
          </div>
        )}

        {/* Full-Width 3-Column Odometer Grid (Zero Horizontal Compression) */}
        <div className="grid grid-cols-3 divide-x divide-slate-800/80 bg-slate-950 rounded-xl py-2.5 px-1 border border-slate-800 text-center font-mono">
          <div className="min-w-0 px-1.5 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wide">
              Previous
            </span>
            <span className="text-sm sm:text-base font-bold text-slate-200 tabular-nums mt-0.5">
              {formatOdometerReading(displayedPreviousReading)}
            </span>
            <span className="text-[10px] text-slate-500">cu.m.</span>
          </div>

          <div className="min-w-0 px-1.5 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase font-semibold text-sky-400 tracking-wide">
              Present
            </span>
            <span
              className={`text-sm sm:text-base tabular-nums mt-0.5 ${
                consumer.isReadThisMonth ? 'font-bold text-sky-300' : 'text-slate-400 italic font-medium'
              }`}
            >
              {consumer.isReadThisMonth && consumer.currentMonthReading
                ? formatOdometerReading(consumer.currentMonthReading.currentReading)
                : 'Pending'}
            </span>
            <span className="text-[10px] text-slate-500">
              {consumer.isReadThisMonth ? 'cu.m.' : '—'}
            </span>
          </div>

          <div className="min-w-0 px-1.5 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wide">
              Consumed
            </span>
            <span
              className={`text-sm sm:text-base font-bold tabular-nums mt-0.5 ${
                consumer.isReadThisMonth ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              {consumer.isReadThisMonth && consumer.currentMonthReading
                ? `+${consumer.currentMonthReading.consumption}`
                : '—'}
            </span>
            <span className="text-[10px] text-slate-500">
              {consumer.isReadThisMonth ? 'cu.m.' : '—'}
            </span>
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="text-xs text-slate-400 font-mono truncate min-w-0">
            <span>Tag: <strong className="text-sky-300">{consumer.meterNumber || consumer.meterSerial}</strong></span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span>{consumer.rateCode}</span>
          </div>

          {!isReadyForReading ? (
            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 text-slate-400 border border-slate-700/80 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>Locked</span>
            </span>
          ) : isPendingApproval ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectConsumer(consumer);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 transition flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>View Ledger</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (consumer.isReadThisMonth) {
                  onSelectConsumer(consumer);
                } else {
                  onStartReading(consumer);
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer shrink-0 whitespace-nowrap ${
                consumer.isReadThisMonth
                  ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
            >
              <span>{consumer.isReadThisMonth ? 'View History' : 'Enter Reading'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }
);

ConsumerDirectoryCard.displayName = 'ConsumerDirectoryCard';

interface ConsumerRowCustomProps {
  consumers: Consumer[];
  onSelectConsumer: (consumer: Consumer) => void;
  onStartReading: (consumer: Consumer) => void;
}

const ConsumerDirectoryRow = ({
  ariaAttributes,
  index,
  style,
  consumers,
  onSelectConsumer,
  onStartReading,
}: RowComponentProps<ConsumerRowCustomProps>) => {
  const consumer = consumers[index];
  if (!consumer) return null;

  return (
    <div {...ariaAttributes} style={style} className="pb-3">
      <ConsumerDirectoryCard
        consumer={consumer}
        onSelectConsumer={onSelectConsumer}
        onStartReading={onStartReading}
      />
    </div>
  );
};

interface ConsumersScreenProps {
  consumers: Consumer[];
  currentUser?: StaffUser | null;
  scrollContainer?: HTMLElement | null;
  onSelectConsumer: (consumer: Consumer) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onStartReading: (consumer: Consumer) => void;
}

export const ConsumersScreen: React.FC<ConsumersScreenProps> = ({
  consumers,
  currentUser,
  scrollContainer,
  onSelectConsumer,
  onNavigate,
  onStartReading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'READY' | 'ALL' | 'READ' | 'UNREAD' | 'DEACTIVATED'>('READY');
  const [allRouteConsumers, setAllRouteConsumers] = useState<Consumer[]>([]);

  useEffect(() => {
    const routes = currentUser?.assignedRoutes || (currentUser?.zone ? [currentUser.zone] : undefined);
    DatabaseHelper.getAllConsumersForRoute(routes).then((list) => {
      setAllRouteConsumers(list);
    });
  }, [consumers, currentUser]);

  const baseConsumerPool = useMemo(() => {
    const raw =
      filterStatus === 'DEACTIVATED' || filterStatus === 'ALL'
        ? allRouteConsumers.length > 0
          ? allRouteConsumers
          : consumers
        : consumers.filter(isValidatedForFieldReading);

    const seen = new Set<string>();
    const unique: Consumer[] = [];
    for (const c of raw) {
      const key = (c.accountNumber || '').trim().toLowerCase() || c.id;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
      }
    }
    return unique.sort((a, b) => {
      const seqA = a.sequenceNo ?? 99999;
      const seqB = b.sequenceNo ?? 99999;
      if (seqA !== seqB) return seqA - seqB;
      return (a.accountNumber || '').localeCompare(b.accountNumber || '');
    });
  }, [consumers, allRouteConsumers, filterStatus]);

  const barangays = useMemo(() => {
    const list = Array.from(new Set([...TAGOLOAN_BARANGAYS, ...baseConsumerPool.map((c) => c.barangay)])).filter(Boolean);
    return ['ALL', ...list.sort()];
  }, [baseConsumerPool]);

  const deactivatedCount = useMemo(() => {
    return allRouteConsumers.filter((c) => !isValidatedForFieldReading(c)).length;
  }, [allRouteConsumers]);

  const readyCount = useMemo(() => {
    return allRouteConsumers.filter(isValidatedForFieldReading).length;
  }, [allRouteConsumers]);

  const filteredConsumers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return baseConsumerPool.filter((c) => {
      const matchSearch =
        !query ||
        (c.name || '').toLowerCase().includes(query) ||
        (c.accountNumber || '').toLowerCase().includes(query) ||
        (c.meterSerial || '').toLowerCase().includes(query) ||
        (c.meterNumber && c.meterNumber.toLowerCase().includes(query)) ||
        (c.address || '').toLowerCase().includes(query) ||
        (c.barangay || '').toLowerCase().includes(query);

      const matchBarangay = selectedBarangay === 'ALL' || c.barangay === selectedBarangay;

      const isReady = isValidatedForFieldReading(c);
      let matchStatus = true;
      if (filterStatus === 'READY') matchStatus = isReady;
      if (filterStatus === 'READ') matchStatus = isReady && !!c.isReadThisMonth;
      if (filterStatus === 'UNREAD') matchStatus = isReady && !c.isReadThisMonth;
      if (filterStatus === 'DEACTIVATED') matchStatus = !isReady;

      return matchSearch && matchBarangay && matchStatus;
    });
  }, [baseConsumerPool, searchTerm, selectedBarangay, filterStatus]);

  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: filterStatus === 'DEACTIVATED' || filterStatus === 'ALL' ? 310 : 245,
    key: `${filterStatus}-${selectedBarangay}-${searchTerm.trim()}-${filteredConsumers.length}`,
  });

  const getConsumerRowKey = useCallback(
    (index: number, data: ConsumerRowCustomProps) => data.consumers[index]?.id ?? index,
    []
  );

  const consumerRowProps = useMemo<ConsumerRowCustomProps>(
    () => ({
      consumers: filteredConsumers,
      onSelectConsumer,
      onStartReading,
    }),
    [filteredConsumers, onSelectConsumer, onStartReading]
  );

  return (
    <div className="p-3.5 sm:p-5 max-w-5xl mx-auto w-full space-y-3.5 pb-20">
      {/* Sticky Search & Breadcrumb Header */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md pt-1 pb-3 -mx-3.5 sm:-mx-5 px-3.5 sm:px-5 border-b border-slate-800/80 space-y-2.5 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition active:scale-95 py-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            Showing <strong className="text-white">{filteredConsumers.length}</strong> of {consumers.length}
          </span>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="search"
            inputMode="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, account, or meter tag..."
            className="w-full h-11 bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded-xl pl-10 pr-10 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 transition shadow-inner font-sans"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
              title="Clear search"
              aria-label="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Directory Title */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Consumer Directory
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Field meter reading sequence
          </p>
        </div>
        {currentUser && (
          <span className="text-xs font-mono text-sky-300 font-semibold">
            {currentUser.assignedRoutes && currentUser.assignedRoutes.length > 0
              ? currentUser.assignedRoutes.join(', ')
              : currentUser.zone || 'All Routes'}
          </span>
        )}
      </div>

      {/* Status Tabs & Barangay Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterStatus('READY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              filterStatus === 'READY'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Droplet className="w-3.5 h-3.5" />
            <span>Active ({readyCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('UNREAD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              filterStatus === 'UNREAD'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Unread</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('READ')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              filterStatus === 'READ'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('DEACTIVATED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              filterStatus === 'DEACTIVATED'
                ? 'bg-rose-900 text-rose-100 border border-rose-700'
                : 'bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-200'
            }`}
          >
            <PowerOff className="w-3.5 h-3.5" />
            <span>Deactivated ({deactivatedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
              filterStatus === 'ALL'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
        </div>

        <select
          value={selectedBarangay}
          onChange={(e) => setSelectedBarangay(e.target.value)}
          aria-label="Filter by Tagoloan Barangay"
          className="w-full sm:w-auto bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500"
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
        <div className="bg-rose-950/30 border border-rose-900/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-200">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Deactivated / Inactive Accounts</span>
            <p className="text-xs text-rose-300/80 mt-0.5">
              Withheld from field meter reading until reactivated by Central Admin.
            </p>
          </div>
        </div>
      )}

      {/* Virtualized Consumers List (react-window v2 with dynamic row height) */}
      <div>
        {filteredConsumers.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-500" />
            <div className="font-bold text-sm text-slate-300">No Consumers Found</div>
            <p className="text-xs text-slate-500">
              {searchTerm.trim()
                ? `No matching records found for "${searchTerm.trim()}".`
                : selectedBarangay !== 'ALL'
                ? `No consumers in Brgy. ${selectedBarangay} match the active filters.`
                : 'No consumers match the active status filters.'}
            </p>
            {searchTerm.trim() && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Search Filter</span>
              </button>
            )}
          </div>
        ) : (
          <List
            rowComponent={ConsumerDirectoryRow}
            rowCount={filteredConsumers.length}
            rowHeight={dynamicRowHeight}
            rowProps={consumerRowProps}
            rowKey={getConsumerRowKey}
            overscanCount={4}
            defaultHeight={520}
            scrollElement={scrollContainer !== undefined ? scrollContainer : 'window'}
          />
        )}
      </div>
    </div>
  );
};

export default ConsumersScreen;
