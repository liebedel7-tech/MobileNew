import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { ActiveScreen, StaffUser } from '../types';
import { OfficialLogo } from './OfficialLogo';

export interface LoadingProcessInfo {
  type: 'module_transition' | 'batch_sync' | 'save_reading' | 'ocr_scan' | 'print_receipt' | 'reset_database' | 'login' | 'logout';
  targetModule?: ActiveScreen;
  title: string;
  subtitle: string;
  steps?: string[];
  durationMs?: number;
  metadata?: Record<string, any>;
}

interface ModuleLoadingScreenProps {
  processInfo: LoadingProcessInfo | null;
  currentUser?: StaffUser | null;
  onFinished?: () => void;
}

export const ModuleLoadingScreen: React.FC<ModuleLoadingScreenProps> = ({
  processInfo,
  onFinished,
}) => {
  const [progress, setProgress] = useState<number>(30);

  useEffect(() => {
    if (!processInfo) return;

    setProgress(30);
    const duration = Math.min(processInfo.durationMs || 200, 400);

    const progressTimer = setInterval(() => {
      setProgress((prev: number) => (prev < 90 ? prev + 30 : prev));
    }, duration / 3);

    const finishTimer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        if (onFinished) {
          onFinished();
        }
      }, 30);
    }, duration);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(finishTimer);
    };
  }, [processInfo, onFinished]);

  if (!processInfo) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 select-none"
      >
        <div className="w-full max-w-xs bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3.5 text-center">
          {/* Logo & Spinner */}
          <div className="flex justify-center items-center relative py-1">
            <OfficialLogo size="sm" glow />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Loader2 className="w-11 h-11 text-sky-400 animate-spin opacity-50" />
            </div>
          </div>

          {/* Titles */}
          <div className="space-y-1">
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
              {processInfo.title || 'Loading Module...'}
            </h2>
            {processInfo.subtitle && (
              <p className="text-[11px] text-slate-400 font-mono truncate px-1">
                {processInfo.subtitle}
              </p>
            )}
          </div>

          {/* Streamlined Progress Bar */}
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-sky-500 rounded-full"
              initial={{ width: '30%' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.12 }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
