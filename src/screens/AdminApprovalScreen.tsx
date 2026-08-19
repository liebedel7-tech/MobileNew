import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Smartphone,
  ShieldCheck,
  FileText,
  AlertTriangle,
  RefreshCw,
  Search,
  Database,
  ArrowRight,
  Send,
  Zap,
  DollarSign,
  Receipt,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { StaffUser, ReaderAccount, MeterReading } from '../types';
import { WebSocketService } from '../services/websocketService';

interface AdminApprovalScreenProps {
  currentUser: StaffUser;
  onNavigateToScreen: (screen: any) => void;
}

export const AdminApprovalScreen: React.FC<AdminApprovalScreenProps> = ({
  currentUser,
  onNavigateToScreen,
}) => {
  const [activeTab, setActiveTab] = useState<'READERS' | 'READINGS' | 'FIRESTORE'>('READERS');
  const [readers, setReaders] = useState<ReaderAccount[]>([]);
  const [pendingReadings, setPendingReadings] = useState<MeterReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRouteForReader, setSelectedRouteForReader] = useState<Record<string, string[]>>({});

  const availableRoutes = [
    'Poblacion',
    'Baluarte',
    'Casinglot',
    'Mohon',
    'Natumolan',
    'Sta. Cruz',
    'Sta. Ana',
    'Sugbongcogon',
    'Gracia',
  ];

  // Fetch all readers and pending readings
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Readers
      const readersRes = await fetch('/api/readers');
      if (readersRes.ok) {
        const data = await readersRes.json();
        if (data.readers) {
          setReaders(data.readers);
          const routeMap: Record<string, string[]> = {};
          data.readers.forEach((r: ReaderAccount) => {
            routeMap[r.id] = r.assignedRoutes || ['Poblacion'];
          });
          setSelectedRouteForReader(routeMap);
        }
      }

      // 2. Fetch Pending Readings
      const readingsRes = await fetch('/api/readings/history');
      if (readingsRes.ok) {
        const rData = await readingsRes.json();
        if (rData.readings) {
          setPendingReadings(rData.readings);
        }
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen for incoming reader registrations or batch submissions via WebSocket
    const unsubscribe = WebSocketService.subscribe((msg) => {
      if (msg.type === 'READER_REGISTERED_PENDING' || msg.type === 'BATCH_SYNC_PROCESSED') {
        fetchData();
        setActionMessage(`⚡ Real-time update: ${msg.type.replace(/_/g, ' ')}`);
        setTimeout(() => setActionMessage(null), 4000);
      }
    });

    return unsubscribe;
  }, []);

  // Admin approves reader
  const handleApproveReader = async (reader: ReaderAccount) => {
    const assigned = selectedRouteForReader[reader.id] || reader.assignedRoutes || ['Poblacion'];

    try {
      const res = await fetch(`/api/readers/${reader.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedRoutes: assigned,
          approvedBy: currentUser.name || 'Admin Supervisor',
        }),
      });

      if (res.ok) {
        setActionMessage(`✅ Meter Reader ${reader.name} is now ACTIVE! Assigned: ${assigned.join(', ')}`);
        fetchData();
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      console.error('Approval failed:', err);
    }
  };

  // Admin rejects reader
  const handleRejectReader = async (reader: ReaderAccount) => {
    try {
      const res = await fetch(`/api/readers/${reader.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        setActionMessage(`Reader ${reader.name} set to REJECTED.`);
        fetchData();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      console.error('Rejection failed:', err);
    }
  };

  // Admin approves reading and publishes bill
  const handleApproveReading = async (reading: MeterReading) => {
    try {
      const res = await fetch(`/api/readings/${reading.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: currentUser.name }),
      });

      if (res.ok) {
        setActionMessage(`✅ Reading for Acc #${reading.accountNumber} APPROVED & Bill Published to Consumer Portal.`);
        fetchData();
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      console.error('Reading approval failed:', err);
    }
  };

  // Toggle route selection for a reader
  const toggleRoute = (readerId: string, route: string) => {
    const current = selectedRouteForReader[readerId] || [];
    let updated: string[];
    if (current.includes(route)) {
      updated = current.filter((r) => r !== route);
      if (updated.length === 0) updated = ['Poblacion']; // keep at least one
    } else {
      updated = [...current, route];
    }
    setSelectedRouteForReader({
      ...selectedRouteForReader,
      [readerId]: updated,
    });
  };

  const pendingReaders = readers.filter((r) => r.status === 'pending');
  const activeReaders = readers.filter((r) => r.status === 'active');

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-950 border border-sky-700/60 rounded-xl flex items-center justify-center text-sky-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white uppercase tracking-tight">
                  Admin & Supervisor Desk
                </h1>
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                  Central Web System
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Reader Onboarding • Route Dispatching • Reading Validation • Cloud Firestore Sync
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold self-start sm:self-auto cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* Global Action Message Banner */}
        {actionMessage && (
          <div className="mt-3 p-2.5 bg-sky-950 border border-sky-700 rounded-xl text-xs text-sky-200 flex items-center justify-between animate-fadeIn">
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mt-4">
          <button
            type="button"
            onClick={() => setActiveTab('READERS')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'READERS'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Reader Registrations</span>
            {pendingReaders.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-black text-[10px] font-black rounded-full">
                {pendingReaders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('READINGS')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'READINGS'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Reading Approvals</span>
            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 text-[10px] font-mono rounded">
              {pendingReadings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FIRESTORE')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'FIRESTORE'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Firestore Architecture</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: READER REGISTRATIONS ================= */}
      {activeTab === 'READERS' && (
        <div className="space-y-4">
          {/* Pending Approval Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Pending Admin Approval & Route Assignment ({pendingReaders.length})</span>
              </h2>
            </div>

            {pendingReaders.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400">
                No pending meter reader registrations. When a reader signs up on the mobile app, their profile appears here for route assignment.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {pendingReaders.map((reader) => (
                  <div
                    key={reader.id}
                    className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 shadow-lg space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-white">{reader.name}</h3>
                          <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[10px] font-bold uppercase">
                            Pending Review
                          </span>
                        </div>
                        <p className="text-xs text-sky-400 font-mono mt-0.5">
                          Employee ID: <span className="text-white">{reader.employeeId}</span> • Username: <span className="text-white">@{reader.username}</span>
                        </p>
                      </div>

                      <div className="text-right text-[11px] text-slate-400 font-mono">
                        Registered: {new Date(reader.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                        <span>Device: <span className="text-white">{reader.deviceInfo || 'Android Field Device'}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>Contact: <span className="text-white">{reader.contactNumber || 'N/A'}</span></span>
                      </div>
                    </div>

                    {/* Route Assignment Checkboxes */}
                    <div>
                      <label className="block text-[11px] font-bold text-sky-300 uppercase tracking-wider mb-1.5">
                        Assign Target Routes / Barangays (Consumers in these routes will sync to this mobile terminal):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableRoutes.map((route) => {
                          const isAssigned = (selectedRouteForReader[reader.id] || []).includes(route);
                          return (
                            <button
                              key={route}
                              type="button"
                              onClick={() => toggleRoute(reader.id, route)}
                              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition border cursor-pointer ${
                                isAssigned
                                  ? 'bg-sky-600 text-white border-sky-400 shadow-sm'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {isAssigned ? '✓ ' : '+ '}
                              {route}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleRejectReader(reader)}
                        className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Decline
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApproveReader(reader)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve & Assign Routes</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Field Readers Section */}
          <div className="pt-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Active Field Meter Readers ({activeReaders.length})</span>
            </h2>

            <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800 overflow-hidden">
              {activeReaders.map((reader) => (
                <div key={reader.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-white">{reader.name}</h3>
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[9px] font-mono font-bold uppercase">
                        Active Terminal
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Employee ID: <span className="text-sky-400 font-mono">{reader.employeeId}</span> • Routes: <span className="text-white font-medium">{reader.assignedRoutes.join(', ')}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Approved by {reader.approvedBy || 'Admin'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: READING APPROVALS ================= */}
      {activeTab === 'READINGS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>Field Meter Readings Verification Queue ({pendingReadings.length})</span>
            </h2>
          </div>

          {pendingReadings.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400 space-y-2">
              <p>No meter readings submitted yet this cycle.</p>
              <p className="text-[11px] text-slate-500">
                When meter readers scan tags and submit readings from the mobile app, they stream here for billing verification.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReadings.map((reading) => {
                const isApproved = reading.approvalStatus === 'approved' || reading.status === 'SYNCED';
                return (
                  <div
                    key={reading.id}
                    className={`bg-slate-900 border rounded-2xl p-4 shadow-md space-y-3 ${
                      isApproved ? 'border-slate-800' : 'border-sky-500/60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-sky-400 font-mono">
                            Acc #{reading.accountNumber}
                          </span>
                          <span className="text-xs font-bold text-white">
                            {reading.consumerName}
                          </span>
                          {reading.isAnomaly && (
                            <span className="px-1.5 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 rounded text-[9px] font-bold">
                              Spike Alert
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Barangay: <span className="text-white">{reading.barangay}</span> • Reader: <span className="text-white">{reading.readerName || 'Staff'}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            isApproved
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-sky-950 text-sky-400 border border-sky-800'
                          }`}
                        >
                          {isApproved ? 'Approved & Billed' : 'Pending Approval'}
                        </span>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500">Previous Reading</div>
                        <div className="font-mono text-slate-300 font-semibold">{reading.previousReading} m³</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Current Reading</div>
                        <div className="font-mono text-sky-400 font-bold">{reading.currentReading} m³</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Consumption</div>
                        <div className="font-mono text-emerald-400 font-bold">+{reading.consumption} m³</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Calculated Bill</div>
                        <div className="font-mono text-amber-400 font-bold">
                          ₱{reading.billCalculation?.totalAmountDue?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px] text-slate-500 font-mono">
                        Logged: {new Date(reading.readingDate || Date.now()).toLocaleDateString()} {reading.readingTime || ''}
                      </div>

                      {!isApproved && (
                        <button
                          type="button"
                          onClick={() => handleApproveReading(reading)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Issue Bill</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: CLOUD FIRESTORE ARCHITECTURE ================= */}
      {activeTab === 'FIRESTORE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-sky-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Cloud Firestore End-to-End Integration Map
              </h2>
            </div>
            <span className="text-[10px] font-mono text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
              Project ID: ai-studio-tagoloanwaterdis
            </span>
          </div>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>1. Readers Collection (Firestore: /readers)</span>
              </h3>
              <p className="text-slate-400 text-[11px]">
                Mobile registers reader document with <code className="text-amber-400">status: 'pending'</code>. Web admin sets <code className="text-emerald-400">status: 'active'</code> and assigns <code className="text-sky-400">assignedRoutes: ['Poblacion', ...]</code>.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>2. Consumers Sync (Firestore: /consumers)</span>
              </h3>
              <p className="text-slate-400 text-[11px]">
                When mobile app unlocks, it queries <code className="text-sky-400">where('routeCode', 'in', reader.assignedRoutes)</code> and syncs locally into offline SQLite. When scanning Meter Tag Number (e.g. <code className="text-amber-400">MT-4401</code>), it matches immediately.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span>3. Readings Queue (Firestore: /readings)</span>
              </h3>
              <p className="text-slate-400 text-[11px]">
                Mobile submits readings with <code className="text-amber-400">approvalStatus: 'pending_approval'</code>. Admin clicks "Approve & Issue Bill", setting <code className="text-emerald-400">approvalStatus: 'approved'</code> and writing billing statements for the Consumer Portal.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
