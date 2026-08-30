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
  Search
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
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Scanner Mode & Smart Detection
  const [scanStep, setScanStep] = useState<'IDENTIFY_TAG' | 'SCAN_METER' | 'SUBMITTED'>(
    initialConsumer ? 'SCAN_METER' : 'IDENTIFY_TAG'
  );
  const [ownerPopupVisible, setOwnerPopupVisible] = useState(!!initialConsumer);
  const [identifiedTagNumber, setIdentifiedTagNumber] = useState<string>('');
  
  // OCR & Reading State
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSendingToAdmin, setIsSendingToAdmin] = useState(false);
  const [lastSubmittedReading, setLastSubmittedReading] = useState<MeterReading | null>(null);

  // Manual fallback input if reader chooses to quick-type tag
  const [manualTagQuery, setManualTagQuery] = useState('');
  const [showManualTagInput, setShowManualTagInput] = useState(false);

  // Load consumers list for real-time tag matching
  useEffect(() => {
    DatabaseHelper.getAllConsumers().then((list) => {
      setAllConsumers(list);
    });
  }, []);

  // Audio / Haptic feedback for smart tag match
  const playMatchFeedback = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
      // Simple Web Audio beep
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // Ignore audio failure
    }
  }, []);

  // Camera initialization
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
              width: { ideal: 1920, min: 640 },
              height: { ideal: 1080, min: 480 },
            },
            audio: false,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facing },
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
        setCameraError('Live camera not supported in this browser. Please use Chrome/Edge or an Android device.');
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraActive(false);
      setCameraError('Camera access required. Please allow camera permissions in your browser or phone settings.');
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

  // Match and pop up owner automatically when a tag or serial is identified
  const handleTagIdentified = useCallback((matchedConsumer: Consumer, tagStr: string) => {
    setSelectedConsumer(matchedConsumer);
    setIdentifiedTagNumber(tagStr);
    setOwnerPopupVisible(true);
    setScanStep('SCAN_METER');
    if (onSelectConsumer) onSelectConsumer(matchedConsumer);
    playMatchFeedback();

    WebSocketService.notifyProcessEvent('TAG_IDENTIFIED_AUTO', 'COMPLETED', {
      tag: tagStr,
      accountNumber: matchedConsumer.accountNumber,
      ownerName: matchedConsumer.name,
      previousReading: matchedConsumer.previousReading,
    });
  }, [onSelectConsumer, playMatchFeedback]);

  // Real-time camera stream frame analysis (continuous auto-detection)
  useEffect(() => {
    if (!cameraActive || selectedConsumer || scanStep !== 'IDENTIFY_TAG') return;

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      try {
        // Native BarcodeDetector API for instant Tag barcode / QR auto-detection
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'],
          });
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue?.trim();
            if (rawValue) {
              const matched = await DatabaseHelper.getConsumerByTagOrMeterNumber(rawValue);
              if (matched) {
                handleTagIdentified(matched, rawValue);
                return;
              }
            }
          }
        }
      } catch {
        // Continuous scan error or not supported
      }
    }, 900);

    return () => clearInterval(interval);
  }, [cameraActive, selectedConsumer, scanStep, handleTagIdentified]);

  // Direct manual tag input auto-matcher (matches instantaneously as user types or selects)
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

  // Perform Smart Vision Analysis on Video Frame
  const processLiveFrame = async (photoDataUrl: string) => {
    setIsProcessing(true);
    setCapturedPhoto(photoDataUrl);

    try {
      const result = await OCRService.analyzeMeterPhoto(
        photoDataUrl,
        selectedConsumer?.previousReading,
        selectedConsumer?.meterSerial || selectedConsumer?.meterNumber
      );

      setOcrResult(result);

      // If no owner was locked before this photo, check if the image detected a meter tag / serial
      if (!selectedConsumer && result.meterSerialDetected) {
        const autoMatch = await DatabaseHelper.getConsumerByTagOrMeterNumber(result.meterSerialDetected);
        if (autoMatch) {
          handleTagIdentified(autoMatch, result.meterSerialDetected);
        }
      }

      if (result.success && result.readingValue !== null) {
        playMatchFeedback();
      }
    } catch (err) {
      console.error('Vision analysis error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCaptureLive = async () => {
    if (videoRef.current && cameraActive && videoRef.current.videoWidth > 0) {
      const photo = OCRService.captureFrameFromVideo(videoRef.current);
      if (photo) {
        await processLiveFrame(photo);
      }
    }
  };

  // Immediate "Send to Admin" Action
  const handleSendToAdmin = async () => {
    if (!selectedConsumer || !ocrResult || !ocrResult.success || ocrResult.readingValue === null) {
      return;
    }

    const currentReading = ocrResult.readingValue;
    const previousReading = selectedConsumer.previousReading;

    // Strict validation
    if (currentReading < previousReading) {
      alert(`Strict Validation: Current reading (${currentReading} m³) cannot be less than previous reading (${previousReading} m³).`);
      return;
    }

    setIsSendingToAdmin(true);

    try {
      // 1. Compute Bill
      const bill = CalculationService.calculateWaterBill(
        selectedConsumer.category,
        previousReading,
        currentReading
      );

      // 2. Capture GPS Location
      const location = await LocationService.getCurrentLocation();

      // 3. Construct Complete Reading Record
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

      // 4. Save to Local Database (IndexedDB / SQLite)
      if (onSaveReading) {
        await onSaveReading(readingRecord);
      } else {
        await DatabaseHelper.saveReading(readingRecord);
      }

      // 5. Broadcast to Admin Portal Live via WebSocket
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

      // 6. Log audit event
      await LoggerService.logAction(
        'METER_READING_SENT_TO_ADMIN',
        currentUser?.id || 'FIELD_READER',
        currentUser?.name || 'Field Reader',
        `Camera auto-identified Tag & Dial for Account ${selectedConsumer.accountNumber} (${selectedConsumer.name}). Reading: ${currentReading} m³, Consumption: ${bill.consumption} m³, Amount: ₱${bill.totalAmountDue.toFixed(2)}.`
      );

      // 7. Background sync to Central Cloud API
      SyncService.submitSingleReading(readingRecord).catch(() => {});

      if (onReloadData) onReloadData();

      setLastSubmittedReading(readingRecord);
      setScanStep('SUBMITTED');
    } catch (err: any) {
      console.error('Send to admin error:', err);
      alert('Failed to send reading to admin. Stored locally in offline ledger.');
    } finally {
      setIsSendingToAdmin(false);
    }
  };

  // Reset scanner to scan the next consumer
  const handleScanNextConsumer = () => {
    setSelectedConsumer(null);
    setIdentifiedTagNumber('');
    setOwnerPopupVisible(false);
    setOcrResult(null);
    setCapturedPhoto(null);
    setLastSubmittedReading(null);
    setScanStep('IDENTIFY_TAG');
    startCamera(facingMode);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col justify-between select-none overflow-hidden">
      {/* Top Floating Control Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-30 space-y-2 pointer-events-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate(selectedConsumer ? 'consumer_details' : 'dashboard')}
            className="px-3 py-1.5 bg-slate-950/90 backdrop-blur-md border border-slate-800 text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg hover:bg-slate-900 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit Scanner</span>
          </button>

          {/* Mode Badge */}
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 px-3 py-1 rounded-xl flex items-center gap-1.5 text-xs text-slate-300 font-mono shadow-md">
            <span className={`w-2 h-2 rounded-full ${selectedConsumer ? 'bg-emerald-400' : 'bg-sky-400'} animate-pulse`} />
            <span className="font-bold">
              {scanStep === 'SUBMITTED' ? 'SENT TO ADMIN' : selectedConsumer ? 'DIAL SCANNER' : 'SMART TAG SCANNER'}
            </span>
          </div>
        </div>

        {/* 🌟 AUTOMATIC OWNER POPUP BANNER (Pops up automatically when tag is scanned) */}
        {selectedConsumer && ownerPopupVisible && scanStep !== 'SUBMITTED' && (
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/80 border-2 border-emerald-400 p-3 rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 shadow-md shrink-0">
                  <CheckCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-1.5 py-0.2 rounded font-mono font-bold">
                      TAG #{selectedConsumer.meterNumber || selectedConsumer.meterSerial}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Acc #{selectedConsumer.accountNumber}
                    </span>
                  </div>
                  <h3 className="font-black text-sm text-white leading-tight mt-0.5">
                    {selectedConsumer.name}
                  </h3>
                </div>
              </div>

              {/* Reset/Change consumer button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedConsumer(null);
                  setOwnerPopupVisible(false);
                  setScanStep('IDENTIFY_TAG');
                }}
                className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 bg-slate-800 rounded-lg transition"
              >
                Change
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">{selectedConsumer.barangay}, {selectedConsumer.address}</span>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 text-sky-300 font-mono text-[10px]">
                <span>Prev Reading: <strong className="text-slate-200">{selectedConsumer.previousReading} m³</strong></span>
                <span>•</span>
                <span>Prev Consumed: <strong className="text-sky-400">{selectedConsumer.previousConsumption ?? selectedConsumer.averageConsumption} m³</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Tag Radar Chips for Active Route (No need to type) */}
        {!selectedConsumer && !ocrResult && scanStep === 'IDENTIFY_TAG' && (
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800/90 p-2 rounded-2xl shadow-xl space-y-1.5">
            <div className="flex items-center justify-between text-[11px] px-1">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Aim camera at Tag or tap route account:
              </span>
              <button
                type="button"
                onClick={() => setShowManualTagInput(!showManualTagInput)}
                className="text-sky-400 hover:text-sky-300 font-bold text-[10px] flex items-center gap-0.5"
              >
                <Search className="w-3 h-3" />
                <span>{showManualTagInput ? 'Hide Search' : 'Manual Search'}</span>
              </button>
            </div>

            {/* Quick Tag Chips from Assigned Consumers */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {allConsumers.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleTagIdentified(c, c.meterNumber || c.meterSerial)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-emerald-950/80 border border-slate-700 hover:border-emerald-500 rounded-xl text-left shrink-0 transition active:scale-95"
                >
                  <span className="text-[9px] font-mono text-emerald-400 font-bold block">
                    {c.meterNumber || c.meterSerial}
                  </span>
                  <span className="text-[10px] font-bold text-white truncate max-w-[90px] block">
                    {c.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Optional Manual Tag Search Bar */}
            {showManualTagInput && (
              <div className="pt-1 flex items-center gap-1.5 border-t border-slate-800">
                <Tag className="w-3.5 h-3.5 text-sky-400 ml-1 shrink-0" />
                <input
                  type="text"
                  value={manualTagQuery}
                  onChange={(e) => handleDirectTagInput(e.target.value)}
                  placeholder="Type Tag # or Account (e.g. MT-4401 or 1001-A)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Camera Viewfinder Viewport */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        {/* Live Video Camera Stream */}
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

        {/* Captured Photo Snapshot */}
        {capturedPhoto && (
          <div className="relative w-full h-full flex items-center justify-center p-3">
            <img
              src={capturedPhoto}
              alt="Water Meter Dial"
              className="max-h-[60vh] rounded-2xl shadow-2xl border-2 border-sky-400 object-contain bg-slate-900"
            />
          </div>
        )}

        {/* Camera Permission / Error Fallback Box */}
        {!cameraActive && !capturedPhoto && (
          <div className="text-center p-5 space-y-4 max-w-sm mx-auto z-10">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-sky-400 shadow-xl">
              <Camera className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-white text-base">Water Meter Camera</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {cameraError || 'Allow camera access to auto-identify tag number & scan meter reading.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>Enable Camera Feed</span>
            </button>
          </div>
        )}

        {/* Viewfinder Overlay HUD */}
        {!ocrResult && !capturedPhoto && scanStep !== 'SUBMITTED' && (
          <ScanOverlay
            onCapture={handleCaptureLive}
            onToggleTorch={handleToggleTorch}
            onFlipCamera={handleFlipCamera}
            torchOn={torchOn}
            isProcessing={isProcessing}
            cameraActive={cameraActive}
            mode={selectedConsumer ? 'meter' : 'tag'}
            guideTitle={selectedConsumer ? 'ALIGN 5-DIGIT METER DIAL' : 'AIM AT METER TAG NUMBER'}
            guideSubtitle={
              selectedConsumer 
                ? `Scanning index for ${selectedConsumer.name}` 
                : 'Point camera at tag or barcode to pop up owner'
            }
            isAutoScanning={true}
          />
        )}
      </div>

      {/* 🚀 SUBMISSION CONFIRMATION CELEBRATION MODAL */}
      {scanStep === 'SUBMITTED' && lastSubmittedReading && (
        <div className="p-5 bg-slate-900 border-t-2 border-emerald-500 rounded-t-3xl shadow-2xl space-y-4 z-40 max-w-lg mx-auto w-full animate-in slide-in-from-bottom-6 duration-300">
          <div className="text-center space-y-1.5">
            <div className="w-14 h-14 bg-emerald-500/20 border-2 border-emerald-400 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-base font-black text-white uppercase tracking-tight">
              Reading Sent to Admin
            </h2>
            <p className="text-xs text-slate-300">
              Dispatched live to Central Billing Portal (Approval Queue)
            </p>
          </div>

          {/* Reading Summary Card */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/40 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold block">
                  ACCOUNT #{lastSubmittedReading.accountNumber}
                </span>
                <span className="font-bold text-white text-sm">{lastSubmittedReading.consumerName}</span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold rounded-full">
                Pending Approval
              </span>
            </div>

            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  PREVIOUS READING
                </span>
                <span className="font-bold text-slate-200 text-sm">
                  {lastSubmittedReading.previousReading}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  PRESENT READING
                </span>
                <span className="font-bold text-sky-300 text-sm">
                  {lastSubmittedReading.currentReading}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  CONSUMPTION
                </span>
                <span className="font-black text-emerald-400 text-sm">
                  {lastSubmittedReading.consumption}
                </span>
              </div>
            </div>
          </div>

          {/* Post-Submit Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleScanNextConsumer}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition active:scale-[0.98] cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-slate-950" />
              <span>Scan Next Meter / House</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                View Reading Logs
              </button>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="py-2.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold rounded-xl transition"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 OCR READING IDENTIFIED BOTTOM SHEET (With Instant "Send to Admin") */}
      {ocrResult && scanStep !== 'SUBMITTED' && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl space-y-3 z-30 max-w-lg mx-auto w-full animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              {ocrResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
              <div>
                <h3 className="font-black text-sm text-white">
                  {ocrResult.success ? '5-Digit Meter Reading Detected' : 'Meter Digits Unclear'}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  {ocrResult.success ? `Confidence: ${(ocrResult.confidence * 100).toFixed(0)}%` : 'No valid digits identified'}
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
              className="text-xs text-sky-400 hover:text-white px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg transition cursor-pointer"
            >
              Retake Scan
            </button>
          </div>

          {ocrResult.success ? (
            <div className="space-y-3">
              {/* Matched Consumer Profile Card */}
              {selectedConsumer ? (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-emerald-500/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold block">
                      Account #{selectedConsumer.accountNumber} (Tag: {selectedConsumer.meterNumber || selectedConsumer.meterSerial})
                    </span>
                    <span className="font-bold text-white">{selectedConsumer.name}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-[10px] font-bold rounded">
                    Owner Confirmed
                  </span>
                </div>
              ) : (
                <div className="bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/80 text-xs text-amber-300 flex items-center justify-between">
                  <span>Tag not matched yet. Select consumer:</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('consumers')}
                    className="px-2 py-1 bg-amber-600 text-white rounded text-[11px] font-bold"
                  >
                    Select Owner
                  </button>
                </div>
              )}

              {/* 5 Wheel Slot Confirmation Display */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Detected 5-Digit Counter
                </span>
                
                {/* Visual 5-wheel odometer presentation */}
                <div className="flex items-center justify-center gap-1.5 my-2">
                  {ocrResult.digits.map((digit, i) => (
                    <div
                      key={i}
                      className="w-10 h-12 bg-slate-900 border-2 border-sky-400 rounded-lg flex items-center justify-center font-mono font-black text-2xl text-white shadow-lg"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                <div className="text-sm font-bold text-sky-400 font-mono">
                  {ocrResult.readingValue} <span className="text-xs font-sans text-slate-400">cubic meters</span>
                </div>

                {selectedConsumer && (
                  <>
                    {/* Validation Warning if OCR detected reading < previous reading */}
                    {ocrResult.readingValue < selectedConsumer.previousReading ? (
                      <div className="mt-2 p-2.5 bg-red-950/80 border border-red-500 rounded-xl text-left text-xs text-red-200 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-red-300">
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>Validation Rule Violation</span>
                        </div>
                        <p className="text-[11px] text-red-200/90 leading-tight">
                          Detected reading (<strong>{ocrResult.readingValue} m³</strong>) is less than previous reading (<strong>{selectedConsumer.previousReading} m³</strong>). Please retake scan or enter manually.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2 font-mono text-xs mt-2 text-left">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            PREVIOUS READING
                          </span>
                          <span className="font-bold text-slate-200 text-sm">
                            {selectedConsumer.previousReading}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            PRESENT READING
                          </span>
                          <span className="font-bold text-sky-300 text-sm">
                            {ocrResult.readingValue}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                            CONSUMPTION
                          </span>
                          <span className="font-black text-emerald-400 text-sm">
                            {ocrResult.readingValue - selectedConsumer.previousReading}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 🌟 SEND TO ADMIN ACTION BUTTON */}
              {selectedConsumer && ocrResult.readingValue >= selectedConsumer.previousReading ? (
                <button
                  type="button"
                  onClick={handleSendToAdmin}
                  disabled={isSendingToAdmin}
                  className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {isSendingToAdmin ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Transmitting to Admin...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-slate-950" />
                      <span>Send to Admin</span>
                    </>
                  )}
                </button>
              ) : selectedConsumer ? (
                <button
                  type="button"
                  onClick={() => onNavigate('reading_entry')}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  <span>Review in Manual Form</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('consumers')}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  <span>Assign Owner to this Reading</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-950/40 p-3 rounded-2xl border border-amber-800/80 text-amber-300 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-200">
                  <XCircle className="w-4 h-4 text-amber-400" />
                  <span>Could Not Identify 5-Digit Counter</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {ocrResult.message || 'Position camera steadily facing the 5 mechanical digit wheels and retake the scan.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOcrResult(null);
                    setCapturedPhoto(null);
                    startCamera(facingMode);
                  }}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Retake Scan
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate(selectedConsumer ? 'reading_entry' : 'consumers')}
                  className="py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
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
