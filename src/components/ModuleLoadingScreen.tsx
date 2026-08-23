import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  Wifi, 
  CheckCircle2, 
  Activity, 
  Database, 
  Camera, 
  Tag, 
  Users, 
  FileText, 
  LayoutDashboard, 
  Send, 
  History, 
  ShieldAlert, 
  Cpu, 
  Smartphone,
  Calculator,
  Printer,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ActiveScreen, StaffUser } from '../types';
import { WebSocketService, WSTelemetryStats } from '../services/websocketService';

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

// Module configuration metadata
const MODULE_CONFIGS: Record<ActiveScreen, {
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGlow: string;
  borderColor: string;
  defaultSteps: string[];
}> = {
  landing: {
    name: 'District Central Landing & Operations Portal',
    category: 'System Overview & Gateway',
    icon: LayoutDashboard,
    color: 'text-cyan-400',
    bgGlow: 'from-cyan-500/20 to-blue-600/5',
    borderColor: 'border-cyan-500/40',
    defaultSteps: [
      'Loading 3D Floating District Graphics',
      'Establishing WebSocket live telemetry connection',
      'Mounting Portal Landing Page',
    ],
  },
  dashboard: {
    name: 'District Route Overview',
    category: 'Field Operations & Quota',
    icon: LayoutDashboard,
    color: 'text-sky-400',
    bgGlow: 'from-sky-500/20 to-blue-600/5',
    borderColor: 'border-sky-500/40',
    defaultSteps: [
      'Querying local SQLite consumer cache',
      'Calculating daily reading quota progress',
      'Synchronizing district telemetry over WebSocket',
      'Mounting Field Dashboard view',
    ],
  },
  consumers: {
    name: 'Consumer Route Directory',
    category: 'Zone & Account Registry',
    icon: Users,
    color: 'text-emerald-400',
    bgGlow: 'from-emerald-500/20 to-teal-600/5',
    borderColor: 'border-emerald-500/40',
    defaultSteps: [
      'Indexing 12 district zone records',
      'Verifying meter sequence & GPS tags',
      'Emitting MODULE_NAVIGATION packet',
      'Rendering Route Directory list',
    ],
  },
  consumer_details: {
    name: 'Consumer Profile & History',
    category: 'Account Intelligence',
    icon: FileText,
    color: 'text-cyan-400',
    bgGlow: 'from-cyan-500/20 to-blue-600/5',
    borderColor: 'border-cyan-500/40',
    defaultSteps: [
      'Loading historical 12-month consumption',
      'Fetching current tariff rate schedule',
      'Validating GPS proximity coordinates',
      'Readying field meter inspection tools',
    ],
  },
  reading_entry: {
    name: 'Instant Bill & Reading Calculator',
    category: 'Billing & Tariff Engine',
    icon: Calculator,
    color: 'text-amber-400',
    bgGlow: 'from-amber-500/20 to-orange-600/5',
    borderColor: 'border-amber-500/40',
    defaultSteps: [
      'Initializing Tagoloan graduated tariff matrix',
      'Pre-populating previous index reading',
      'Activating real-time anomaly detection',
      'Preparing Instant Water Bill generator',
    ],
  },
  scan_meter: {
    name: 'Multi-ROI Optical Odometer Scanner',
    category: 'Optical Vision & Camera Sensor',
    icon: Camera,
    color: 'text-sky-400',
    bgGlow: 'from-sky-500/20 to-indigo-600/5',
    borderColor: 'border-sky-500/40',
    defaultSteps: [
      'Booting camera hardware stream',
      'Configuring 6-Crop Multi-ROI pipeline',
      'Loading strict 5-digit integer odometer rules',
      'Activating real-time viewfinder overlay',
    ],
  },
  batch_submission: {
    name: 'Central Batch Sync Gateway',
    category: 'Cloud Reconciliation & Upload',
    icon: Send,
    color: 'text-amber-400',
    bgGlow: 'from-amber-500/20 to-red-600/5',
    borderColor: 'border-amber-500/40',
    defaultSteps: [
      'Scanning local pending readings queue',
      'Validating cryptographic transaction checksums',
      'Opening high-priority WebSocket channel',
      'Readying batch submission interface',
    ],
  },
  history: {
    name: 'Field Readings Ledger',
    category: 'Historical Archive & Receipts',
    icon: History,
    color: 'text-blue-400',
    bgGlow: 'from-blue-500/20 to-cyan-600/5',
    borderColor: 'border-blue-500/40',
    defaultSteps: [
      'Loading offline reading log records',
      'Formatting thermal receipt reprint buffers',
      'Aggregating total cubic meter volume',
      'Rendering chronological audit log',
    ],
  },
  audit_log: {
    name: 'Security & Action Audit Trail',
    category: 'Tamper-Evident System Log',
    icon: ShieldAlert,
    color: 'text-rose-400',
    bgGlow: 'from-rose-500/20 to-amber-600/5',
    borderColor: 'border-rose-500/40',
    defaultSteps: [
      'Extracting immutable device event logs',
      'Checking reader action timestamps',
      'Verifying GPS security signatures',
      'Rendering staff audit ledger',
    ],
  },
  debug: {
    name: 'Hardware & Terminal Diagnostics',
    category: 'System Diagnostics & Telemetry',
    icon: Cpu,
    color: 'text-teal-400',
    bgGlow: 'from-teal-500/20 to-emerald-600/5',
    borderColor: 'border-teal-500/40',
    defaultSteps: [
      'Testing SQLite storage engine',
      'Measuring WebSocket round-trip latency',
      'Verifying camera and GPS geolocation APIs',
      'Initializing diagnostic console',
    ],
  },
  meter_readers: {
    name: 'Meter Readers & Staff Directory',
    category: 'Admin Access & Personnel Approval',
    icon: Users,
    color: 'text-amber-400',
    bgGlow: 'from-amber-500/20 to-orange-600/5',
    borderColor: 'border-amber-500/40',
    defaultSteps: [
      'Synchronizing meter reader registrations',
      'Checking pending mobile approval requests',
      'Loading assigned barangay coverage routes',
      'Opening Staff & Meter Readers Directory',
    ],
  },
  flutter_config: {
    name: 'Android Flutter Terminal Setup',
    category: 'Hardware & Token Engine',
    icon: Smartphone,
    color: 'text-sky-400',
    bgGlow: 'from-sky-500/20 to-purple-600/5',
    borderColor: 'border-sky-500/40',
    defaultSteps: [
      'Inspecting Android WebAPK manifest',
      'Verifying Bluetooth thermal printer binding',
      'Syncing device security token',
      'Rendering configuration dashboard',
    ],
  },
  token_setup: {
    name: 'Device Security Token Setup',
    category: 'Authentication & Security',
    icon: Smartphone,
    color: 'text-sky-400',
    bgGlow: 'from-sky-500/20 to-purple-600/5',
    borderColor: 'border-sky-500/40',
    defaultSteps: [
      'Validating reader credentials',
      'Generating offline HMAC token',
      'Connecting to central auth node',
      'Finalizing configuration',
    ],
  },
  login: {
    name: 'Reader Terminal Authentication',
    category: 'Tagoloan Security Gateway',
    icon: ShieldAlert,
    color: 'text-sky-400',
    bgGlow: 'from-sky-500/20 to-blue-600/5',
    borderColor: 'border-sky-500/40',
    defaultSteps: [
      'Initializing biometric & credential check',
      'Connecting to district auth service',
      'Preparing field session',
    ],
  },
};

export const ModuleLoadingScreen: React.FC<ModuleLoadingScreenProps> = ({
  processInfo,
  currentUser,
  onFinished,
}) => {
  const [progress, setProgress] = useState(15);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [wsStats, setWsStats] = useState<WSTelemetryStats>(WebSocketService.getStats());

  useEffect(() => {
    const unsub = WebSocketService.subscribeStats((stats) => {
      setWsStats(stats);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!processInfo) return;

    setProgress(15);
    setCurrentStepIndex(0);

    const duration = processInfo.durationMs || 320; // Crisp, high-speed native feel
    const targetModule = processInfo.targetModule || 'dashboard';
    const config = MODULE_CONFIGS[targetModule] || MODULE_CONFIGS.dashboard;
    const steps = processInfo.steps || config.defaultSteps;

    const intervalTime = Math.max(30, Math.floor(duration / (steps.length + 2)));

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.floor(85 / (steps.length + 1));
        return next >= 98 ? 98 : next;
      });
    }, intervalTime);

    const stepTimer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, intervalTime);

    const finishTimer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        if (onFinished) {
          onFinished();
        }
      }, 50);
    }, duration);

    return () => {
      clearInterval(progressTimer);
      clearInterval(stepTimer);
      clearTimeout(finishTimer);
    };
  }, [processInfo, onFinished]);

  if (!processInfo) return null;

  const targetModule = processInfo.targetModule || 'dashboard';
  const config = MODULE_CONFIGS[targetModule] || MODULE_CONFIGS.dashboard;
  const IconComponent = config.icon;
  const steps = processInfo.steps || config.defaultSteps;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 select-none"
      >
        {/* Background Ambient Glow */}
        <div className={`absolute w-72 h-72 rounded-full bg-gradient-to-tr ${config.bgGlow} blur-3xl -z-10 animate-pulse`} />

        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
          {/* Top Tagoloan Water District Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-sky-500 text-slate-950 flex items-center justify-center font-bold text-xs italic">
                W
              </div>
              <div>
                <span className="text-[11px] font-bold tracking-wider text-white uppercase block leading-none">
                  Tagoloan Water District
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  Misamis Oriental • Field Terminal
                </span>
              </div>
            </div>

            {/* WebSocket Status Indicator */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${wsStats.status === 'CONNECTED' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span className={wsStats.status === 'CONNECTED' ? 'text-emerald-400' : 'text-amber-400'}>
                WS {wsStats.status === 'CONNECTED' ? `${wsStats.latencyMs}ms` : wsStats.status}
              </span>
            </div>
          </div>

          {/* Module Icon & Pulse Animation */}
          <div className="flex flex-col items-center justify-center text-center space-y-3 pt-2">
            <div className="relative">
              {/* Outer pulsing radar ring */}
              <div className={`absolute inset-0 rounded-2xl bg-current opacity-20 animate-ping ${config.color}`} />
              <div className={`w-16 h-16 rounded-2xl bg-slate-950 border ${config.borderColor} flex items-center justify-center shadow-inner relative z-10 ${config.color}`}>
                <IconComponent className="w-8 h-8 animate-bounce" />
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                {config.category}
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                {processInfo.title || config.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {processInfo.subtitle || `Loading ${config.name}...`}
              </p>
            </div>
          </div>

          {/* Real-time Loading Steps Stream */}
          <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-800/60 pb-1.5">
              <span className="flex items-center gap-1 text-slate-300">
                <Activity className="w-3 h-3 text-sky-400 animate-spin" />
                <span>PROCESS TELEMETRY</span>
              </span>
              <span className="text-sky-400 font-bold">{progress}%</span>
            </div>

            {/* Current Active Step */}
            <div className="min-h-[38px] flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
              </div>
              <span className="text-xs text-slate-200 font-medium leading-tight">
                {steps[currentStepIndex] || 'Finalizing process...'}
              </span>
            </div>

            {/* Shimmering Progress Bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden relative">
              <motion.div
                className="h-full bg-gradient-to-r from-sky-500 via-emerald-400 to-cyan-400 rounded-full"
                initial={{ width: '10%' }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: 'easeOut', duration: 0.15 }}
              />
            </div>
          </div>

          {/* WebSocket Broadcast Telemetry Packet Info */}
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">WS Event:</span>
              <span className="text-emerald-300 font-bold">
                {processInfo.type === 'module_transition' ? 'MODULE_NAVIGATION' : 'PROCESS_EVENT'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <span>Reader:</span>
              <span className="text-white">{currentUser?.name?.split(' ')[0] || 'Field'}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
