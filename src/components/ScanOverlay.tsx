import React from 'react';
import { Camera, Zap, RefreshCw } from 'lucide-react';

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
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-20">
      {/* Top Unobtrusive Status Pill */}
      <div className="text-center pt-2">
        <div className="inline-block bg-slate-950/80 backdrop-blur-md border border-slate-700/60 rounded-full px-4 py-1.5 shadow-md">
          <p className="text-xs font-bold text-sky-300">
            {guideTitle || 'ALIGN 5-DIGIT METER DIAL'}
          </p>
          <p className="text-[10px] text-slate-300">
            {guideSubtitle || 'Aim at water meter counter • Tap shutter to capture'}
          </p>
        </div>
      </div>

      {/* Ultra-Clean Transparent Viewport Reticle - 100% Clear & Unobstructed */}
      <div className="relative flex-1 flex items-center justify-center my-2 pointer-events-none">
        <div className="relative w-[85%] max-w-[340px] h-[55%] max-h-[260px] pointer-events-none">
          {/* Subtle 4 Corner Guides Only - NO background colors or blocking graphics */}
          <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-sky-400/90 rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-sky-400/90 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-sky-400/90 rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-sky-400/90 rounded-br-xl" />
        </div>
      </div>

      {/* Bottom Floating Clean Shutter Control Bar */}
      <div className="pointer-events-auto flex items-center justify-around pb-4 pt-2">
        {/* Flashlight toggle */}
        {onToggleTorch ? (
          <button
            onClick={onToggleTorch}
            type="button"
            className={`w-12 h-12 rounded-full border flex items-center justify-center backdrop-blur-md transition ${
              torchOn
                ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/30'
                : 'bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title="Toggle Flashlight"
          >
            <Zap className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-12 h-12" />
        )}

        {/* Primary Clean Shutter Button */}
        <button
          onClick={onCapture}
          disabled={isProcessing}
          type="button"
          className="w-18 h-18 rounded-full bg-white p-1 shadow-2xl hover:scale-105 active:scale-95 transition flex items-center justify-center border-4 border-sky-400 cursor-pointer disabled:opacity-50"
          title="Capture Water Meter"
        >
          <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
            {isProcessing ? (
              <RefreshCw className="w-7 h-7 text-sky-400 animate-spin" />
            ) : (
              <Camera className="w-7 h-7 text-white" />
            )}
          </div>
        </button>

        {/* Flip Camera or Open Phone Camera */}
        {onFlipCamera ? (
          <button
            onClick={onFlipCamera}
            type="button"
            className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-700 text-sky-400 hover:bg-slate-800 flex items-center justify-center transition"
            title="Switch Camera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        ) : onOpenNativeCamera ? (
          <button
            onClick={onOpenNativeCamera}
            type="button"
            className="w-12 h-12 rounded-full bg-slate-900/80 border border-slate-700 text-emerald-400 hover:bg-slate-800 flex items-center justify-center transition"
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
