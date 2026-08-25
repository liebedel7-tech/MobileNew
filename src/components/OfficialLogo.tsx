import React, { useState } from 'react';
import { Droplet } from 'lucide-react';
import { 
  OFFICIAL_TAGOLOAN_LOGO_URL, 
  OFFICIAL_TAGOLOAN_LOGO_FALLBACK, 
  OFFICIAL_TAGOLOAN_LOGO_DIRECT 
} from '../constants/branding';

interface OfficialLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  glow?: boolean;
}

const SIZE_MAP = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
  '2xl': 'w-28 h-28',
};

export const OfficialLogo: React.FC<OfficialLogoProps> = ({
  size = 'md',
  className = '',
  glow = false,
}) => {
  const [errorStage, setErrorStage] = useState<number>(0);
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  const getSrc = () => {
    if (errorStage === 0) return OFFICIAL_TAGOLOAN_LOGO_URL;
    if (errorStage === 1) return OFFICIAL_TAGOLOAN_LOGO_FALLBACK;
    if (errorStage === 2) return OFFICIAL_TAGOLOAN_LOGO_DIRECT;
    if (errorStage === 3) return '/icon.svg';
    return null;
  };

  const src = getSrc();

  return (
    <div className={`relative shrink-0 flex items-center justify-center ${sizeClass} ${className}`}>
      {glow && (
        <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 opacity-50 blur-sm animate-pulse" />
      )}
      
      {src ? (
        <img
          src={src}
          alt="Tagoloan Water District Official Logo"
          referrerPolicy="no-referrer"
          onError={() => setErrorStage((prev) => prev + 1)}
          className={`w-full h-full object-contain relative z-10 rounded-full bg-white/5 p-0.5 shadow-sm border border-sky-400/20`}
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-tr from-sky-500 via-sky-400 to-blue-600 rounded-full flex items-center justify-center font-black text-slate-950 shadow-md relative z-10`}>
          <Droplet className="w-1/2 h-1/2 text-slate-950 fill-slate-950" />
        </div>
      )}
    </div>
  );
};
