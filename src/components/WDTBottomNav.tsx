import React from 'react';
import {
  Home,
  Users,
  History,
  Sliders,
  CloudUpload
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
  const getMappedActiveTab = (screen: ActiveScreen): ActiveScreen => {
    if (screen === 'consumer_details' || screen === 'reading_entry') return 'consumers';
    if (
      screen === 'audit_log' ||
      screen === 'meter_readers' ||
      screen === 'flutter_config' ||
      screen === 'token_setup' ||
      screen === 'system_connection' ||
      screen === 'architecture_security'
    ) {
      return 'debug';
    }
    return screen;
  };

  const currentTab = getMappedActiveTab(activeScreen);

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
        <div className="relative flex items-center justify-center">
          <CloudUpload className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-4 px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center shadow-sm tabular-nums">
              {pendingCount > 99 ? '99+' : pendingCount}
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
    <nav className="w-full bg-slate-900/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-5 px-1 sm:px-2 shrink-0 select-none z-40 shadow-lg sticky bottom-0 left-0 right-0 overscroll-none [overscroll-behavior:none] touch-none pb-[env(safe-area-inset-bottom)]">
      {NAV_ITEMS.map((item) => {
        const isActive = currentTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-1 transition-colors py-1.5 px-0.5 relative touch-manipulation cursor-pointer ${
              isActive
                ? 'text-sky-400 font-bold'
                : 'text-slate-400 hover:text-slate-200 active:text-slate-100'
            }`}
          >
            {isActive && (
              <span className="absolute top-0 left-2.5 right-2.5 h-0.5 bg-sky-400 rounded-full" />
            )}

            <span className={`shrink-0 transition-transform ${isActive ? 'scale-105' : ''}`}>
              {item.icon}
            </span>
            <span className="text-[11px] leading-tight whitespace-nowrap tracking-tight font-semibold">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
