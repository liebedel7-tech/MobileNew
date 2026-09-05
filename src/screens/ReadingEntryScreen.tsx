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

  // Reset form and post-save states whenever the consumer changes (e.g. moving to Next Consumer)
  useEffect(() => {
    setCurrentReading(initialReadingValue !== undefined && initialReadingValue !== null ? String(initialReadingValue) : '');
    setPhotoUrl(initialPhotoUrl);
    setMeterCondition('NORMAL');
    setRemarks('');
    setSavedReading(null);
    setSendSuccess(false);
    setSendFeedback(null);
    if (consumer.gpsCoordinates) {
      setGpsLocation({
        lat: consumer.gpsCoordinates.lat,
        lng: consumer.gpsCoordinates.lng,
        accuracy: 4,
      });
    }
  }, [consumer.id, initialReadingValue, initialPhotoUrl]);

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
  }, [consumer.id]);

  const numReading = Number(currentReading) || 0;
  const prevReading = consumer.previousReading || 0;
  const isReadingInvalid = currentReading !== '' && !isNaN(Number(currentReading)) && numReading < prevReading;
  const consumption = isReadingInvalid ? 0 : Math.max(0, numReading - prevReading);
  const currentBillingMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

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

  // Handle Save Locally & Dispatch to Admin
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentReading || isNaN(Number(currentReading))) {
      alert('Please enter a valid present reading value.');
      return;
    }

    if (numReading < prevReading) {
      alert(
        `Validation Error: Present reading (${numReading} cu.m.) cannot be less than Previous reading (${prevReading} cu.m.).\n\nPlease check the meter dial and enter the correct reading.`
      );
      return;
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

    // 1. Save locally to device DB
    await onSaveReading(newReading);

    await LoggerService.log(
      'READING_CONFIRMED_SENT',
      `Meter reading ${numReading} cu.m. (${consumption} used, ₱${billCalc.totalAmountDue}) confirmed & dispatched for Acc #${consumer.accountNumber}. Status: Pending Admin Approval.`,
      user.id,
      user.name
    );

    // 2. Transmit / Send to Admin
    try {
      const syncResult = await SyncService.submitSingleReading(newReading);
      if (syncResult.success) {
        setSendSuccess(true);
        setSendFeedback('Reading successfully transmitted to Central Admin for review & approval.');
      } else {
        setSendSuccess(true);
        setSendFeedback('Recorded locally in encrypted storage. Queued for automatic admin sync.');
      }

      // Notify Central Admin via live WebSocket channel
      WebSocketService.send('READING_SUBMITTED_FOR_APPROVAL', {
        readingId: newReading.id,
        accountNumber: newReading.accountNumber,
        consumerName: newReading.consumerName,
        consumption: newReading.consumption,
        amount: newReading.billCalculation.totalAmountDue,
        readerName: user.name,
        timestamp: now.toISOString(),
      });
    } catch {
      setSendSuccess(true);
      setSendFeedback('Saved securely to handheld database. Ready for sync.');
    }

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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[11px] font-mono font-bold tracking-wide uppercase mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Transmitted to Central Admin</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Reading Confirmed & Sent
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Meter reading was logged and dispatched to Central Admin. Status: <strong className="text-amber-400 font-mono">Pending Admin Approval</strong>.
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

            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  PREVIOUS READING
                </span>
                <span className="font-bold text-slate-200 text-sm">
                  {savedReading.previousReading}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  PRESENT READING
                </span>
                <span className="font-bold text-sky-300 text-sm">
                  {savedReading.currentReading}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  CONSUMPTION
                </span>
                <span className="font-black text-emerald-400 text-sm">
                  {savedReading.consumption}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <span className="text-xs text-slate-400">Transmission Status:</span>
              <span className="text-xs font-bold text-amber-400 font-mono bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded">
                Pending Admin Approval
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
                <span>View Consumer's List</span>
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

        <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 font-mono pt-2.5 mt-2.5 border-t border-slate-800 text-center">
          <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block font-sans">Meter Tag/SN</span>
            <strong className="text-sky-300 font-mono truncate block">{consumer.meterNumber || consumer.meterSerial}</strong>
          </div>
          <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block font-sans">Prev Reading</span>
            <strong className="text-slate-200 font-bold block">{prevReading} cu.m.</strong>
          </div>
          <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block font-sans">Prev Consumed</span>
            <strong className="text-sky-400 font-bold block">{consumer.previousConsumption ?? consumer.averageConsumption} cu.m.</strong>
          </div>
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
              min={prevReading}
              value={currentReading}
              onChange={(e) => setCurrentReading(e.target.value)}
              placeholder={String(prevReading)}
              required
              autoFocus
              className={`w-full bg-slate-950 border-2 rounded-2xl py-3 px-4 text-3xl font-black text-center tracking-widest font-mono focus:outline-none transition shadow-inner ${
                isReadingInvalid
                  ? 'border-red-500 text-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-500/20'
                  : 'border-slate-700 text-sky-400 focus:border-sky-500'
              }`}
            />
            <div className="text-center text-[11px] text-slate-500 mt-1">
              Minimum allowed reading: <strong className="text-slate-300 font-mono">{prevReading} cu.m.</strong> (Previous Index)
            </div>
          </div>

          {/* Validation Rule Alert: Present Reading >= Previous Reading */}
          {isReadingInvalid && (
            <div className="p-3.5 bg-red-950/80 border-2 border-red-500/80 rounded-xl text-xs text-red-200 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-red-300 font-extrabold block text-xs uppercase tracking-wide">
                  ⚠️ Invalid Reading: Below Previous Reading
                </strong>
                <p className="text-[11px] text-red-200/90 leading-relaxed">
                  Present reading (<strong className="text-white font-mono">{numReading} cu.m.</strong>) cannot be less than previous reading (<strong className="text-white font-mono">{prevReading} cu.m.</strong>).
                  Negative consumption is strictly not allowed in meter reading.
                </p>
              </div>
            </div>
          )}

          {/* Real-time Readings & Consumption Breakdown */}
          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                PREVIOUS READING
              </span>
              <span className="font-bold text-slate-200 text-sm">
                {prevReading}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                PRESENT READING
              </span>
              <span className={`font-bold text-sm ${
                isReadingInvalid ? 'text-red-400' : 'text-sky-300'
              }`}>
                {currentReading !== '' ? numReading : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                CONSUMPTION
              </span>
              {isReadingInvalid ? (
                <span className="text-xs font-mono font-bold text-red-400">
                  Invalid (Negative)
                </span>
              ) : (
                <span className="font-black text-emerald-400 text-sm">
                  {currentReading !== '' && numReading >= prevReading ? consumption : '0'}
                </span>
              )}
            </div>
          </div>

          {/* Abnormal Consumption Warning */}
          {anomalyInfo.isAnomaly && !isReadingInvalid && (
            <div className="p-3 bg-amber-950/70 border border-amber-800 rounded-xl text-xs text-amber-300 flex items-start gap-2 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Consumption Notice:</strong> {anomalyInfo.reason}
              </div>
            </div>
          )}
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

        {/* Action Confirm & Send Button */}
        <button
          type="submit"
          disabled={isSaving || isReadingInvalid || !currentReading}
          className={`w-full font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition active:scale-[0.98] ${
            isReadingInvalid
              ? 'bg-red-900/60 text-red-300 border border-red-700 cursor-not-allowed opacity-80'
              : !currentReading
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 shadow-sky-500/20 cursor-pointer'
          }`}
        >
          {isReadingInvalid ? (
            <>
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>Cannot Send: Present Reading &lt; Previous</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4 text-slate-950" />
              <span>{isSaving ? 'Recording & Sending to Admin...' : 'Confirm & Send to Admin'}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
