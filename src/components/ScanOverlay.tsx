import React from 'react';
import { Camera, Zap, RefreshCw, Scan, Tag, Sparkles, CheckCircle2 } from 'lucide-react';

interface ScanOverlayProps {
  onCapture: () => void;
  onToggleTorch?: () => void;
  onFlipCamera?: () => void;
  onOpenNativeCamera?: () => void;
  torchOn?: boolean;
  isProcessing?: boolean;
  cameraActive?: boolean;
  mode?: 'meter' | 'tag';
  guideTitle?: string;
  guideSubtitle?: string;
  isAutoScanning?: boolean;
  liveTagDetected?: string | null;
  liveReadingDigits?: string[] | null;
  liveReadingValue?: number | null;
  liveConfidence?: number;
}

export const ScanOverlay: React.FC<ScanOverlayProps> = ({
  onCapture,
  onToggleTorch,
  onFlipCamera,
  onOpenNativeCamera,
  torchOn = false,
  isProcessing = false,
  mode = 'meter',
  guideTitle,
  guideSubtitle,
  isAutoScanning = true,
  liveTagDetected,
  liveReadingDigits,
  liveReadingValue,
  liveConfidence,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2.5 z-20">
      {/* Top Floating Viewfinder Status Badge */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="inline-flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-full px-2.5 py-1 shadow-md">
          {mode === 'tag' ? (
            <Tag className="w-3 h-3 text-emerald-400 animate-pulse" />
          ) : (
            <Scan className="w-3 h-3 text-sky-400 animate-pulse" />
          )}
          <span className="text-[10.5px] font-black text-white tracking-wide">
            {mode === 'tag' ? 'TAG ALIGNMENT' : '5-DIAL ALIGNMENT'}
          </span>
          {isAutoScanning && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-0.5" />
          )}
        </div>

        {/* Real-time scan indicator */}
        <div className="bg-slate-950/85 border border-slate-700/80 rounded-full px-2.5 py-0.5 text-[9.5px] font-mono text-emerald-400 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" />
          <span>REAL-TIME OCR</span>
        </div>
      </div>

      {/* Viewport Reticle - Targeted for Tag Number vs 5-Dial Reading */}
      <div className="relative flex-1 flex items-center justify-center pointer-events-none my-1">
        {mode === 'tag' ? (
          /* Tag / Serial Reticle */
          <div
            className={`relative w-[85%] max-w-[280px] h-[55%] max-h-[140px] pointer-events-none rounded-2xl border transition-all duration-300 ${
              liveTagDetected
                ? 'border-emerald-400 bg-emerald-950/30 ring-2 ring-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                : 'border-emerald-500/50 bg-emerald-950/15 backdrop-blur-[0.5px]'
            }`}
          >
            {/* 4 Corner Guides */}
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-xl" />

            {/* Animated Laser Scanning Line */}
            <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#34d399] animate-[scan_2s_ease-in-out_infinite]" />

            <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
              {liveTagDetected ? (
                <div className="bg-slate-950/90 border border-emerald-400 rounded-lg px-2.5 py-1 shadow-lg flex items-center gap-1.5 animate-in zoom-in-95">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[11px] font-mono font-black text-emerald-300">
                    IDENTIFIED: {liveTagDetected}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] font-mono font-bold text-emerald-300/90 bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                  AIM AT METER TAG / NUMBER
                </span>
              )}
            </div>
          </div>
        ) : (
          /* 5-Digit Odometer Dial Reticle */
          <div
            className={`relative w-[90%] max-w-[320px] h-[65%] max-h-[160px] pointer-events-none rounded-2xl border transition-all duration-300 ${
              liveReadingDigits && liveReadingDigits.length === 5
                ? 'border-sky-400 bg-sky-950/30 ring-2 ring-sky-400/50 shadow-[0_0_20px_rgba(56,189,248,0.3)]'
                : 'border-sky-500/50 bg-sky-950/15 backdrop-blur-[0.5px]'
            }`}
          >
            {/* 4 Corner Guides */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-sky-400 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-sky-400 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-sky-400 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-sky-400 rounded-br-xl" />

            {/* 5 Wheel Slot Outline Guides (With live reading numbers if spotted) */}
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex items-center justify-center gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => {
                const liveDigit = liveReadingDigits && liveReadingDigits[i] ? liveReadingDigits[i] : null;
                return (
                  <div
                    key={i}
                    className={`w-8 sm:w-9 h-11 border-2 rounded-lg flex items-center justify-center font-mono font-black text-sm sm:text-base transition-all ${
                      liveDigit !== null
                        ? 'border-sky-400 bg-slate-950 text-sky-300 shadow-md scale-105'
                        : 'border-dashed border-sky-400/60 bg-sky-950/40 text-sky-400/60'
                    }`}
                  >
                    {liveDigit !== null ? liveDigit : i + 1}
                  </div>
                );
              })}
            </div>

            {/* Animated Laser Scanning Line */}
            <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_10px_#38bdf8] animate-[scan_2.2s_ease-in-out_infinite]" />

            {/* Bottom live indicator */}
            <div className="absolute bottom-1.5 inset-x-0 text-center">
              <span className="text-[9.5px] font-mono text-sky-300/90 bg-slate-950/80 px-2 py-0.5 rounded border border-sky-500/30">
                {liveReadingValue !== null && liveReadingValue !== undefined
                  ? `LIVE READING: ${liveReadingValue} m³ (${((liveConfidence || 0.9) * 100).toFixed(0)}% MATCH)`
                  : '5 MECHANICAL WHEEL COUNTER'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Viewfinder Controls */}
      <div className="pointer-events-auto flex items-center justify-between px-2 pt-1">
        {onToggleTorch ? (
          <button
            onClick={onToggleTorch}
            type="button"
            className={`w-9 h-9 rounded-full border flex items-center justify-center backdrop-blur-md transition cursor-pointer ${
              torchOn
                ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-md shadow-amber-500/30'
                : 'bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title="Toggle Flashlight"
          >
            <Zap className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-9 h-9" />
        )}

        {onFlipCamera ? (
          <button
            onClick={onFlipCamera}
            type="button"
            className="w-9 h-9 rounded-full bg-slate-900/80 border border-slate-700 text-sky-400 hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
            title="Switch Camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-9 h-9" />
        )}
      </div>
    </div>
  );
};


