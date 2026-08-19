import React, { useState, useRef, useEffect } from 'react';
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
  Upload,
  RotateCw,
  Search,
  User,
  MapPin,
  Check
} from 'lucide-react';
import { Consumer, ActiveScreen } from '../types';
import { OCRService, OCRResult } from '../services/ocrService';
import { ScanOverlay } from '../components/ScanOverlay';
import { DatabaseHelper } from '../services/databaseHelper';

interface ScanMeterScreenProps {
  consumer?: Consumer | null;
  onNavigate: (screen: ActiveScreen) => void;
  onOCRComplete: (consumer: Consumer, readingValue: number, photoUrl: string, confidence: number) => void;
  onSelectConsumer?: (consumer: Consumer) => void;
}

export const ScanMeterScreen: React.FC<ScanMeterScreenProps> = ({
  consumer: initialConsumer,
  onNavigate,
  onOCRComplete,
  onSelectConsumer,
}) => {
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(initialConsumer || null);
  const [tagInput, setTagInput] = useState('');
  const [tagSearching, setTagSearching] = useState(false);
  const [tagMatchError, setTagMatchError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Initialize and start camera stream with graceful constraint fallbacks
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
              console.warn('Video auto-play deferred:', playErr);
            }
            setCameraActive(true);
          }
        }
      } else {
        setCameraError('Live camera not supported in this browser. Tap shutter to capture using native camera.');
      }
    } catch (err: any) {
      console.warn('Live camera stream unavailable:', err);
      setCameraActive(false);
      setCameraError('Live camera stream not permitted. Tap shutter to capture directly with phone camera.');
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

  // Tag search function
  const handleSearchTag = async (tagToSearch?: string) => {
    const query = (tagToSearch || tagInput).trim();
    if (!query) return;

    setTagSearching(true);
    setTagMatchError(null);

    try {
      const match = await DatabaseHelper.getConsumerByTagOrMeterNumber(query);
      if (match) {
        setSelectedConsumer(match);
        if (onSelectConsumer) onSelectConsumer(match);
        setTagMatchError(null);
      } else {
        setTagMatchError(`No consumer account found matching Tag / Meter "${query}".`);
      }
    } catch (err) {
      setTagMatchError('Tag search failed.');
    } finally {
      setTagSearching(false);
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
          console.warn('Torch constraint error:', e);
        }
      } else {
        setTorchOn(!torchOn);
      }
    } else {
      setTorchOn(!torchOn);
    }
  };

  const processCapturedPhoto = async (photoDataUrl: string) => {
    setIsProcessing(true);
    setCapturedPhoto(photoDataUrl);

    try {
      const result = await OCRService.analyzeMeterPhoto(
        photoDataUrl,
        selectedConsumer?.previousReading,
        selectedConsumer?.meterSerial
      );
      setOcrResult(result);

      // If no consumer was selected yet, attempt to auto-identify by serial or detected numbers
      if (!selectedConsumer && result.meterSerialDetected) {
        const autoMatch = await DatabaseHelper.getConsumerByTagOrMeterNumber(result.meterSerialDetected);
        if (autoMatch) {
          setSelectedConsumer(autoMatch);
          if (onSelectConsumer) onSelectConsumer(autoMatch);
        }
      }
    } catch (err) {
      console.error('OCR processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLiveCapture = async () => {
    if (videoRef.current && cameraActive && videoRef.current.videoWidth > 0) {
      const photo = OCRService.captureFrameFromVideo(videoRef.current);
      if (photo) {
        await processCapturedPhoto(photo);
        return;
      }
    }

    if (nativeCameraInputRef.current) {
      nativeCameraInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        await processCapturedPhoto(base64);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyReading = () => {
    if (ocrResult && ocrResult.success && selectedConsumer) {
      onOCRComplete(
        selectedConsumer,
        ocrResult.readingValue,
        capturedPhoto || '',
        ocrResult.confidence
      );
    } else if (ocrResult && ocrResult.success) {
      onNavigate('consumers');
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col justify-between select-none">
      {/* Hidden Native Phone Camera & File Upload Inputs */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Top Floating Nav & Tag Identification Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-30 space-y-2 pointer-events-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate(selectedConsumer ? 'consumer_details' : 'dashboard')}
            className="px-3 py-1.5 bg-slate-950/90 backdrop-blur-md border border-slate-800 text-sky-400 rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg hover:bg-slate-900 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit Scanner</span>
          </button>

          {selectedConsumer ? (
            <div className="bg-slate-950/90 backdrop-blur-md border border-emerald-500/50 px-3 py-1 rounded-xl text-right">
              <span className="text-[10px] text-emerald-400 font-mono block font-bold">
                TAG: {selectedConsumer.meterNumber || selectedConsumer.meterSerial}
              </span>
              <span className="text-xs font-bold text-white truncate max-w-[140px] block">
                {selectedConsumer.name}
              </span>
            </div>
          ) : (
            <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 px-3 py-1 rounded-xl flex items-center gap-1.5 text-xs text-slate-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span>SCANNER ACTIVE</span>
            </div>
          )}
        </div>

        {/* Quick Meter Tag Search / Scanner Header Bar */}
        {!selectedConsumer && !ocrResult && (
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 p-2 rounded-xl shadow-lg flex items-center gap-2">
            <Tag className="w-4 h-4 text-sky-400 shrink-0 ml-1" />
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchTag()}
              placeholder="Enter Tag # (e.g. MT-4401 or 1001-A)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
            <button
              type="button"
              onClick={() => handleSearchTag()}
              disabled={tagSearching}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shrink-0 transition cursor-pointer"
            >
              {tagSearching ? '...' : 'Match'}
            </button>
          </div>
        )}

        {tagMatchError && (
          <div className="p-2 bg-rose-950/90 border border-rose-800 rounded-xl text-[11px] text-rose-300">
            {tagMatchError}
          </div>
        )}
      </div>

      {/* Camera Viewport & Main Viewfinder Area */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        {/* Live Video Camera Element */}
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
              alt="Captured Water Meter"
              className="max-h-[62vh] rounded-2xl shadow-2xl border-2 border-sky-400 object-contain bg-slate-900"
            />
          </div>
        )}

        {/* Camera Permission / Fallback State Box */}
        {!cameraActive && !capturedPhoto && (
          <div className="text-center p-5 space-y-4 max-w-sm mx-auto z-10">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-sky-400 shadow-xl shadow-sky-950/50">
              <Camera className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-white text-base">Water Meter Camera</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {cameraError || 'Position camera steadily over the 5-digit mechanical water meter dial.'}
              </p>
            </div>

            {/* Direct Camera Shutter Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (nativeCameraInputRef.current) {
                    nativeCameraInputRef.current.click();
                  }
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition cursor-pointer"
              >
                <Camera className="w-4 h-4 text-slate-950" />
                <span>Open Phone Camera</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Retry Live Feed</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (galleryInputRef.current) {
                      galleryInputRef.current.click();
                    }
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-400" />
                  <span>Choose Photo</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Viewfinder Overlay HUD with Live Shutter */}
        {!ocrResult && !capturedPhoto && (
          <ScanOverlay
            onCapture={handleLiveCapture}
            onToggleTorch={handleToggleTorch}
            onFlipCamera={handleFlipCamera}
            onOpenNativeCamera={() => nativeCameraInputRef.current?.click()}
            torchOn={torchOn}
            isProcessing={isProcessing}
            cameraActive={cameraActive}
            mode="meter"
          />
        )}
      </div>

      {/* OCR Result Bottom Sheet */}
      {ocrResult && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl space-y-3 z-30 max-w-lg mx-auto w-full">
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
              Retake Photo
            </button>
          </div>

          {/* Result Outcome Display */}
          {ocrResult.success ? (
            <div className="space-y-2.5">
              {/* Matched Consumer Badge */}
              {selectedConsumer && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-emerald-500/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold block">
                      Account #{selectedConsumer.accountNumber} (Tag: {selectedConsumer.meterNumber || selectedConsumer.meterSerial})
                    </span>
                    <span className="font-bold text-white">{selectedConsumer.name}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-[10px] font-bold rounded">
                    Matched
                  </span>
                </div>
              )}

              {/* 5 Wheel Slot Confirmation Display */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Detected 5-Digit Reading
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
                  <div className="text-xs text-emerald-400 font-semibold mt-1">
                    Monthly Consumption: <strong>{Math.max(0, ocrResult.readingValue - selectedConsumer.previousReading)} cu.m.</strong>
                    <span className="text-slate-500 text-[10px] ml-1.5">(Prev: {selectedConsumer.previousReading} cu.m.)</span>
                  </div>
                )}
              </div>

              {/* Transfer Button */}
              <button
                type="button"
                onClick={handleApplyReading}
                className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-3 rounded-xl shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition active:scale-[0.98] cursor-pointer"
              >
                <span>Accept Reading & Proceed</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-950/40 p-3 rounded-2xl border border-amber-800/80 text-amber-300 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-200">
                  <XCircle className="w-4 h-4 text-amber-400" />
                  <span>Could Not Identify 5-Digit Counter</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {ocrResult.message || 'Please position camera steadily directly facing the 5 mechanical digit wheels and retake the photo.'}
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
                  Retake Photo
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
