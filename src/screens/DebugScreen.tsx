import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Sliders, 
  Wifi, 
  WifiOff, 
  Database, 
  RefreshCw, 
  Trash2, 
  Activity, 
  ShieldCheck, 
  KeyRound,
  Server,
  Zap,
  Radio,
  Send
} from 'lucide-react';
import { SyncState, ActiveScreen } from '../types';
import { SyncService } from '../services/syncService';
import { DatabaseHelper } from '../services/databaseHelper';
import { LoggerService } from '../services/loggerService';
import { WebSocketService, WSTelemetryStats } from '../services/websocketService';
import { getApiEndpoint } from '../services/apiConfig';

interface DebugScreenProps {
  syncState: SyncState;
  onNavigate: (screen: ActiveScreen) => void;
  onResetDatabase: () => void;
  onSyncTrigger: () => void;
}

export const DebugScreen: React.FC<DebugScreenProps> = ({
  syncState,
  onNavigate,
  onResetDatabase,
  onSyncTrigger,
}) => {
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [wsStats, setWsStats] = useState<WSTelemetryStats>(WebSocketService.getStats());
  const [dbStats, setDbStats] = useState({
    consumers: 0,
    readings: 0,
    pending: 0,
    logs: 0,
  });

  const loadDbStats = async () => {
    try {
      const consumers = await DatabaseHelper.getAllConsumers();
      const readings = await DatabaseHelper.getAllReadings();
      const pending = await DatabaseHelper.getPendingReadings();
      const logs = await DatabaseHelper.getAllAuditLogs();
      setDbStats({
        consumers: consumers.length,
        readings: readings.length,
        pending: pending.length,
        logs: logs.length,
      });
    } catch (e) {
      console.error('Error loading DB stats:', e);
    }
  };

  useEffect(() => {
    loadDbStats();
    const unsub = WebSocketService.subscribeStats((stats) => {
      setWsStats(stats);
    });
    return unsub;
  }, []);

  const handlePingServer = async () => {
    setIsPinging(true);
    try {
      const res = await fetch(getApiEndpoint('/api/health'), {
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const text = await res.text();
          let data: any = null;
          try {
            if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
              data = JSON.parse(text.trim());
            }
          } catch {
            data = null;
          }
          setServerHealth(data || { status: 'Online', note: 'Local server responding' });
        } else {
          setServerHealth({ status: 'Online', note: 'Local server responding' });
        }
      } else {
        setServerHealth({ error: `HTTP ${res.status}` });
      }
    } catch {
      setServerHealth({ error: 'Offline / Standalone local mode active' });
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 max-w-4xl mx-auto w-full space-y-4 pb-16">
      {/* Header Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          DIAGNOSTICS & SYSTEM CONFIG
        </span>
      </div>

      <div>
        <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
          <Sliders className="w-5 h-5 text-sky-400" />
          <span>Developer Tools & Diagnostics</span>
        </h2>
        <p className="text-xs text-slate-400">
          Network condition simulator, SQLite local storage manager, and sync engine tuner
        </p>
      </div>

      {/* Network Simulator Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {syncState.isOnline ? (
              <Wifi className="w-5 h-5 text-emerald-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-amber-400" />
            )}
            <div>
              <h3 className="font-bold text-sm text-white">Network Connectivity Simulation</h3>
              <p className="text-xs text-slate-400">
                Test how the meter reader works in remote dead zones in Tagoloan without internet
              </p>
            </div>
          </div>

          <button
            onClick={() => SyncService.setSimulatedOffline(!syncState.isSimulatedOffline)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              syncState.isSimulatedOffline
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {syncState.isSimulatedOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            <span>{syncState.isSimulatedOffline ? 'Simulating OFFLINE' : 'ONLINE Mode'}</span>
          </button>
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono flex items-center justify-between">
          <span>Current Active Status:</span>
          <strong className={syncState.isOnline ? 'text-emerald-400' : 'text-amber-400'}>
            {syncState.isOnline ? 'CONNECTED (Central Sync Ready)' : 'OFFLINE (Local Queue Mode)'}
          </strong>
        </div>
      </div>

      {/* Sync Engine Intervals Config */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">Background Sync Engine Timers</h3>
            <p className="text-xs text-slate-400">
              Set automated background push/pull synchronization intervals
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950 px-2 py-1 rounded border border-sky-800">
            {syncState.autoSyncInterval}s interval
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => SyncService.setAutoSyncInterval(30)}
            className={`p-2.5 rounded-xl text-xs font-bold border transition text-center ${
              syncState.autoSyncInterval === 30
                ? 'bg-sky-950 border-sky-500 text-sky-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
            }`}
          >
            30 Seconds (Default)
          </button>
          <button
            onClick={() => SyncService.setAutoSyncInterval(300)}
            className={`p-2.5 rounded-xl text-xs font-bold border transition text-center ${
              syncState.autoSyncInterval === 300
                ? 'bg-sky-950 border-sky-500 text-sky-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
            }`}
          >
            5 Minutes (Battery Saver)
          </button>
          <button
            onClick={() => SyncService.setAutoSyncInterval(60)}
            className={`p-2.5 rounded-xl text-xs font-bold border transition text-center ${
              syncState.autoSyncInterval === 60
                ? 'bg-sky-950 border-sky-500 text-sky-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
            }`}
          >
            1 Minute
          </button>
        </div>
      </div>

      {/* Local SQLite / IndexedDB Database Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-sm text-white">Local Database Vault Statistics</h3>
          </div>
          <button
            onClick={loadDbStats}
            className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
          >
            Refresh Stats
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Cached Consumers</span>
            <span className="text-base font-black text-white font-mono">{dbStats.consumers}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Recorded Readings</span>
            <span className="text-base font-black text-white font-mono">{dbStats.readings}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Pending Upload</span>
            <span className="text-base font-black text-amber-400 font-mono">{dbStats.pending}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Audit Trail Logs</span>
            <span className="text-base font-black text-sky-400 font-mono">{dbStats.logs}</span>
          </div>
        </div>

        {/* Database Sync / Clear Actions */}
        <div className="pt-2 flex items-center gap-2">
          <button
            onClick={async () => {
              if (window.confirm('Reload consumer records from Central Server database?')) {
                await onResetDatabase();
                await loadDbStats();
                alert('Database synchronized successfully from server!');
              }
            }}
            className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync from Central Server</span>
          </button>

          <button
            onClick={async () => {
              if (window.confirm('WARNING: Clear ALL local readings and cache?')) {
                await DatabaseHelper.clearAllData();
                await loadDbStats();
                alert('Local vault cleared.');
              }
            }}
            className="px-3 py-2 bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Vault</span>
          </button>
        </div>
      </div>

      {/* Real-Time WebSocket Diagnostics Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-sky-400 animate-pulse" />
            <div>
              <h3 className="font-bold text-sm text-white">WebSocket Real-Time Broadcast Node</h3>
              <p className="text-xs text-slate-400">Tagoloan District Central Gateway telemetry</p>
            </div>
          </div>

          <button
            onClick={() => WebSocketService.ping()}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Ping WebSocket</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Status</span>
            <span className={`text-sm font-black font-mono ${wsStats.status === 'CONNECTED' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {wsStats.status}
            </span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Round-Trip Latency</span>
            <span className="text-sm font-black text-sky-400 font-mono">{wsStats.latencyMs} ms</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Packets Sent (TX)</span>
            <span className="text-sm font-black text-purple-400 font-mono">{wsStats.messagesSent}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Packets Recv (RX)</span>
            <span className="text-sm font-black text-emerald-400 font-mono">{wsStats.messagesReceived}</span>
          </div>
        </div>

        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <span>Server Node: <strong className="text-slate-200">{wsStats.serverNode}</strong></span>
          <span>Last Event: <strong className="text-sky-300">{wsStats.lastEventType || 'None'}</strong></span>
        </div>
      </div>

      {/* Central Server Health Ping */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Central Billing Server Connection</h3>
          </div>

          <button
            onClick={handlePingServer}
            disabled={isPinging}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
          >
            <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Pinging...' : 'Ping /api/health'}</span>
          </button>
        </div>

        {serverHealth && (
          <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
            {JSON.stringify(serverHealth, null, 2)}
          </pre>
        )}

        <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
          <span className="text-xs text-slate-400">Configure District Server & Flutter Build:</span>
          <button
            onClick={() => onNavigate('flutter_config')}
            className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Flutter & District Config →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
