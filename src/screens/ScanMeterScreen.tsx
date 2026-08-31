import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Camera, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  ChevronRight, 
  XCircle, 
  Tag, 
  RotateCw, 
  User, 
  MapPin, 
  Send, 
  Sparkles,
  Check,
  Smartphone,
  CheckCheck,
  Clock,
  Droplets,
  Layers,
  Search,
  Scan
} from 'lucide-react';
import { Consumer, ActiveScreen, MeterReading, StaffUser } from '../types';
import { OCRService, OCRResult } from '../services/ocrService';
import { ScanOverlay } from '../components/ScanOverlay';
import { DatabaseHelper } from '../services/databaseHelper';
import { CalculationService } from '../services/calculationService';
import { LocationService } from '../services/locationService';
import { WebSocketService } from '../services/websocketService';
import { SyncService } from '../services/syncService';
import { LoggerService } from '../services/loggerService';

interface ScanMeterScreenProps {
  consumer?: Consumer | null;
  currentUser?: StaffUser | null;
  onNavigate: (screen: ActiveScreen) => void;
  onOCRComplete?: (data: { readingValue: number; photoUrl: string; confidence: number }) => void;
  onSelectConsumer?: (consumer: Consumer) => void;
  onSaveReading?: (reading: MeterReading) => Promise<void> | void;
  onReloadData?: () => void;
}

export const ScanMeterScreen: React.FC<ScanMeterScreenProps> = ({
  consumer: initialConsumer,
  currentUser,
  onNavigate,
  onOCRComplete,
  onSelectConsumer,
  onSaveReading,
  onReloadData,
}) => {
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(initialConsumer || null);
  const [allConsumers, setAllConsumers] = useState<Consumer[]>([]);
  
  // Camera state & stream configuration
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Two-Stage Workflow: Stage 1 = IDENTIFY_TAG -> Stage 2 = SCAN_METER -> Stage 3 = SUBMITTED
  const [scanStep, setScanStep] = useState<'IDENTIFY_TAG' | 'SCAN_METER' | 'SUBMITTED'>(
    initialConsumer ? 'SCAN_METER' : 'IDENTIFY_TAG'
  );
  const [identifiedTagNumber, setIdentifiedTagNumber] = useState<string>(
    initialConsumer?.meterNumber || initialConsumer?.meterSerial || ''
  );
  const [tagStatusMessage, setTagStatusMessage] = useState<string | null>(null);
  
  // OCR & Reading State
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSendingToAdmin, setIsSendingToAdmin] = useState(false);
  const [lastSubmittedReading, setLastSubmittedReading] = useState<MeterReading | null>(null);

  // Quick manual tag input fallback
  const [manualTagQuery, setManualTagQuery] = useState('');
  const [showManualTagInput, setShowManualTagInput] = useState(false);

  // Load consumers list for active reader
  useEffect(() => {
    const routes = currentUser?.assignedRoutes || (currentUser?.zone ? [currentUser.zone] : undefined);
    DatabaseHelper.getConsumersForReader(routes).then((list) => {
      setAllConsumers(list);
    });
  }, [currentUser]);

  // Audio / Haptic feedback for smart tag match
  const playMatchFeedback = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      }
    } catch {
      // Ignore audio failure
    }
  }, []);

  // High-Quality Camera initialization with auto-focus & exposure constraints
  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    try {
      setCameraError(null);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        let stream: MediaStream | null = null;
        
        // Try high-definition environmental camera with continuous focus
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              aspectRatio: { ideal: 16 / 9 },
            },
            audio: false,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: facing,
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
              },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }
        }

        if (stream) {
          streamRef.current = stream;
          
          // Apply advanced continuous focus / exposure if supported by mobile hardware
          const track = stream.getVideoTracks()[0];
          if (track && 'applyConstraints' in track) {
            try {
              const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
              const advancedProps: any = {};
              if (capabilities?.focusMode?.includes('continuous')) {
                advancedProps.focusMode = 'continuous';
              }
              if (capabilities?.exposureMode?.includes('continuous')) {
                advancedProps.exposureMode = 'continuous';
              }
              if (Object.keys(advancedProps).length > 0) {
                await (track as any).applyConstraints({ advanced: [advancedProps] });
              }
            } catch (e) {
              console.debug('Camera continuous focus config note:', e);
            }
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.muted = true;
            try {
              await videoRef.current.play();
            } catch (playErr) {
              console.warn('Video play deferred:', playErr);
            }
            setCameraActive(true);
          }
        }
      } else {
        setCameraError('Live camera not supported in this browser. Please use Chrome/Edge on your mobile device.');
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraActive(false);
      setCameraError('Camera access required. Please allow camera permissions in phone settings.');
    }
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Handle Tag identification and shift into Stage 2 (Meter Dial Reading)
  const handleTagIdentified = useCallback((matchedConsumer: Consumer, tagStr: string) => {
    setSelectedConsumer(matchedConsumer);
    setIdentifiedTagNumber(tagStr);
    setScanStep('SCAN_METER');
    setTagStatusMessage(null);
    if (onSelectConsumer) onSelectConsumer(matchedConsumer);
    playMatchFeedback();

    WebSocketService.notifyProcessEvent('TAG_IDENTIFIED_AUTO', 'COMPLETED', {
      tag: tagStr,
      accountNumber: matchedConsumer.accountNumber,
      ownerName: matchedConsumer.name,
      previousReading: matchedConsumer.previousReading,
    });
  }, [onSelectConsumer, playMatchFeedback]);

  // Direct manual tag query matcher
  const handleDirectTagInput = async (value: string) => {
    setManualTagQuery(value);
    const clean = value.trim();
    if (clean.length >= 3) {
      const match = await DatabaseHelper.getConsumerByTagOrMeterNumber(clean);
      if (match) {
        handleTagIdentified(match, clean);
      }
    }
  };

  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const handleToggleTorch = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
      if (capabilities && capabilities.torch) {
        try {
          const nextTorch = !torchOn;
          await (track as any).applyConstraints({
            advanced: [{ torch: nextTorch }],
          });
          setTorchOn(nextTorch);
        } catch (e) {
          console.warn('Torch error:', e);
        }
      } else {
        setTorchOn(!torchOn);
      }
    } else {
      setTorchOn(!torchOn);
    }
  };

  // Capture Button Handler (Exclusively Stage 1: Tag Number vs Stage 2: 5-Digit Reading)
  const handleCaptureButton = async () => {
    if (!videoRef.current || !cameraActive || videoRef.current.videoWidth === 0) return;
    
    const photo = OCRService.captureFrameFromVideo(videoRef.current);
    if (!photo) return;

    if (scanStep === 'IDENTIFY_TAG' && !selectedConsumer) {
      // Stage 1: Analyze frame for Meter Tag / Serial Number ONLY
      setIsProcessing(true);
      setTagStatusMessage('Scanning meter tag number in mobile database...');
      try {
        const tagResult = await OCRService.analyzeTagPhoto(photo);
        if (tagResult.success && tagResult.tagDetected) {
          const matched = await DatabaseHelper.getConsumerByTagOrMeterNumber(tagResult.tagDetected);
          if (matched) {
            handleTagIdentified(matched, tagResult.tagDetected);
            return;
          } else {
            setTagStatusMessage(`Tag #${tagResult.tagDetected} detected, but not registered in your assigned route.`);
            return;
          }
        }
        
        // If not matched, provide clear instant feedback
        setTagStatusMessage('No tag number recognized in frame. Aim steadily at the meter badge or select account below.');
      } catch (e) {
        setTagStatusMessage('Could not read tag. Aim steadily at the meter badge or select account.');
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Stage 2: Analyze 5-digit Odometer Dial Reading ONLY
      setIsProcessing(true);
      setCapturedPhoto(photo);

      try {
        const result = await OCRService.analyzeMeterPhoto(
          photo,
          selectedConsumer?.previousReading,
          selectedConsumer?.meterSerial || selectedConsumer?.meterNumber
        );

        setOcrResult(result);

        if (result.success && result.readingValue !== null) {
          playMatchFeedback();
        }
      } catch (err) {
        console.error('Vision dial recognition error:', err);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Transmit Reading Directly to Central Admin Portal
  const handleSendToAdmin = async () => {
    if (!selectedConsumer || !ocrResult || !ocrResult.success || ocrResult.readingValue === null) {
      return;
    }

    const currentReading = ocrResult.readingValue;
    const previousReading = selectedConsumer.previousReading;

    if (currentReading < previousReading) {
      alert(`Strict Validation: Current reading (${currentReading} m³) cannot be less than previous reading (${previousReading} m³).`);
      return;
    }

    setIsSendingToAdmin(true);

    try {
      const bill = CalculationService.calculateWaterBill(
        selectedConsumer.category,
        previousReading,
        currentReading
      );

      const location = await LocationService.getCurrentLocation();

      const readingRecord: MeterReading = {
        id: `MR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        consumerId: selectedConsumer.id,
        accountNumber: selectedConsumer.accountNumber,
        consumerName: selectedConsumer.name,
        meterSerial: selectedConsumer.meterSerial,
        meterNumber: selectedConsumer.meterNumber || identifiedTagNumber || selectedConsumer.meterSerial,
        category: selectedConsumer.category,
        barangay: selectedConsumer.barangay,
        routeCode: selectedConsumer.routeCode || 'WDT-P01',
        previousReading: previousReading,
        currentReading: currentReading,
        consumption: bill.consumption,
        readingDate: new Date().toISOString().split('T')[0],
        readingTime: new Date().toLocaleTimeString('en-US', { hour12: false }),
        readerId: currentUser?.id || 'WDT-FIELD-READER',
        readerName: currentUser?.name || 'Field Meter Reader',
        gpsCoordinates: location,
        photoUrl: capturedPhoto || '',
        ocrConfidence: ocrResult.confidence,
        ocrDetectedSerial: ocrResult.meterSerialDetected,
        meterCondition: 'NORMAL',
        status: 'PENDING_SYNC',
        approvalStatus: 'pending_approval',
        billCalculation: bill,
        syncTimestamp: new Date().toISOString(),
      };

      if (onSaveReading) {
        await onSaveReading(readingRecord);
      } else {
        await DatabaseHelper.saveReading(readingRecord);
      }

      WebSocketService.send('FIELD_READING_RECORDED', {
        readingId: readingRecord.id,
        accountNumber: readingRecord.accountNumber,
        consumerName: readingRecord.consumerName,
        currentReading: readingRecord.currentReading,
        previousReading: readingRecord.previousReading,
        consumption: readingRecord.consumption,
        totalAmountDue: readingRecord.billCalculation.totalAmountDue,
        readerName: currentUser?.name || 'Field Meter Reader',
        timestamp: new Date().toISOString(),
        approvalStatus: 'pending_approval',
      });

      await LoggerService.logAction(
        'METER_READING_SENT_TO_ADMIN',
        currentUser?.id || 'FIELD_READER',
        currentUser?.name || 'Field Reader',
        `Camera 2-Stage Verified for Account ${selectedConsumer.accountNumber} (${selectedConsumer.name}). Reading: ${currentReading} m³, Consumption: ${bill.consumption} m³.`
      );

      SyncService.submitSingleReading(readingRecord).catch(() => {});

      if (onReloadData) onReloadData();

      setLastSubmittedReading(readingRecord);
      setScanStep('SUBMITTED');
    } catch (err: any) {
      console.error('Send to admin error:', err);
      alert('Failed to send reading to admin. Saved to offline ledger.');
    } finally {
      setIsSendingToAdmin(false);
    }
  };

  const handleScanNextConsumer = () => {
    setSelectedConsumer(null);
    setIdentifiedTagNumber('');
    setOcrResult(null);
    setCapturedPhoto(null);
    setLastSubmittedReading(null);
    setScanStep('IDENTIFY_TAG');
    startCamera(facingMode);
  };

  return (
    <div className="relative w-full h-full min-h-0 max-h-full bg-slate-950 flex flex-col justify-between select-none overflow-hidden touch-none">
      {/* 🔝 TOP PINNED STATUS & NAVIGATION BAR (Zero Scrolling Required) */}
      <div className="z-30 p-2.5 space-y-2 pointer-events-auto bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate(selectedConsumer ? 'consumer_details' : 'dashboard')}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit</span>
          </button>

          {/* Dynamic Stage Pill */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-mono shadow-sm">
            <span className={`w-2 h-2 rounded-full ${selectedConsumer ? 'bg-sky-400' : 'bg-emerald-400'} animate-ping`} />
            <span className="font-bold text-white text-[11px]">
              {scanStep === 'SUBMITTED' 
                ? 'SENT TO ADMIN' 
                : scanStep === 'SCAN_METER' 
                ? 'STEP 2: SCAN DIAL' 
                : 'STEP 1: IDENTIFY TAG'}
            </span>
          </div>
        </div>

        {/* 🌟 STEP 2 CONFIRMED OWNER BANNER (Shows verified consumer before reading) */}
        {selectedConsumer && scanStep === 'SCAN_METER' && !ocrResult && (
          <div className="bg-slate-900 border-2 border-sky-500/80 p-2.5 rounded-xl shadow-lg flex items-center justify-between text-xs animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-300 shrink-0">
                <CheckCheck className="w-4 h-4 text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9.5px] bg-sky-950 text-sky-300 border border-sky-700 px-1.5 py-0.2 rounded font-mono font-bold">
                    TAG #{selectedConsumer.meterNumber || selectedConsumer.meterSerial}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono truncate">
                    Acc #{selectedConsumer.accountNumber}
                  </span>
                </div>
                <h3 className="font-black text-xs text-white truncate mt-0.5">
                  {selectedConsumer.name}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedConsumer(null);
                setScanStep('IDENTIFY_TAG');
              }}
              className="text-[10px] text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg shrink-0 ml-2 font-semibold"
            >
              Change
            </button>
          </div>
        )}

        {/* 🌟 STEP 1 QUICK CONSUMER RADAR CHIPS (Select or aim at tag) */}
        {!selectedConsumer && scanStep === 'IDENTIFY_TAG' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Aim camera at Tag or pick account:
              </span>
              <button
                type="button"
                onClick={() => setShowManualTagInput(!showManualTagInput)}
                className="text-sky-400 hover:text-sky-300 font-bold text-[10px] flex items-center gap-0.5"
              >
                <Search className="w-3 h-3" />
                <span>{showManualTagInput ? 'Hide Search' : 'Manual'}</span>
              </button>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {allConsumers.slice(0, 10).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleTagIdentified(c, c.meterNumber || c.meterSerial)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-emerald-950/80 border border-slate-700 hover:border-emerald-500 rounded-lg text-left shrink-0 transition active:scale-95"
                >
                  <span className="text-[9px] font-mono text-emerald-400 font-bold block">
                    {c.meterNumber || c.meterSerial}
                  </span>
                  <span className="text-[10px] font-bold text-white truncate max-w-[85px] block">
                    {c.name}
                  </span>
                </button>
              ))}
            </div>

            {showManualTagInput && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                <Tag className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <input
                  type="text"
                  value={manualTagQuery}
                  onChange={(e) => handleDirectTagInput(e.target.value)}
                  placeholder="Type Tag # or Account (e.g. TAG-01042)..."
                  className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none font-mono"
                  autoFocus
                />
              </div>
            )}

            {tagStatusMessage && (
              <p className="text-[10.5px] text-amber-300 bg-amber-950/60 px-2 py-1 rounded border border-amber-800/80">
                {tagStatusMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 🎯 MAIN CENTERED VIEWFINDER (Perfect Center on Phone Viewport) */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        {/* Live Camera Stream */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          onLoadedMetadata={() => videoRef.current?.play()}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            cameraActive && !capturedPhoto ? 'opacity-100 block' : 'hidden opacity-0'
          }`}
        />

        {/* Captured Photo Preview */}
        {capturedPhoto && (
          <div className="relative w-full h-full flex items-center justify-center p-3">
            <img
              src={capturedPhoto}
              alt="Meter Dial"
              className="max-h-[55vh] rounded-2xl shadow-2xl border-2 border-sky-400 object-contain bg-slate-900"
            />
          </div>
        )}

        {/* Camera Permission Box */}
        {!cameraActive && !capturedPhoto && (
          <div className="text-center p-5 space-y-3 max-w-xs mx-auto z-10">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-sky-400 shadow-xl">
              <Camera className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white text-sm">Camera Offline</h3>
              <p className="text-[11px] text-slate-400 leading-tight">
                {cameraError || 'Grant camera permission to begin optical 2-stage scanning.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>Enable Camera</span>
            </button>
          </div>
        )}

        {/* Dynamic Center Reticle Overlay */}
        {!ocrResult && !capturedPhoto && scanStep !== 'SUBMITTED' && (
          <ScanOverlay
            onCapture={handleCaptureButton}
            onToggleTorch={handleToggleTorch}
            onFlipCamera={handleFlipCamera}
            torchOn={torchOn}
            isProcessing={isProcessing}
            cameraActive={cameraActive}
            mode={selectedConsumer ? 'meter' : 'tag'}
            guideTitle={selectedConsumer ? 'STEP 2: ALIGN 5-DIGIT METER DIAL' : 'STEP 1: AIM AT METER TAG NUMBER'}
            guideSubtitle={
              selectedConsumer 
                ? `Recording reading for ${selectedConsumer.name}` 
                : 'Identifies tag & checks mobile database'
            }
            isAutoScanning={true}
          />
        )}
      </div>

      {/* 🚀 SUBMISSION CELEBRATION MODAL */}
      {scanStep === 'SUBMITTED' && lastSubmittedReading && (
        <div className="p-4 bg-slate-900 border-t-2 border-emerald-500 rounded-t-2xl shadow-2xl space-y-3 z-40 max-w-lg mx-auto w-full animate-in slide-in-from-bottom-4">
          <div className="text-center space-y-1">
            <div className="w-11 h-11 bg-emerald-500/20 border-2 border-emerald-400 rounded-xl flex items-center justify-center mx-auto text-emerald-400 shadow-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">
              Reading Sent to Admin
            </h2>
            <p className="text-[11px] text-slate-300">
              Dispatched live to Central Billing Portal (Approval Queue)
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/40 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div>
                <span className="text-[9.5px] text-emerald-400 font-bold block">
                  ACCOUNT #{lastSubmittedReading.accountNumber}
                </span>
                <span className="font-bold text-white text-xs">{lastSubmittedReading.consumerName}</span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-[9.5px] font-bold rounded-full">
                Pending Approval
              </span>
            </div>

            <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-[9.5px] uppercase font-bold text-slate-400">PREVIOUS READING</span>
                <span className="font-bold text-slate-200">{lastSubmittedReading.previousReading} m³</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-[9.5px] uppercase font-bold text-slate-400">PRESENT READING</span>
                <span className="font-bold text-sky-300">{lastSubmittedReading.currentReading} m³</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-[9.5px] uppercase font-bold text-emerald-400">CONSUMPTION</span>
                <span className="font-black text-emerald-400">{lastSubmittedReading.consumption} m³</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <button
              type="button"
              onClick={handleScanNextConsumer}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl shadow-lg flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Scan Next Meter / House</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg"
              >
                View Logs
              </button>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="py-2 bg-slate-800 text-sky-400 text-xs font-bold rounded-lg"
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 OCR READING IDENTIFIED BOTTOM SHEET (No Scrolling Required) */}
      {ocrResult && scanStep !== 'SUBMITTED' && (
        <div className="p-3.5 bg-slate-900 border-t border-slate-800 rounded-t-2xl shadow-2xl space-y-2.5 z-30 max-w-lg mx-auto w-full animate-in slide-in-from-bottom-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              {ocrResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
              <div>
                <h3 className="font-black text-xs text-white">
                  {ocrResult.success ? '5-Digit Meter Reading Detected' : 'Meter Digits Unclear'}
                </h3>
                <span className="text-[9.5px] text-slate-400 font-mono">
                  {ocrResult.success ? `Confidence: ${(ocrResult.confidence * 100).toFixed(0)}%` : 'Retake photo with better lighting'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setOcrResult(null);
                setCapturedPhoto(null);
                startCamera(facingMode);
              }}
              className="text-xs text-sky-400 hover:text-white px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg transition cursor-pointer"
            >
              Retake
            </button>
          </div>

          {ocrResult.success ? (
            <div className="space-y-2">
              {/* 5 Wheel Slot Confirmation Display */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1 my-1">
                  {ocrResult.digits.map((digit, i) => (
                    <div
                      key={i}
                      className="w-9 h-11 bg-slate-900 border-2 border-sky-400 rounded-lg flex items-center justify-center font-mono font-black text-xl text-white shadow"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                <div className="text-xs font-bold text-sky-400 font-mono mt-1">
                  {ocrResult.readingValue} <span className="text-[10px] font-sans text-slate-400">cubic meters</span>
                </div>

                {selectedConsumer && (
                  <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800 space-y-1 font-mono text-xs mt-1.5 text-left">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-[9px] uppercase font-bold text-slate-400">PREVIOUS</span>
                      <span className="font-bold text-slate-200">{selectedConsumer.previousReading} m³</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-[9px] uppercase font-bold text-slate-400">PRESENT</span>
                      <span className="font-bold text-sky-300">{ocrResult.readingValue} m³</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-[9px] uppercase font-bold text-emerald-400">CONSUMPTION</span>
                      <span className="font-black text-emerald-400">{ocrResult.readingValue - selectedConsumer.previousReading} m³</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {selectedConsumer && ocrResult.readingValue >= selectedConsumer.previousReading ? (
                <button
                  type="button"
                  onClick={handleSendToAdmin}
                  disabled={isSendingToAdmin}
                  className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 text-slate-950 font-black py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSendingToAdmin ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Transmitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-slate-950" />
                      <span>Send to Admin</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(selectedConsumer ? 'reading_entry' : 'consumers')}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl shadow text-xs uppercase tracking-wider transition"
                >
                  <span>{selectedConsumer ? 'Adjust in Manual Form' : 'Assign Owner'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-amber-950/40 p-2 rounded-xl border border-amber-800/80 text-amber-300 text-xs">
                {ocrResult.message || 'Position camera steadily facing the 5 mechanical digit wheels.'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOcrResult(null);
                    setCapturedPhoto(null);
                    startCamera(facingMode);
                  }}
                  className="py-2 bg-slate-800 text-white text-xs font-bold rounded-lg"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate(selectedConsumer ? 'reading_entry' : 'consumers')}
                  className="py-2 bg-sky-600 text-white text-xs font-bold rounded-lg"
                >
                  Enter Manually
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

