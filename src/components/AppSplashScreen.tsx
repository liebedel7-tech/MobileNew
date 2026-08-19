import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Droplet, ShieldCheck, Wifi, Database, CheckCircle2, Sparkles } from 'lucide-react';
import { WSConnectionStatus } from '../services/websocketService';

interface AppSplashScreenProps {
  wsStatus: WSConnectionStatus;
  onFinishLoading: () => void;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({
  wsStatus,
  onFinishLoading,
}) => {
  const [loadStep, setLoadStep] = useState<number>(1);
  const [loadText, setLoadText] = useState<string>('Initializing Flutter Mobile Engine...');

  useEffect(() => {
    const t1 = setTimeout(() => {
      setLoadStep(2);
      setLoadText('Mounting Offline SQLite Database Vault...');
    }, 450);

    const t2 = setTimeout(() => {
      setLoadStep(3);
      setLoadText('Establishing Real-Time Central WebSocket Channel...');
    }, 900);

    const t3 = setTimeout(() => {
      setLoadStep(4);
      setLoadText('Ready! Tagoloan Field System Active.');
    }, 1350);

    const t4 = setTimeout(() => {
      onFinishLoading();
    }, 1650);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onFinishLoading]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between p-6 select-none"
    >
      {/* Top Status Bar Placeholder */}
      <div className="w-full flex justify-between items-center text-[10px] text-slate-500 font-mono">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
          <span>LWUA WDT SECURE CONTAINER</span>
        </span>
        <span>v2.4.0 APK</span>
      </div>

      {/* Center Emblem */}
      <div className="flex flex-col items-center text-center space-y-4 max-w-xs">
        <motion.div
          initial={{ scale: 0.8, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.5, type: 'spring', damping: 14 }}
          className="relative"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-sky-600 via-blue-700 to-indigo-900 p-0.5 shadow-2xl shadow-sky-600/40 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center border border-sky-400/30 relative overflow-hidden">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                <Droplet className="w-12 h-12 text-sky-400 fill-sky-400/20" />
              </motion.div>
              <div className="absolute inset-0 bg-gradient-to-t from-sky-500/10 to-transparent pointer-events-none" />
            </div>
          </div>
        </motion.div>

        <div className="space-y-1">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl font-black tracking-tight text-white uppercase"
          >
            Tagoloan Water District
          </motion.h1>
          <p className="text-xs text-sky-400 font-semibold tracking-wide uppercase">
            Field Meter Reading & Billing
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            Province of Misamis Oriental
          </p>
        </div>

        {/* Progress Bar & Status */}
        <div className="w-full space-y-2.5 pt-2">
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <motion.div
              initial={{ width: '10%' }}
              animate={{ width: `${loadStep * 25}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full"
            />
          </div>

          <div className="text-[11px] text-slate-300 font-mono flex items-center justify-center gap-1.5 h-5">
            {loadStep === 4 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full"
              />
            )}
            <span>{loadText}</span>
          </div>
        </div>
      </div>

      {/* Bottom Hardware Handshake Indicators */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-sm text-[10px] text-slate-400 font-mono">
        <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl flex items-center gap-1.5 justify-center">
          <Database className="w-3 h-3 text-sky-400" />
          <span>SQLite OK</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl flex items-center gap-1.5 justify-center">
          <Wifi className={`w-3 h-3 ${wsStatus === 'CONNECTED' ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>WS {wsStatus}</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl flex items-center gap-1.5 justify-center">
          <Sparkles className="w-3 h-3 text-sky-400" />
          <span>Flutter UI</span>
        </div>
      </div>
    </motion.div>
  );
};
