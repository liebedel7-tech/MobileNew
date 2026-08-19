import React from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Droplet, 
  Camera, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ShieldCheck, 
  Calendar,
  AlertTriangle,
  History,
  Tag
} from 'lucide-react';
import { Consumer, MeterReading, ActiveScreen } from '../types';

interface ConsumerDetailsScreenProps {
  consumer: Consumer;
  readings: MeterReading[];
  onStartReading: (consumer: Consumer) => void;
  onScanMeter: (consumer: Consumer) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onViewReceipt: (reading: MeterReading) => void;
}

export const ConsumerDetailsScreen: React.FC<ConsumerDetailsScreenProps> = ({
  consumer,
  readings,
  onStartReading,
  onScanMeter,
  onNavigate,
  onViewReceipt,
}) => {
  // Consumer's readings
  const consumerReadings = readings.filter(
    (r) => r.consumerId === consumer.id || r.accountNumber === consumer.accountNumber
  );

  return (
    <div className="p-3 sm:p-4 max-w-4xl mx-auto w-full space-y-4 pb-16">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('consumers')}
          className="flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Consumers</span>
        </button>

        <span
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
            consumer.status === 'Active'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : 'bg-rose-950 text-rose-400 border border-rose-800'
          }`}
        >
          Status: {consumer.status}
        </span>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-extrabold text-sky-400 bg-sky-950 px-2.5 py-0.5 rounded border border-sky-800">
                {consumer.accountNumber}
              </span>
              <span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                {consumer.category}
              </span>
            </div>
            <h2 className="text-xl font-black text-white">{consumer.name}</h2>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{consumer.address}</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onScanMeter(consumer)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition"
            >
              <Camera className="w-4 h-4" />
              <span>Scan OCR</span>
            </button>
            <button
              onClick={() => onStartReading(consumer)}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-600/30 transition"
            >
              <FileText className="w-4 h-4" />
              <span>Enter Reading</span>
            </button>
          </div>
        </div>

        {/* Meter & Route Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Meter Serial</span>
            <span className="font-mono font-bold text-white text-sm">{consumer.meterSerial}</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Meter Size</span>
            <span className="font-bold text-white text-sm">{consumer.meterSize}</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Previous Reading</span>
            <span className="font-mono font-bold text-sky-400 text-sm">{consumer.previousReading} cu.m.</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">3-Month Average</span>
            <span className="font-bold text-emerald-400 text-sm">{consumer.averageConsumption} cu.m.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Route Code:</span>
            <strong className="text-slate-200 font-mono">{consumer.routeCode}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Sequence No:</span>
            <strong className="text-slate-200 font-mono">#{consumer.sequenceNo}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-slate-500" />
            <strong className="text-slate-200">{consumer.contactNumber || 'None recorded'}</strong>
          </div>
        </div>
      </div>

      {/* Current Month Status */}
      {consumer.currentMonthReading ? (
        <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-emerald-300">
                Reading Logged for Current Cycle
              </h3>
            </div>
            <button
              onClick={() => onViewReceipt(consumer.currentMonthReading!)}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Bill Receipt</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs pt-1 text-center">
            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Present Reading</span>
              <span className="font-mono font-bold text-white text-sm">
                {consumer.currentMonthReading.currentReading} cu.m.
              </span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Consumption</span>
              <span className="font-mono font-bold text-sky-400 text-sm">
                {consumer.currentMonthReading.consumption} cu.m.
              </span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Total Amount Due</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                ₱{consumer.currentMonthReading.billCalculation.totalAmountDue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-950/20 border border-amber-800/50 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <div className="font-bold text-xs text-amber-300">Pending Field Reading</div>
              <div className="text-[11px] text-slate-400">
                This consumer has not yet been read for the current billing cycle.
              </div>
            </div>
          </div>

          <button
            onClick={() => onStartReading(consumer)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition"
          >
            Read Now
          </button>
        </div>
      )}

      {/* Historical Readings Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <History className="w-4 h-4 text-sky-400" />
          <span>Historical Readings & Billing Archive</span>
        </div>

        {consumerReadings.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No past readings archived in local cache for this consumer.
          </div>
        ) : (
          <div className="space-y-2">
            {consumerReadings.map((reading) => (
              <div
                key={reading.id}
                className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{reading.readingDate} {reading.readingTime}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        reading.status === 'SYNCED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {reading.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Reading: {reading.currentReading} cu.m. • Used: {reading.consumption} cu.m.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400 font-mono">
                      ₱{reading.billCalculation.totalAmountDue.toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => onViewReceipt(reading)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-xs"
                    title="View Statement"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
