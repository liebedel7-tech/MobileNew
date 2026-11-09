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
} from '../constants/routes';

interface ConsumerDetailsScreenProps {
  consumer: Consumer;
  readings: MeterReading[];
  user?: StaffUser | null;
  onStartReading: (consumer: Consumer) => void;
  onScanMeter: (consumer: Consumer) => void;
  onNavigate: (screen: ActiveScreen) => void;
}

export const ConsumerDetailsScreen: React.FC<ConsumerDetailsScreenProps> = ({
  consumer,
  readings,
  onStartReading,
  onScanMeter,
  onNavigate,
}) => {
  // Consumer's readings sorted newest first
  const consumerReadings = (readings || [])
    .filter((r) => {
      const matchId = Boolean(r.consumerId && consumer.id && r.consumerId.toLowerCase() === consumer.id.toLowerCase());
      const matchAcc = Boolean(
        r.accountNumber &&
          consumer.accountNumber &&
          r.accountNumber.trim().toLowerCase() === consumer.accountNumber.trim().toLowerCase()
      );
      return matchId || matchAcc;
    })
    .sort((a, b) => {
      const timeA = new Date(`${a.readingDate}T${a.readingTime?.replace(/\s*(AM|PM)/i, '') || '00:00:00'}`).getTime();
      const timeB = new Date(`${b.readingDate}T${b.readingTime?.replace(/\s*(AM|PM)/i, '') || '00:00:00'}`).getTime();
      return timeB - timeA;
    });

  const isReadyForReading = isValidatedForFieldReading(consumer);
  const deactivationReason = getConsumerDeactivationReason(consumer);

  const isReadingApproved = (r: MeterReading) => r.approvalStatus === 'approved' || r.status === 'APPROVED';
  const isReadingRejected = (r: MeterReading) => r.approvalStatus === 'rejected' || r.status === 'REJECTED';
  const isReadingPending = (r: MeterReading) => !isReadingApproved(r) && !isReadingRejected(r);

  const pendingReading = consumer.currentMonthReading && isReadingPending(consumer.currentMonthReading)
    ? consumer.currentMonthReading
    : consumerReadings.find(isReadingPending);

  const isPendingApproval = !!pendingReading;

  return (
    <div className="p-3.5 sm:p-5 max-w-4xl mx-auto w-full space-y-3.5 pb-20">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onNavigate('consumers')}
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Consumers Directory</span>
        </button>

        <div className="flex items-center gap-1.5">
          {consumer.meterStatus && consumer.meterStatus !== 'active' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 uppercase">
              Meter: {consumer.meterStatus}
            </span>
          )}
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              consumer.status === 'Active'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-rose-950 text-rose-400 border border-rose-800'
            }`}
          >
            Account: {consumer.status}
          </span>
        </div>
      </div>

      {/* Main Consumer Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        {/* Title, Category & Address */}
        <div className="space-y-1.5 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/80 px-2.5 py-0.5 rounded border border-sky-800/60">
              {consumer.accountNumber}
            </span>
            <span className="text-[11px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
              {consumer.category}
            </span>
            <span className="text-[11px] font-mono text-slate-400 ml-auto">
              Route: <strong className="text-slate-200">{consumer.routeCode}</strong> · #{consumer.sequenceNo}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {consumer.name}
          </h2>

          <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{consumer.address}</span>
          </div>
        </div>

        {/* Primary Action Buttons Bar */}
        <div>
          {!isReadyForReading ? (
            <div className="p-3 bg-rose-950/50 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Reading Prohibited: Account or Water Meter has been deactivated by Admin.</span>
            </div>
          ) : isPendingApproval ? (
            <div className="p-3.5 bg-amber-950/60 border border-amber-600/70 rounded-2xl text-xs space-y-2.5 shadow-sm text-amber-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Reading Pending Admin Approval</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
                  Awaiting Verification
                </span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-amber-200/90">
                A present reading of <strong className="text-white font-mono">{formatOdometerReading(pendingReading?.currentReading)} cu.m.</strong> was logged on {pendingReading?.readingDate} {pendingReading?.readingTime || ''} and is awaiting central admin verification. Under Tagoloan Water District policy, you cannot read or send another reading until the admin approves this reading. Once approved, this present reading will become the baseline for the next reading.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 flex items-center gap-1.5 transition text-xs cursor-pointer active:scale-95 shadow-sm"
                >
                  <span>View in Reading Logs</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onScanMeter(consumer)}
                className="h-11 px-3 bg-slate-800 hover:bg-slate-750 text-sky-300 border border-slate-700/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-sm cursor-pointer"
              >
                <Camera className="w-4 h-4 text-sky-400" />
                <span>Scan Camera OCR</span>
              </button>

              <button
                type="button"
                onClick={() => onStartReading(consumer)}
                className="h-11 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-600/25 transition active:scale-95 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Enter Reading</span>
              </button>
            </div>
          )}
        </div>

        {/* 🚫 Deactivation Alert Banner (if deactivated) */}
        {!isReadyForReading && (
          <div className="p-3 bg-rose-950/30 border border-rose-900/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-rose-300 block text-xs">
                Account Status Notice
              </span>
              <p className="text-[11.5px] text-rose-200/90 leading-relaxed">
                {deactivationReason || 'This account or water meter is inactive and withheld from field reading capture.'}
              </p>
            </div>
          </div>
        )}

        {/* Standardized Specifications 4-Box Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[9.5px] uppercase font-bold tracking-wider">
              METER TAG / SN
            </span>
            <span className="font-bold text-sky-300 text-xs sm:text-sm block mt-0.5 truncate">
              {consumer.meterNumber || 'TAG-N/A'}
            </span>
            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
              {consumer.meterSerial}
            </span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[9.5px] uppercase font-bold tracking-wider">
              SIZE / RATE CODE
            </span>
            <span className="font-bold text-white text-xs sm:text-sm block mt-0.5">
              {consumer.meterSize || '1/2"'}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {consumer.rateCode || 'RES-01'}
            </span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[9.5px] uppercase font-bold tracking-wider">
              PREVIOUS READING
            </span>
            <span className="font-bold text-slate-200 text-xs sm:text-sm block mt-0.5">
              {formatOdometerReading(consumer.previousReading)} cu.m.
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
              {consumer.previousReadingDate || 'Prior cycle'}
            </span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[9.5px] uppercase font-bold tracking-wider">
              CONSUMPTION AVG
            </span>
            <span className="font-bold text-emerald-400 text-xs sm:text-sm block mt-0.5">
              {consumer.previousConsumption ?? consumer.averageConsumption} cu.m.
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              3-Mo: {consumer.averageConsumption} cu.m.
            </span>
          </div>
        </div>

        {/* Secondary Contact Strip */}
        {consumer.contactNumber && (
          <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5 font-mono">
            <Phone className="w-3.5 h-3.5 text-slate-500" />
            <span>Contact: <strong className="text-slate-200">{consumer.contactNumber}</strong></span>
          </div>
        )}
      </div>

      {/* Current Month Reading Status Card */}
      {consumer.currentMonthReading ? (
        <div className="bg-emerald-950/30 border border-emerald-700/60 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-emerald-300">
                  Present Reading Logged
                </h3>
                <span className="text-[10.5px] text-slate-400 font-mono">
                  {consumer.currentMonthReading.readingDate} at {consumer.currentMonthReading.readingTime}
                </span>
              </div>
            </div>

            {isReadingApproved(consumer.currentMonthReading) ? (
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Approved by Admin</span>
              </span>
            ) : isReadingRejected(consumer.currentMonthReading) ? (
              <span className="text-[10px] font-mono text-rose-300 bg-rose-950 px-2 py-0.5 rounded border border-rose-700 font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span>Flagged / Rejected</span>
              </span>
            ) : (
              <span className="text-[10px] font-mono text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Pending Admin Approval</span>
              </span>
            )}
          </div>

          {/* 3-Column Odometer Breakdown */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 text-center font-mono">
            <div>
              <span className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider block">
                PREVIOUS BASELINE
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-200 block mt-0.5">
                {formatOdometerReading(consumer.currentMonthReading.previousReading ?? consumer.previousReading)} cu.m.
              </span>
            </div>

            <div>
              <span className="text-[9.5px] uppercase font-bold text-sky-400 tracking-wider block">
                PRESENT INDEX
              </span>
              <span className="text-xs sm:text-sm font-black text-sky-300 block mt-0.5">
                {formatOdometerReading(consumer.currentMonthReading.currentReading)} cu.m.
              </span>
            </div>

            <div>
              <span className="text-[9.5px] uppercase font-bold text-emerald-400 tracking-wider block">
                CONSUMPTION
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-400 block mt-0.5">
                +{consumer.currentMonthReading.consumption} cu.m.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-400 font-mono">
              Field Reader: <strong className="text-slate-200">{consumer.currentMonthReading.readerName || 'Field Reader'}</strong>
            </span>
            <button
              type="button"
              onClick={() => onStartReading(consumer)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-sky-300 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer"
            >
              Update / Adjust
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-950/20 border border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-xs text-amber-300">
                Awaiting Present Reading
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Previous Index: <strong className="text-slate-200">{formatOdometerReading(consumer.previousReading)} cu.m.</strong> · 3-Mo Avg: <strong className="text-sky-300">{consumer.averageConsumption} cu.m.</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStartReading(consumer)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shrink-0 shadow-sm active:scale-95 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Enter Present Reading</span>
          </button>
        </div>
      )}

      {/* Historical Readings Progression Chain */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <History className="w-4 h-4 text-sky-400" />
            <span>Meter Readings History Chain</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {consumerReadings.length} Record(s)
          </span>
        </div>

        {consumerReadings.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-6 text-center text-slate-400 text-xs space-y-1">
            <div className="font-bold text-slate-300 text-sm">Initial Cycle Baseline Active</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Previous baseline index: <strong className="text-slate-200 font-mono">{formatOdometerReading(consumer.previousReading)} cu.m.</strong> ({consumer.previousReadingDate}).
              Historical records from past months will be displayed here as cycles conclude.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {consumerReadings.map((reading) => {
              const isApproved = isReadingApproved(reading);
              const isRejected = isReadingRejected(reading);
              const isPending = isReadingPending(reading);
              const billAmount = reading.billCalculation?.totalAmountDue
                ? reading.billCalculation.totalAmountDue.toFixed(2)
                : (reading.consumption * 28).toFixed(2);

              return (
                <div
                  key={reading.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 hover:border-slate-700 transition shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-white font-mono">
                      {reading.readingDate} {reading.readingTime}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1 ${
                        isApproved
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : isRejected
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Approved</span>
                        </>
                      ) : isRejected ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Flagged / Rejected</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pending Admin Approval</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* 4-Column Progression Grid with Previous, Present, Consumption, and Billed Amount */}
                  <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                    <div>
                      <span className="text-xs uppercase font-semibold text-slate-400 block">PREVIOUS</span>
                      <span className="text-sm font-bold text-slate-200 block mt-0.5">
                        {formatOdometerReading(reading.previousReading)} cu.m.
                      </span>
                    </div>
                    <div>
                      <span className="text-xs uppercase font-semibold text-sky-400 block">PRESENT</span>
                      <span className="text-sm font-black text-sky-300 block mt-0.5">
                        {formatOdometerReading(reading.currentReading)} cu.m.
                      </span>
                    </div>
                    <div>
                      <span className="text-xs uppercase font-semibold text-emerald-400 block">CONSUMPTION</span>
                      <span className="text-sm font-black text-emerald-400 block mt-0.5">
                        +{reading.consumption} cu.m.
                      </span>
                    </div>
                    <div>
                      <span className="text-xs uppercase font-semibold text-amber-400 block">BILLED AMOUNT</span>
                      <span className="text-sm font-black text-amber-300 block mt-0.5">
                        ₱{billAmount}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center justify-between gap-1.5 font-mono pt-0.5">
                    <span>Reader: <strong className="text-slate-200">{reading.readerName || reading.readerId}</strong></span>
                    {reading.approvedBy && isApproved && (
                      <span className="text-emerald-400">Verified by: {reading.approvedBy}</span>
                    )}
                    {reading.remarks && (
                      <span className="text-slate-400 italic">Note: {reading.remarks}</span>
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
