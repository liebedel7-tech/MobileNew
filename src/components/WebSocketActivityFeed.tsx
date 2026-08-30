import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  Wifi, 
  WifiOff, 
  Activity, 
  ChevronUp, 
  ChevronDown, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  ArrowUpRight,
  ShieldCheck,
  X
} from 'lucide-react';
import { WebSocketService, WSTelemetryStats, WSEventPacket } from '../services/websocketService';

export const WebSocketActivityFeed: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<WSTelemetryStats>(WebSocketService.getStats());
  const [recentEvents, setRecentEvents] = useState<WSEventPacket[]>(WebSocketService.getRecentEvents());
  const [latestToast, setLatestToast] = useState<{ id: number; text: string; type: string } | null>(null);

  useEffect(() => {
    const unsubStats = WebSocketService.subscribeStats((newStats) => {
      setStats(newStats);
    });

    const unsubEvents = WebSocketService.subscribe((packet) => {
      setRecentEvents(WebSocketService.getRecentEvents());
      
      // Generate readable toast message for incoming / outgoing activities
      let text = `Packet: ${packet.type}`;
      if (packet.type === 'MODULE_NAVIGATION' || packet.type === 'MODULE_NAVIGATION_BROADCAST') {
        const to = packet.payload?.toModule || 'module';
        const reader = packet.payload?.readerName || 'Reader';
        text = `📡 ${reader} opened ${to.replace('_', ' ').toUpperCase()}`;
      } else if (packet.type === 'PROCESS_EVENT' || packet.type === 'PROCESS_TELEMETRY_UPDATE') {
        text = `⚡ Process [${packet.payload?.processName}]: ${packet.payload?.status}`;
      } else if (packet.type === 'LIVE_READING_UPDATE' || packet.type === 'FIELD_READING_RECORDED') {
        text = `📝 New reading: ${packet.payload?.consumerName || packet.payload?.accountNumber} (₱${packet.payload?.totalAmount?.toFixed(2) || '0.00'})`;
      } else if (packet.type === 'BATCH_SYNC_PROCESSED') {
        text = `✅ Batch sync processed (${packet.payload?.processedCount || 0} readings)`;
      } else if (packet.type === 'CONNECTION_ESTABLISHED') {
        text = `🟢 Connected to Tagoloan District Central Billing Node`;
      } else if (packet.type === 'STAFF_ACTIVITY_STREAM') {
        text = `👤 Staff: ${packet.payload?.readerName} (${packet.payload?.action})`;
      }

      const toastId = Date.now();
      setLatestToast({ id: toastId, text, type: packet.type });
      setTimeout(() => {
        setLatestToast((prev: { id: number; text: string; type: string } | null) => (prev?.id === toastId ? null : prev));
      }, 4000);
    });

    return () => {
      unsubStats();
      unsubEvents();
    };
  }, []);

  const handleManualPing = () => {
    WebSocketService.ping();
  };

  return (
    <>
      {/* Floating Live Event Toast (Brief Notification of Real-Time Activity) */}
      <AnimatePresence>
        {latestToast && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-20 left-4 right-4 z-40 max-w-sm mx-auto pointer-events-auto"
          >
            <div 
              onClick={() => setIsOpen(true)}
              className="bg-slate-900/95 border border-sky-500/40 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-850 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <p className="text-[11px] text-slate-200 font-mono truncate font-medium">
                  {latestToast.text}
                </p>
              </div>
              <span className="text-[9px] bg-sky-950 text-sky-300 font-mono px-1.5 py-0.5 rounded border border-sky-800 shrink-0">
                WS LIVE
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Real-Time WebSocket Telemetry Drawer Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3"
          >
            <motion.div
              initial={{ y: 50, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 50, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/40">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">WebSocket Telemetry Node</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Tagoloan District Central Gateway</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualPing}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Send Ping Test"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                  <div className="text-[9px] text-slate-400 font-mono uppercase">Status</div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1 mt-0.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {stats.status}
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                  <div className="text-[9px] text-slate-400 font-mono uppercase">Latency</div>
                  <div className="text-xs font-bold text-sky-400 mt-0.5 font-mono">
                    {stats.latencyMs} ms
                  </div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                  <div className="text-[9px] text-slate-400 font-mono uppercase">Active Peers</div>
                  <div className="text-xs font-bold text-purple-400 mt-0.5 font-mono">
                    {stats.activePeers} Node{stats.activePeers > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Packet Counters */}
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] font-mono shrink-0">
                <span className="text-slate-400">Packets TX/RX:</span>
                <span className="text-slate-200">
                  <span className="text-emerald-400 font-bold">{stats.messagesSent} TX</span> / <span className="text-sky-400 font-bold">{stats.messagesReceived} RX</span>
                </span>
              </div>

              {/* Recent WebSocket Events Stream */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[140px]">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Live Event Packet Stream ({recentEvents.length})
                </div>

                {recentEvents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 font-mono">
                    Listening for WebSocket events...
                  </div>
                ) : (
                  recentEvents.map((evt: WSEventPacket, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-[10px] font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sky-400 font-bold flex items-center gap-1">
                          <Activity className="w-2.5 h-2.5" />
                          {evt.type}
                        </span>
                        <span className="text-slate-500">
                          {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-slate-300 truncate text-[9px] bg-slate-900 p-1 rounded">
                        {JSON.stringify(evt.payload)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer info */}
              <div className="text-[10px] text-slate-500 font-mono text-center pt-2 border-t border-slate-800 shrink-0">
                Tagoloan Water District • WebSocket Server v2.4
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
