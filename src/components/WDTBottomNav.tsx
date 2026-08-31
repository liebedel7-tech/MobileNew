import React from 'react';
import { 
  Home, 
  Users, 
  History, 
  Sliders, 
  Send
} from 'lucide-react';
import { ActiveScreen } from '../types';

interface WDTBottomNavProps {
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  pendingCount?: number;
}

export const WDTBottomNav: React.FC<WDTBottomNavProps> = ({
  activeScreen,
  onNavigate,
  pendingCount = 0,
}) => {
  const NAV_ITEMS: { id: ActiveScreen; label: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: <Home className="w-5 h-5" />,
    },
    {
      id: 'consumers',
      label: 'Consumers',
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: 'batch_submission',
      label: 'Sync Queue',
      icon: (
        <div className="relative">
          <Send className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center animate-pulse">
              {pendingCount}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'history',
      label: 'Readings',
      icon: <History className="w-5 h-5" />,
    },
    {
      id: 'debug',
      label: 'Diagnostics',
      icon: <Sliders className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-5 px-1 sm:px-4 shrink-0 select-none z-30 shadow-lg">
      {NAV_ITEMS.map((item) => {
        const isActive = activeScreen === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center gap-1 transition-all py-1 px-0.5 relative ${
              isActive
                ? 'text-sky-400 font-bold bg-sky-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="text-[10px] leading-none whitespace-nowrap tracking-tight">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
