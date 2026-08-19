import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ClipboardList, 
  ShieldCheck, 
  Download, 
  Search, 
  Clock, 
  User,
  Filter
} from 'lucide-react';
import { AuditLog, ActiveScreen } from '../types';

interface AuditLogScreenProps {
  logs: AuditLog[];
  onNavigate: (screen: ActiveScreen) => void;
}

export const AuditLogScreen: React.FC<AuditLogScreenProps> = ({ logs, onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.userId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `wdt_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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

        <button
          onClick={handleExportLogs}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span>Export Logs</span>
        </button>
      </div>

      <div>
        <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-400" />
          <span>System Audit Trail & Accountability</span>
        </h2>
        <p className="text-xs text-slate-400">
          Permanent log of field entries, sync operations, security events, and reader transactions
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter audit events by action code, reader name, or details..."
          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
        />
      </div>

      {/* Audit Log Timeline Entries */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
            No audit records matching search.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 space-y-1 shadow-sm font-sans"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                  {log.action}
                </span>
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>

              <p className="text-xs text-slate-200 font-medium">{log.details}</p>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/60">
                <span className="flex items-center gap-1 text-slate-400">
                  <User className="w-3 h-3 text-sky-400" />
                  {log.userName} ({log.userId})
                </span>
                <span>Ref: {log.id}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
