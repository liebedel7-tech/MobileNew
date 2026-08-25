import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { OfficialLogo } from './OfficialLogo';
import { APP_OFFICIAL_TITLE } from '../constants/branding';

interface AppSplashScreenProps {
  onFinish: () => void;
  minDurationMs?: number;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({
  onFinish,
  minDurationMs = 5500,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const steps = [
      { progress: 18, delay: 500 },
      { progress: 38, delay: 1500 },
      { progress: 62, delay: 2800 },
      { progress: 85, delay: 4200 },
      { progress: 100, delay: 5100 },
    ];

    const timeouts: NodeJS.Timeout[] = [];

    steps.forEach((step) => {
      const t = setTimeout(() => {
        setProgress(step.progress);
      }, step.delay);
      timeouts.push(t);
    });

    const endTimer = setTimeout(() => {
      onFinish();
    }, Math.max(minDurationMs, 5500));
    timeouts.push(endTimer);

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [onFinish, minDurationMs]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="fixed inset-0 z-[100] w-full h-full bg-[#07193f] flex flex-col items-center justify-center p-6 select-none overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at center, #0c2b64 0%, #07193f 60%, #030d24 100%)',
      }}
    >
      {/* Background Soft Blue Ambient Glows */}
      <div className="absolute w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute w-64 h-64 bg-blue-600/20 rounded-full blur-2xl pointer-events-none -z-10" />

      {/* Center Container */}
      <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-sm px-4">
        {/* Official Logo with Soft Pulse */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative flex items-center justify-center"
        >
          {/* Subtle Radiant Ring */}
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.7, 0.35] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
            className="absolute -inset-4 rounded-full bg-sky-500/30 blur-lg -z-10"
          />
          
          <OfficialLogo size="2xl" glow className="shadow-2xl" />
        </motion.div>

        {/* Official Name */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
          className="space-y-1.5"
        >
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase drop-shadow-md">
            {APP_OFFICIAL_TITLE}
          </h1>
        </motion.div>

        {/* Minimalist Loading Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="w-56 space-y-2 pt-3"
        >
          <div className="h-1.5 w-full bg-[#030e24] rounded-full overflow-hidden border border-sky-900/60 shadow-inner">
            <motion.div
              className="h-full bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-500 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.5)]"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
