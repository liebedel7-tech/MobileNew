import React from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Camera, 
  CheckCircle2, 
  Clock, 
  FileText, 
  History, 
  ShieldAlert, 
  Lock,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Consumer, MeterReading, StaffUser, ActiveScreen } from '../types';
import { 
  isValidatedForFieldReading, 
  getConsumerDeactivationReason,
  formatOdometerReading,
  parseReadingTimestamp,
} from '../constants/routes';

interface ConsumerDetailsScreenProps {
  consumer: Consumer;
  readings: MeterReading[];
  user?: StaffUser | null;
  onStartReading: (consumer: Consumer) => void;
  onScanMeter: (consumer: Consumer) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onBack?: () => void;
  backLabel?: string;
}

export const ConsumerDetailsScreen: React.FC<ConsumerDetailsScreenProps> = ({
  consumer,
  readings,
  onStartReading,
  onScanMeter,
  onNavigate,
  onBack,
  backLabel = 'Consumers Directory',
}) => {
  const seenIds = new Set<string>();
  // Consumer's readings sorted newest first (deduplicated by reading ID)
  const consumerReadings = (readings || [])
    .filter((r) => {
      const matchId = Boolean(r.consumerId && consumer.id && r.consumerId.toLowerCase() === consumer.id.toLowerCase());
      const matchAcc = Boolean(
        r.accountNumber &&
          consumer.accountNumber &&
          r.accountNumber.trim().toLowerCase() === consumer.accountNumber.trim().toLowerCase()
      );
      if (!matchId && !matchAcc) return false;
      if (r.id && seenIds.has(r.id)) return false;
      if (r.id) seenIds.add(r.id);
      return true;
    })
    .sort((a, b) => {
      const timeA = parseReadingTimestamp(a);
      const timeB = parseReadingTimestamp(b);
      if (timeB !== timeA) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    });

  const isReadyForReading = isValidatedForFieldReading(consumer);
  const deactivationReason = getConsumerDeactivationReason(consumer);

  const isReadingApproved = (r: MeterReading) => r.approvalStatus === 'approved' || r.status === 'APPROVED';
  const isReadingRejected = (r: MeterReading) => r.approvalStatus === 'rejected' || r.status === 'REJECTED';

  const latestRecorded =
    consumerReadings.find((r) => !isReadingRejected(r)) ||
    (consumer.currentMonthReading && !isReadingRejected(consumer.currentMonthReading)
      ? consumer.currentMonthReading
      : undefined);

  const activeBaseline = latestRecorded ? latestRecorded.currentReading : consumer.previousReading;
  const activeBaselineDate = latestRecorded
    ? `${latestRecorded.readingDate}${latestRecorded.readingTime ? ` ${latestRecorded.readingTime}` : ''}`
    : consumer.previousReadingDate;

  const displayedCurrentReading = latestRecorded || consumer.currentMonthReading;

  return (
    <div className="p-3.5 sm:p-5 max-w-4xl mx-auto w-full space-y-4 pb-20">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : onNavigate('consumers'))}
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition active:scale-95 cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-medium">
          {consumer.meterStatus && consumer.meterStatus !== 'active' && (
            <>
              <span className="text-rose-400 capitalize">Meter: {consumer.meterStatus}</span>
              <span aria-hidden="true" className="text-slate-700">·</span>
            </>
          )}
          <span className={consumer.status === 'Active' ? 'text-emerald-400' : 'text-rose-400'}>
            {consumer.status}
          </span>
        </div>
      </div>

      {/* Main Consumer Profile Card (Single Elevation, Zero Nested Boxes) */}
      <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
            {consumer.name}
          </h2>
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-400">
            <span className="font-mono font-semibold text-sky-400">{consumer.accountNumber}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{consumer.category}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono">Route {consumer.routeCode} #{consumer.sequenceNo}</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{consumer.address}</span>
          </div>
          {consumer.contactNumber && (
            <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
              <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{consumer.contactNumber}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isReadyForReading ? (
          <div className="pt-3 border-t border-slate-800/70 flex items-start gap-2.5 text-xs text-rose-300">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block">Reading Disabled</span>
              <p className="text-rose-300/80 leading-relaxed">
                {deactivationReason || 'This account or water meter is inactive and withheld from field reading capture.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onScanMeter(consumer)}
                className="h-11 px-3 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Scan Camera</span>
              </button>

              <button
                type="button"
                onClick={() => onStartReading(consumer)}
                className="h-11 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>{latestRecorded ? 'New Reading' : 'Enter Reading'}</span>
              </button>
            </div>

            {latestRecorded && (
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400 pt-1">
                <span>
                  Active baseline: <strong className="font-mono text-slate-200">{formatOdometerReading(latestRecorded.currentReading)} cu.m.</strong>
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="text-sky-400 hover:text-sky-300 font-semibold inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                >
                  <span>All Accounts</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Hairline Meter Specs Strip (No Nested Boxes) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3.5 border-t border-slate-800/70 font-mono">
          <div className="min-w-0">
            <span className="text-[11px] font-sans text-slate-400 block">Meter Tag</span>
            <span className="font-semibold text-sky-300 text-xs sm:text-sm block mt-0.5 truncate">
              {consumer.meterNumber || consumer.meterSerial || 'TAG-N/A'}
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] font-sans text-slate-400 block">Meter Size</span>
            <span className="font-semibold text-slate-200 text-xs sm:text-sm block mt-0.5">
              {consumer.meterSize || '1/2"'}
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] font-sans text-slate-400 block">
              {latestRecorded ? 'Active Baseline' : 'Previous Reading'}
            </span>
            <span className="font-semibold text-slate-200 text-xs sm:text-sm block mt-0.5 tabular-nums">
              {formatOdometerReading(activeBaseline)} cu.m.
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-[11px] font-sans text-slate-400 block">3-Mo Average</span>
            <span className="font-semibold text-emerald-400 text-xs sm:text-sm block mt-0.5 tabular-nums">
              {consumer.averageConsumption} cu.m.
            </span>
          </div>
        </div>
      </div>

      {/* Latest Reading Summary Card */}
      {displayedCurrentReading ? (
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm text-white">Latest Reading</h3>
              <span className="text-xs text-slate-400 font-mono">
                {displayedCurrentReading.readingDate}
                {displayedCurrentReading.readingTime ? ` · ${displayedCurrentReading.readingTime}` : ''}
              </span>
            </div>

            {isReadingApproved(displayedCurrentReading) ? (
              <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1 shrink-0 whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Approved</span>
              </span>
            ) : isReadingRejected(displayedCurrentReading) ? (
              <span className="text-xs font-semibold text-rose-300 flex items-center gap-1 shrink-0 whitespace-nowrap">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Flagged</span>
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1 shrink-0 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Pending</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-800/80 border-t border-slate-800/70 pt-3 text-center font-mono">
            <div className="min-w-0 px-1.5 flex flex-col items-center">
              <span className="text-[11px] font-sans font-medium text-slate-400">Previous</span>
              <span className="text-sm sm:text-base font-semibold text-slate-200 tabular-nums mt-0.5">
                {formatOdometerReading(displayedCurrentReading.previousReading ?? consumer.previousReading)}
              </span>
            </div>

            <div className="min-w-0 px-1.5 flex flex-col items-center">
              <span className="text-[11px] font-sans font-medium text-sky-400">Present</span>
              <span className="text-sm sm:text-base font-bold text-sky-300 tabular-nums mt-0.5">
                {formatOdometerReading(displayedCurrentReading.currentReading)}
              </span>
            </div>

            <div className="min-w-0 px-1.5 flex flex-col items-center">
              <span className="text-[11px] font-sans font-medium text-emerald-400">Consumed</span>
              <span className="text-sm sm:text-base font-bold text-emerald-400 tabular-nums mt-0.5">
                +{displayedCurrentReading.consumption} <span className="text-[11px] font-normal text-slate-400">cu.m.</span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/50 text-xs text-slate-400">
            <span className="truncate">
              Reader: <strong className="text-slate-200 font-medium">{displayedCurrentReading.readerName || 'Field Reader'}</strong>
            </span>
            {isReadyForReading && (
              <button
                type="button"
                onClick={() => onStartReading(consumer)}
                className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-0.5 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <span>Record Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-sm text-white">No Reading Recorded Yet</div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Baseline: {formatOdometerReading(consumer.previousReading)} cu.m.
            </div>
          </div>

          {isReadyForReading ? (
            <button
              type="button"
              onClick={() => onStartReading(consumer)}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-xl text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Enter Reading</span>
            </button>
          ) : (
            <span className="text-xs text-rose-400 flex items-center gap-1 shrink-0">
              <Lock className="w-3.5 h-3.5" />
              <span>Locked</span>
            </span>
          )}
        </div>
      )}

      {/* Reading History Section (Unified Single-Card List) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <History className="w-4 h-4 text-sky-400" />
            <span>Reading History</span>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {consumerReadings.length} {consumerReadings.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {consumerReadings.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-6 text-center text-slate-400 text-xs space-y-1">
            <div className="font-semibold text-slate-200 text-sm">Initial Baseline Active</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Starting baseline: <strong className="text-slate-200 font-mono">{formatOdometerReading(consumer.previousReading)} cu.m.</strong>
              {activeBaselineDate ? ` (${activeBaselineDate})` : ''}. Future readings logged for this account will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl divide-y divide-slate-800/70 overflow-hidden">
            {consumerReadings.map((reading) => {
              const isApproved = isReadingApproved(reading);
              const isRejected = isReadingRejected(reading);

              return (
                <div key={reading.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-white font-mono">
                      {reading.readingDate}
                      {reading.readingTime ? ` · ${reading.readingTime}` : ''}
                    </span>

                    {isApproved ? (
                      <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Approved</span>
                      </span>
                    ) : isRejected ? (
                      <span className="text-xs font-semibold text-rose-300 flex items-center gap-1 whitespace-nowrap">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Flagged</span>
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-300 flex items-center gap-1 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>

                  {/* Clean 3-Column Readings-Only Row */}
                  <div className="grid grid-cols-3 divide-x divide-slate-800/80 text-center font-mono items-center">
                    <div className="min-w-0 px-1.5 flex flex-col justify-center">
                      <span className="text-[11px] font-sans font-medium text-slate-400">Previous</span>
                      <span className="text-sm font-semibold text-slate-200 tabular-nums mt-0.5">
                        {formatOdometerReading(reading.previousReading)}
                      </span>
                    </div>
                    <div className="min-w-0 px-1.5 flex flex-col justify-center">
                      <span className="text-[11px] font-sans font-medium text-sky-400">Present</span>
                      <span className="text-sm font-bold text-sky-300 tabular-nums mt-0.5">
                        {formatOdometerReading(reading.currentReading)}
                      </span>
                    </div>
                    <div className="min-w-0 px-1.5 flex flex-col justify-center">
                      <span className="text-[11px] font-sans font-medium text-emerald-400">Consumed</span>
                      <span className="text-sm font-bold text-emerald-400 tabular-nums mt-0.5">
                        +{reading.consumption} <span className="text-[11px] font-normal text-slate-400">cu.m.</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center justify-between gap-1.5">
                    <span>
                      Reader: <strong className="text-slate-200 font-medium">{reading.readerName || reading.readerId}</strong>
                    </span>
                    {reading.approvedBy && isApproved && (
                      <span className="text-emerald-400">Verified by {reading.approvedBy}</span>
                    )}
                    {reading.remarks && (
                      <span className="text-slate-400 italic w-full">Note: {reading.remarks}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsumerDetailsScreen;
