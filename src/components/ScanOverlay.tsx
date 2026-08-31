import React from 'react';
import { Camera, Zap, RefreshCw, Scan, Tag } from 'lucide-react';

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
  isAutoScanning = false,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-20">
      {/* Top Unobtrusive Status Pill */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 bg-slate-950/85 backdrop-blur-md border border-slate-700/70 rounded-full px-4 py-1.5 shadow-lg">
          {mode === 'tag' ? (
            <Tag className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          ) : (
            <Scan className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          )}
          <div className="text-left">
            <p className="text-xs font-black text-white tracking-wide">
              {guideTitle || (mode === 'tag' ? 'AIM AT METER TAG / SERIAL' : 'AIM AT 5-DIGIT METER DIAL')}
            </p>
            <p className="text-[10px] text-slate-300 font-medium">
              {guideSubtitle || (mode === 'tag' ? 'Identifies meter tag number' : 'Auto-identifying 5 mechanical digit wheels')}
            </p>
          </div>
        </div>
      </div>

      {/* Viewport Reticle - Dynamic for Tag Number vs Dial Reading */}
      <div className="relative flex-1 flex items-center justify-center my-2 pointer-events-none">
        {mode === 'tag' ? (
          /* Meter Tag / Serial Number Reticle */
          <div className="relative w-[82%] max-w-[320px] h-[35%] max-h-[160px] pointer-events-none rounded-2xl border border-emerald-500/40 bg-emerald-950/10 backdrop-blur-[1px]">
            {/* 4 Corner Guides */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-emerald-400 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-emerald-400 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-emerald-400 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-emerald-400 rounded-br-xl" />
            
            {/* Animated Laser Scanning Line */}
            <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-[scan_2s_ease-in-out_infinite]" />
            
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-mono font-bold text-emerald-300/90 bg-slate-950/70 px-2.5 py-0.5 rounded border border-emerald-500/30">
                METER TAG NUMBER ALIGNMENT
              </span>
            </div>
          </div>
        ) : (
          /* 5-Digit Odometer Dial Reticle */
          <div className="relative w-[88%] max-w-[340px] h-[48%] max-h-[220px] pointer-events-none rounded-2xl border border-sky-500/40 bg-sky-950/10 backdrop-blur-[1px]">
            {/* 4 Corner Guides */}
            <div className="absolute top-0 left-0 w-7 h-7 border-t-3 border-l-3 border-sky-400 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-7 h-7 border-t-3 border-r-3 border-sky-400 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-3 border-l-3 border-sky-400 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-3 border-r-3 border-sky-400 rounded-br-xl" />

            {/* 5 Wheel Slot Outline Guides */}
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex items-center justify-center gap-1.5 opacity-60">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-9 h-13 border-2 border-dashed border-sky-400/70 rounded-lg bg-sky-950/30 flex items-center justify-center font-mono text-xs text-sky-300"
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Animated Laser Scanning Line */}
            <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-[scan_2.5s_ease-in-out_infinite]" />
          </div>
        )}
      </div>

      {/* Bottom Floating Shutter & Camera Controls */}
      <div className="pointer-events-auto flex items-center justify-around pb-4 pt-2">
        {/* Flashlight toggle */}
        {onToggleTorch ? (
          <button
            onClick={onToggleTorch}
            type="button"
            className={`w-12 h-12 rounded-full border flex items-center justify-center backdrop-blur-md transition cursor-pointer ${
              torchOn
                ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/30'
                : 'bg-slate-900/85 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title="Toggle Flashlight"
          >
            <Zap className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-12 h-12" />
        )}

        {/* Primary Clean Shutter / Scan Button */}
        <button
          onClick={onCapture}
          disabled={isProcessing}
          type="button"
          className="w-18 h-18 rounded-full bg-white p-1 shadow-2xl hover:scale-105 active:scale-95 transition flex items-center justify-center border-4 border-sky-400 cursor-pointer disabled:opacity-50"
          title="Analyze Meter Reading"
        >
          <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
            {isProcessing ? (
              <RefreshCw className="w-7 h-7 text-sky-400 animate-spin" />
            ) : (
              <Camera className="w-7 h-7 text-white" />
            )}
          </div>
        </button>

        {/* Flip Camera */}
        {onFlipCamera ? (
          <button
            onClick={onFlipCamera}
            type="button"
            className="w-12 h-12 rounded-full bg-slate-900/85 border border-slate-700 text-sky-400 hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
            title="Switch Camera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        ) : onOpenNativeCamera ? (
          <button
            onClick={onOpenNativeCamera}
            type="button"
            className="w-12 h-12 rounded-full bg-slate-900/85 border border-slate-700 text-emerald-400 hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
            title="Open Phone Camera"
          >
            <Camera className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-12 h-12" />
        )}
      </div>
    </div>
  );
};

