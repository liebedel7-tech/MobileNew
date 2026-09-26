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
  Send,
  Smartphone,
  CheckCircle2,
  Download,
  RotateCcw,
  Users,
  AlertCircle,
  FileText,
  Clock,
  Terminal
} from 'lucide-react';
import { SyncState, ActiveScreen } from '../types';
import { SyncService } from '../services/syncService';
import { DatabaseHelper } from '../services/databaseHelper';
import { LoggerService } from '../services/loggerService';
import { WebSocketService, WSTelemetryStats } from '../services/websocketService';
import { 
  universalApiFetch, 
  getApiEndpoint, 
  getApiLogs, 
  getApiStats, 
  clearApiLogs, 
  subscribeApiLogs, 
  ApiLogEntry 
} from '../services/apiConfig';
import { useDeviceInstallStatus } from '../services/installService';

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
  const { isInstalled, markAsInstalled, resetInstallStatus } = useDeviceInstallStatus();
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [wsTelemetryHealth, setWsTelemetryHealth] = useState<any>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [wsStats, setWsStats] = useState<WSTelemetryStats>(WebSocketService.getStats());
  const [showWsLogs, setShowWsLogs] = useState(false);
  const [wsLogs, setWsLogs] = useState<string[]>(WebSocketService.getConnectionLogs());
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>(getApiLogs());
  const [apiFilter, setApiFilter] = useState<'all' | 'errors'>('all');
  const [apiStats, setApiStats] = useState(getApiStats());

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
    const unsubWs = WebSocketService.subscribeStats((stats) => {
      setWsStats(stats);
      setWsLogs(WebSocketService.getConnectionLogs());
    });

    const unsubApi = subscribeApiLogs((logs) => {
      setApiLogs(logs);
      setApiStats(getApiStats());
    });

    return () => {
      unsubWs();
      unsubApi();
    };
  }, []);

  const handlePingServer = async () => {
    setIsPinging(true);
    try {
      const res = await universalApiFetch('/api/health', {
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

  const handlePingWsEndpoint = async () => {
    try {
      const res = await universalApiFetch('/api/ws/status', {
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setWsTelemetryHealth(data);
      } else {
        setWsTelemetryHealth({ error: `HTTP ${res.status}` });
      }
    } catch (err: any) {
      setWsTelemetryHealth({ error: err?.message || 'Failed to ping WS status endpoint' });
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

      {/* Meter Readers Management Quick-Access */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Meter Readers & Route Assignment</h3>
            <p className="text-xs text-slate-400">
              Manage field reader accounts, approvals, and assigned coverage areas
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('meter_readers')}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shrink-0 cursor-pointer shadow-sm active:scale-95"
        >
          Open Readers
        </button>
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
            <Radio className={`w-5 h-5 ${wsStats.status === 'CONNECTED' ? 'text-emerald-400 animate-pulse' : wsStats.status === 'RECONNECTING' ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">WebSocket Real-Time Broadcast Node</h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  wsStats.status === 'CONNECTED'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                    : wsStats.status === 'RECONNECTING'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/60 animate-pulse'
                    : wsStats.status === 'CONNECTING'
                    ? 'bg-sky-950/80 text-sky-300 border-sky-700/60'
                    : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                }`}>
                  {wsStats.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">Tagoloan District Central Gateway telemetry & backoff reconnection</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => WebSocketService.forceReconnect()}
              className="px-2.5 py-1.5 bg-amber-600/90 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              title="Initiate immediate exponential backoff reconnect"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconnect Now</span>
            </button>

            <button
              onClick={() => WebSocketService.ping()}
              className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Ping</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Latency (RTT)</span>
            <span className="text-sm font-black text-sky-400 font-mono">{wsStats.latencyMs} ms</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Retry Attempts</span>
            <span className={`text-sm font-black font-mono ${wsStats.reconnectAttempts > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {wsStats.reconnectAttempts}
            </span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Buffered TX Queue</span>
            <span className={`text-sm font-black font-mono ${wsStats.bufferedMessagesCount > 0 ? 'text-amber-400' : 'text-purple-400'}`}>
              {wsStats.bufferedMessagesCount} pkts
            </span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Packets Recv (RX)</span>
            <span className="text-sm font-black text-emerald-400 font-mono">{wsStats.messagesReceived}</span>
          </div>
        </div>

        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>Server Node: <strong className="text-slate-200">{wsStats.serverNode}</strong></span>
          {wsStats.nextReconnectDelayMs && (
            <span className="text-amber-400 font-semibold">
              Retrying in {(wsStats.nextReconnectDelayMs / 1000).toFixed(1)}s
            </span>
          )}
          <span>Last Event: <strong className="text-sky-300">{wsStats.lastEventType || 'None'}</strong></span>
        </div>

        {/* WebSocket Connection Log Drawer */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <button
              onClick={() => setShowWsLogs(!showWsLogs)}
              className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{showWsLogs ? 'Hide WebSocket Connection Logs' : 'View WebSocket Connection Logs (Diagnostics)'}</span>
            </button>
            {showWsLogs && (
              <button
                onClick={() => {
                  WebSocketService.clearConnectionLogs();
                  setWsLogs([]);
                }}
                className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Clear Log History
              </button>
            )}
          </div>

          {showWsLogs && (
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 max-h-44 overflow-y-auto space-y-1 font-mono text-[10px]">
              {wsLogs.length === 0 ? (
                <p className="text-slate-500 italic">No WebSocket connection logs recorded yet.</p>
              ) : (
                wsLogs.map((logLine, idx) => (
                  <div 
                    key={idx} 
                    className={`leading-relaxed ${
                      logLine.includes('error') || logLine.includes('Failed')
                        ? 'text-rose-400'
                        : logLine.includes('warn') || logLine.includes('closed') || logLine.includes('Scheduling')
                        ? 'text-amber-300'
                        : logLine.includes('established') || logLine.includes('Handshake')
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {logLine}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* API Client Layer Telemetry & Error Logging Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm text-white">API Client Layer Diagnostics & Telemetry</h3>
              <p className="text-xs text-slate-400">Request tracing, failover metrics, and error logging</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePingServer}
              disabled={isPinging}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
              <span>Ping /api/health</span>
            </button>
            <button
              onClick={handlePingWsEndpoint}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer border border-slate-700"
            >
              <span>Ping /api/ws/status</span>
            </button>
          </div>
        </div>

        {/* API Statistics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Calls</span>
            <span className="text-sm font-black text-white font-mono">{apiStats.total}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Successful</span>
            <span className="text-sm font-black text-emerald-400 font-mono">{apiStats.success}</span>
          </div>
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Errors (4xx/5xx)</span>
            <span className={`text-sm font-black font-mono ${apiStats.errors > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {apiStats.errors}
            </span>
          </div>
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Offline Fallbacks</span>
            <span className={`text-sm font-black font-mono ${apiStats.fallbacks > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {apiStats.fallbacks}
            </span>
          </div>
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Avg Latency</span>
            <span className="text-sm font-black text-sky-400 font-mono">{apiStats.avgLatencyMs} ms</span>
          </div>
        </div>

        {serverHealth && (
          <pre className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
            {JSON.stringify(serverHealth, null, 2)}
          </pre>
        )}

        {wsTelemetryHealth && (
          <pre className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-sky-300 overflow-x-auto">
            {JSON.stringify(wsTelemetryHealth, null, 2)}
          </pre>
        )}

        {/* API Logs Filter & List */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setApiFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  apiFilter === 'all'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                All Requests ({apiLogs.length})
              </button>
              <button
                onClick={() => setApiFilter('errors')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  apiFilter === 'errors'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Errors Only ({apiLogs.filter((l) => !l.success).length})
              </button>
            </div>

            <button
              onClick={() => clearApiLogs()}
              className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Clear API Logs
            </button>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 max-h-56 overflow-y-auto divide-y divide-slate-800/60 font-mono text-xs">
            {apiLogs
              .filter((log) => apiFilter === 'all' || !log.success)
              .slice(0, 50)
              .map((log) => (
                <div key={log.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-900/60 transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                        log.method === 'GET'
                          ? 'bg-sky-950 text-sky-400 border border-sky-800'
                          : log.method === 'POST'
                          ? 'bg-purple-950 text-purple-400 border border-purple-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {log.method}
                    </span>

                    <span className="text-slate-200 text-xs font-semibold truncate">
                      {log.endpoint}
                    </span>

                    {log.isOfflineFallback && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-950/80 text-amber-300 border border-amber-800 shrink-0">
                        OFFLINE SYNTHETIC
                      </span>
                    )}

                    {log.error && (
                      <span className="text-rose-400 text-[10px] truncate max-w-[200px]" title={log.error}>
                        {log.error}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <span
                      className={`text-[11px] font-bold ${
                        log.status && log.status < 400
                          ? 'text-emerald-400'
                          : log.status && log.status < 500
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {log.status || 'ERR'}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {log.durationMs}ms
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      {log.timestamp}
                    </span>
                  </div>
                </div>
              ))}

            {apiLogs.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-xs italic">
                No API requests recorded yet.
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
          <span className="text-xs text-slate-400">Configure District Server & Flutter Build:</span>
          <button
            onClick={() => onNavigate('flutter_config')}
            className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Flutter & District Config →</span>
          </button>
        </div>
      </div>

      {/* Device & PWA/APK Installation Status Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Device Application Installation State</h3>
              <p className="text-xs text-slate-400">PWA standalone mode and native device package detector</p>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
            isInstalled 
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
              : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
          }`}>
            {isInstalled ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Installed on Device</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Web Browser Mode</span>
              </>
            )}
          </span>
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
          <div className="flex justify-between items-center text-slate-300">
            <span>Install Button Visibility:</span>
            <strong className={isInstalled ? 'text-rose-400' : 'text-emerald-400'}>
              {isInstalled ? 'Hidden (App is already downloaded)' : 'Visible ("Install this on your device")'}
            </strong>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Detected Display Mode:</span>
            <span className="font-mono text-slate-400">
              {typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
          {isInstalled ? (
            <button
              onClick={() => {
                resetInstallStatus();
                alert('Device installation status reset. "Install on Device" buttons will now be visible.');
              }}
              className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Status (Show Install Buttons)</span>
            </button>
          ) : (
            <button
              onClick={() => {
                markAsInstalled();
                alert('Marked as installed on this device! "Install on Device" buttons will now be hidden.');
              }}
              className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Simulate Installed State (Hide Install Buttons)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
