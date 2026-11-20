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
import { Consumer, ActiveScreen, StaffUser, MeterReading } from '../types';
import {
  TAGOLOAN_BARANGAYS,
  isValidatedForFieldReading,
  getConsumerDeactivationReason,
  isConsumerDisconnected,
  formatOdometerReading,
  parseReadingTimestamp,
} from '../constants/routes';
import { DatabaseHelper } from '../services/databaseHelper';

interface ConsumerCardProps {
  consumer: Consumer;
  readingCount: number;
  latestReading?: MeterReading;
  onSelectConsumer: (consumer: Consumer) => void;
  onStartReading: (consumer: Consumer) => void;
}

const ConsumerDirectoryCard: React.FC<ConsumerCardProps> = React.memo(
  ({ consumer, readingCount, latestReading, onSelectConsumer, onStartReading }) => {
    const isReadyForReading = isValidatedForFieldReading(consumer);
    const isDisconnected = isConsumerDisconnected(consumer);
    const deactivationReason = getConsumerDeactivationReason(consumer);

    const activeReading = latestReading || consumer.currentMonthReading;
    const hasRecordedReading = Boolean(activeReading || consumer.isReadThisMonth);

    const displayedPreviousReading =
      activeReading?.previousReading !== undefined
        ? activeReading.previousReading
        : consumer.previousReading;

    const isApproved =
      activeReading?.approvalStatus === 'approved' ||
      activeReading?.status === 'APPROVED';
    const isRejected =
      activeReading?.approvalStatus === 'rejected' ||
      activeReading?.status === 'REJECTED';
    const isPendingApproval = hasRecordedReading && !isApproved && !isRejected;

    return (
      <div
        role="button"
        tabIndex={0}
        className={`consumer-card bg-slate-900 border rounded-2xl p-4 space-y-3 transition cursor-pointer active:scale-[0.99] ${
          !isReadyForReading
            ? 'border-rose-900/50 bg-slate-900/60 hover:border-rose-700/70'
            : hasRecordedReading
            ? 'border-slate-800/90 hover:border-sky-500/70'
            : 'border-slate-800/90 hover:border-sky-500/70'
        }`}
        onClick={() => onSelectConsumer(consumer)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectConsumer(consumer);
          }
        }}
      >
        {/* Row 1: Consumer Name + Clean Unboxed Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <h3 className="font-semibold text-[15px] text-white leading-snug truncate">
              {consumer.name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
              <span className="font-mono font-semibold text-sky-400">{consumer.accountNumber}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-mono">Seq #{consumer.sequenceNo}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="truncate">{consumer.category}</span>
              {readingCount > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-mono text-sky-300 tabular-nums">
                    {readingCount} {readingCount === 1 ? 'reading' : 'readings'}
                  </span>
                </>
              )}
            </div>
          </div>

          {!isReadyForReading ? (
            <span className="text-xs font-semibold text-rose-400 flex items-center gap-1 shrink-0 whitespace-nowrap pt-0.5">
              <Lock className="w-3.5 h-3.5" />
              <span>{isDisconnected ? 'Disconnected' : 'Unverified'}</span>
            </span>
          ) : isApproved ? (
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1 shrink-0 whitespace-nowrap pt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Approved</span>
            </span>
          ) : isRejected ? (
            <span className="text-xs font-semibold text-rose-300 flex items-center gap-1 shrink-0 whitespace-nowrap pt-0.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Flagged</span>
            </span>
          ) : isPendingApproval ? (
            <span className="text-xs font-semibold text-amber-300 flex items-center gap-1 shrink-0 whitespace-nowrap pt-0.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Pending</span>
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-400 shrink-0 whitespace-nowrap pt-0.5">
              Unread
            </span>
          )}
        </div>

        {/* Row 2: Address & Quiet Inactive Notice */}
        <div className="space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{consumer.address}</span>
          </div>

          {!isReadyForReading && (
            <div className="text-xs text-rose-300/90 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">
                {deactivationReason || 'Withheld from field reading until reactivated.'}
              </span>
            </div>
          )}
        </div>

        {/* Row 3: Hairline 3-Column Odometer Metrics (No Nested Box) */}
        <div className="grid grid-cols-3 divide-x divide-slate-800/80 border-t border-slate-800/70 pt-3 text-center font-mono">
          <div className="min-w-0 px-1.5 flex flex-col items-center">
            <span className="text-[11px] font-sans font-medium text-slate-400">
              Previous
            </span>
            <span className="text-sm sm:text-base font-semibold text-slate-200 tabular-nums mt-0.5">
              {formatOdometerReading(displayedPreviousReading)}
            </span>
          </div>

          <div className="min-w-0 px-1.5 flex flex-col items-center">
            <span className="text-[11px] font-sans font-medium text-sky-400">
              Present
            </span>
            <span
              className={`text-sm sm:text-base tabular-nums mt-0.5 ${
                hasRecordedReading ? 'font-bold text-sky-300' : 'text-slate-500 font-medium'
              }`}
            >
              {activeReading
                ? formatOdometerReading(activeReading.currentReading)
                : '—'}
            </span>
          </div>

          <div className="min-w-0 px-1.5 flex flex-col items-center">
            <span className="text-[11px] font-sans font-medium text-emerald-400">
              Consumed
            </span>
            <span
              className={`text-sm sm:text-base font-bold tabular-nums mt-0.5 ${
                activeReading ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              {activeReading
                ? (
                  <>
                    +{activeReading.consumption} <span className="text-[11px] font-normal text-slate-400">cu.m.</span>
                  </>
                )
                : '—'}
            </span>
          </div>
        </div>

        {/* Row 4: Quiet Footer & Single Primary Action */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/50">
          <div className="text-xs text-slate-400 font-mono truncate min-w-0">
            <span>Tag {consumer.meterNumber || consumer.meterSerial}</span>
          </div>

          {!isReadyForReading ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectConsumer(consumer);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
            >
              <Lock className="w-3 h-3 text-rose-400" />
              <span>{readingCount > 0 ? 'History' : 'Locked'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasRecordedReading) {
                  onSelectConsumer(consumer);
                } else {
                  onStartReading(consumer);
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap ${
                hasRecordedReading
                  ? 'bg-slate-800 hover:bg-slate-700 text-sky-300'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
            >
              <span>{hasRecordedReading ? 'View History' : 'Enter Reading'}</span>
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
  readingSummaryMap: Map<string, { count: number; latest?: MeterReading }>;
  onSelectConsumer: (consumer: Consumer) => void;
  onStartReading: (consumer: Consumer) => void;
}

const ConsumerDirectoryRow = ({
  ariaAttributes,
  index,
  style,
  consumers,
  readingSummaryMap,
  onSelectConsumer,
  onStartReading,
}: RowComponentProps<ConsumerRowCustomProps>) => {
  const consumer = consumers[index];
  if (!consumer) return null;

  const accKey = (consumer.accountNumber || '').trim().toLowerCase();
  const idKey = (consumer.id || '').trim().toLowerCase();
  const summary = readingSummaryMap.get(accKey) || readingSummaryMap.get(idKey);

  return (
    <div {...ariaAttributes} style={style} className="pb-3">
      <ConsumerDirectoryCard
        consumer={consumer}
        readingCount={summary?.count || 0}
        latestReading={summary?.latest}
        onSelectConsumer={onSelectConsumer}
        onStartReading={onStartReading}
      />
    </div>
  );
};

interface ConsumersScreenProps {
  consumers: Consumer[];
  readings?: MeterReading[];
  currentUser?: StaffUser | null;
  scrollContainer?: HTMLElement | null;
  onSelectConsumer: (consumer: Consumer) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onStartReading: (consumer: Consumer) => void;
}

export const ConsumersScreen: React.FC<ConsumersScreenProps> = ({
  consumers,
  readings = [],
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

  const readingSummaryMap = useMemo(() => {
    const map = new Map<string, { count: number; latest?: MeterReading }>();
    const sorted = [...readings].sort((a, b) => parseReadingTimestamp(b) - parseReadingTimestamp(a));
    const seenIds = new Set<string>();

    for (const r of sorted) {
      if (r.id && seenIds.has(r.id)) continue;
      if (r.id) seenIds.add(r.id);

      const keys = [
        (r.accountNumber || '').trim().toLowerCase(),
        (r.consumerId || '').trim().toLowerCase(),
      ].filter(Boolean);

      for (const k of keys) {
        const existing = map.get(k);
        if (!existing) {
          map.set(k, {
            count: 1,
            latest: r.approvalStatus !== 'rejected' && r.status !== 'REJECTED' ? r : undefined,
          });
        } else {
          existing.count += 1;
          if (!existing.latest && r.approvalStatus !== 'rejected' && r.status !== 'REJECTED') {
            existing.latest = r;
          }
        }
      }
    }
    return map;
  }, [readings]);

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
    defaultRowHeight: filterStatus === 'DEACTIVATED' || filterStatus === 'ALL' ? 235 : 210,
    key: `${filterStatus}-${selectedBarangay}-${searchTerm.trim()}-${filteredConsumers.length}`,
  });

  const getConsumerRowKey = useCallback(
    (index: number, data: ConsumerRowCustomProps) => data.consumers[index]?.id ?? index,
    []
  );

  const consumerRowProps = useMemo<ConsumerRowCustomProps>(
    () => ({
      consumers: filteredConsumers,
      readingSummaryMap,
      onSelectConsumer,
      onStartReading,
    }),
    [filteredConsumers, readingSummaryMap, onSelectConsumer, onStartReading]
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
