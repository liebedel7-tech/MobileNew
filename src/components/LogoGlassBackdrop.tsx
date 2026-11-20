import React, { useState } from 'react';
import {
  OFFICIAL_TAGOLOAN_LOGO_URL,
  OFFICIAL_TAGOLOAN_LOGO_FALLBACK,
  OFFICIAL_TAGOLOAN_LOGO_DIRECT,
} from '../constants/branding';

interface LogoGlassBackdropProps {
  intensity?: 'soft' | 'balanced';
}

export const LogoGlassBackdrop: React.FC<LogoGlassBackdropProps> = ({
  intensity = 'balanced',
}) => {
  const [errorStage, setErrorStage] = useState<number>(0);

  const getSrc = () => {
    if (errorStage === 0) return OFFICIAL_TAGOLOAN_LOGO_URL;
    if (errorStage === 1) return OFFICIAL_TAGOLOAN_LOGO_FALLBACK;
    if (errorStage === 2) return OFFICIAL_TAGOLOAN_LOGO_DIRECT;
    if (errorStage === 3) return '/pwa-512x512.png';
    if (errorStage === 4) return '/icon.svg';
    return null;
  };

  const src = getSrc();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden bg-slate-950"
    >
      {/* Full-screen scaled official logo backdrop */}
      {src ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setErrorStage((prev) => prev + 1)}
          className={`absolute inset-0 w-full h-full object-cover object-center scale-110 transition-opacity duration-500 ${
            intensity === 'soft'
              ? 'opacity-45 blur-xl saturate-125'
              : 'opacity-55 blur-lg saturate-125'
          }`}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-sky-900/50 via-slate-950 to-blue-950/60" />
      )}

      {/* Secondary soft ambient radial light from logo hues */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 28%, rgba(56, 189, 248, 0.22) 0%, rgba(15, 23, 42, 0.45) 52%, rgba(2, 6, 23, 0.88) 100%)',
        }}
      />

      {/* Frosted glass layer over the entire screen */}
      <div className="absolute inset-0 backdrop-blur-2xl bg-slate-950/45" />

      {/* Subtle glass sheen edge */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
};
