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
  const [progress, setProgress] = useState<number>(20);

  useEffect(() => {
    if (!processInfo) return;

    setProgress(20);
    const duration = processInfo.durationMs || 250; // Fast, snappy, native feel

    const progressTimer = setInterval(() => {
      setProgress((prev: number) => (prev < 90 ? prev + 25 : prev));
    }, duration / 4);

    const finishTimer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        if (onFinished) {
          onFinished();
        }
      }, 40);
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
        transition={{ duration: 0.12 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none"
      >
        <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
          {/* Logo & Spinner */}
          <div className="flex justify-center items-center relative">
            <OfficialLogo size="sm" />
            <div className="absolute -inset-1">
              <Loader2 className="w-12 h-12 text-sky-500 animate-spin opacity-40 mx-auto" />
            </div>
          </div>

          {/* Simple Titles */}
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-white tracking-tight">
              {processInfo.title || 'Loading...'}
            </h2>
            {processInfo.subtitle && (
              <p className="text-xs text-slate-400">
                {processInfo.subtitle}
              </p>
            )}
          </div>

          {/* Simple Progress Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-sky-500 rounded-full"
              initial={{ width: '20%' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.15 }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
