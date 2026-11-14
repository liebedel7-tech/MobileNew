import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Check,
  Smartphone,
  CheckCheck,
  Clock,
  Droplets,
  Layers,
  Search,
  Scan,
  Sliders,
  CheckSquare,
  ShieldAlert,
  PowerOff,
  Keyboard
} from 'lucide-react';
import { Consumer, ActiveScreen, MeterReading, StaffUser } from '../types';
import { 
  isValidatedForFieldReading, 
  getConsumerDeactivationReason,
  formatOdometerReading,
  cleanOdometerInput,
  parseOdometerReading,
} from '../constants/routes';
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
  consumers?: Consumer[];
  currentUser?: StaffUser | null;
  onNavigate: (screen: ActiveScreen) => void;
  onOCRComplete?: (data: { readingValue: number; photoUrl: string; confidence: number }) => void;
  onSelectConsumer?: (consumer: Consumer | null) => void;
  onSaveReading?: (reading: MeterReading) => Promise<void> | void;
  onReloadData?: () => void;
}

type ScanWorkflowStep = 'IDENTIFY_TAG' | 'CONFIRM_CONSUMER' | 'SCAN_METER' | 'SUBMITTED';

const normalizeIdentifier = (value?: string | null): string =>
  (value || '').trim().toLowerCase().replace(/[\s\-_]/g, '');

const getConsumerIdentifierKeys = (c: Consumer): string[] =>
  [c.id, c.accountNumber, c.meterNumber, c.meterSerial]
    .map((v) => normalizeIdentifier(v))
    .filter((v) => v.length > 0);

export const ScanMeterScreen: React.FC<ScanMeterScreenProps> = ({
  consumer: initialConsumer,
  consumers: consumersProp,
  currentUser,
  onNavigate,
  onOCRComplete,
  onSelectConsumer,
  onSaveReading,
  onReloadData,
}) => {
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(initialConsumer || null);
  const [allConsumers, setAllConsumers] = useState<Consumer[]>(consumersProp || []);
  const scannedKeysRef = useRef<Set<string>>(new Set());
  const [scannedVersion, setScannedVersion] = useState(0);
  
  // Camera state & stream configuration
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Multi-Stage Workflow: IDENTIFY_TAG -> CONFIRM_CONSUMER -> SCAN_METER -> SUBMITTED
  const [scanStep, setScanStep] = useState<ScanWorkflowStep>(
    initialConsumer ? 'SCAN_METER' : 'IDENTIFY_TAG'
  );
  const [identifiedTagNumber, setIdentifiedTagNumber] = useState<string>(
    initialConsumer?.meterNumber || initialConsumer?.meterSerial || ''
  );
  const [identifiedEntities, setIdentifiedEntities] = useState<string[]>([]);
  const [tagStatusMessage, setTagStatusMessage] = useState<string | null>(null);
  const [deactivationBlock, setDeactivationBlock] = useState<{
    consumer: Consumer;
    reason: string;
    tag: string;
  } | null>(null);

  const [pendingApprovalBlock, setPendingApprovalBlock] = useState<{
    consumer: Consumer;
    pendingReading: MeterReading;
  } | null>(null);

  const [latestApprovedReading, setLatestApprovedReading] = useState<MeterReading | null>(null);
  
  // Real-Time Optical Identification States
  const [liveAutoScanActive, setLiveAutoScanActive] = useState(true);
  const [liveTagDetected, setLiveTagDetected] = useState<string | null>(null);
  const [liveDetectedConsumer, setLiveDetectedConsumer] = useState<Consumer | null>(null);
  const [liveReadingDigits, setLiveReadingDigits] = useState<string[] | null>(null);
  const [liveReadingValue, setLiveReadingValue] = useState<number | null>(null);
  const [liveConfidence, setLiveConfidence] = useState<number>(0.92);
  const [isReadingClear, setIsReadingClear] = useState<boolean>(false);
  const [clearConfidenceCount, setClearConfidenceCount] = useState<number>(0);

  // OCR & Final Reading State
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSendingToAdmin, setIsSendingToAdmin] = useState(false);
  const [lastSubmittedReading, setLastSubmittedReading] = useState<MeterReading | null>(null);

  // Quick manual tag input fallback
  const [manualTagQuery, setManualTagQuery] = useState('');
  const [showManualTagInput, setShowManualTagInput] = useState(false);

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

  const refreshConsumers = useCallback(async () => {
    const routes = currentUser?.assignedRoutes || (currentUser?.zone ? [currentUser.zone] : undefined);
    const list = await DatabaseHelper.getConsumersForReader(routes);
    setAllConsumers(list);
  }, [currentUser]);

  // Keep consumers synchronized with parent prop and active reader routes
  useEffect(() => {
    if (consumersProp && consumersProp.length > 0) {
      setAllConsumers(consumersProp);
    } else {
      refreshConsumers();
    }
  }, [consumersProp, refreshConsumers]);

  // Keep scannedKeysRef in sync with consumers whose reading is already logged (unless explicitly rejected for re-inspection)
  const isConsumerAlreadyScanned = useCallback(
    (c: Consumer): boolean => {
      const keys = getConsumerIdentifierKeys(c);
      if (keys.some((k) => scannedKeysRef.current.has(k))) {
        return true;
      }
      if (c.isReadThisMonth) {
        const approval = c.currentMonthReading?.approvalStatus;
        const status = c.currentMonthReading?.status;
        if (approval !== 'rejected' && status !== 'REJECTED') {
          return true;
        }
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scannedVersion]
  );

  // Eligible unread consumers for tag detection and selection (strictly excludes scanned/read accounts)
  const scannableConsumers = useMemo(
    () => allConsumers.filter((c) => isValidatedForFieldReading(c) && !isConsumerAlreadyScanned(c)),
    [allConsumers, isConsumerAlreadyScanned]
  );

  // Clear stale internal selection if parent clears initialConsumer while we are in SCAN_METER
  const prevInitialConsumerRef = useRef<Consumer | null | undefined>(initialConsumer);
  useEffect(() => {
    if (prevInitialConsumerRef.current && !initialConsumer && scanStep === 'SCAN_METER') {
      setSelectedConsumer(null);
      setIdentifiedTagNumber('');
      setScanStep('IDENTIFY_TAG');
    }
    prevInitialConsumerRef.current = initialConsumer;
  }, [initialConsumer, scanStep]);

  // Verify if selected consumer has a reading pending admin approval or an approved baseline
  useEffect(() => {
    let isMounted = true;
    if (selectedConsumer && scanStep !== 'SUBMITTED') {
      Promise.all([
        DatabaseHelper.getPendingReadingForMeter(selectedConsumer.accountNumber, selectedConsumer.meterNumber || selectedConsumer.meterSerial),
        DatabaseHelper.getLatestApprovedReading(selectedConsumer.accountNumber, selectedConsumer.meterNumber || selectedConsumer.meterSerial),
      ]).then(([pending, approved]) => {
        if (!isMounted) return;
        setLatestApprovedReading(approved);
        const isPending = pending && pending.approvalStatus !== 'approved' && pending.status !== 'APPROVED';
        if (isPending) {
          setPendingApprovalBlock({
            consumer: selectedConsumer,
            pendingReading: pending,
          });
        } else {
          setPendingApprovalBlock(null);
        }
      });
    } else if (!selectedConsumer) {
      setPendingApprovalBlock(null);
      setLatestApprovedReading(null);
    }
    return () => {
      isMounted = false;
    };
  }, [selectedConsumer, scanStep]);

  const effectiveBaselineReading = useMemo(() => {
    if (!selectedConsumer) return 0;
    return latestApprovedReading
      ? latestApprovedReading.currentReading
      : (selectedConsumer.previousReading || 0);
  }, [selectedConsumer, latestApprovedReading]);

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

  // Handle Tag identification and display Consumer Info first (CONFIRM_CONSUMER) before meter reading
  const handleTagIdentified = useCallback((matchedConsumer: Consumer, tagStr: string) => {
    // ENFORCE DEACTIVATION & WATER METER STATUS GATE:
    if (!isValidatedForFieldReading(matchedConsumer)) {
      const reason = getConsumerDeactivationReason(matchedConsumer) || 'Account or Water Meter deactivated by Admin.';
      setDeactivationBlock({
        consumer: matchedConsumer,
        reason,
        tag: tagStr,
      });
      setTagStatusMessage(`DEACTIVATED BY ADMIN: ${reason}`);
      setLiveTagDetected(null);
      setLiveDetectedConsumer(null);
      return;
    }

    // ENFORCE PENDING APPROVAL & ALREADY-SCANNED GATE:
    // Prevent a previously scanned/submitted consumer from reappearing in tag identification
    if (isConsumerAlreadyScanned(matchedConsumer)) {
      const existingReading = matchedConsumer.currentMonthReading;
      if (
        existingReading &&
        existingReading.approvalStatus !== 'approved' &&
        existingReading.status !== 'APPROVED'
      ) {
        setPendingApprovalBlock({
          consumer: matchedConsumer,
          pendingReading: existingReading,
        });
      }
      setTagStatusMessage(
        `Already scanned this cycle: ${matchedConsumer.name} (Tag #${tagStr}). Aim at an unread water meter.`
      );
      setLiveTagDetected(null);
      setLiveDetectedConsumer(null);
      return;
    }

    setDeactivationBlock(null);
    setPendingApprovalBlock(null);
    setOcrResult(null);
    setCapturedPhoto(null);
    setLiveReadingDigits(null);
    setLiveReadingValue(null);
    setIsReadingClear(false);
    setClearConfidenceCount(0);
    setSelectedConsumer(matchedConsumer);
    setIdentifiedTagNumber(tagStr);
    setScanStep('CONFIRM_CONSUMER');
    setTagStatusMessage(null);
    setLiveTagDetected(null);
    setLiveDetectedConsumer(null);
    playMatchFeedback();

    WebSocketService.notifyProcessEvent('TAG_IDENTIFIED_AUTO', 'COMPLETED', {
      tag: tagStr,
      accountNumber: matchedConsumer.accountNumber,
      ownerName: matchedConsumer.name,
      previousReading: matchedConsumer.previousReading,
    });
  }, [isConsumerAlreadyScanned, playMatchFeedback]);

  // Explicit confirmation action after reviewing Consumer Info Card -> Stage 'SCAN_METER'
  const handleProceedToScanMeter = useCallback(() => {
    if (!selectedConsumer) return;
    if (!isValidatedForFieldReading(selectedConsumer) || isConsumerAlreadyScanned(selectedConsumer)) {
      return;
    }
    setOcrResult(null);
    setCapturedPhoto(null);
    setLiveReadingDigits(null);
    setLiveReadingValue(null);
    setIsReadingClear(false);
    setClearConfidenceCount(0);
    setTagStatusMessage(null);
    if (onSelectConsumer) {
      onSelectConsumer(selectedConsumer);
    }
    setScanStep('SCAN_METER');
    playMatchFeedback();
  }, [selectedConsumer, isConsumerAlreadyScanned, onSelectConsumer, playMatchFeedback]);

  // ⚡ REAL-TIME OPTICAL SCANNER LOOP (Runs only during active IDENTIFY_TAG or SCAN_METER)
  useEffect(() => {
    if (
      !cameraActive ||
      isProcessing ||
      ocrResult ||
      scanStep === 'CONFIRM_CONSUMER' ||
      scanStep === 'SUBMITTED' ||
      !liveAutoScanActive ||
      deactivationBlock ||
      pendingApprovalBlock
    ) {
      return;
    }

    let isScanning = false;
    let autoLockTimer: any = null;

    const interval = setInterval(async () => {
      if (isScanning || !videoRef.current || videoRef.current.videoWidth === 0) return;
      isScanning = true;

      try {
        if (scanStep === 'IDENTIFY_TAG' && !selectedConsumer) {
          // Real-time Stage 1: Search frame ONLY against unread & active scannableConsumers
          if (scannableConsumers.length === 0) return;
          const tagResult = await RealTimeScanner.scanFrameForTag(videoRef.current, scannableConsumers);
          if (tagResult && tagResult.tagDetected && tagResult.matchedConsumer) {
            if (isConsumerAlreadyScanned(tagResult.matchedConsumer)) {
              return;
            }
            const matched = tagResult.matchedConsumer;
            const tagDetected = tagResult.tagDetected;
            setLiveTagDetected(tagDetected);
            setLiveDetectedConsumer(matched);
            setLiveConfidence(tagResult.confidence);
            playMatchFeedback();
            setTagStatusMessage(`Detected Tag #${tagDetected} — ${matched.name}`);

            if (!autoLockTimer) {
              autoLockTimer = setTimeout(() => {
                handleTagIdentified(matched, tagDetected);
              }, 350);
            }
          }
        } else if (scanStep === 'SCAN_METER' && selectedConsumer) {
          // Real-time Stage 2: Identify 5-digit mechanical dial numbers using latest approved baseline
          const prev = effectiveBaselineReading;
          const dialResult = await RealTimeScanner.scanFrameForDialReading(
            videoRef.current,
            prev
          );
          if (dialResult && dialResult.digits && dialResult.digits.length === 5) {
            const isNormal = dialResult.readingValue >= prev;
            const isRollover = prev >= 90000 && dialResult.readingValue < 10000;
            const isValidSequence = prev === 0 || isNormal || isRollover;

            if (!isValidSequence) {
              setLiveReadingDigits(null);
              setLiveReadingValue(null);
              setIsReadingClear(false);
              setClearConfidenceCount(0);
              return;
            }

            setLiveReadingDigits(dialResult.digits);
            setLiveReadingValue(dialResult.readingValue);
            setLiveConfidence(dialResult.confidence);

            const meetsConfidenceThreshold = dialResult.confidence > 0.90;
            const isClear = meetsConfidenceThreshold && isValidSequence && dialResult.digits.length === 5;

            setIsReadingClear(isClear);

            if (isClear) {
              setClearConfidenceCount((prevCount) => {
                const nextCount = prevCount + 1;
                if (nextCount >= 2 && !autoLockTimer && videoRef.current) {
                  playMatchFeedback();
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
                        confidence: dialResult.confidence || 0.96,
                        digits: dialResult.digits,
                        meterSerialDetected: selectedConsumer.meterSerial || selectedConsumer.meterNumber,
                        meterCondition: 'Normal',
                        potentialLeak: false,
                        source: 'live_realtime_autolock',
                        message: `Auto-identified: ${formatted5} cu.m. (Confidence: ${Math.round((dialResult.confidence || 0.95) * 100)}%)`,
                      });
                    }
                  }, 300);
                }
                return nextCount;
              });
            } else {
              setClearConfidenceCount(0);
            }
          } else {
            setIsReadingClear(false);
            setClearConfidenceCount(0);
          }
        }
      } catch {
        // Continuous scan tick silent handler
      } finally {
        isScanning = false;
      }
    }, 380);

    return () => {
      clearInterval(interval);
      if (autoLockTimer) clearTimeout(autoLockTimer);
    };
  }, [
    cameraActive,
    isProcessing,
    ocrResult,
    scanStep,
    selectedConsumer,
    scannableConsumers,
    effectiveBaselineReading,
    liveAutoScanActive,
    deactivationBlock,
    pendingApprovalBlock,
    isConsumerAlreadyScanned,
    handleTagIdentified,
    playMatchFeedback,
  ]);

  // Direct manual tag query matcher (matches exact tag/serial/account against unread scannable consumers)
  const handleDirectTagInput = async (value: string) => {
    setManualTagQuery(value);
    const clean = value.trim();
    if (clean.length >= 4) {
      const norm = normalizeIdentifier(clean);
      const exactUnread = scannableConsumers.find(
        (c) =>
          normalizeIdentifier(c.meterNumber) === norm ||
          normalizeIdentifier(c.meterSerial) === norm ||
          normalizeIdentifier(c.accountNumber) === norm
      );
      if (exactUnread) {
        handleTagIdentified(exactUnread, exactUnread.meterNumber || clean);
        return;
      }
      const exactAny = allConsumers.find(
        (c) =>
          normalizeIdentifier(c.meterNumber) === norm ||
          normalizeIdentifier(c.meterSerial) === norm ||
          normalizeIdentifier(c.accountNumber) === norm
      );
      if (exactAny && isConsumerAlreadyScanned(exactAny)) {
        setTagStatusMessage(
          `Already scanned this cycle: ${exactAny.name} (${exactAny.meterNumber || exactAny.accountNumber}). Select an unread meter.`
        );
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

  const handleSetZoom = async (newZoom: number) => {
    setZoomLevel(newZoom);
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = (track && track.getCapabilities && (track as any).getCapabilities()) as any;
      if (capabilities && capabilities.zoom) {
        try {
          await (track as any).applyConstraints({
            advanced: [{ zoom: newZoom }],
          });
        } catch (e) {
          console.debug('Hardware zoom constraint note:', e);
        }
      }
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
      const prev = selectedConsumer.previousReading || 0;
      const isNormal = liveReadingValue >= prev;
      const isRollover = prev >= 90000 && liveReadingValue < 10000;
      if (prev > 0 && !isNormal && !isRollover) {
        // Prevent accepting invalid / smaller numbers
        setOcrResult({
          success: false,
          status: 'REJECTED_INVALID_READING',
          readingValue: 0,
          odometerFormatted: '-----',
          digits: ['-', '-', '-', '-', '-'],
          confidence: 0,
          meterSerialDetected: selectedConsumer.meterSerial || selectedConsumer.meterNumber,
          meterCondition: 'Invalid Reading',
          potentialLeak: false,
          source: 'validation_error',
          message: `Invalid Reading Error: Detected value (${formatOdometerReading(liveReadingValue)} cu.m.) cannot be less than previous record (${formatOdometerReading(prev)} cu.m.). Please frame dials properly or type reading manually.`,
        });
        return;
      }

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

          // Step A: Check if direct tag or serial matches database strictly within assigned routes
          const readerRoutes = currentUser?.assignedRoutes || (currentUser?.zone ? [currentUser.zone] : undefined);
          let matched = await DatabaseHelper.getConsumerByTagOrMeterNumber(tag, readerRoutes);

          // Step B: Check other entities detected
          if (!matched && entities.length > 1) {
            for (const entity of entities) {
              const m = await DatabaseHelper.getConsumerByTagOrMeterNumber(entity, readerRoutes);
              if (m) {
                matched = m;
                break;
              }
            }
          }

          if (matched) {
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
    } else if (scanStep === 'SCAN_METER' && selectedConsumer) {
      // Stage 2: Analyze 5-digit Odometer Dial Reading ONLY
      setIsProcessing(true);
      setCapturedPhoto(photo);

      try {
        const result = await OCRService.analyzeMeterPhoto(
          photo,
          effectiveBaselineReading,
          selectedConsumer?.meterSerial || selectedConsumer?.meterNumber
        );

        // Strict Validation: If result detected a number but it is smaller than previousReading without rollover,
        // it is an INVALID reading. DO NOT fill random numbers into the input field! It must be an ERROR!
        if (result.success && result.readingValue !== null && selectedConsumer) {
          const prev = effectiveBaselineReading;
          const isNormal = result.readingValue >= prev;
          const isRollover = prev >= 90000 && result.readingValue < 10000;
          if (prev > 0 && !isNormal && !isRollover) {
            setOcrResult({
              success: false,
              status: 'REJECTED_INVALID_READING',
              readingValue: 0,
              odometerFormatted: '-----',
              digits: ['-', '-', '-', '-', '-'],
              confidence: 0,
              meterSerialDetected: selectedConsumer?.meterSerial || '',
              meterCondition: 'Invalid Reading',
              potentialLeak: false,
              source: 'validation_error',
              message: `Invalid Reading Error: Detected dial reading (${formatOdometerReading(result.readingValue)} cu.m.) cannot be smaller than the previous record (${formatOdometerReading(prev)} cu.m.). The system will not populate random numbers. Please retake photo with clear alignment or type the reading manually.`,
            });
            return;
          }
        }

        // Set genuine result (either success with valid detected digits or rejection with clear error)
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

    // Retrieve Authoritative Approved Baseline and Existing Pending Record
    const latestApproved = await DatabaseHelper.getLatestApprovedReading(
      selectedConsumer.accountNumber,
      selectedConsumer.meterNumber || selectedConsumer.meterSerial
    );
    const existingPending = await DatabaseHelper.getPendingReadingForMeter(
      selectedConsumer.accountNumber,
      selectedConsumer.meterNumber || selectedConsumer.meterSerial
    );

    const isPendingUnapproved = existingPending && existingPending.approvalStatus !== 'approved' && existingPending.status !== 'APPROVED';
    if (isPendingUnapproved) {
      setPendingApprovalBlock({ consumer: selectedConsumer, pendingReading: existingPending });
      return;
    }

    const previousReading = latestApproved ? latestApproved.currentReading : (selectedConsumer.previousReading || 0);
    const calc = CalculationService.calculateConsumption(previousReading, currentReading);

    if (!calc.isValid) {
      setOcrResult({
        ...ocrResult,
        success: false,
        status: 'REJECTED_INVALID_READING',
        message: calc.error || `Strict Validation: Current reading (${currentReading} m³) cannot be less than previous reading (${previousReading} m³).`,
      });
      return;
    }

    setIsSendingToAdmin(true);
    let readingRecord: MeterReading | null = null;
    const submittedConsumer = selectedConsumer;

    const markConsumerAsScanned = (record: MeterReading) => {
      getConsumerIdentifierKeys(submittedConsumer).forEach((k) => scannedKeysRef.current.add(k));
      setScannedVersion((v) => v + 1);
      setAllConsumers((prevList) =>
        prevList.map((c) =>
          c.id === submittedConsumer.id || c.accountNumber === submittedConsumer.accountNumber
            ? { ...c, isReadThisMonth: true, currentMonthReading: record }
            : c
        )
      );
    };

    try {
      const bill = CalculationService.calculateWaterBill(
        selectedConsumer.category,
        previousReading,
        currentReading
      );

      const location = await LocationService.getCurrentLocation();

      // Re-use existing pending record ID to prevent duplicate pending records
      const recordId = existingPending?.id || `MR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      readingRecord = {
        id: recordId,
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

      // Immediately mark as scanned in local session & consumer list so it can never reappear in Tag Scan
      markConsumerAsScanned(readingRecord);

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

      await SyncService.submitSingleReading(readingRecord).catch(() => {});

      if (onReloadData) onReloadData();

      setLastSubmittedReading(readingRecord);
      setScanStep('SUBMITTED');
    } catch (err: any) {
      console.warn('Reading save offline note:', err);
      if (onReloadData) onReloadData();
      if (readingRecord) {
        markConsumerAsScanned(readingRecord);
        setLastSubmittedReading(readingRecord);
        setScanStep('SUBMITTED');
      }
    } finally {
      setIsSendingToAdmin(false);
    }
  };

  const handleResetScan = useCallback(() => {
    setSelectedConsumer(null);
    if (onSelectConsumer) {
      onSelectConsumer(null);
    }
    setIdentifiedTagNumber('');
    setIdentifiedEntities([]);
    setOcrResult(null);
    setCapturedPhoto(null);
    setLiveTagDetected(null);
    setLiveDetectedConsumer(null);
    setLiveReadingDigits(null);
    setLiveReadingValue(null);
    setIsReadingClear(false);
    setClearConfidenceCount(0);
    setLastSubmittedReading(null);
    setTagStatusMessage(null);
    setDeactivationBlock(null);
    setPendingApprovalBlock(null);
    setManualTagQuery('');
    setShowManualTagInput(false);
    setIsProcessing(false);
    setScanStep('IDENTIFY_TAG');
    refreshConsumers();
    startCamera(facingMode);
  }, [facingMode, onSelectConsumer, refreshConsumers]);

  const handleScanNextConsumer = () => {
    handleResetScan();
  };

  return (
    <div className="relative w-full h-full min-h-0 max-h-full bg-slate-950 flex flex-col justify-start select-none overflow-hidden touch-pan-y">
      {/* TOP COMPACT HEADER & NAVIGATION BAR */}
      <div className="z-30 px-3 py-2 space-y-1.5 pointer-events-auto bg-slate-950/90 backdrop-blur-md border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (scanStep === 'SUBMITTED') {
                  onNavigate('dashboard');
                } else if (selectedConsumer && initialConsumer) {
                  onNavigate('consumer_details');
                } else {
                  onNavigate('dashboard');
                }
              }}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-slate-800 transition active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>

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
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-mono shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                isOffline
                  ? 'bg-amber-400'
                  : scanStep === 'CONFIRM_CONSUMER'
                  ? 'bg-amber-400'
                  : selectedConsumer
                  ? 'bg-sky-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="font-bold text-white text-[11px] sm:text-xs">
              {scanStep === 'SUBMITTED'
                ? isOffline
                  ? 'SAVED OFFLINE'
                  : 'SENT TO ADMIN'
                : scanStep === 'CONFIRM_CONSUMER'
                ? 'CONSUMER INFO'
                : scanStep === 'SCAN_METER'
                ? isOffline
                  ? 'OFFLINE DIALS'
                  : 'ODOMETER SCAN'
                : 'TAG SCAN'}
            </span>
          </div>

          {/* Real-Time Auto-Scan Toggle */}
          {(scanStep === 'IDENTIFY_TAG' || scanStep === 'SCAN_METER') && (
            <button
              type="button"
              onClick={() => setLiveAutoScanActive(!liveAutoScanActive)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition cursor-pointer ${
                liveAutoScanActive
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-sm'
                  : 'bg-slate-900 text-slate-300 border-slate-700'
              }`}
              title="Toggle Continuous Real-Time Scan"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{liveAutoScanActive ? 'Auto' : 'Manual'}</span>
            </button>
          )}
        </div>

        {/* Offline Banner when in Field Offline Mode */}
        {isOffline && (
          <div className="bg-amber-950/80 border border-amber-800 px-3 py-1.5 rounded-xl flex items-center justify-between text-xs text-amber-200">
            <span className="flex items-center gap-2 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Field Offline Mode Active
            </span>
            <span className="text-xs text-amber-300">Queuing locally</span>
          </div>
        )}

        {/* STEP 3 CONFIRMED OWNER BANNER (During Odometer Scan) */}
        {selectedConsumer && scanStep === 'SCAN_METER' && !ocrResult && (
          <div className="bg-slate-900 border border-sky-500/80 p-2.5 rounded-xl shadow-md flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-300 shrink-0">
                <CheckCheck className="w-4 h-4 text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-sky-950 text-sky-300 border border-sky-700 px-1.5 py-0.5 rounded font-mono font-bold">
                    TAG #{identifiedTagNumber || selectedConsumer.meterNumber || selectedConsumer.meterSerial}
                  </span>
                  <span className="text-xs text-slate-400 font-mono truncate">
                    Acc #{selectedConsumer.accountNumber}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white truncate mt-0.5">
                  {selectedConsumer.name}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetScan}
              className="text-xs text-sky-400 hover:text-white px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg shrink-0 ml-1.5 font-semibold cursor-pointer"
            >
              Change Tag
            </button>
          </div>
        )}

        {/* STEP 1 QUICK CONSUMER SEARCH & UNREAD SELECTION (Excludes already-scanned accounts) */}
        {!selectedConsumer && scanStep === 'IDENTIFY_TAG' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 truncate">
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Aim at meter tag ({scannableConsumers.length} unread):</span>
              </span>
              <button
                type="button"
                onClick={() => setShowManualTagInput(!showManualTagInput)}
                className="text-sky-400 hover:text-sky-300 font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Search className="w-3 h-3" />
                <span>{showManualTagInput ? 'Hide Search' : 'Search / Filter'}</span>
              </button>
            </div>

            {showManualTagInput && (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-sky-400 shrink-0" />
                <input
                  type="text"
                  value={manualTagQuery}
                  onChange={(e) => handleDirectTagInput(e.target.value)}
                  placeholder="Filter unread by Name, Tag #, Serial, or Account..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  autoFocus
                />
                {manualTagQuery && (
                  <button
                    type="button"
                    onClick={() => setManualTagQuery('')}
                    className="text-xs text-slate-400 hover:text-white px-1.5 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {scannableConsumers.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {(manualTagQuery
                  ? scannableConsumers.filter((c) =>
                      (c.name + ' ' + c.meterNumber + ' ' + c.meterSerial + ' ' + c.accountNumber)
                        .toLowerCase()
                        .includes(manualTagQuery.toLowerCase())
                    )
                  : scannableConsumers.slice(0, 8)
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleTagIdentified(c, c.meterNumber || c.meterSerial)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-emerald-950/80 border border-slate-700 hover:border-emerald-500 rounded-xl text-left shrink-0 transition active:scale-95 cursor-pointer"
                  >
                    <span className="text-xs font-mono text-emerald-400 font-bold block truncate max-w-[130px]">
                      {c.meterNumber || c.meterSerial}
                    </span>
                    <span className="text-xs font-bold text-white truncate max-w-[130px] block mt-0.5">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-emerald-950/60 border border-emerald-700/70 rounded-xl px-3 py-2 text-xs text-emerald-200 font-medium">
                All eligible water meters in your assigned route have already been scanned this cycle.
              </div>
            )}

            {tagStatusMessage && (
              <p className="text-xs text-amber-300 bg-amber-950/70 px-3 py-1.5 rounded-lg border border-amber-800 leading-snug">
                {tagStatusMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* COMPACT VIEWFINDER & CONFIRMATION WORKSPACE */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col items-center justify-start space-y-2.5 max-w-md mx-auto w-full">
        {/* Viewfinder Bounded Box (Compact preview strip during CONFIRM_CONSUMER so video stays warm without hiding Consumer Info Card) */}
        <div
          className={`relative w-full rounded-2xl overflow-hidden border-2 bg-slate-950 shadow-2xl flex items-center justify-center transition-all duration-300 shrink-0 ${
            scanStep === 'CONFIRM_CONSUMER' && !deactivationBlock && !pendingApprovalBlock
              ? 'h-24 border-emerald-500/80'
              : scanStep === 'SUBMITTED'
              ? 'h-0 border-0 opacity-0 pointer-events-none'
              : 'aspect-[4/3] max-h-[270px] sm:max-h-[300px]'
          } ${
            scanStep === 'SCAN_METER'
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
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-out',
            }}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              cameraActive && !capturedPhoto ? 'opacity-100 block' : 'hidden opacity-0'
            }`}
          />

          {/* Compact Verified Tag Badge Overlay during CONFIRM_CONSUMER */}
          {scanStep === 'CONFIRM_CONSUMER' && selectedConsumer && (
            <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px] flex items-center justify-between px-4 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300 block">
                    Meter Tag Scanned
                  </span>
                  <span className="text-sm font-mono font-black text-white truncate block">
                    TAG #{identifiedTagNumber || selectedConsumer.meterNumber || selectedConsumer.meterSerial}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/60 text-[10px] font-bold text-emerald-300 uppercase tracking-wider shrink-0">
                Step 1 Verified
              </span>
            </div>
          )}

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
          {!cameraActive && !capturedPhoto && scanStep !== 'CONFIRM_CONSUMER' && scanStep !== 'SUBMITTED' && (
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
          {!ocrResult && !capturedPhoto && (scanStep === 'IDENTIFY_TAG' || scanStep === 'SCAN_METER') && (
            <ScanOverlay
              onCapture={handleCaptureButton}
              onToggleTorch={handleToggleTorch}
              onFlipCamera={handleFlipCamera}
              onTypeReading={() => onNavigate(selectedConsumer ? 'reading_entry' : 'consumers')}
              torchOn={torchOn}
              isProcessing={isProcessing}
              cameraActive={cameraActive}
              mode={scanStep === 'SCAN_METER' ? 'meter' : 'tag'}
              isAutoScanning={liveAutoScanActive}
              liveTagDetected={liveTagDetected}
              liveReadingDigits={liveReadingDigits}
              liveReadingValue={liveReadingValue}
              liveConfidence={liveConfidence}
              zoom={zoomLevel}
              onSetZoom={handleSetZoom}
              isReadingClear={isReadingClear}
              clearConfidenceCount={clearConfidenceCount}
            />
          )}

          {/* 🚫 DEACTIVATION BLOCK OVERLAY */}
          {deactivationBlock && (
            <div className="absolute inset-2 z-40 bg-slate-950/95 border-2 border-rose-500 rounded-xl p-3 shadow-2xl backdrop-blur-md text-white flex flex-col justify-between animate-in zoom-in-95">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-900/80 border border-rose-400 flex items-center justify-center text-rose-300 shrink-0">
                    <ShieldAlert className="w-5 h-5 text-rose-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-wider bg-rose-900 text-rose-200 px-2 py-0.5 rounded border border-rose-700">
                      Water Meter Deactivated
                    </span>
                    <h4 className="font-extrabold text-xs text-white truncate mt-0.5">
                      {deactivationBlock.consumer.name}
                    </h4>
                  </div>
                </div>

                <div className="bg-rose-950/60 p-2 rounded-lg border border-rose-900/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-rose-300 font-mono">
                    <span>Acc: <strong>{deactivationBlock.consumer.accountNumber}</strong></span>
                    <span>Tag: <strong>{deactivationBlock.tag}</strong></span>
                  </div>
                  <p className="text-[11px] text-rose-200 font-semibold leading-snug">
                    {deactivationBlock.reason}
                  </p>
                </div>

                <p className="text-[10px] text-slate-400 leading-tight">
                  Status changed by Central Admin. Field reading input is prohibited until reactivated.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="flex-1 py-1.5 bg-rose-900 hover:bg-rose-800 border border-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Scan Next Meter</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('consumers')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition active:scale-95"
                >
                  Directory
                </button>
              </div>
            </div>
          )}

          {/* ⚠️ PENDING APPROVAL BLOCK OVERLAY */}
          {pendingApprovalBlock && (
            <div className="absolute inset-2 z-40 bg-slate-950/95 border-2 border-amber-500 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-white flex flex-col justify-between animate-in zoom-in-95">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-900/80 border border-amber-400 flex items-center justify-center text-amber-300 shrink-0">
                    <Clock className="w-5 h-5 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-wider bg-amber-900 text-amber-200 px-2 py-0.5 rounded border border-amber-700">
                      Reading Pending Admin Approval
                    </span>
                    <h4 className="font-extrabold text-xs text-white truncate mt-0.5">
                      {pendingApprovalBlock.consumer.name}
                    </h4>
                  </div>
                </div>

                <div className="bg-amber-950/60 p-2.5 rounded-lg border border-amber-900/80 space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-[10px] text-amber-300">
                    <span>Acc: <strong>{pendingApprovalBlock.consumer.accountNumber}</strong></span>
                    <span>Tag: <strong>{pendingApprovalBlock.consumer.meterNumber || pendingApprovalBlock.consumer.meterSerial}</strong></span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-2 rounded border border-amber-800/60 text-center text-[10px]">
                    <div>
                      <span className="text-slate-500 block text-[8px] uppercase">PREV</span>
                      <strong className="text-slate-300 block">{formatOdometerReading(pendingApprovalBlock.pendingReading.previousReading)}</strong>
                    </div>
                    <div>
                      <span className="text-amber-400 block text-[8px] uppercase">PRESENT</span>
                      <strong className="text-amber-300 block">{formatOdometerReading(pendingApprovalBlock.pendingReading.currentReading)}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-400 block text-[8px] uppercase">CONSUMED</span>
                      <strong className="text-emerald-400 block">+{pendingApprovalBlock.pendingReading.consumption}</strong>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-200/90 leading-snug">
                    Logged: {pendingApprovalBlock.pendingReading.readingDate} {pendingApprovalBlock.pendingReading.readingTime || ''}
                  </p>
                </div>

                <p className="text-[10.5px] text-slate-300 leading-tight">
                  A present reading has already been recorded and is awaiting central admin verification. Under Tagoloan Water District policy, you cannot scan or send another reading until the admin approves this reading. Once approved, this present reading will become the baseline for the next reading.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>View in Reading Logs</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        {/* STEP 2: CONSUMER INFORMATION CONFIRMATION CARD (Before proceeding to water meter dial scan) */}
        {scanStep === 'CONFIRM_CONSUMER' && selectedConsumer && !deactivationBlock && !pendingApprovalBlock && (
          <div className="w-full bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-xl space-y-3 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/60 flex items-center justify-center text-emerald-300 shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 block">
                    Consumer Account Found
                  </span>
                  <h2 className="text-base font-extrabold text-white truncate">
                    {selectedConsumer.name}
                  </h2>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-sky-950 border border-sky-700 text-sky-300 text-[10px] font-mono font-bold uppercase shrink-0">
                {selectedConsumer.category}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Account No.</span>
                <span className="font-mono font-bold text-white text-xs sm:text-sm block truncate mt-0.5">
                  {selectedConsumer.accountNumber}
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Meter Tag / Serial</span>
                <span className="font-mono font-bold text-emerald-300 text-xs sm:text-sm block truncate mt-0.5">
                  {identifiedTagNumber || selectedConsumer.meterNumber || selectedConsumer.meterSerial}
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 col-span-2 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Service Address</span>
                  <span className="text-xs text-slate-200 font-medium block leading-snug">
                    {selectedConsumer.address ? `${selectedConsumer.address}, ` : ''}{selectedConsumer.barangay}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Previous Baseline</span>
                <span className="text-base font-black text-sky-300">
                  {formatOdometerReading(effectiveBaselineReading)} cu.m.
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sequence / Route</span>
                <span className="text-xs font-bold text-slate-200">
                  #{selectedConsumer.sequenceNo || '—'} • {selectedConsumer.routeCode || 'Active'}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleProceedToScanMeter}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs sm:text-sm uppercase tracking-wider transition active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Proceed to Scan Water Meter</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleResetScan}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-xs transition active:scale-95 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Wrong Tag / Rescan</span>
              </button>
            </div>
          </div>
        )}

        {/* MINIMALIST REAL-TIME OCR HUD */}
        {!ocrResult && !capturedPhoto && (scanStep === 'IDENTIFY_TAG' || scanStep === 'SCAN_METER') && (
          <div className="w-full space-y-1.5">
            {/* Stage 1: Live Tag Detected Banner */}
            {scanStep === 'IDENTIFY_TAG' && liveTagDetected && (
              <div className="bg-emerald-950 border border-emerald-600 p-2.5 rounded-xl shadow-md flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-900/60 border border-emerald-400 flex items-center justify-center text-emerald-300 shrink-0">
                    <Tag className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-emerald-400 font-bold block uppercase tracking-wider">
                      Detected Tag
                    </span>
                    <span className="text-sm font-bold text-white truncate block">
                      {liveTagDetected} {liveDetectedConsumer ? `• ${liveDetectedConsumer.name}` : ''}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAcceptRealTimeTag}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs shadow flex items-center gap-1 active:scale-95 transition cursor-pointer shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>View Info</span>
                </button>
              </div>
            )}

            {/* Stage 2: Dial Reading HUD */}
            {scanStep === 'SCAN_METER' && selectedConsumer && (
              <div className="w-full bg-slate-900 border border-slate-700 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-300">
                    Prev: <strong className="text-white font-bold">{formatOdometerReading(effectiveBaselineReading)}</strong> m³
                  </span>
                  {liveReadingValue !== null && (
                    <span className="text-xs text-sky-400">
                      Live: <strong className="text-sky-300 font-bold">{formatOdometerReading(liveReadingValue)}</strong> m³
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {liveReadingValue !== null && liveReadingValue >= effectiveBaselineReading && (
                    <span className="text-xs font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700">
                      +{liveReadingValue - effectiveBaselineReading} m³
                    </span>
                  )}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    isReadingClear
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                      : 'bg-slate-950 text-slate-300 border-slate-700'
                  }`}>
                    {((liveConfidence || 0.9) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🚀 SUBMISSION NOTIFICATION MODAL */}
        {scanStep === 'SUBMITTED' && lastSubmittedReading && (
          <div className="p-4 bg-slate-900 border-2 border-emerald-500 rounded-2xl shadow-xl space-y-3 z-40 max-w-lg mx-auto w-full">
            <div className="text-center space-y-1">
              <div className="w-10 h-10 bg-emerald-500/20 border-2 border-emerald-400 rounded-xl flex items-center justify-center mx-auto text-emerald-400 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-sm font-black text-white uppercase tracking-tight">
                {isOffline ? 'Reading Saved Offline' : 'Reading Sent to Admin'}
              </h2>
              <p className="text-xs text-slate-300">
                {isOffline
                  ? 'Queued in device local database (Ready to sync with Admin)'
                  : 'Submitted to Central Billing Portal (Approval Queue)'}
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/40 space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div>
                  <span className="text-xs text-emerald-400 font-bold block">
                    ACCOUNT #{lastSubmittedReading.accountNumber}
                  </span>
                  <span className="font-bold text-white text-sm">{lastSubmittedReading.consumerName}</span>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-bold rounded-full">
                  Pending Approval
                </span>
              </div>

              <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-800 space-y-1.5 font-mono text-xs sm:text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-xs uppercase font-semibold text-slate-400">PREVIOUS READING</span>
                  <span className="font-bold text-slate-200">{formatOdometerReading(lastSubmittedReading.previousReading)} cu.m.</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-xs uppercase font-semibold text-slate-400">PRESENT READING</span>
                  <span className="font-bold text-sky-300">{formatOdometerReading(lastSubmittedReading.currentReading)} cu.m.</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                  <span className="text-xs uppercase font-bold text-emerald-400">CONSUMPTION</span>
                  <span className="font-black text-emerald-400 text-sm">+{lastSubmittedReading.consumption} cu.m.</span>
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
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
                <div>
                  <h3 className="font-bold text-xs text-white">
                    {ocrResult.success 
                      ? '5-Digit Meter Reading Detected' 
                      : ocrResult.status === 'REJECTED_INVALID_READING'
                      ? 'Invalid Reading Error'
                      : 'Meter Reading Error'}
                  </h3>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {ocrResult.success 
                      ? `Confidence: ${(ocrResult.confidence * 100).toFixed(0)}%` 
                      : 'Random numbers rejected — manual entry required'}
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
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span className="font-semibold text-slate-300">5-DIGIT MECHANICAL WHEELS</span>
                    <span className="text-sky-400">Tap ▲/▼ to fine-tune</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 my-1.5">
                    {ocrResult.digits.map((digit, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
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
                          className="w-10 h-7 bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white rounded-md flex items-center justify-center text-xs font-black transition cursor-pointer"
                          title={`Increment digit ${i + 1}`}
                        >
                          ▲
                        </button>
                        <div
                          className="w-11 h-14 bg-slate-900 border-2 border-slate-600 rounded-lg flex items-center justify-center font-mono font-black text-2xl sm:text-3xl text-white shadow-sm select-none"
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
                          className="w-10 h-7 bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white rounded-md flex items-center justify-center text-xs font-black transition cursor-pointer"
                          title={`Decrement digit ${i + 1}`}
                        >
                          ▼
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-2.5 pt-2 border-t border-slate-800">
                    <span className="text-sm font-semibold text-slate-300">Total Reading:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={5}
                      value={formatOdometerReading(ocrResult.readingValue)}
                      onChange={(e) => {
                        const clean = cleanOdometerInput(e.target.value);
                        const val = clean ? Math.min(99999, parseInt(clean, 10)) : 0;
                        const formatted = String(val).padStart(5, '0');
                        setOcrResult({
                          ...ocrResult,
                          readingValue: val,
                          odometerFormatted: formatted,
                          digits: formatted.slice(-5).split(''),
                        });
                      }}
                      className="w-28 bg-slate-900 border-2 border-slate-600 text-white font-mono font-black text-lg px-3 py-1 rounded-lg text-center focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-sm text-sky-400 font-bold">cu.m.</span>
                  </div>

                  {selectedConsumer && (
                    <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-800 space-y-1 font-mono text-xs sm:text-sm mt-2 text-left">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-xs uppercase font-semibold text-slate-400">PREVIOUS READING</span>
                        <span className="font-bold text-slate-200">{formatOdometerReading(effectiveBaselineReading)} cu.m.</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-xs uppercase font-semibold text-slate-400">PRESENT READING</span>
                        <span className="font-bold text-sky-300">{formatOdometerReading(ocrResult.readingValue)} cu.m.</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                        <span className="text-xs uppercase font-bold text-emerald-400">CONSUMPTION</span>
                        {(() => {
                          const calc = CalculationService.calculateConsumption(effectiveBaselineReading, ocrResult.readingValue);
                          return (
                            <span className={`font-black text-sm ${calc.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
                              {calc.isValid
                                ? `+${calc.consumption} cu.m.`
                                : `Invalid: Less than previous (${formatOdometerReading(effectiveBaselineReading)} cu.m.)`}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                {selectedConsumer && CalculationService.calculateConsumption(effectiveBaselineReading, ocrResult.readingValue).isValid ? (
                  <button
                    type="button"
                    onClick={handleSendToAdmin}
                    disabled={isSendingToAdmin}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingToAdmin ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Transmitting Reading...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-white" />
                        <span>Send Reading to Admin</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate(selectedConsumer ? 'reading_entry' : 'consumers')}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl shadow text-sm uppercase tracking-wider transition cursor-pointer"
                  >
                    <span>{selectedConsumer ? 'Adjust in Manual Form' : 'Assign Owner'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-rose-950/80 border border-rose-500/80 p-3 rounded-xl shadow-lg space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-900 border border-rose-400 flex items-center justify-center text-rose-300 shrink-0">
                      <XCircle className="w-4 h-4 text-rose-300" />
                    </div>
                    <div>
                      <h4 className="font-black text-xs text-white uppercase tracking-wider">
                        {ocrResult.status === 'REJECTED_INVALID_READING'
                          ? 'Invalid Reading Rejected'
                          : 'Digits Unclear or Rejected'}
                      </h4>
                      <span className="text-[9.5px] text-rose-300 font-mono">
                        Camera did not fill random numbers
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-rose-200 font-medium leading-relaxed bg-rose-950/60 p-2 rounded-lg border border-rose-900/80 font-mono">
                    {ocrResult.message || 'Position camera steadily facing the 5 mechanical digit wheels.'}
                  </p>

                  {selectedConsumer && (
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 pt-1 border-t border-rose-900/60">
                      <span>Previous Record: <strong className="text-white">{formatOdometerReading(effectiveBaselineReading)} m³</strong></span>
                      <span className="text-rose-400 font-bold">Must be ≥ Previous</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOcrResult(null);
                      setCapturedPhoto(null);
                      startCamera(facingMode);
                    }}
                    className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retake Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(selectedConsumer ? 'reading_entry' : 'consumers')}
                    className="py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>Enter Manually</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PERSISTENT BOTTOM FOOTER */}
      <div className="z-30 px-3 py-2.5 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 shrink-0 w-full pointer-events-auto">
        <div className="max-w-md mx-auto flex items-center gap-2">
          {scanStep === 'CONFIRM_CONSUMER' && selectedConsumer ? (
            <>
              <button
                type="button"
                onClick={handleProceedToScanMeter}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 px-3 rounded-xl shadow flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Proceed Scan Meter</span>
              </button>
              <button
                type="button"
                onClick={handleResetScan}
                className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rescan Tag</span>
              </button>
            </>
          ) : !ocrResult && scanStep !== 'SUBMITTED' ? (
            <button
              type="button"
              onClick={handleCaptureButton}
              disabled={isProcessing}
              className={`flex-1 font-bold py-2.5 rounded-xl shadow flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer disabled:opacity-50 ${
                selectedConsumer
                  ? isReadingClear
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 font-black'
                    : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>
                    {selectedConsumer
                      ? isReadingClear
                        ? 'Capture Clear Reading'
                        : 'Capture Dial'
                      : 'Identify Tag #'}
                  </span>
                </>
              )}
            </button>
          ) : ocrResult && scanStep !== 'SUBMITTED' ? (
            selectedConsumer && CalculationService.calculateConsumption(effectiveBaselineReading, ocrResult.readingValue).isValid ? (
              <button
                type="button"
                onClick={handleSendToAdmin}
                disabled={isSendingToAdmin}
                className="flex-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 text-slate-950 font-black py-2.5 rounded-xl shadow flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSendingToAdmin ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-slate-950" />
                    <span>{isOffline ? 'Save to Offline Queue' : 'Send to Admin'}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOcrResult(null);
                  setCapturedPhoto(null);
                  startCamera(facingMode);
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl shadow text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer"
              >
                <span>Retake Photo</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={handleScanNextConsumer}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 rounded-xl shadow flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider transition active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Scan Next Meter</span>
            </button>
          )}

          {/* Persistent Fallback Action: Type Reading Manually / Consumers */}
          {scanStep !== 'CONFIRM_CONSUMER' && scanStep !== 'SUBMITTED' && (
            <button
              type="button"
              onClick={() => {
                const photo = capturedPhoto || (videoRef.current ? OCRService.captureFrameFromVideo(videoRef.current) : '');
                if (selectedConsumer && onOCRComplete && photo) {
                  onOCRComplete({
                    readingValue: effectiveBaselineReading,
                    photoUrl: photo,
                    confidence: 0,
                  });
                } else {
                  onNavigate(selectedConsumer ? 'reading_entry' : 'consumers');
                }
              }}
              className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-400 hover:text-white rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow shrink-0"
              title="Type reading manually if dial is damaged, moisture-filled, or unclear"
            >
              <Keyboard className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{selectedConsumer ? 'Type Manually' : 'Consumers'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
