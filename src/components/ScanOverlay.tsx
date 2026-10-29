import React from 'react';
import { 
  Camera, 
  Zap, 
  RefreshCw, 
  Scan, 
  Tag, 
  Sparkles, 
  CheckCircle2, 
  Target, 
  ArrowDown, 
  Crosshair, 
  ZoomIn, 
  Send,
  Eye
} from 'lucide-react';

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
  zoom?: number;
  onSetZoom?: (zoom: number) => void;
  previousReading?: number;
  onQuickSendToAdmin?: () => void;
}

export const ScanOverlay: React.FC<ScanOverlayProps> = ({
  onCapture,
  onToggleTorch,
  onFlipCamera,
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
  zoom = 1,
  onSetZoom,
  previousReading,
  onQuickSendToAdmin,
}) => {
  const isDigitsIdentified = liveReadingDigits && liveReadingDigits.length === 5;
  const isTagIdentified = Boolean(liveTagDetected);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2.5 z-20 overflow-hidden">
      {/* 🔝 TOP HUD: Mode Status & Visual Pointer Indicator */}
      <div className="flex items-center justify-between pointer-events-auto gap-2">
        {/* Active Mode Pill */}
        <div className="inline-flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-full px-3 py-1 shadow-lg">
          {mode === 'tag' ? (
            <Tag className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          ) : (
            <Target className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          )}
          <span className="text-[11px] font-black text-white tracking-wide uppercase">
            {mode === 'tag' ? 'Step 1: Point at Tag / Serial #' : 'Step 2: Point at Odometer Dials'}
          </span>
          {isAutoScanning && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
          )}
        </div>

        {/* Real-time Recognition Status */}
        <div className="bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-full px-2.5 py-1 text-[10px] font-mono flex items-center gap-1.5 shadow-md">
          <Sparkles className="w-3 h-3 text-sky-400 animate-spin" />
          <span className={isDigitsIdentified || isTagIdentified ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
            {isDigitsIdentified ? 'LOCKED ON DIALS' : isTagIdentified ? 'TAG IDENTIFIED' : 'ACTIVE POINTER'}
          </span>
        </div>
      </div>

      {/* 🎯 MAIN CENTER VIEWPORT RETICLE: High-precision targeting pointers */}
      <div className="relative flex-1 flex flex-col items-center justify-center pointer-events-none my-auto">
        {mode === 'tag' ? (
          /* ========================================================
             TAG / SERIAL NUMBER POINTING RETICLE
             ======================================================== */
          <div className="relative flex flex-col items-center w-full max-w-[320px]">
            {/* Top Pointer Arrow */}
            <div className="mb-2 flex items-center gap-1.5 bg-slate-950/85 border border-emerald-500/60 rounded-full px-3 py-0.5 text-emerald-300 text-[10.5px] font-mono font-bold animate-bounce shadow-lg">
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>POINT CAMERA AT METER TAG / PLATE</span>
            </div>

            <div
              className={`relative w-[90%] h-32 rounded-2xl border-2 transition-all duration-300 flex items-center justify-center ${
                liveTagDetected
                  ? 'border-emerald-400 bg-emerald-950/40 ring-4 ring-emerald-400/40 shadow-[0_0_25px_rgba(52,211,153,0.4)]'
                  : 'border-emerald-500/70 bg-emerald-950/20 backdrop-blur-[0.5px]'
              }`}
            >
              {/* Corner Targeting Brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

              {/* Crosshair Center Pointer */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Crosshair className="w-8 h-8 text-emerald-400/40" />
              </div>

              {/* Horizontal Laser Guide Line */}
              <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-[scan_2s_ease-in-out_infinite]" />

              {/* Target Identification Badge */}
              <div className="z-10 text-center px-2">
                {liveTagDetected ? (
                  <div className="bg-slate-950/95 border-2 border-emerald-400 rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-2 animate-in zoom-in-95">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-mono font-black text-emerald-300 tracking-wider">
                      IDENTIFIED: {liveTagDetected}
                    </span>
                  </div>
                ) : (
                  <div className="text-[10px] font-mono font-bold text-emerald-300 bg-slate-950/90 px-3 py-1 rounded-lg border border-emerald-500/40">
                    ALIGN METER TAG # (e.g. MT-4401)
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================
             5-DIGIT MECHANICAL ODOMETER DIALS POINTING RETICLE
             ======================================================== */
          <div className="relative flex flex-col items-center w-full max-w-[360px]">
            {/* Top Pointer Heading with Downward Pointers */}
            <div className="mb-2 flex flex-col items-center">
              <div className="inline-flex items-center gap-1.5 bg-slate-950/90 border border-sky-400/80 rounded-full px-3 py-0.5 text-sky-300 text-[10.5px] font-mono font-bold shadow-lg">
                <ArrowDown className="w-3.5 h-3.5 text-sky-400 animate-bounce" />
                <span>POINT DIRECTLY AT NUMBER WHEELS (CU.M.)</span>
              </div>
              <div className="flex items-center justify-center gap-4 text-[9px] text-sky-400/80 font-mono mt-0.5">
                <span>▼ 10k</span>
                <span>▼ 1k</span>
                <span>▼ 100</span>
                <span>▼ 10</span>
                <span>▼ 1</span>
              </div>
            </div>

            {/* Odometer Glass Reticle Frame */}
            <div
              className={`relative w-[95%] h-36 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center ${
                isDigitsIdentified
                  ? 'border-emerald-400 bg-slate-950/60 ring-4 ring-emerald-400/40 shadow-[0_0_30px_rgba(52,211,153,0.5)]'
                  : 'border-sky-400/80 bg-slate-950/40 backdrop-blur-[0.5px] shadow-[0_0_20px_rgba(56,189,248,0.25)]'
              }`}
            >
              {/* Corner Optical Brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-sky-400 rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-sky-400 rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-sky-400 rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-sky-400 rounded-br-xl" />

              {/* 5 Physical Roller Wheels Visualization with Direct Number Pointing */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 my-auto z-10">
                {[0, 1, 2, 3, 4].map((i) => {
                  const digit = liveReadingDigits && liveReadingDigits[i] ? liveReadingDigits[i] : null;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      {/* Individual pointer arrow per number */}
                      <span className={`text-[10px] font-black transition-colors ${
                        digit !== null ? 'text-emerald-400 animate-bounce' : 'text-sky-400/60'
                      }`}>
                        ▼
                      </span>

                      {/* Number Wheel Box (Styled like real black-on-white water meter odometer) */}
                      <div
                        className={`w-9 sm:w-11 h-14 rounded-lg flex flex-col items-center justify-center font-mono font-black text-xl sm:text-2xl transition-all shadow-md ${
                          digit !== null
                            ? 'bg-white text-slate-950 border-2 border-emerald-400 ring-2 ring-emerald-400/50 scale-105'
                            : 'bg-slate-900 border-2 border-sky-500/70 text-sky-300'
                        }`}
                        style={{
                          boxShadow: digit !== null ? '0 0 15px rgba(52,211,153,0.6)' : 'none'
                        }}
                      >
                        {digit !== null ? digit : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Laser Scanning Bar */}
              <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-[scan_2.2s_ease-in-out_infinite]" />

              {/* Bottom Live Number Identification Banner */}
              <div className="absolute -bottom-4 inset-x-0 flex justify-center z-20">
                <div className={`px-3 py-1 rounded-full font-mono text-[11px] font-black border shadow-lg flex items-center gap-1.5 transition-all ${
                  liveReadingValue !== null && liveReadingValue !== undefined
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-400 ring-2 ring-emerald-400/30'
                    : 'bg-slate-950/90 text-sky-300 border-sky-600'
                }`}>
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    {liveReadingValue !== null && liveReadingValue !== undefined
                      ? `IDENTIFIED: ${liveReadingValue} cu.m. (${((liveConfidence || 0.95) * 100).toFixed(0)}% MATCH)`
                      : 'CENTER THE 5 NUMBERS INSIDE BOXES'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🎛️ BOTTOM CAMERA CONTROLS: Zoom Presets, Torch, Shutter */}
      <div className="pointer-events-auto flex flex-col gap-2 pt-2 z-20">
        {/* Zoom Selector Bar (Critical for reading meters deep in ground pits) */}
        {onSetZoom && (
          <div className="flex items-center justify-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-full py-1 px-3 self-center shadow-lg">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Zoom:</span>
            {[1, 1.5, 2, 3].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => onSetZoom(z)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold transition cursor-pointer ${
                  zoom === z
                    ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                {z}x
              </button>
            ))}
          </div>
        )}

        {/* Viewfinder Bottom Row */}
        <div className="flex items-center justify-between px-3">
          {/* Torch / Flashlight Toggle Button */}
          {onToggleTorch ? (
            <button
              onClick={onToggleTorch}
              type="button"
              className={`w-11 h-11 rounded-full border-2 flex items-center justify-center backdrop-blur-md transition cursor-pointer shadow-lg active:scale-95 ${
                torchOn
                  ? 'bg-amber-400 border-amber-200 text-slate-950 shadow-amber-400/50'
                  : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
              title="Toggle Flashlight / Torch"
            >
              <Zap className="w-5 h-5 fill-current" />
            </button>
          ) : (
            <div className="w-11 h-11" />
          )}

          {/* Quick Guidance Hint */}
          <div className="text-center">
            <span className="text-[10px] font-mono text-slate-400 bg-slate-950/90 px-2.5 py-1 rounded-full border border-slate-800 shadow">
              Hold camera steady & parallel to glass
            </span>
          </div>

          {/* Camera Flip Button */}
          {onFlipCamera ? (
            <button
              onClick={onFlipCamera}
              type="button"
              className="w-11 h-11 rounded-full bg-slate-900/90 border-2 border-slate-700 text-sky-400 hover:bg-slate-800 flex items-center justify-center transition cursor-pointer shadow-lg active:scale-95"
              title="Switch Front/Back Camera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-11 h-11" />
          )}
        </div>
      </div>
    </div>
  );
};
