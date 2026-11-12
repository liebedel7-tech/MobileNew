import React, { useEffect, useState } from 'react';
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
    <div
      className="fixed inset-0 z-[100] w-full h-full bg-[#07193f] flex flex-col items-center justify-center p-6 select-none overflow-hidden animate-in fade-in duration-300"
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
        <div className="relative flex items-center justify-center transition-transform duration-500 hover:scale-105">
          <OfficialLogo size="2xl" className="shadow-lg" />
        </div>

        {/* Official Name */}
        <div className="space-y-1.5 animate-in slide-in-from-bottom-2 duration-500">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase drop-shadow-md">
            {APP_OFFICIAL_TITLE}
          </h1>
        </div>

        {/* Minimalist Loading Bar */}
        <div className="w-56 space-y-2 pt-3">
          <div className="h-2 w-full bg-[#030e24] rounded-full overflow-hidden border border-sky-900/60 shadow-inner">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
