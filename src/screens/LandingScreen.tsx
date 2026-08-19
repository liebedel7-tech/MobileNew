import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { 
  ArrowRight, 
  Sparkles, 
  Smartphone, 
  Users, 
  FileText, 
  Camera, 
  Radio, 
  Zap, 
  Eye, 
  Download, 
  ChevronRight, 
  Gauge, 
  Droplet,
  CloudUpload,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { ActiveScreen, StaffUser, SyncState } from '../types';
import { WebSocketService, WSTelemetryStats } from '../services/websocketService';

interface LandingScreenProps {
  user: StaffUser | null;
  syncState: SyncState;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenApkModal: () => void;
  wsStatus?: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  isMobileChassis?: boolean;
  onToggleChassis?: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  user,
  syncState,
  onNavigate,
  onOpenApkModal,
  wsStatus = 'CONNECTED',
  isMobileChassis,
  onToggleChassis,
}) => {
  const [wsStats, setWsStats] = useState<WSTelemetryStats>(WebSocketService.getStats());
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Google Drive photo URL with high-res fallbacks
  const DRIVE_IMAGE_URL = 'https://lh3.googleusercontent.com/d/1R8aOCfamLWF4BN_r3Nk02-6juOR6Zqjg=s1600';
  const DRIVE_IMAGE_FALLBACK = 'https://drive.google.com/thumbnail?id=1R8aOCfamLWF4BN_r3Nk02-6juOR6Zqjg&sz=w1600';

  // 3D Motion Physics for Mobile Floating Photo & Stage
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 22, stiffness: 140, mass: 0.4 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothMouseY, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(smoothMouseX, [-0.5, 0.5], [-14, 14]);

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
          {/* District Brand Emblem */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-tr from-sky-500 to-blue-600 rounded-xl flex items-center justify-center font-black text-slate-950 text-base shadow-md shadow-sky-500/30">
              <Droplet className="w-4 h-4 text-slate-950 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-black text-white tracking-tight leading-none uppercase">
                  Tagoloan Water District
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
        {/* District Badge Pill */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[10px] font-mono font-medium">
            <Sparkles className="w-3 h-3 text-sky-400 animate-pulse" />
            <span>OFFICIAL MISAMIS ORIENTAL FIELD PORTAL</span>
          </div>

          <span className="text-[10px] font-mono text-slate-500">v2.4.0-Mobile</span>
        </div>

        {/* 3D Mobile Photo Stage Card */}
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
              y: [-3, 3, -3],
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

            {/* Inner Card Screen */}
            <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800 shadow-inner">
              {/* Photo from Google Drive */}
              <img
                src={DRIVE_IMAGE_URL}
                onError={(e) => {
                  if (!imageError) {
                    setImageError(true);
                    (e.target as HTMLImageElement).src = DRIVE_IMAGE_FALLBACK;
                  }
                }}
                onLoad={() => setImageLoaded(true)}
                alt="Tagoloan Water District Field Terminal"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center filter brightness-95 contrast-105"
              />

              {/* Ambient Readability Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />

              {/* 3D Floating HUD Layer 1: Sensor Banner */}
              <div 
                style={{ transform: 'translateZ(25px)' }}
                className="absolute inset-x-2.5 top-2.5 p-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-sky-500/40 shadow-lg"
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="flex items-center gap-1 font-bold text-sky-400">
                    <Eye className="w-3 h-3 text-sky-400 animate-pulse" />
                    <span>ODOMETER SENSOR HUD</span>
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 text-[9px] border border-emerald-800">
                    99.4% MATCH
                  </span>
                </div>

                {/* Animated Laser Scan Beam */}
                <div className="relative mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    className="w-1/3 h-full bg-gradient-to-r from-transparent via-sky-400 to-transparent"
                  />
                </div>
              </div>

              {/* 3D Floating HUD Layer 2: Live Consumer Reading Preview */}
              <div 
                style={{ transform: 'translateZ(35px)' }}
                className="absolute left-2.5 bottom-2.5 right-2.5 p-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-xl space-y-1"
              >
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-slate-400">AMORATO, VICENTE G.</span>
                  <span className="text-emerald-400 font-bold">READY TO BILL</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-300">Index: <strong className="text-sky-400">00360 cu.m</strong></span>
                  <span className="text-amber-300 font-bold">₱842.50 DUE</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Primary Mobile Call-To-Action Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* Main Login / Enter Terminal Button */}
          <button
            type="button"
            onClick={() => onNavigate(user ? 'dashboard' : 'login')}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-sky-400 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl shadow-sky-500/25 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
          >
            <Gauge className="w-4 h-4 text-slate-950" />
            <span>{user ? 'Open Reader Terminal' : 'Staff Sign In / Register'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Admin / Supervisor Desk Button */}
          <button
            type="button"
            onClick={() => onNavigate('admin_approvals')}
            className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-sky-500/60 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span>Admin Approvals Desk</span>
          </button>
        </div>

        {/* Mobile Quick System Specs Bar */}
        <div className="grid grid-cols-3 gap-2 py-1">
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

        {/* Mobile Direct Modules List */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-mono text-sky-400 tracking-wider uppercase font-semibold">
              Field Terminal Modules
            </h2>
            <span className="text-[10px] text-slate-500">Tap to open</span>
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
                  Multi-ROI 6-crop dial detection & 5-digit capture
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
                  12-zone route walking sequence & GPS locations
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
          </div>

          {/* Module 3: Graduated Tariff Bill Calculator */}
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
                  Graduated Tariff Calculator
                </h3>
                <p className="text-[10px] text-slate-400">
                  Cubic meter tiers, discounts & thermal bill print
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

          {/* Module 5: Android APK Installation */}
          <div 
            onClick={onOpenApkModal}
            className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
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
