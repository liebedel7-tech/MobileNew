import React from 'react';
import { Wifi, BatteryMedium, Signal } from 'lucide-react';

interface MobileFrameWrapperProps {
  isMobileChassis: boolean;
  children: React.ReactNode;
}

export const MobileFrameWrapper: React.FC<MobileFrameWrapperProps> = ({
  isMobileChassis,
  children,
}) => {
  if (!isMobileChassis) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-start">
        <div className="w-full max-w-md min-h-screen flex flex-col bg-slate-950 shadow-2xl">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 p-0 sm:py-6 sm:px-4 flex items-center justify-center">
      {/* Mobile Device Bezel Frame */}
      <div className="w-full max-w-[420px] min-h-screen sm:min-h-[840px] sm:max-h-[92vh] bg-slate-900 sm:border-[10px] border-slate-800 sm:rounded-[44px] shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative ring-1 ring-slate-700/80">
        
        {/* Mobile Device Status Bar & Dynamic Island */}
        <div className="hidden sm:flex h-8 bg-slate-950 w-full items-center justify-between px-6 shrink-0 select-none border-b border-slate-900/50">
          <span className="text-[11px] font-semibold text-slate-300 font-mono">09:41</span>
          
          {/* Dynamic Island Pill */}
          <div className="w-24 h-4 bg-black rounded-full flex items-center justify-between px-2.5 shadow-inner">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
            <div className="w-2 h-2 rounded-full bg-sky-950 border border-sky-500/40" />
          </div>

          {/* Status Icons */}
          <div className="flex items-center gap-1.5 text-slate-300">
            <Signal className="w-3 h-3 text-slate-300" />
            <Wifi className="w-3 h-3 text-slate-300" />
            <BatteryMedium className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Device Screen Content Container */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-slate-950 relative scrollbar-thin scrollbar-thumb-slate-800">
          {children}
        </div>
      </div>
    </div>
  );
};

