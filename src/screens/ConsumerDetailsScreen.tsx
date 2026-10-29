import React, { useState } from 'react';
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
import { Consumer, MeterReading, StaffUser, ActiveScreen } from '../types';

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
  user,
  onStartReading,
  onScanMeter,
  onNavigate,
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
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Meter Tag / SN</span>
            <span className="font-mono font-bold text-sky-300 text-sm block">{consumer.meterNumber || 'TAG-N/A'}</span>
            <span className="font-mono text-[10px] text-slate-400 block">{consumer.meterSerial}</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Meter Size / Rate</span>
            <span className="font-bold text-white text-sm block">{consumer.meterSize}</span>
            <span className="text-[10px] text-slate-400 block">{consumer.rateCode}</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Previous Reading</span>
            <span className="font-mono font-bold text-slate-200 text-sm block">{consumer.previousReading} cu.m.</span>
            <span className="text-[10px] text-slate-400 block">{consumer.previousReadingDate}</span>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Previous Consumed</span>
            <span className="font-mono font-bold text-sky-400 text-sm block">{consumer.previousConsumption ?? consumer.averageConsumption} cu.m.</span>
            <span className="text-[10px] text-slate-400 block">Avg: {consumer.averageConsumption} cu.m.</span>
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

      {/* Current Month Reading Status */}
      {consumer.currentMonthReading ? (
        <div className="bg-emerald-950/40 border border-emerald-600/60 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-extrabold text-sm text-emerald-300">
                  Present Reading Logged for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Recorded on {consumer.currentMonthReading.readingDate} at {consumer.currentMonthReading.readingTime}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-mono text-emerald-300 bg-emerald-900/80 px-2.5 py-1 rounded-lg border border-emerald-700 font-bold">
              Pending Admin Approval
            </span>
          </div>

          {/* Reading Continuity Grid */}
          <div className="bg-slate-950/90 rounded-xl p-3 sm:p-4 border border-slate-800 space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                PREVIOUS READING (BASELINE INDEX)
              </span>
              <span className="font-bold text-slate-200 text-sm">
                {consumer.previousReading} cu.m.
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
                PRESENT READING (CURRENT METER INDEX)
              </span>
              <span className="font-black text-sky-300 text-base">
                {consumer.currentMonthReading.currentReading} cu.m.
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                TOTAL CONSUMPTION
              </span>
              <span className="font-black text-emerald-400 text-base">
                +{consumer.currentMonthReading.consumption} cu.m.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400 font-mono">
              Reader: <strong className="text-slate-200">{consumer.currentMonthReading.readerName || 'Field Reader'}</strong>
            </span>
            <button
              onClick={() => onStartReading(consumer)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <span>Update / Adjust Present Reading</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-950/20 border border-amber-800/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-xs text-amber-300">
                Awaiting Present Reading for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Previous Index: <strong className="text-slate-200">{consumer.previousReading} cu.m.</strong> • 3-Mo Avg: <strong className="text-sky-300">{consumer.averageConsumption} cu.m.</strong>
              </div>
            </div>
          </div>

          <button
            onClick={() => onStartReading(consumer)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shrink-0 shadow cursor-pointer"
          >
            <span>Enter Present Reading</span>
          </button>
        </div>
      )}

      {/* Historical Readings Log & Progression Chain */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <History className="w-4 h-4 text-sky-400" />
            <span>Meter Readings Progression & History Chain</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {consumerReadings.length} Logged Record(s)
          </span>
        </div>

        {consumerReadings.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-6 text-center text-slate-400 text-xs space-y-1">
            <div className="font-bold text-slate-300">Initial Cycle On Track</div>
            <p className="text-[11px] text-slate-500">
              Previous baseline index: <strong className="text-slate-300 font-mono">{consumer.previousReading} cu.m.</strong> (Recorded on {consumer.previousReadingDate}).
              Historical readings chain will accumulate chronologically as present readings are logged.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {consumerReadings.map((reading) => (
              <div
                key={reading.id}
                className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono">
                      {reading.readingDate} {reading.readingTime}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        reading.approvalStatus === 'approved'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {reading.approvalStatus === 'approved' ? 'Approved & Billed' : 'Pending Admin Approval'}
                    </span>
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-400">
                    By: {reading.readerName || reading.readerId}
                  </span>
                </div>

                {/* Progression Bar: Previous -> Present = Consumption */}
                <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800/80 grid grid-cols-3 gap-2 text-center font-mono">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">PREVIOUS INDEX</span>
                    <span className="text-xs font-bold text-slate-300 block">{reading.previousReading} cu.m.</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-sky-400 block">PRESENT INDEX</span>
                    <span className="text-xs font-black text-sky-300 block">{reading.currentReading} cu.m.</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-emerald-400 block">CONSUMPTION</span>
                    <span className="text-xs font-black text-emerald-400 block">+{reading.consumption} cu.m.</span>
                  </div>
                </div>

                {reading.remarks && (
                  <div className="text-[10.5px] text-slate-400 italic font-sans">
                    Note: {reading.remarks}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
