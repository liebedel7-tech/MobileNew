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
  Sparkles,
  Send,
  UserCheck,
  ChevronRight,
  Printer,
  Home,
  Check
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
import { SyncService } from '../services/syncService';
import { WebSocketService } from '../services/websocketService';

interface ReadingEntryScreenProps {
  consumer: Consumer;
  user: StaffUser;
  allConsumers?: Consumer[];
  initialReadingValue?: number;
  initialPhotoUrl?: string;
  initialOcrConfidence?: number;
  onSaveReading: (reading: MeterReading) => Promise<void> | void;
  onNavigate: (screen: ActiveScreen) => void;
  onScanWithCamera: (consumer: Consumer) => void;
  onSelectNextConsumer?: (consumer: Consumer) => void;
  onViewReceipt?: (reading: MeterReading) => void;
}

export const ReadingEntryScreen: React.FC<ReadingEntryScreenProps> = ({
  consumer,
  user,
  allConsumers = [],
  initialReadingValue,
  initialPhotoUrl,
  initialOcrConfidence,
  onSaveReading,
  onNavigate,
  onScanWithCamera,
  onSelectNextConsumer,
  onViewReceipt,
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

  // Post-Save Flow State
  const [savedReading, setSavedReading] = useState<MeterReading | null>(null);
  const [isSendingToAdmin, setIsSendingToAdmin] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);

  // Find next unread consumer on route
  const nextConsumer = useMemo(() => {
    if (!allConsumers || allConsumers.length === 0) return null;
    const currentIndex = allConsumers.findIndex((c) => c.id === consumer.id);
    // Find next unread consumer after current
    for (let i = currentIndex + 1; i < allConsumers.length; i++) {
      if (!allConsumers[i].isReadThisMonth) return allConsumers[i];
    }
    // Loop back from beginning if none after
    for (let i = 0; i < currentIndex; i++) {
      if (!allConsumers[i].isReadThisMonth) return allConsumers[i];
    }
    return null;
  }, [allConsumers, consumer.id]);

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

  // Handle Save Locally
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
      approvalStatus: 'pending_approval',
      billCalculation: billCalc,
      isAnomaly: anomalyInfo.isAnomaly,
      anomalyReason: anomalyInfo.reason,
    };

    await onSaveReading(newReading);

    await LoggerService.log(
      'READING_SAVED_LOCAL',
      `Meter reading ${numReading} cu.m. (${consumption} used, ₱${billCalc.totalAmountDue}) saved locally for Acc #${consumer.accountNumber}. Awaiting Send to Admin.`,
      user.id,
      user.name
    );

    setIsSaving(false);
    setSavedReading(newReading);
  };

  // Handle Explicit "Send to Admin Dashboard" action
  const handleSendToAdmin = async () => {
    if (!savedReading) return;
    setIsSendingToAdmin(true);
    setSendFeedback(null);

    try {
      const result = await SyncService.submitSingleReading(savedReading);
      if (result.success) {
        setSendSuccess(true);
        setSendFeedback('Reading successfully submitted to Central Admin Dashboard for review & approval.');
        
        // Notify via WebSocket
        WebSocketService.send('READING_SUBMITTED_FOR_APPROVAL', {
          readingId: savedReading.id,
          accountNumber: savedReading.accountNumber,
          consumerName: savedReading.consumerName,
          consumption: savedReading.consumption,
          amount: savedReading.billCalculation.totalAmountDue,
          readerName: user.name,
          timestamp: new Date().toISOString(),
        });
      } else {
        setSendFeedback(result.message || 'Queued locally in offline database.');
      }
    } catch (err: any) {
      setSendFeedback(`Notice: Queued offline (${err?.message || 'Will sync when online'})`);
    } finally {
      setIsSendingToAdmin(false);
    }
  };

  // -------------------------------------------------------------
  // POST-SAVE CONFIRMATION VIEW (NO THERMAL RECEIPT POPUP)
  // -------------------------------------------------------------
  if (savedReading) {
    return (
      <div className="p-3 sm:p-5 max-w-2xl mx-auto w-full space-y-4 pb-24 animate-in fade-in zoom-in-95 duration-200">
        {/* Status Confirmation Banner */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-center space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[11px] font-mono font-bold tracking-wide uppercase mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Saved to Offline SQLite
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Reading Confirmed & Saved
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Record stored in encrypted device storage. Tap <strong className="text-sky-300">"Send to Admin Dashboard"</strong> to dispatch for supervisor approval.
            </p>
          </div>

          {/* Reading Summary Breakdown Card */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div>
                <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                  {consumer.accountNumber}
                </span>
                <h3 className="font-bold text-sm text-white mt-1">{consumer.name}</h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Zone Route</span>
                <span className="text-xs font-mono font-bold text-slate-200">{consumer.routeCode}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center py-1">
              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Previous</span>
                <span className="text-xs font-mono font-bold text-slate-300">{savedReading.previousReading} m³</span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Present</span>
                <span className="text-xs font-mono font-bold text-sky-400">{savedReading.currentReading} m³</span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Used</span>
                <span className="text-xs font-mono font-bold text-emerald-400">{savedReading.consumption} m³</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <span className="text-xs text-slate-400">Calculated Water Tariff:</span>
              <span className="text-base font-black text-emerald-400 font-mono">
                ₱{savedReading.billCalculation.totalAmountDue.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Send Status Notification */}
          {sendFeedback && (
            <div className={`p-3 rounded-xl text-xs font-medium text-left flex items-start gap-2 ${
              sendSuccess 
                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300' 
                : 'bg-sky-950/80 border border-sky-800 text-sky-300'
            }`}>
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{sendFeedback}</span>
            </div>
          )}

          {/* Primary Action: SEND TO ADMIN DASHBOARD BUTTON */}
          <div className="pt-2">
            {!sendSuccess ? (
              <button
                type="button"
                onClick={handleSendToAdmin}
                disabled={isSendingToAdmin}
                className="w-full py-4 px-6 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-black rounded-2xl shadow-xl shadow-sky-600/30 flex items-center justify-center gap-2.5 text-sm uppercase tracking-wider transition active:scale-[0.98] disabled:opacity-50"
              >
                <Send className={`w-5 h-5 ${isSendingToAdmin ? 'animate-bounce' : ''}`} />
                <span>{isSendingToAdmin ? 'Submitting to Admin Portal...' : 'Send to Admin Dashboard'}</span>
              </button>
            ) : (
              <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Status: PENDING ADMIN APPROVAL</span>
              </div>
            )}
          </div>

          {/* Secondary Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            {nextConsumer ? (
              <button
                type="button"
                onClick={() => {
                  if (onSelectNextConsumer) {
                    onSelectNextConsumer(nextConsumer);
                  }
                  // Reset state for next consumer
                  setSavedReading(null);
                  setCurrentReading('');
                  setSendSuccess(false);
                  setSendFeedback(null);
                }}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition border border-slate-700 active:scale-[0.98]"
              >
                <span>Next Meter: {nextConsumer.name.split(' ')[0]}</span>
                <ChevronRight className="w-4 h-4 text-sky-400" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('consumers')}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition border border-slate-700 active:scale-[0.98]"
              >
                <ChevronRight className="w-4 h-4 text-sky-400" />
                <span>View Route Directory</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 transition border border-slate-800 active:scale-[0.98]"
            >
              <Home className="w-4 h-4 text-slate-400" />
              <span>Back to Dashboard</span>
            </button>
          </div>

          {/* Optional manual receipt preview (NOT automatically opened) */}
          {onViewReceipt && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => onViewReceipt(savedReading)}
                className="text-[11px] text-slate-500 hover:text-slate-400 font-medium inline-flex items-center gap-1 transition"
              >
                <Printer className="w-3 h-3" />
                <span>Optional: View Receipt Printout Spool</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // REGULAR READING ENTRY FORM
  // -------------------------------------------------------------
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
          <span>{isSaving ? 'Saving to Offline Storage...' : 'Confirm & Save Reading'}</span>
        </button>
      </form>
    </div>
  );
};
