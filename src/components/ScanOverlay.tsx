import React from 'react';
import { 
  Zap, 
  RefreshCw, 
  Tag, 
  Target, 
  CheckCircle2, 
  Eye,
  Keyboard
} from 'lucide-react';
import { formatOdometerReading } from '../constants/routes';

interface ScanOverlayProps {
  onCapture: () => void;
  onToggleTorch?: () => void;
  onFlipCamera?: () => void;
  onTypeReading?: () => void;
  torchOn?: boolean;
  isProcessing?: boolean;
  cameraActive?: boolean;
  mode?: 'meter' | 'tag';
  isAutoScanning?: boolean;
  liveTagDetected?: string | null;
  liveReadingDigits?: string[] | null;
  liveReadingValue?: number | null;
  liveConfidence?: number;
  zoom?: number;
  onSetZoom?: (zoom: number) => void;
  isReadingClear?: boolean;
  clearConfidenceCount?: number;
}

export const ScanOverlay: React.FC<ScanOverlayProps> = ({
  onCapture,
  onToggleTorch,
  onFlipCamera,
  onTypeReading,
  torchOn = false,
  isProcessing = false,
  mode = 'meter',
  liveTagDetected,
  liveReadingDigits,
  liveReadingValue,
  liveConfidence = 0,
  zoom = 1,
  onSetZoom,
  isReadingClear = false,
  clearConfidenceCount = 0,
}) => {
  const displayDigits = liveReadingValue !== null && liveReadingValue !== undefined
    ? formatOdometerReading(liveReadingValue).split('')
    : (liveReadingDigits && liveReadingDigits.length === 5 ? liveReadingDigits : null);
  const isDigitsIdentified = displayDigits && displayDigits.length === 5;
  const pct = Math.round(liveConfidence * 100);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 z-20 overflow-hidden select-none">
      {/* 🔝 MINIMAL TOP HUD: Mode Badge, Real-time Confidence, and Quick Type Button */}
      <div className="flex items-center justify-between pointer-events-auto gap-2">
        {/* Mode Tag */}
        <div className="inline-flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-full px-2.5 py-1 shadow-md">
          {mode === 'tag' ? (
            <Tag className="w-3 h-3 text-emerald-400" />
          ) : (
            <Target className="w-3 h-3 text-sky-400" />
          )}
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
            {mode === 'tag' ? 'Scan Tag #' : 'Odometer Scan'}
          </span>
        </div>

        {/* Status Pill: Clear vs Identifying */}
        {mode === 'meter' && (
          <div className="flex items-center gap-1.5">
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border backdrop-blur-md flex items-center gap-1.5 transition-all shadow-md ${
              isReadingClear
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-400 ring-2 ring-emerald-400/30'
                : isDigitsIdentified
                ? 'bg-sky-950/80 text-sky-300 border-sky-500/70'
                : 'bg-slate-950/80 text-slate-400 border-slate-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                isReadingClear 
                  ? 'bg-emerald-400 animate-ping' 
                  : isDigitsIdentified 
                  ? 'bg-sky-400 animate-pulse' 
                  : 'bg-amber-400'
              }`} />
              <span>
                {isReadingClear 
                  ? `CLEAR (${pct}%)` 
                  : isDigitsIdentified 
                  ? `ANALYZING (${pct}%)` 
                  : 'ALIGN DIALS'}
              </span>
            </div>

            {/* In-Overlay Direct Manual Type Button (Always accessible) */}
            {onTypeReading && (
              <button
                type="button"
                onClick={onTypeReading}
                className="px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-sky-300 hover:text-white text-[10px] font-bold font-mono flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-md"
                title="Switch directly to manual typing"
              >
                <Keyboard className="w-3 h-3 text-sky-400" />
                <span>Type</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 🎯 MINIMAL VIEWPORT RETICLE: Ultra-clean frame focused on the dials */}
      <div className="relative flex-1 flex flex-col items-center justify-center pointer-events-none my-auto">
        {mode === 'tag' ? (
          /* Tag scanning frame */
          <div className="relative w-[85%] max-w-[280px] h-28 rounded-2xl border-2 transition-all duration-300 flex items-center justify-center border-emerald-400/90 bg-emerald-950/10">
            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-emerald-400 rounded-tl-xl" />
            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-emerald-400 rounded-tr-xl" />
            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-emerald-400 rounded-bl-xl" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-emerald-400 rounded-br-xl" />

            {liveTagDetected ? (
              <div className="bg-slate-950/95 border border-emerald-400 rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-mono font-black text-emerald-300 tracking-wider">
                  {liveTagDetected}
                </span>
              </div>
            ) : (
              <span className="text-[10px] font-mono font-medium text-emerald-300/80 bg-slate-950/70 px-2 py-0.5 rounded">
                Tag / Serial Number
              </span>
            )}
          </div>
        ) : (
          /* 5-Digit Odometer Reticle */
          <div className="relative w-[92%] max-w-[340px] flex flex-col items-center">
            {/* Odometer Glass Reticle Frame */}
            <div
              className={`relative w-full h-28 rounded-2xl border-2 transition-all duration-300 flex items-center justify-center ${
                isReadingClear
                  ? 'border-emerald-400 bg-emerald-950/20 ring-4 ring-emerald-400/40 shadow-[0_0_25px_rgba(52,211,153,0.4)]'
                  : isDigitsIdentified
                  ? 'border-sky-400 bg-slate-950/30'
                  : 'border-sky-400/70 bg-slate-950/20'
              }`}
            >
              {/* Clean Corner Brackets */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-sky-400 rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-sky-400 rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-sky-400 rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-sky-400 rounded-br-xl" />

              {/* 5 Physical Roller Wheels */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 z-10">
                {[0, 1, 2, 3, 4].map((i) => {
                  const digit = displayDigits && displayDigits[i] ? displayDigits[i] : null;
                  return (
                    <div
                      key={i}
                      className={`w-9 sm:w-10 h-14 rounded-lg flex items-center justify-center font-mono font-black text-xl sm:text-2xl transition-all shadow-sm ${
                        digit !== null
                          ? isReadingClear
                            ? 'bg-emerald-400 text-slate-950 border-2 border-emerald-200 scale-105 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                            : 'bg-white text-slate-950 border border-sky-400'
                          : 'bg-slate-900/90 border border-slate-700 text-slate-500'
                      }`}
                    >
                      {digit !== null ? digit : '·'}
                    </div>
                  );
                })}
              </div>

              {/* Laser Scanning Line */}
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-60" />
            </div>

            {/* Confidence-Weighted Auto-Capture Progress Bar (When clear reading is locking) */}
            {isReadingClear && clearConfidenceCount > 0 && (
              <div className="w-full max-w-[240px] mt-1.5 bg-slate-950/80 rounded-full h-1 overflow-hidden border border-emerald-500/50">
                <div 
                  className="bg-emerald-400 h-full transition-all duration-200"
                  style={{ width: `${Math.min(100, (clearConfidenceCount / 2) * 100)}%` }}
                />
              </div>
            )}

            {/* Bottom Identified Value (Clean Pill) */}
            {liveReadingValue !== null && liveReadingValue !== undefined && (
              <div className={`mt-2 flex items-center gap-1.5 backdrop-blur-md rounded-full px-3 py-1 shadow-lg transition-all ${
                isReadingClear
                  ? 'bg-emerald-950/95 border border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/30'
                  : 'bg-slate-950/90 border border-sky-500/80 text-sky-300'
              }`}>
                <Eye className={`w-3.5 h-3.5 ${isReadingClear ? 'text-emerald-400' : 'text-sky-400'}`} />
                <span className="font-mono text-xs font-black">
                  {formatOdometerReading(liveReadingValue)} m³
                </span>
                <span className={`text-[10px] font-mono font-bold ml-1 ${isReadingClear ? 'text-emerald-300' : 'text-sky-400'}`}>
                  ({pct}%)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🎛️ BOTTOM CONTROLS: Torch, Zoom, Flip */}
      <div className="pointer-events-auto flex items-center justify-between px-2 pt-1 z-20">
        {/* Torch Toggle */}
        {onToggleTorch ? (
          <button
            onClick={onToggleTorch}
            type="button"
            className={`w-10 h-10 rounded-full border flex items-center justify-center backdrop-blur-md transition cursor-pointer shadow-md active:scale-95 ${
              torchOn
                ? 'bg-amber-400 border-amber-200 text-slate-950 shadow-amber-400/50'
                : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
            aria-label="Toggle Torch"
            title="Toggle Flashlight / Torch"
          >
            <Zap className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}

        {/* Minimal Zoom Control */}
        {onSetZoom && (
          <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-full p-1 shadow-md">
            {[1, 1.5, 2].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => onSetZoom(z)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold transition cursor-pointer ${
                  zoom === z
                    ? 'bg-sky-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {z}x
              </button>
            ))}
          </div>
        )}

        {/* Camera Flip */}
        {onFlipCamera ? (
          <button
            onClick={onFlipCamera}
            type="button"
            className="w-10 h-10 rounded-full bg-slate-900/80 border border-slate-700 text-sky-400 hover:bg-slate-800 flex items-center justify-center transition cursor-pointer shadow-md active:scale-95"
            aria-label="Flip Camera"
            title="Switch Camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}
      </div>
    </div>
  );
};
