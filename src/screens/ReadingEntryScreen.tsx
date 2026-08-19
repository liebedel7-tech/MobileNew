import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Droplet, 
  Camera, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  Calculator, 
  ShieldCheck, 
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';
import { 
  Consumer, 
  MeterReading, 
  MeterCondition, 
  StaffUser, 
  BillCalculation, 
  ActiveScreen 
} from '../types';
import { CalculationService } from '../services/calculationService';
import { LocationService } from '../services/locationService';
import { LoggerService } from '../services/loggerService';

interface ReadingEntryScreenProps {
  consumer: Consumer;
  user: StaffUser;
  initialReadingValue?: number;
  initialPhotoUrl?: string;
  initialOcrConfidence?: number;
  onSaveReading: (reading: MeterReading) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onScanWithCamera: (consumer: Consumer) => void;
}

export const ReadingEntryScreen: React.FC<ReadingEntryScreenProps> = ({
  consumer,
  user,
  initialReadingValue,
  initialPhotoUrl,
  initialOcrConfidence,
  onSaveReading,
  onNavigate,
  onScanWithCamera,
}) => {
  const [currentReading, setCurrentReading] = useState<string>(
    initialReadingValue !== undefined ? String(initialReadingValue) : ''
  );
  const [meterCondition, setMeterCondition] = useState<MeterCondition>('NORMAL');
  const [remarks, setRemarks] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initialPhotoUrl);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy?: number }>({
    lat: consumer.gpsCoordinates?.lat || 8.5385,
    lng: consumer.gpsCoordinates?.lng || 124.7550,
    accuracy: 4,
  });
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Capture GPS on mount
  useEffect(() => {
    setIsCapturingGPS(true);
    LocationService.getCurrentLocation()
      .then((loc) => {
        setGpsLocation(loc);
      })
      .finally(() => {
        setIsCapturingGPS(false);
      });
  }, []);

  const numReading = Number(currentReading) || 0;
  const prevReading = consumer.previousReading || 0;
  const consumption = Math.max(0, numReading - prevReading);

  // Live Bill Calculation
  const billCalc: BillCalculation = useMemo(() => {
    return CalculationService.calculateWaterBill(
      consumer.category,
      prevReading,
      numReading
    );
  }, [consumer.category, prevReading, numReading]);

  // Anomaly Check
  const anomalyInfo = useMemo(() => {
    if (!currentReading || isNaN(Number(currentReading))) return { isAnomaly: false };
    return CalculationService.checkConsumptionAnomaly(consumption, consumer.averageConsumption);
  }, [consumption, consumer.averageConsumption, currentReading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentReading || isNaN(Number(currentReading))) {
      alert('Please enter a valid present reading value.');
      return;
    }

    if (numReading < prevReading) {
      const confirmRoll = window.confirm(
        `Warning: Present reading (${numReading}) is LESS than previous reading (${prevReading}). Meter dial rollover or replacement? Proceed anyway?`
      );
      if (!confirmRoll) return;
    }

    setIsSaving(true);
    const now = new Date();
    const readingId = `WDT-RDG-${Date.now()}-${consumer.accountNumber.replace(/-/g, '')}`;

    const newReading: MeterReading = {
      id: readingId,
      consumerId: consumer.id,
      accountNumber: consumer.accountNumber,
      consumerName: consumer.name,
      meterSerial: consumer.meterSerial,
      category: consumer.category,
      barangay: consumer.barangay,
      routeCode: consumer.routeCode,
      previousReading: prevReading,
      currentReading: numReading,
      consumption,
      readingDate: now.toISOString().split('T')[0],
      readingTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      readerId: user.id,
      readerName: user.name,
      gpsCoordinates: gpsLocation,
      photoUrl,
      ocrConfidence: initialOcrConfidence,
      meterCondition,
      remarks,
      status: 'PENDING_SYNC',
      billCalculation: billCalc,
      isAnomaly: anomalyInfo.isAnomaly,
      anomalyReason: anomalyInfo.reason,
    };

    await LoggerService.log(
      'READING_SAVED',
      `Meter reading ${numReading} cu.m. (${consumption} used, ₱${billCalc.totalAmountDue}) recorded for Acc #${consumer.accountNumber}`,
      user.id,
      user.name
    );

    onSaveReading(newReading);
  };

  return (
    <div className="p-3 sm:p-4 max-w-3xl mx-auto w-full space-y-4 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('consumers')}
          className="flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Cancel & Back</span>
        </button>

        <span className="text-xs text-slate-400 font-mono">
          Route: <strong className="text-white">{consumer.routeCode}</strong>
        </span>
      </div>

      {/* Consumer Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs font-extrabold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
            {consumer.accountNumber}
          </span>
          <span className="text-xs font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
            {consumer.category}
          </span>
        </div>

        <h2 className="text-base font-black text-white truncate">{consumer.name}</h2>
        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="truncate">{consumer.address}</span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 font-mono pt-2 mt-2 border-t border-slate-800">
          <span>Meter SN: <strong className="text-slate-200">{consumer.meterSerial}</strong></span>
          <span>Previous: <strong className="text-sky-400 font-bold">{prevReading} cu.m.</strong></span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Meter Reading Input Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Droplet className="w-4 h-4 text-sky-400" />
              Present Meter Reading (cu.m.)
            </label>

            <button
              type="button"
              onClick={() => onScanWithCamera(consumer)}
              className="px-2.5 py-1 bg-sky-950 border border-sky-800 hover:bg-sky-900 text-sky-300 rounded-lg text-xs font-bold flex items-center gap-1 transition"
            >
              <Camera className="w-3.5 h-3.5 text-sky-400" />
              <span>Use Camera OCR</span>
            </button>
          </div>

          {/* Large Digit Input */}
          <div className="relative">
            <input
              type="number"
              step="1"
              value={currentReading}
              onChange={(e) => setCurrentReading(e.target.value)}
              placeholder="0000"
              required
              autoFocus
              className="w-full bg-slate-950 border-2 border-slate-700 rounded-2xl py-3 px-4 text-3xl font-black text-sky-400 text-center tracking-widest font-mono focus:outline-none focus:border-sky-500 transition shadow-inner"
            />
            <div className="text-center text-[11px] text-slate-500 mt-1">
              Enter total full cubic meters from meter odometer dials
            </div>
          </div>

          {/* Real-time Consumption Delta pill */}
          <div className="grid grid-cols-2 gap-2 text-center pt-1">
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Previous Reading</span>
              <span className="text-sm font-mono font-bold text-slate-200">{prevReading} cu.m.</span>
            </div>

            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Consumption This Month</span>
              <span className="text-sm font-mono font-black text-sky-400">
                {consumption} cu.m.
              </span>
            </div>
          </div>

          {/* Abnormal Consumption Warning */}
          {anomalyInfo.isAnomaly && (
            <div className="p-3 bg-amber-950/70 border border-amber-800 rounded-xl text-xs text-amber-300 flex items-start gap-2 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Consumption Notice:</strong> {anomalyInfo.reason}
              </div>
            </div>
          )}
        </div>

        {/* Live Bill Breakdown Calculation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase">
              <Calculator className="w-4 h-4 text-sky-400" />
              <span>LWUA Tiered Bill Computation</span>
            </div>
            <span className="text-[11px] text-emerald-400 font-bold">
              Due: {billCalc.dueDate}
            </span>
          </div>

          <div className="space-y-1 text-xs font-mono">
            {billCalc.breakdown.map((item, idx) => (
              <div key={idx} className="flex justify-between text-slate-300">
                <span>{item.bracket}:</span>
                <span className="text-white font-semibold">₱{item.amount.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Environmental Fee (5%):</span>
              <span>₱{billCalc.environmentalFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Local Franchise Tax (2%):</span>
              <span>₱{billCalc.franchiseTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Meter Maintenance Fee:</span>
              <span>₱{billCalc.maintenanceFee.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline font-black">
            <span className="text-xs uppercase text-slate-300">Estimated Total Due:</span>
            <span className="text-xl text-emerald-400 font-mono">
              ₱{billCalc.totalAmountDue.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Meter Condition Flags */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Meter Physical Condition / Field Remarks
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: 'NORMAL', label: 'Normal / Clear' },
              { id: 'GLASS_FOGGED', label: 'Fogged / Moisture' },
              { id: 'STUCK_DIAL', label: 'Stuck Dial' },
              { id: 'LEAK_SUSPECTED', label: 'Leak Indicator Spinning' },
              { id: 'DAMAGED', label: 'Damaged Casing' },
              { id: 'NO_ACCESS', label: 'No Access / Locked' },
            ].map((cond) => (
              <button
                key={cond.id}
                type="button"
                onClick={() => setMeterCondition(cond.id as MeterCondition)}
                className={`p-2 rounded-xl text-xs font-semibold text-left border transition ${
                  meterCondition === cond.id
                    ? 'bg-sky-950 border-sky-500 text-sky-200 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {cond.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Additional reader notes (e.g., gate locked, dog inside, meter buried)..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 mt-2"
          />
        </div>

        {/* GPS Verification Info */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>
              GPS: {gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)} (±{gpsLocation.accuracy}m)
            </span>
          </div>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Auto-Tagged
          </span>
        </div>

        {/* Action Save Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-2xl shadow-xl shadow-emerald-950/80 flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving to Offline Queue...' : 'Confirm & Save Reading'}</span>
        </button>
      </form>
    </div>
  );
};
