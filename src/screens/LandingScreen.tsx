import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { 
  ArrowRight, 
  Sparkles, 
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
  CheckCircle2
} from 'lucide-react';
import { ActiveScreen, StaffUser, SyncState } from '../types';
import { WebSocketService, WSTelemetryStats } from '../services/websocketService';
import { OfficialLogo } from '../components/OfficialLogo';
import { 
  OFFICIAL_TAGOLOAN_LOGO_URL, 
  OFFICIAL_TAGOLOAN_LOGO_FALLBACK, 
  APP_OFFICIAL_BADGE, 
  APP_OFFICIAL_TITLE 
} from '../constants/branding';

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
  const [wsStats, setWsStats] = useState<WSTelemetryStats>(WebSocketService.getStats());
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 3D Motion Physics for Clear Photo Card
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 22, stiffness: 140, mass: 0.4 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothMouseY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(smoothMouseX, [-0.5, 0.5], [-10, 10]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handlePointerLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

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
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950 pb-8">
      {/* Mobile Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5">
        <div className="flex items-center justify-between">
          {/* Official District Brand Emblem */}
          <div className="flex items-center gap-2.5">
            <OfficialLogo size="sm" glow />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-black text-white tracking-tight leading-none uppercase">
                  {APP_OFFICIAL_TITLE}
                </h1>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Field Operations Terminal
              </p>
            </div>
          </div>

          {/* Right Status Pill & APK Button */}
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full border ${
              wsStatus === 'CONNECTED'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'CONNECTED' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>{wsStatus === 'CONNECTED' ? `${wsStats.latencyMs}ms` : 'OFFLINE'}</span>
            </span>

            <button
              type="button"
              onClick={onOpenApkModal}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 transition"
              title="Download Android APK"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Mobile Screen Scrollable Body */}
      <div className="px-4 py-4 space-y-4 max-w-md mx-auto w-full">
        {/* District Official Badge Pill */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[10px] font-mono font-medium">
            <Sparkles className="w-3 h-3 text-sky-400 animate-pulse" />
            <span>{APP_OFFICIAL_BADGE}</span>
          </div>

          <span className="text-[10px] font-mono text-slate-500">v2.4.0-Mobile</span>
        </div>

        {/* Clear Photo Card of Tagoloan Water District */}
        <div 
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          style={{ perspective: 1000 }}
          className="w-full flex justify-center items-center py-1 touch-none select-none"
        >
          <motion.div
            style={{
              rotateX,
              rotateY,
              transformStyle: 'preserve-3d',
            }}
            animate={{
              y: [-2, 2, -2],
            }}
            transition={{
              y: {
                repeat: Infinity,
                duration: 5,
                ease: 'easeInOut',
              },
            }}
            className="relative w-full aspect-[4/3] rounded-2xl bg-slate-900 border border-slate-700/80 p-2 shadow-[0_15px_35px_rgba(14,165,233,0.25)] group cursor-pointer"
          >
            {/* Outer Glowing Holographic Halo */}
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-sky-500 via-teal-400 to-blue-600 opacity-40 group-hover:opacity-70 blur-md transition duration-500 -z-10" />

            {/* Inner Clear Photo Screen */}
            <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800 shadow-inner">
              {/* Clear Photo from Google Drive */}
              <img
                src={imageError ? OFFICIAL_TAGOLOAN_LOGO_FALLBACK : OFFICIAL_TAGOLOAN_LOGO_URL}
                onError={() => {
                  if (!imageError) setImageError(true);
                }}
                onLoad={() => setImageLoaded(true)}
                alt="Tagoloan Water District Official Emblem"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain p-4 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition duration-500 group-hover:scale-105"
              />

              {/* Ambient Readability Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />

              {/* Top Banner Tag */}
              <div 
                style={{ transform: 'translateZ(20px)' }}
                className="absolute inset-x-2.5 top-2.5 p-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-sky-500/40 shadow-lg"
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="flex items-center gap-1.5 font-bold text-sky-400">
                    <OfficialLogo size="xs" />
                    <span>TAGOLOAN WATER DISTRICT</span>
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 text-[9px] border border-emerald-800 font-bold">
                    ACTIVE
                  </span>
                </div>
              </div>

              {/* Bottom Photo Overlay */}
              <div 
                style={{ transform: 'translateZ(30px)' }}
                className="absolute left-2.5 bottom-2.5 right-2.5 p-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-xl space-y-0.5 text-center"
              >
                <div className="text-[11px] font-bold text-white uppercase tracking-wide">
                  Official Mobile Terminal
                </div>
                <div className="text-[9px] text-sky-300 font-mono">
                  Autonomous Offline Meter Reading & Billing Platform
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Dedicated Landing Sign In & Register Section (Clean & Minimalist) */}
        {!user ? (
          <div className="space-y-3.5 pt-2">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Meter Reader Authentication
              </h2>
              <p className="text-[11px] text-slate-400">
                Official Mobile Terminal • Authorized Field Meter Readers Only
              </p>
            </div>

            {/* ONLY Sign In & Register Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Sign In Button */}
              <button
                type="button"
                onClick={() => onOpenLogin('LOGIN')}
                className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-sky-400 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-slate-950" />
                <span>Sign In</span>
              </button>

              {/* Register Button */}
              <button
                type="button"
                onClick={() => onOpenLogin('REGISTER')}
                className="py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-sky-500/40 text-sky-300 font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-sky-400" />
                <span>Register</span>
              </button>
            </div>

            {/* Direct Mobile APK / PWA Download Action */}
            <button
              type="button"
              onClick={onOpenApkModal}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-between transition group"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px]">Install / Download Mobile App</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                <Download className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                <span>APK / PWA</span>
              </div>
            </button>
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
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-bold text-white group-hover:text-sky-300 transition">
                        Reading Logs & History
                      </h3>
                      <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 text-[9px] font-mono font-bold">
                        Logs
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Audit history, bill summaries & sync records
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition" />
              </div>

              {/* Module 6: Android APK & Diagnostics */}
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
            </div>
          </div>
        )}

        {/* Mobile Footer Information */}
        <div className="pt-4 border-t border-slate-800/80 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>LWUA Accredited Water Utility Terminal</span>
          </div>
          <p className="text-[9px] text-slate-500 font-mono">
            Tagoloan Water District • Misamis Oriental, Philippines
          </p>
        </div>
      </div>
    </div>
  );
};
