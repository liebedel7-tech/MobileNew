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
  Send,
  UserCheck,
  ChevronRight,
  Home,
  Check,
  ShieldAlert,
  PowerOff,
  Lock
} from 'lucide-react';
import { 
  Consumer, 
  MeterReading, 
  MeterCondition, 
  StaffUser, 
  BillCalculation, 
  ActiveScreen 
} from '../types';
import { 
  isValidatedForFieldReading, 
  getConsumerDeactivationReason,
  formatOdometerReading,
  cleanOdometerInput,
  parseOdometerReading,
} from '../constants/routes';
import { CalculationService } from '../services/calculationService';
import { LocationService } from '../services/locationService';
import { LoggerService } from '../services/loggerService';
import { SyncService } from '../services/syncService';
import { WebSocketService } from '../services/websocketService';
import { DatabaseHelper } from '../services/databaseHelper';

interface ReadingEntryScreenProps {
  consumer: Consumer;
  user: StaffUser | null;
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
    initialReadingValue !== undefined && initialReadingValue !== null
      ? cleanOdometerInput(String(initialReadingValue))
      : (consumer.currentMonthReading?.currentReading !== undefined ? cleanOdometerInput(String(consumer.currentMonthReading.currentReading)) : '')
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

  // Authoritative Baseline & Existing Pending Reading from Database
  const [approvedRecord, setApprovedRecord] = useState<MeterReading | null>(null);
  const [pendingRecord, setPendingRecord] = useState<MeterReading | null>(null);

  // Post-Save Flow State
  const [savedReading, setSavedReading] = useState<MeterReading | null>(null);
  const [isSendingToAdmin, setIsSendingToAdmin] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);

  // Network & Simulated Offline state
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !navigator.onLine || window.localStorage?.getItem('twd_simulated_offline') === 'true';
  });

  useEffect(() => {
    const handleStatus = () => {
      const offline = !navigator.onLine || window.localStorage?.getItem('twd_simulated_offline') === 'true';
      setIsOffline(offline);
    };
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // Retrieve Latest Approved Reading Baseline and Any Existing Pending Record
  useEffect(() => {
    let isMounted = true;
    const acc = consumer.accountNumber;
    const meter = consumer.meterNumber || consumer.meterSerial;

    Promise.all([
      DatabaseHelper.getLatestApprovedReading(acc, meter),
      DatabaseHelper.getPendingReadingForMeter(acc, meter),
    ])
      .then(([latestApproved, existingPending]) => {
        if (!isMounted) return;
        setApprovedRecord(latestApproved);
        setPendingRecord(existingPending);

        // If an existing pending reading exists and reader hasn't typed a new value, pre-fill for seamless in-place edit
        if (existingPending && (initialReadingValue === undefined || initialReadingValue === null)) {
          if (existingPending.currentReading !== undefined) {
            setCurrentReading(cleanOdometerInput(String(existingPending.currentReading)));
          }
          if (existingPending.photoUrl && !initialPhotoUrl) {
            setPhotoUrl(existingPending.photoUrl);
          }
          if (existingPending.remarks) {
            setRemarks(existingPending.remarks);
          }
          if (existingPending.meterCondition) {
            setMeterCondition(existingPending.meterCondition);
          }
        }
      })
      .catch((err) => console.warn('Baseline lookup note:', err));

    return () => {
      isMounted = false;
    };
  }, [consumer.id, consumer.accountNumber, consumer.meterNumber, consumer.meterSerial, initialReadingValue, initialPhotoUrl]);

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
    const defaultVal = initialReadingValue !== undefined && initialReadingValue !== null
      ? cleanOdometerInput(String(initialReadingValue))
      : (consumer.currentMonthReading?.currentReading !== undefined ? cleanOdometerInput(String(consumer.currentMonthReading.currentReading)) : '');
    setCurrentReading(defaultVal);
    setPhotoUrl(initialPhotoUrl || consumer.currentMonthReading?.photoUrl);
    setMeterCondition(consumer.currentMonthReading?.meterCondition || 'NORMAL');
    setRemarks(consumer.currentMonthReading?.remarks || '');
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
  }, [consumer.id, consumer.currentMonthReading, initialReadingValue, initialPhotoUrl]);

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

  // Listen for real-time Central Admin Reading Approvals & Flags
  useEffect(() => {
    const handleApprovalEvent = (e: any) => {
      const detail = e.detail || {};
      const readingKey = detail.readingId || detail.accountNumber || (detail.reading && (detail.reading.id || detail.reading.accountNumber));
      if (
        savedReading &&
        (savedReading.id === readingKey ||
          savedReading.accountNumber === detail.accountNumber ||
          consumer.accountNumber === detail.accountNumber)
      ) {
        setSavedReading((prev) =>
          prev
            ? {
                ...prev,
                approvalStatus: 'approved',
                status: 'APPROVED',
                approvedAt: detail.timestamp || new Date().toISOString(),
                approvedBy: detail.approvedBy || 'Admin Supervisor',
              }
            : null
        );
        setSendSuccess(true);
        setSendFeedback('✓ Reading has been officially APPROVED by Admin! Baseline advanced & billing statement issued.');
      }
    };

    const handleRejectionEvent = (e: any) => {
      const detail = e.detail || {};
      const readingKey = detail.readingId || detail.accountNumber || (detail.reading && (detail.reading.id || detail.reading.accountNumber));
      if (
        savedReading &&
        (savedReading.id === readingKey ||
          savedReading.accountNumber === detail.accountNumber ||
          consumer.accountNumber === detail.accountNumber)
      ) {
        setSavedReading((prev) =>
          prev
            ? {
                ...prev,
                approvalStatus: 'rejected',
                status: 'REJECTED',
                rejectionReason: detail.reason,
              }
            : null
        );
        setSendFeedback(`⚠️ Reading flagged for re-inspection by Admin: ${detail.reason || 'Verification needed'}`);
      }
    };

    window.addEventListener('twd:reading_approved', handleApprovalEvent);
    window.addEventListener('twd:reading_rejected', handleRejectionEvent);
    return () => {
      window.removeEventListener('twd:reading_approved', handleApprovalEvent);
      window.removeEventListener('twd:reading_rejected', handleRejectionEvent);
    };
  }, [savedReading, consumer.accountNumber]);

  const numReading = parseOdometerReading(currentReading);

  // Authoritative Previous Reading: latest approved reading present value, or consumer baseline, or 00000
  const prevReading = useMemo(() => {
    if (approvedRecord && approvedRecord.currentReading !== undefined) {
      return parseOdometerReading(approvedRecord.currentReading);
    }
    if (consumer.previousReading !== undefined && consumer.previousReading !== null) {
      return parseOdometerReading(consumer.previousReading);
    }
    return 0;
  }, [approvedRecord, consumer.previousReading]);

  // Sequential consumption calculation with 5-digit mechanical rollover support
  const consumptionResult = useMemo(() => {
    if (currentReading === '' || isNaN(Number(currentReading))) {
      return { consumption: 0, isRollover: false, isValid: true };
    }
    return CalculationService.calculateConsumption(prevReading, numReading);
  }, [prevReading, numReading, currentReading]);

  const consumption = consumptionResult.consumption;
  const isRollover = consumptionResult.isRollover;
  const isReadingInvalid = currentReading !== '' && !consumptionResult.isValid;
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

  const isReadyForReading = isValidatedForFieldReading(consumer);
  const deactivationReason = getConsumerDeactivationReason(consumer);

  const isPendingUnapproved = Boolean(
    pendingRecord &&
    pendingRecord.approvalStatus !== 'approved' &&
    pendingRecord.status !== 'APPROVED'
  );

  // Handle Save Locally & Dispatch to Admin
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isPendingUnapproved) {
      alert(`Reading Pending Admin Approval: A reading (${pendingRecord?.currentReading} cu.m.) has already been recorded for Account #${consumer.accountNumber} and is awaiting central admin verification. You cannot submit another reading until it is approved.`);
      return;
    }

    if (!isReadyForReading) {
      alert(`Cannot Submit: This account or water meter is deactivated by Admin.\n\nReason: ${deactivationReason}`);
      return;
    }

    if (!currentReading || isNaN(Number(currentReading))) {
      alert('Please enter a valid present reading value.');
      return;
    }

    if (!consumptionResult.isValid) {
      alert(
        consumptionResult.error ||
        `Validation Error: Present reading (${numReading} cu.m.) cannot be less than Previous reading (${prevReading} cu.m.).\n\nPlease check the meter dial and enter the correct reading.`
      );
      return;
    }

    setIsSaving(true);
    const now = new Date();
    // Re-use existing pending record ID to modify in place rather than creating duplicate records!
    const readingId = pendingRecord?.id || `WDT-RDG-${Date.now()}-${consumer.accountNumber.replace(/-/g, '')}`;

    const newReading: MeterReading = {
      id: readingId,
      consumerId: consumer.id,
      accountNumber: consumer.accountNumber,
      consumerName: consumer.name,
      meterSerial: consumer.meterSerial || consumer.meterNumber || 'MTR-STD',
      category: consumer.category,
      barangay: consumer.barangay,
      routeCode: consumer.routeCode,
      previousReading: prevReading,
      currentReading: numReading,
      consumption,
      readingDate: now.toISOString().split('T')[0],
      readingTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      readerId: user?.id || 'RDR-001',
      readerName: user?.name || 'Field Staff',
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
      pendingRecord ? 'PENDING_READING_UPDATED' : 'READING_CONFIRMED_SENT',
      `Meter reading ${numReading} cu.m. (${consumption} cu.m. consumed) ${pendingRecord ? 'updated' : 'recorded'} for Acc #${consumer.accountNumber}. Status: Pending Admin Approval.`,
      user?.id || 'RDR-001',
      user?.name || 'Field Staff'
    );

    // 2. Transmit / Send to Admin
    try {
      const syncResult = await SyncService.submitSingleReading(newReading);
      if (syncResult.success) {
        setSendSuccess(true);
        if (syncResult.reading && (syncResult.reading.approvalStatus === 'approved' || syncResult.reading.status === 'APPROVED')) {
          newReading.approvalStatus = 'approved';
          newReading.status = 'APPROVED';
          newReading.approvedAt = syncResult.reading.approvedAt;
          newReading.approvedBy = syncResult.reading.approvedBy;
          setSendFeedback('✓ Reading verified & APPROVED by Admin! Baseline advanced & billing statement issued.');
        } else {
          setSendFeedback('Reading successfully transmitted to Central Admin for review & approval.');
        }
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
        readerName: user?.name || 'Field Staff',
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
        if (result.reading && (result.reading.approvalStatus === 'approved' || result.reading.status === 'APPROVED')) {
          setSavedReading((prev) => prev ? {
            ...prev,
            approvalStatus: 'approved',
            status: 'APPROVED',
            approvedAt: result.reading.approvedAt,
            approvedBy: result.reading.approvedBy,
          } : null);
          setSendFeedback('✓ Reading has been officially APPROVED by Admin! Baseline advanced & billing statement issued.');
        } else {
          setSendFeedback('Reading successfully submitted to Central Admin Dashboard for review & approval.');
        }
        
        // Notify via WebSocket
        WebSocketService.send('READING_SUBMITTED_FOR_APPROVAL', {
          readingId: savedReading.id,
          accountNumber: savedReading.accountNumber,
          consumerName: savedReading.consumerName,
          consumption: savedReading.consumption,
          amount: savedReading.billCalculation.totalAmountDue,
          readerName: user?.name || 'Field Staff',
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
  // POST-SAVE CONFIRMATION VIEW (Digital Transmission to Central Admin)
  // -------------------------------------------------------------
  if (savedReading) {
    const isApproved = savedReading.approvalStatus === 'approved' || savedReading.status === 'APPROVED';
    const isRejected = savedReading.approvalStatus === 'rejected' || savedReading.status === 'REJECTED';

    return (
      <div className="p-3 sm:p-5 max-w-2xl mx-auto w-full space-y-4 pb-24 animate-in fade-in zoom-in-95 duration-200">
        {/* Status Confirmation Banner */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl text-center space-y-4 relative overflow-hidden">
          <div className={`absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 rounded-full blur-2xl pointer-events-none ${
            isApproved ? 'bg-emerald-500/20' : isRejected ? 'bg-rose-500/20' : 'bg-sky-500/10'
          }`} />
          
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-inner border ${
            isApproved
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : isRejected
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
              : 'bg-sky-500/20 border-sky-500/40 text-sky-400'
          }`}>
            {isApproved ? (
              <CheckCircle2 className="w-9 h-9" />
            ) : isRejected ? (
              <AlertTriangle className="w-9 h-9" />
            ) : (
              <ShieldCheck className="w-9 h-9" />
            )}
          </div>

          <div>
            {isApproved ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-600 text-emerald-300 text-[11px] font-mono font-bold tracking-wide uppercase mb-2 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Approved by Central Admin</span>
              </span>
            ) : isRejected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/90 border border-rose-700 text-rose-300 text-[11px] font-mono font-bold tracking-wide uppercase mb-2 shadow-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Flagged / Requires Re-Inspection</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 text-[11px] font-mono font-bold tracking-wide uppercase mb-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{isOffline ? 'Offline Queue (Pending Sync)' : 'Transmitted to Central Admin'}</span>
              </span>
            )}

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isApproved 
                ? 'Reading Approved & Saved' 
                : isRejected 
                ? 'Reading Flagged for Review' 
                : isOffline 
                ? 'Reading Confirmed & Saved Offline' 
                : 'Reading Confirmed & Sent'}
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              {isApproved ? (
                <>
                  Meter reading was <strong className="text-emerald-400 font-mono">Approved by Admin</strong>. Consumer baseline has been advanced and billing statement issued.
                </>
              ) : isRejected ? (
                <>
                  Admin requested re-check: <strong className="text-rose-400">{savedReading.rejectionReason || 'Inspection needed'}</strong>.
                </>
              ) : isOffline ? (
                <>
                  Meter reading saved securely to device database. Status: <strong className="text-amber-400 font-mono">Queued for Admin Sync</strong>.
                </>
              ) : (
                <>
                  Meter reading was logged and dispatched to Central Admin. Status: <strong className="text-amber-400 font-mono">Pending Admin Approval</strong>.
                </>
              )}
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
                  {formatOdometerReading(savedReading.previousReading)} cu.m.
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  PRESENT READING
                </span>
                <span className="font-bold text-sky-300 text-sm">
                  {formatOdometerReading(savedReading.currentReading)} cu.m.
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  CONSUMPTION
                </span>
                <span className="font-black text-emerald-400 text-sm">
                  +{savedReading.consumption} cu.m.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <span className="text-xs text-slate-400">Transmission Status:</span>
              {isApproved ? (
                <span className="text-xs font-bold text-emerald-300 font-mono bg-emerald-950/90 border border-emerald-700 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  Approved by Admin
                </span>
              ) : isRejected ? (
                <span className="text-xs font-bold text-rose-300 font-mono bg-rose-950/90 border border-rose-700 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  Flagged by Admin
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-300 font-mono bg-amber-950/80 border border-amber-800/80 px-2.5 py-0.5 rounded flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Pending Admin Approval
                </span>
              )}
            </div>

            {isApproved && (savedReading.approvedBy || savedReading.approvedAt) && (
              <div className="bg-emerald-950/40 border border-emerald-900/60 rounded-xl p-2.5 text-xs text-emerald-300 flex items-center justify-between font-mono">
                <span className="text-[11px] text-emerald-400/80">Verified By:</span>
                <span className="font-bold text-emerald-200">
                  {savedReading.approvedBy || 'Admin Supervisor'}
                  {savedReading.approvedAt ? ` • ${new Date(savedReading.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Send Status Notification */}
          {sendFeedback && (
            <div className={`p-3 rounded-xl text-xs font-medium text-left flex items-start gap-2 ${
              isApproved
                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                : isRejected
                ? 'bg-rose-950/80 border border-rose-800 text-rose-300'
                : sendSuccess 
                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300' 
                : 'bg-sky-950/80 border border-sky-800 text-sky-300'
            }`}>
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{sendFeedback}</span>
            </div>
          )}

          {/* Primary Action Button Area */}
          <div className="pt-2">
            {isApproved ? (
              <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/60 rounded-2xl flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold font-mono shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Status: APPROVED BY ADMIN (SAVED)</span>
              </div>
            ) : isRejected ? (
              <div className="p-3.5 bg-rose-950/80 border border-rose-500/60 rounded-2xl flex items-center justify-center gap-2 text-rose-300 text-xs font-bold font-mono shadow-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Status: REJECTED — RE-INSPECTION NEEDED</span>
              </div>
            ) : !sendSuccess ? (
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
              <div className="p-3.5 bg-amber-950/60 border border-amber-500/40 rounded-2xl flex items-center justify-center gap-2 text-amber-300 text-xs font-bold font-mono">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Status: TRANSMITTED (PENDING ADMIN APPROVAL)</span>
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
            <span className="text-[10px] text-slate-500 uppercase block font-sans">
              {approvedRecord ? 'Approved Prev' : 'Initial Baseline'}
            </span>
            <strong className="text-slate-200 font-bold block">{formatOdometerReading(prevReading)} cu.m.</strong>
          </div>
          <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block font-sans">Prev Consumed</span>
            <strong className="text-sky-400 font-bold block">
              {approvedRecord?.consumption ?? consumer.previousConsumption ?? consumer.averageConsumption} cu.m.
            </strong>
          </div>
        </div>

        {/* 🚫 Deactivation Alert Banner */}
        {!isReadyForReading && (
          <div className="mt-3 p-3 bg-rose-950/40 border border-rose-900/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-200">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-rose-300 block text-sm">
                🚫 Deactivated by Admin — Not Available for Field Reading
              </span>
              <p className="text-xs text-rose-200">
                {deactivationReason || 'This water meter or account is deactivated in Central Admin.'}
              </p>
              <p className="text-[11px] text-slate-400">
                New readings cannot be recorded or submitted until Admin reactivates this meter or consumer in the Web Portal.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ⚠️ Single Pending Record Enforced Notice */}
      {isPendingUnapproved && pendingRecord && (
        <div className="bg-amber-950/60 border border-amber-600/70 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-bold text-amber-300 text-sm">
                  Reading Pending Admin Approval — Cannot Read or Send New Reading
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
                  Awaiting Verification
                </span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                A present reading of <strong className="text-white font-mono">{formatOdometerReading(pendingRecord.currentReading)} cu.m.</strong> was logged on {pendingRecord.readingDate} {pendingRecord.readingTime || ''} and is currently awaiting central admin verification.
              </p>
              <div className="text-[11px] text-amber-300/90 bg-amber-950/80 p-2.5 rounded-xl border border-amber-800/60 space-y-1">
                <p className="font-bold text-amber-200">District Policy Gate:</p>
                <p>Under Tagoloan Water District policy, field readers cannot take or send another reading for this account until the admin approves this reading. Once approved, this present reading will become the baseline for subsequent readings.</p>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>View in Reading Logs</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('consumers')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition active:scale-95 cursor-pointer"
                >
                  Back to Directory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              className="px-2.5 py-1 bg-sky-950 border border-sky-800 hover:bg-sky-900 text-sky-300 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-sky-400" />
              <span>Use Camera OCR</span>
            </button>
          </div>

          {/* Captured Dial Photo Preview (carried from Camera Scan) */}
          {photoUrl && (
            <div className="relative w-full max-h-48 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center shadow-inner">
              <img
                src={photoUrl}
                alt="Captured Dial"
                className="max-h-44 object-contain rounded-lg p-1"
              />
              <div className="absolute top-2 left-2 bg-slate-950/90 border border-slate-700 px-2.5 py-1 rounded-lg text-xs text-sky-300 font-mono flex items-center gap-1.5 shadow">
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                <span>Captured Meter Photo</span>
              </div>
            </div>
          )}

          {/* 5-Wheel Mechanical Odometer Roller HUD (00000 to 99999) */}
          <div className="bg-slate-950 p-3.5 sm:p-4 rounded-2xl border border-slate-800 text-center space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
              <span className="uppercase font-bold text-sky-400 tracking-wider">5-DIGIT MECHANICAL ODOMETER</span>
              <span className="text-slate-300 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800 text-xs">
                Whole numbers (00000–99999)
              </span>
            </div>

            {/* 5 Physical Roller Wheel Dials */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
              {formatOdometerReading(currentReading).split('').map((digit, idx) => {
                const labels = ['10k', '1k', '100', '10', '1'];
                return (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                      {labels[idx]}
                    </span>
                    <div className="w-11 sm:w-13 h-16 sm:h-18 bg-slate-900 border-2 border-slate-600 rounded-xl flex items-center justify-center font-mono font-black text-3xl sm:text-4xl text-white shadow-inner select-none relative overflow-hidden">
                      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
                      <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                      <span className={currentReading !== '' ? 'text-white font-black' : 'text-slate-500'}>
                        {digit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Large Digit Input Field (Strictly whole numbers, no decimals or commas) */}
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              value={currentReading}
              onChange={(e) => setCurrentReading(cleanOdometerInput(e.target.value))}
              placeholder={formatOdometerReading(prevReading)}
              required
              autoFocus
              className={`w-full bg-slate-950 border-2 rounded-2xl py-3.5 px-4 text-3xl font-black text-center tracking-widest font-mono focus:outline-none transition shadow-inner ${
                isReadingInvalid
                  ? 'border-red-500 text-red-400 focus:border-red-400'
                  : 'border-slate-700 text-white focus:border-sky-500'
              }`}
            />
            <div className="text-center text-xs text-slate-300 mt-2 flex flex-wrap items-center justify-center gap-2 font-medium">
              <span>Whole numbers only</span>
              <span>•</span>
              <span>Min: <strong className="text-white font-mono">{formatOdometerReading(prevReading)} cu.m.</strong></span>
            </div>
          </div>

          {/* Validation Rule Alert: Present Reading >= Previous Reading */}
          {isReadingInvalid && (
            <div className="p-3.5 bg-red-950/80 border-2 border-red-500/80 rounded-xl text-xs sm:text-sm text-red-200 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-red-300 font-bold block text-sm uppercase tracking-wide">
                  Invalid Reading: Below Previous Reading
                </strong>
                <p className="text-xs sm:text-sm text-red-200 leading-relaxed">
                  Present reading (<strong className="text-white font-mono">{formatOdometerReading(numReading)} cu.m.</strong>) cannot be less than previous reading (<strong className="text-white font-mono">{formatOdometerReading(prevReading)} cu.m.</strong>).
                  Negative consumption is strictly not allowed.
                </p>
              </div>
            </div>
          )}

          {/* Real-time Readings & Consumption Breakdown */}
          <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 space-y-2 font-mono text-xs sm:text-sm">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                PREVIOUS READING
              </span>
              <span className="font-bold text-slate-200 text-sm sm:text-base">
                {formatOdometerReading(prevReading)} cu.m.
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                PRESENT READING
              </span>
              <span className={`font-bold text-sm sm:text-base ${
                isReadingInvalid ? 'text-red-400' : 'text-sky-300'
              }`}>
                {currentReading !== '' ? `${formatOdometerReading(numReading)} cu.m.` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                CONSUMPTION
              </span>
              {isReadingInvalid ? (
                <span className="text-xs sm:text-sm font-mono font-bold text-red-400">
                  Invalid (Below Previous)
                </span>
              ) : (
                <span className="font-black text-emerald-400 text-base sm:text-lg flex items-center gap-1.5">
                  <span>{currentReading !== '' ? `+${consumption} cu.m.` : '0 cu.m.'}</span>
                  {isRollover && (
                    <span className="text-xs font-sans font-bold bg-sky-950 text-sky-300 border border-sky-700 px-2 py-0.5 rounded">
                      Rollover 99999
                    </span>
                  )}
                </span>
              )}
            </div>

            {isRollover && (
              <div className="bg-sky-950 border border-sky-800 rounded-lg p-2.5 text-xs text-sky-200 flex items-center justify-between">
                <span className="font-bold text-sky-300">5-Digit Mechanical Rollover:</span>
                <span className="font-mono text-xs">Rolled over 00000 (+100,000 cu.m.)</span>
              </div>
            )}
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
        {isPendingUnapproved ? (
          <div className="w-full font-black py-4 rounded-2xl bg-amber-950/70 border border-amber-800 text-amber-300 flex items-center justify-center gap-2 text-sm uppercase tracking-wider cursor-not-allowed">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Reading Pending Admin Approval (Cannot Re-Read)</span>
          </div>
        ) : !isReadyForReading ? (
          <div className="w-full font-black py-4 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-300 flex items-center justify-center gap-2 text-sm uppercase tracking-wider cursor-not-allowed">
            <Lock className="w-4 h-4 text-rose-400" />
            <span>Reading Prohibited (Deactivated by Admin)</span>
          </div>
        ) : (
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
                <span>
                  {isSaving 
                    ? 'Saving Reading...' 
                    : isOffline 
                    ? 'Save to Offline Queue' 
                    : 'Confirm & Send to Admin'}
                </span>
              </>
            )}
          </button>
        )}
      </form>
    </div>
  );
};
