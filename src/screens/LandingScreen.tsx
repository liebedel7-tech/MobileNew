import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  Smartphone, 
  Users, 
  FileText, 
  Camera, 
  Download, 
  ChevronRight, 
  Gauge, 
  CloudUpload, 
  ShieldCheck,
  LogIn,
  UserPlus,
  Lock,
  Unlock,
  CheckCircle2,
  Shield,
  History
} from 'lucide-react';
import { ActiveScreen, StaffUser, SyncState } from '../types';
import { WebSocketService, WSTelemetryStats } from '../services/websocketService';
import { OfficialLogo } from '../components/OfficialLogo';
import { LogoGlassBackdrop } from '../components/LogoGlassBackdrop';
import { APP_OFFICIAL_BADGE, APP_OFFICIAL_TITLE } from '../constants/branding';
import { useDeviceInstallStatus } from '../services/installService';

interface LandingScreenProps {
  user: StaffUser | null;
  syncState: SyncState;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenLogin: (mode?: 'LOGIN' | 'REGISTER') => void;
  onOpenApkModal: () => void;
  wsStatus?: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  isMobileChassis?: boolean;
  onToggleChassis?: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  user,
  syncState,
  onNavigate,
  onOpenLogin,
  onOpenApkModal,
  wsStatus = 'CONNECTED',
}) => {
  const { isInstalled } = useDeviceInstallStatus();
  const [wsStats, setWsStats] = useState<WSTelemetryStats>(WebSocketService.getStats());


  useEffect(() => {
    const unsub = WebSocketService.subscribeStats((stats) => {
      setWsStats(stats);
    });
    return unsub;
  }, []);

  const handleModuleClick = (screen: ActiveScreen) => {
    if (!user) {
      onNavigate('login');
    } else {
      onNavigate(screen);
    }
  };

  return (
    <div className="relative flex-1 min-h-0 w-full flex flex-col bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950 overflow-hidden">
      <LogoGlassBackdrop intensity="balanced" />

      <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden pb-8 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        {/* Main Mobile Screen Scrollable Body - Seamless Whole-Page Glass Canvas */}
        <div className="px-5 py-6 max-w-md mx-auto w-full flex-1 flex flex-col justify-between gap-6">
          {/* Open Unboxed District Hero */}
          <div className="flex flex-col items-center text-center pt-6 space-y-3">
            <OfficialLogo size="2xl" />

            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-wider text-sky-300/90 uppercase">
                {APP_OFFICIAL_BADGE}
              </p>
              <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">
                {APP_OFFICIAL_TITLE}
              </h2>
            </div>
          </div>

          {/* Seamless Unboxed Authentication & Actions (Zero Borders or Boundaries) */}
          {!user ? (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Meter Reader Authentication
                </h3>
                <p className="text-xs text-slate-300/85">
                  Authorized Field Meter Readers Only
                </p>
              </div>

              {/* Borderless Sign In & Register Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onOpenLogin('LOGIN')}
                  className="py-3.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-slate-950" />
                  <span>Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenLogin('REGISTER')}
                  className="py-3.5 px-4 rounded-xl bg-white/12 hover:bg-white/20 backdrop-blur-md text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-sky-300" />
                  <span>Register</span>
                </button>
              </div>

              {/* Direct Mobile APK / PWA Download Action - Borderless */}
              {!isInstalled && (
                <button
                  type="button"
                  onClick={onOpenApkModal}
                  className="w-full py-3 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-md text-slate-100 hover:text-white text-xs font-semibold flex items-center justify-between transition group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Install / Download Mobile App</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-300 font-mono">
                    <Download className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                    <span>APK / PWA</span>
                  </div>
                </button>
              )}
            </div>
          ) : (
          /* User Is Logged In - Unlocked Field Terminal Modules */
          <div className="space-y-3 pt-1 animate-in fade-in">
            {/* Logged in Welcome Card */}
            <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 flex items-center justify-center font-bold">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{user.name}</span>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800">
                      ONLINE
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {user.role} • {user.zone}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1 shadow-sm"
              >
                <span>Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick System Specs Bar */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[9px] text-slate-400 font-mono uppercase block">Territory</span>
                <span className="text-xs font-bold text-white">12 Zones</span>
                <span className="text-[9px] text-slate-500 block">Poblacion</span>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[9px] text-slate-400 font-mono uppercase block">Storage</span>
                <span className="text-xs font-bold text-emerald-400">100% Offline</span>
                <span className="text-[9px] text-slate-500 block">SQLite / DB</span>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[9px] text-slate-400 font-mono uppercase block">Live Sync</span>
                <span className="text-xs font-bold text-sky-400">WebSocket</span>
                <span className="text-[9px] text-slate-500 block">{wsStats.latencyMs}ms</span>
              </div>
            </div>

            {/* FIELD TERMINAL MODULES (Active & Unlocked) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <h2 className="text-[11px] font-mono text-emerald-400 tracking-wider uppercase font-bold">
                    Field Terminal Modules
                  </h2>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Ready</span>
              </div>

              {/* Module 1: Optical Odometer Camera */}
              <div 
                onClick={() => handleModuleClick('scan_meter')}
                className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-bold text-white group-hover:text-sky-300 transition">
                      Optical Odometer Scanner
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Multi-ROI dial detection & 5-digit capture
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition" />
              </div>

              {/* Module 2: Zone Consumer Roster */}
              <div 
                onClick={() => handleModuleClick('consumers')}
                className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                      Zone Consumer Directory
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      12-zone route walking sequence & GPS tags
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
              </div>

              {/* Module 3: Manual Reading Entry */}
              <div 
                onClick={() => handleModuleClick('reading_entry')}
                className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-bold text-white group-hover:text-amber-300 transition">
                      Manual Reading Entry
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Direct odometer index logging & field remarks
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
              </div>

              {/* Module 4: Batch Sync Gateway */}
              <div 
                onClick={() => handleModuleClick('batch_submission')}
                className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                    <CloudUpload className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-bold text-white group-hover:text-purple-300 transition">
                      Central Batch Sync Gateway
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      WebSocket offline batch ledger synchronization
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition" />
              </div>

              {/* Module 5: Reading Logs & Submittal History */}
              <div 
                onClick={() => handleModuleClick('history')}
                className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-bold text-white group-hover:text-sky-300 transition">
                      Reading Logs &amp; History
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Audit history, bill summaries & sync records
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition" />
              </div>

              {/* Module 6: Security, Scale & Survival Architecture */}
              <div 
                onClick={() => handleModuleClick('architecture_security')}
                className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                        Security, Scale &amp; Survival Ops
                      </h3>
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold">
                        Shield
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      RBAC, 10k bot flood mitigation, speed &amp; crash reboot
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
              </div>

              {/* Module 7: Android APK & Diagnostics - Only shown if not yet installed */}
              {!isInstalled && (
                <div 
                  onClick={onOpenApkModal}
                  className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                        Android APK / PWA Install
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Native Android WebAPK field deployment package
                      </p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-emerald-400 group-hover:translate-y-0.5 transition" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Footer Information - Seamless */}
        <div className="pt-2 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-300/85">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>LWUA Accredited Water Utility Terminal</span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Tagoloan Water District • Misamis Oriental, Philippines
          </p>
        </div>
        </div>
      </div>
    </div>
  );
};
