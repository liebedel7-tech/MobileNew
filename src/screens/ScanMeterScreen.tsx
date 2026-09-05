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
  Scan,
  Sliders,
  CheckSquare
} from 'lucide-react';
import { Consumer, ActiveScreen, MeterReading, StaffUser } from '../types';
import { OCRService, OCRResult } from '../services/ocrService';
import { RealTimeScanner } from '../services/realTimeScanner';
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
  const [identifiedEntities, setIdentifiedEntities] = useState<string[]>([]);
  const [tagStatusMessage, setTagStatusMessage] = useState<string | null>(null);
  
  // Real-Time Optical Identification States
  const [liveAutoScanActive, setLiveAutoScanActive] = useState(true);
  const [liveTagDetected, setLiveTagDetected] = useState<string | null>(null);
  const [liveDetectedConsumer, setLiveDetectedConsumer] = useState<Consumer | null>(null);
  const [liveReadingDigits, setLiveReadingDigits] = useState<string[] | null>(null);
  const [liveReadingValue, setLiveReadingValue] = useState<number | null>(null);
  const [liveConfidence, setLiveConfidence] = useState<number>(0.92);

  // OCR & Final Reading State
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

  // Audio / Haptic feedback for smart tag or reading match
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
        
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              aspectRatio: { ideal: 4 / 3 },
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
    setLiveTagDetected(null);
    setLiveDetectedConsumer(null);
    if (onSelectConsumer) onSelectConsumer(matchedConsumer);
    playMatchFeedback();

    WebSocketService.notifyProcessEvent('TAG_IDENTIFIED_AUTO', 'COMPLETED', {
      tag: tagStr,
      accountNumber: matchedConsumer.accountNumber,
      ownerName: matchedConsumer.name,
      previousReading: matchedConsumer.previousReading,
    });
  }, [onSelectConsumer, playMatchFeedback]);

  // ⚡ REAL-TIME OPTICAL SCANNER LOOP (Runs continuously while camera is active)
  useEffect(() => {
    if (!cameraActive || isProcessing || ocrResult || scanStep === 'SUBMITTED' || !liveAutoScanActive) {
      return;
    }

    let isScanning = false;
    let autoLockTimer: any = null;

    const interval = setInterval(async () => {
      if (isScanning || !videoRef.current || videoRef.current.videoWidth === 0) return;
      isScanning = true;

      try {
        if (scanStep === 'IDENTIFY_TAG' && !selectedConsumer) {
          // Real-time Stage 1: Search frame for tag numbers in active route
          const tagResult = await RealTimeScanner.scanFrameForTag(videoRef.current, allConsumers);
          if (tagResult && tagResult.tagDetected) {
            setLiveTagDetected(tagResult.tagDetected);
            setLiveDetectedConsumer(tagResult.matchedConsumer);
            setLiveConfidence(tagResult.confidence);
            playMatchFeedback();

            // Automatic Hands-Free Detection Lock: Auto-identify if matching consumer found
            if (tagResult.matchedConsumer) {
              setTagStatusMessage(`⚡ Auto-Detected: ${tagResult.matchedConsumer.name} (${tagResult.tagDetected})`);
              if (!autoLockTimer) {
                autoLockTimer = setTimeout(() => {
                  if (tagResult.matchedConsumer) {
                    handleTagIdentified(tagResult.matchedConsumer, tagResult.tagDetected);
                  }
                }, 400);
              }
            }
          }
        } else if (scanStep === 'SCAN_METER' && selectedConsumer) {
          // Real-time Stage 2: Identify 5-digit mechanical dial numbers
          const dialResult = await RealTimeScanner.scanFrameForDialReading(
            videoRef.current,
            selectedConsumer.previousReading
          );
          if (dialResult && dialResult.digits && dialResult.digits.length === 5) {
            setLiveReadingDigits(dialResult.digits);
            setLiveReadingValue(dialResult.readingValue);
            setLiveConfidence(dialResult.confidence);
            playMatchFeedback();

            // Automatic Hands-Free Reading Lock: Auto-capture and open verification card
            if (!autoLockTimer && videoRef.current) {
              autoLockTimer = setTimeout(() => {
                if (videoRef.current && selectedConsumer) {
                  const formatted5 = dialResult.formatted5Digits;
                  const photo = OCRService.captureFrameFromVideo(videoRef.current);
                  setCapturedPhoto(photo);
                  setOcrResult({
                    success: true,
                    status: 'SUCCESS',
                    readingValue: dialResult.readingValue,
                    odometerFormatted: formatted5,
                    confidence: dialResult.confidence || 0.95,
                    digits: dialResult.digits,
                    meterSerialDetected: selectedConsumer.meterSerial || selectedConsumer.meterNumber,
                    meterCondition: 'Normal',
                    potentialLeak: false,
                    source: 'live_realtime_autolock',
                    message: `Auto-captured: ${formatted5} cu.m.`,
                  });
                }
              }, 600);
            }
          }
        }
      } catch (e) {
        // Continuous scan tick silent handler
      } finally {
        isScanning = false;
      }
    }, 450);

    return () => {
      clearInterval(interval);
      if (autoLockTimer) clearTimeout(autoLockTimer);
    };
  }, [cameraActive, isProcessing, ocrResult, scanStep, selectedConsumer, allConsumers, liveAutoScanActive, handleTagIdentified, playMatchFeedback]);

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

  // Accept Real-Time Lock Directly
  const handleAcceptRealTimeTag = () => {
    if (liveDetectedConsumer && liveTagDetected) {
      handleTagIdentified(liveDetectedConsumer, liveTagDetected);
    }
  };

  const handleAcceptRealTimeReading = () => {
    if (liveReadingValue !== null && selectedConsumer) {
      const formatted5 = String(liveReadingValue).padStart(5, '0');
      const photo = videoRef.current ? OCRService.captureFrameFromVideo(videoRef.current) : '';
      setCapturedPhoto(photo);
      setOcrResult({
        success: true,
        status: 'SUCCESS',
        readingValue: liveReadingValue,
        odometerFormatted: formatted5,
        confidence: liveConfidence || 0.94,
        digits: formatted5.split(''),
        meterSerialDetected: selectedConsumer.meterSerial || selectedConsumer.meterNumber,
        meterCondition: 'Normal',
        potentialLeak: false,
        source: 'real_time_optical_scanner',
        message: `Real-time verified: ${formatted5} cu.m.`,
      });
      playMatchFeedback();
    }
  };

  // Capture Button Handler (Authentic Stage 1: Tag Extraction vs Stage 2: 5-Digit Dial OCR)
  const handleCaptureButton = async () => {
    if (!videoRef.current || !cameraActive || videoRef.current.videoWidth === 0) return;
    
    const photo = OCRService.captureFrameFromVideo(videoRef.current);
    if (!photo) return;

    if (scanStep === 'IDENTIFY_TAG' && !selectedConsumer) {
      // Stage 1: Analyze frame for Meter Tag / Serial Number and Entities
      setIsProcessing(true);
      setTagStatusMessage('Analyzing photo for meter tag & serial numbers...');
      try {
        const tagResult = await OCRService.analyzeTagPhoto(photo);
        if (tagResult.success && tagResult.tagDetected) {
          const tag = tagResult.tagDetected.trim();
          const entities = tagResult.entitiesDetected && tagResult.entitiesDetected.length > 0
            ? tagResult.entitiesDetected
            : [tag];

          setIdentifiedTagNumber(tag);
          setIdentifiedEntities(entities);

          // Step A: Check if direct tag or serial matches database
          let matched = await DatabaseHelper.getConsumerByTagOrMeterNumber(tag);

          // Step B: Check other entities detected
          if (!matched && entities.length > 1) {
            for (const entity of entities) {
              const m = await DatabaseHelper.getConsumerByTagOrMeterNumber(entity);
              if (m) {
                matched = m;
                break;
              }
            }
          }

          if (matched) {
            setTagStatusMessage(`✅ Identified: ${matched.name} (Tag #${tag}) — Account #${matched.accountNumber}`);
            handleTagIdentified(matched, tag);
            return;
          } else {
            // Authentic recognition from photo, but tag is not in reader's route
            setTagStatusMessage(`Identified Number "${tag}" from photo, but it is not in your current route. Search or select below.`);
            setManualTagQuery(tag);
            setShowManualTagInput(true);
            return;
          }
        } else {
          // No tag recognized from photo
          setTagStatusMessage('No tag or serial number detected in the photo. Please aim steadily at the meter badge or select an account below.');
        }
      } catch (e) {
        setTagStatusMessage('Could not analyze photo. Please frame the meter badge clearly with good lighting.');
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

        // Set genuine result (either success with detected digits or rejection with clear reason)
        setOcrResult(result);
        if (result.success && result.readingValue !== null) {
          playMatchFeedback();
        }
      } catch (err) {
        console.error('Vision dial recognition error:', err);
        setOcrResult({
          success: false,
          status: 'FAIL_SAFE_MANUAL_REQUIRED',
          readingValue: 0,
          odometerFormatted: '-----',
          digits: ['-', '-', '-', '-', '-'],
          confidence: 0,
          meterSerialDetected: selectedConsumer?.meterSerial || '',
          meterCondition: 'Unclear',
          potentialLeak: false,
          notes: 'Camera analysis error. Please enter reading directly or retake photo.',
          source: 'camera_vision_ocr',
          message: 'Could not recognize 5 digits on the meter dial. Please retake photo with better lighting or enter manually.',
        });
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

  const handleResetScan = useCallback(() => {
    setSelectedConsumer(null);
    setIdentifiedTagNumber('');
    setIdentifiedEntities([]);
    setOcrResult(null);
    setCapturedPhoto(null);
    setLiveTagDetected(null);
    setLiveDetectedConsumer(null);
    setLiveReadingDigits(null);
    setLiveReadingValue(null);
    setLastSubmittedReading(null);
    setTagStatusMessage(null);
    setManualTagQuery('');
    setShowManualTagInput(false);
    setIsProcessing(false);
    setScanStep('IDENTIFY_TAG');
    startCamera(facingMode);
  }, [facingMode]);

  const handleScanNextConsumer = () => {
    handleResetScan();
  };

  return (
    <div className="relative w-full h-full min-h-0 max-h-full bg-slate-950 flex flex-col justify-start select-none overflow-hidden touch-pan-y">
      {/* 🔝 COMPACT TOP HEADER & NAVIGATION BAR */}
      <div className="z-30 px-3 py-2 space-y-1.5 pointer-events-auto bg-slate-950/90 backdrop-blur-md border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onNavigate(selectedConsumer ? 'consumer_details' : 'dashboard')}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-slate-800 transition active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>

            {/* Reset / New Scan Button */}
            <button
              type="button"
              onClick={handleResetScan}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer"
              title="Reset camera and start fresh scan"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              <span>New Scan</span>
            </button>
          </div>

          {/* Dynamic Stage Pill */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-xl text-xs font-mono shadow-sm">
            <span className={`w-2 h-2 rounded-full ${selectedConsumer ? 'bg-sky-400' : 'bg-emerald-400'} animate-ping`} />
            <span className="font-bold text-white text-[10.5px]">
              {scanStep === 'SUBMITTED' 
                ? 'SENT TO ADMIN' 
                : scanStep === 'SCAN_METER' 
                ? 'STEP 2: SCAN DIAL' 
                : 'STEP 1: IDENTIFY TAG'}
            </span>
          </div>

          {/* Real-Time Auto-Scan Toggle */}
          <button
            type="button"
            onClick={() => setLiveAutoScanActive(!liveAutoScanActive)}
            className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 border transition ${
              liveAutoScanActive
                ? 'bg-emerald-950 text-emerald-300 border-emerald-600/70 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
            title="Toggle Continuous Real-Time OCR"
          >
            <Sparkles className="w-3 h-3" />
            <span>{liveAutoScanActive ? 'Auto OCR' : 'Manual'}</span>
          </button>
        </div>

        {/* 🌟 STEP 2 CONFIRMED OWNER BANNER */}
        {selectedConsumer && scanStep === 'SCAN_METER' && !ocrResult && (
          <div className="bg-slate-900/95 border border-sky-500/80 p-2 rounded-xl shadow-md flex items-center justify-between text-xs animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-300 shrink-0">
                <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-700 px-1 py-0.2 rounded font-mono font-bold">
                    TAG #{selectedConsumer.meterNumber || selectedConsumer.meterSerial}
                  </span>
                  <span className="text-[9.5px] text-slate-400 font-mono truncate">
                    Acc #{selectedConsumer.accountNumber}
                  </span>
                </div>
                <h3 className="font-bold text-[11.5px] text-white truncate">
                  {selectedConsumer.name}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetScan}
              className="text-[9.5px] text-sky-400 hover:text-white px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg shrink-0 ml-1 font-semibold"
            >
              Change Tag
            </button>
          </div>
        )}

        {/* 🌟 STEP 1 QUICK CONSUMER SEARCH & SELECTION */}
        {!selectedConsumer && scanStep === 'IDENTIFY_TAG' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Aim at Meter Tag or search account:
              </span>
              <button
                type="button"
                onClick={() => setShowManualTagInput(!showManualTagInput)}
                className="text-sky-400 hover:text-sky-300 font-bold text-[9.5px] flex items-center gap-0.5"
              >
                <Search className="w-2.5 h-2.5" />
                <span>{showManualTagInput ? 'Hide Search' : 'Filter / Search'}</span>
              </button>
            </div>

            {showManualTagInput && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                <Search className="w-3 h-3 text-sky-400 shrink-0" />
                <input
                  type="text"
                  value={manualTagQuery}
                  onChange={(e) => handleDirectTagInput(e.target.value)}
                  placeholder="Filter by Name, Tag #, Meter Serial, or Account..."
                  className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none font-mono"
                  autoFocus
                />
                {manualTagQuery && (
                  <button
                    type="button"
                    onClick={() => setManualTagQuery('')}
                    className="text-[10px] text-slate-400 hover:text-white px-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {(manualTagQuery
                ? allConsumers.filter((c) =>
                    (c.name + ' ' + c.meterNumber + ' ' + c.meterSerial + ' ' + c.accountNumber)
                      .toLowerCase()
                      .includes(manualTagQuery.toLowerCase())
                  )
                : allConsumers.slice(0, 8)
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleTagIdentified(c, c.meterNumber || c.meterSerial)}
                  className="px-2 py-1 bg-slate-900 hover:bg-emerald-950/80 border border-slate-700 hover:border-emerald-500 rounded-lg text-left shrink-0 transition active:scale-95 cursor-pointer"
                >
                  <span className="text-[8.5px] font-mono text-emerald-400 font-bold block truncate max-w-[110px]">
                    {c.meterNumber || c.meterSerial}
                  </span>
                  <span className="text-[9.5px] font-bold text-white truncate max-w-[110px] block">
                    {c.name}
                  </span>
                </button>
              ))}
            </div>

            {tagStatusMessage && (
              <p className="text-[10px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/80">
                {tagStatusMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 🎯 ADJUSTED COMPACT VIEWFINDER CARD (Clean, proportional size - Not taking the whole screen) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col items-center justify-start space-y-2 max-w-md mx-auto w-full">
        {/* Viewfinder Bounded Box */}
        <div
          className={`relative w-full aspect-[4/3] max-h-[280px] sm:max-h-[320px] rounded-2xl overflow-hidden border-2 bg-slate-950 shadow-2xl flex items-center justify-center transition-all duration-300 ${
            selectedConsumer
              ? 'border-sky-500/80 shadow-[0_0_25px_rgba(14,165,233,0.25)]'
              : 'border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
          }`}
        >
          {/* Live Camera Feed */}
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
            <div className="relative w-full h-full flex items-center justify-center p-2 bg-slate-950">
              <img
                src={capturedPhoto}
                alt="Meter Dial"
                className="max-h-full rounded-xl border border-sky-400 object-contain shadow-lg"
              />
            </div>
          )}

          {/* Camera Permission / Error Box */}
          {!cameraActive && !capturedPhoto && (
            <div className="text-center p-4 space-y-2 max-w-xs mx-auto z-10">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-sky-400 shadow-md">
                <Camera className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-white text-xs">Camera Offline</h3>
                <p className="text-[10.5px] text-slate-400 leading-tight">
                  {cameraError || 'Grant camera permission to enable real-time reading.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="w-full py-2 px-3 rounded-lg bg-sky-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow active:scale-95 transition cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Enable Camera</span>
              </button>
            </div>
          )}

          {/* Viewfinder Reticle with Live Optical Numbers & Tag Feedback */}
          {!ocrResult && !capturedPhoto && scanStep !== 'SUBMITTED' && (
            <ScanOverlay
              onCapture={handleCaptureButton}
              onToggleTorch={handleToggleTorch}
              onFlipCamera={handleFlipCamera}
              torchOn={torchOn}
              isProcessing={isProcessing}
              cameraActive={cameraActive}
              mode={selectedConsumer ? 'meter' : 'tag'}
              guideTitle={selectedConsumer ? 'ALIGN 5-DIGIT METER DIAL' : 'AIM AT METER TAG NUMBER'}
              guideSubtitle={
                selectedConsumer 
                  ? `Reading for ${selectedConsumer.name}` 
                  : 'Real-time identifying tag in route'
              }
              isAutoScanning={liveAutoScanActive}
              liveTagDetected={liveTagDetected}
              liveReadingDigits={liveReadingDigits}
              liveReadingValue={liveReadingValue}
              liveConfidence={liveConfidence}
            />
          )}
        </div>

        {/* ⚡ REAL-TIME LIVE OCR DETECTION HUD (Shows exactly what numbers are identified in real-time) */}
        {!ocrResult && !capturedPhoto && scanStep !== 'SUBMITTED' && (
          <div className="w-full space-y-2">
            {/* Stage 1: Live Tag Detected Banner */}
            {scanStep === 'IDENTIFY_TAG' && liveTagDetected && (
              <div className="bg-emerald-950/90 border border-emerald-500/80 p-2.5 rounded-xl shadow-lg flex items-center justify-between animate-in zoom-in-95">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 shrink-0">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9.5px] font-mono text-emerald-400 font-bold block">
                      ⚡ REAL-TIME TAG DETECTED
                    </span>
                    <span className="text-xs font-black text-white truncate block">
                      {liveTagDetected} {liveDetectedConsumer ? `• ${liveDetectedConsumer.name}` : ''}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAcceptRealTimeTag}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs shadow flex items-center gap-1 active:scale-95 transition cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Select</span>
                </button>
              </div>
            )}

            {/* Stage 2: Live 5-Digit Dial Reading Banner */}
            {scanStep === 'SCAN_METER' && selectedConsumer && (
              <div className="bg-slate-900 border border-sky-500/70 p-2.5 rounded-xl shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-sky-300 font-bold uppercase">
                      Real-Time Dial Reading
                    </span>
                  </div>
                  <span className="text-[9.5px] text-emerald-400 font-mono font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/60">
                    Confidence: {((liveConfidence || 0.9) * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[9px] text-slate-400 font-mono block">PREVIOUS RECORD</span>
                    <span className="text-xs font-bold text-slate-200 font-mono">
                      {selectedConsumer.previousReading} m³
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] text-sky-400 font-mono block">LIVE IDENTIFIED</span>
                    <span className="text-sm font-black text-sky-300 font-mono">
                      {liveReadingValue !== null ? `${liveReadingValue} m³` : 'Aim at wheels...'}
                    </span>
                  </div>

                  {liveReadingValue !== null && (
                    <div className="text-right border-l border-slate-800 pl-2">
                      <span className="text-[9px] text-emerald-400 font-mono block">CONSUMPTION</span>
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        +{Math.max(0, liveReadingValue - selectedConsumer.previousReading)} m³
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick 1-Tap Lock Button for Live Reading */}
                {liveReadingValue !== null && (
                  <button
                    type="button"
                    onClick={handleAcceptRealTimeReading}
                    className="w-full bg-gradient-to-r from-sky-500 to-teal-500 text-slate-950 font-black py-2 rounded-lg text-xs uppercase tracking-wider shadow flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Confirm Live Reading ({liveReadingValue} m³)</span>
                  </button>
                )}
              </div>
            )}

            {/* Shutter Button & Manual Entry Option */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCaptureButton}
                disabled={isProcessing}
                className={`flex-1 font-bold py-2.5 rounded-xl shadow flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer disabled:opacity-50 ${
                  selectedConsumer
                    ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{selectedConsumer ? 'Reading 5 Dials...' : 'Extracting Tag Number...'}</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>{selectedConsumer ? 'Capture 5-Digit Reading' : 'Capture & Identify Tag #'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onNavigate(selectedConsumer ? 'reading_entry' : 'consumers')}
                className="px-3 py-2.5 bg-slate-900 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold"
              >
                Manual
              </button>
            </div>
          </div>
        )}

        {/* 🚀 SUBMISSION CELEBRATION MODAL */}
        {scanStep === 'SUBMITTED' && lastSubmittedReading && (
          <div className="p-3 bg-slate-900 border-2 border-emerald-500 rounded-2xl shadow-2xl space-y-2.5 z-40 max-w-lg mx-auto w-full animate-in slide-in-from-bottom-2">
            <div className="text-center space-y-0.5">
              <div className="w-9 h-9 bg-emerald-500/20 border-2 border-emerald-400 rounded-xl flex items-center justify-center mx-auto text-emerald-400 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h2 className="text-xs font-black text-white uppercase tracking-tight">
                Reading Sent to Admin
              </h2>
              <p className="text-[10px] text-slate-300">
                Dispatched live to Central Billing Portal (Approval Queue)
              </p>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-emerald-500/40 space-y-1.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <div>
                  <span className="text-[9px] text-emerald-400 font-bold block">
                    ACCOUNT #{lastSubmittedReading.accountNumber}
                  </span>
                  <span className="font-bold text-white text-xs">{lastSubmittedReading.consumerName}</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-[9px] font-bold rounded-full">
                  Pending Approval
                </span>
              </div>

              <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800 space-y-1 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[9px] uppercase font-bold text-slate-400">PREVIOUS READING</span>
                  <span className="font-bold text-slate-200">{lastSubmittedReading.previousReading} m³</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[9px] uppercase font-bold text-slate-400">PRESENT READING</span>
                  <span className="font-bold text-sky-300">{lastSubmittedReading.currentReading} m³</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-emerald-400">CONSUMPTION</span>
                  <span className="font-black text-emerald-400">{lastSubmittedReading.consumption} m³</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleScanNextConsumer}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 rounded-xl shadow flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Scan Next Meter</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="py-1.5 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg"
                >
                  View Logs
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="py-1.5 bg-slate-800 text-sky-400 text-xs font-bold rounded-lg"
                >
                  Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 📊 OCR READING IDENTIFIED BOTTOM SHEET */}
        {ocrResult && scanStep !== 'SUBMITTED' && (
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-2 z-30 max-w-lg mx-auto w-full animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                {ocrResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <div>
                  <h3 className="font-bold text-xs text-white">
                    {ocrResult.success ? '5-Digit Meter Reading Detected' : 'Meter Digits Unclear'}
                  </h3>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {ocrResult.success ? `Confidence: ${(ocrResult.confidence * 100).toFixed(0)}%` : 'Retake photo or adjust lighting'}
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
                className="text-xs text-sky-400 hover:text-white px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-lg transition cursor-pointer"
              >
                Retake
              </button>
            </div>

            {ocrResult.success ? (
              <div className="space-y-2">
                {/* 5 Wheel Slot Display with Interactive Stepper Buttons */}
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>5-WHEEL COUNTER</span>
                    <span className="text-sky-400">Tap ▲/▼ to fine-tune digits</span>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 my-1">
                    {ocrResult.digits.map((digit, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = parseInt(digit, 10) || 0;
                            const next = (cur + 1) % 10;
                            const newDigits = [...ocrResult.digits];
                            newDigits[i] = String(next);
                            const newNum = parseInt(newDigits.join(''), 10);
                            setOcrResult({
                              ...ocrResult,
                              digits: newDigits,
                              readingValue: newNum,
                              odometerFormatted: newDigits.join(''),
                            });
                          }}
                          className="w-7 h-4 bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white rounded flex items-center justify-center text-[9px] font-black transition cursor-pointer"
                          title={`Increment digit ${i + 1}`}
                        >
                          ▲
                        </button>
                        <div
                          className="w-8 h-10 bg-slate-900 border-2 border-sky-400 rounded-lg flex items-center justify-center font-mono font-black text-lg text-white shadow select-none"
                        >
                          {digit}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = parseInt(digit, 10) || 0;
                            const next = (cur - 1 + 10) % 10;
                            const newDigits = [...ocrResult.digits];
                            newDigits[i] = String(next);
                            const newNum = parseInt(newDigits.join(''), 10);
                            setOcrResult({
                              ...ocrResult,
                              digits: newDigits,
                              readingValue: newNum,
                              odometerFormatted: newDigits.join(''),
                            });
                          }}
                          className="w-7 h-4 bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white rounded flex items-center justify-center text-[9px] font-black transition cursor-pointer"
                          title={`Decrement digit ${i + 1}`}
                        >
                          ▼
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1 border-t border-slate-800/80">
                    <span className="text-xs font-mono text-slate-400">Total Reading:</span>
                    <input
                      type="number"
                      min={selectedConsumer ? selectedConsumer.previousReading : 0}
                      value={ocrResult.readingValue}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 0) {
                          const formatted = String(val).padStart(5, '0');
                          setOcrResult({
                            ...ocrResult,
                            readingValue: val,
                            odometerFormatted: formatted,
                            digits: formatted.slice(-5).split(''),
                          });
                        }
                      }}
                      className="w-24 bg-slate-900 border border-sky-500/70 text-sky-300 font-mono font-black text-sm px-2 py-0.5 rounded text-center focus:outline-none focus:ring-1 focus:ring-sky-400"
                    />
                    <span className="text-xs text-sky-400 font-mono">m³</span>
                  </div>

                  {selectedConsumer && (
                    <div className="bg-slate-900/90 rounded-lg p-1.5 border border-slate-800 space-y-0.5 font-mono text-xs mt-1 text-left">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-[8.5px] uppercase font-bold text-slate-400">PREVIOUS</span>
                        <span className="font-bold text-slate-200">{selectedConsumer.previousReading} m³</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-[8.5px] uppercase font-bold text-slate-400">PRESENT</span>
                        <span className="font-bold text-sky-300">{ocrResult.readingValue} m³</span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5 border-t border-slate-800">
                        <span className="text-[8.5px] uppercase font-bold text-emerald-400">CONSUMPTION</span>
                        <span className={`font-black ${ocrResult.readingValue >= selectedConsumer.previousReading ? 'text-emerald-400' : 'text-red-400'}`}>
                          {ocrResult.readingValue >= selectedConsumer.previousReading
                            ? `+${ocrResult.readingValue - selectedConsumer.previousReading} m³`
                            : `Invalid: Less than previous (${ocrResult.readingValue - selectedConsumer.previousReading} m³)`}
                        </span>
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
                    className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 text-slate-950 font-black py-2.5 rounded-xl shadow flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingToAdmin ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                        <span>Transmitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-slate-950" />
                        <span>Send to Admin</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate(selectedConsumer ? 'reading_entry' : 'consumers')}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded-xl shadow text-xs uppercase tracking-wider transition"
                  >
                    <span>{selectedConsumer ? 'Adjust in Manual Form' : 'Assign Owner'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="bg-amber-950/40 p-1.5 rounded-lg border border-amber-800/80 text-amber-300 text-xs">
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
                    className="py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(selectedConsumer ? 'reading_entry' : 'consumers')}
                    className="py-1.5 bg-sky-600 text-white text-xs font-bold rounded-lg"
                  >
                    Enter Manually
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
