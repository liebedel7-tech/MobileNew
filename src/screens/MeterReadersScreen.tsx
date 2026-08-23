import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Plus, 
  Smartphone, 
  ShieldCheck, 
  MapPin, 
  ArrowLeft, 
  Check, 
  Sparkles,
  Phone,
  Mail,
  Calendar,
  Send,
  Sliders,
  LogIn
} from 'lucide-react';
import { ReaderAccount, ActiveScreen, StaffUser, ReaderStatus } from '../types';
import { DatabaseHelper } from '../services/databaseHelper';
import { SyncService } from '../services/syncService';
import { WebSocketService } from '../services/websocketService';
import { universalApiFetch } from '../services/apiConfig';
import { LoggerService } from '../services/loggerService';

interface MeterReadersScreenProps {
  currentUser: StaffUser | null;
  onNavigate: (screen: ActiveScreen) => void;
  onSwitchUser?: (user: StaffUser) => void;
}

const AVAILABLE_ROUTES = [
  'Poblacion',
  'Natumolan',
  'Baluarte',
  'Casinglot',
  'Sta. Ana',
  'Rosario',
  'Sta. Cruz',
  'Mohon',
  'Sugbongcogon',
];

export const MeterReadersScreen: React.FC<MeterReadersScreenProps> = ({
  currentUser,
  onNavigate,
  onSwitchUser,
}) => {
  const [readers, setReaders] = useState<ReaderAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'pending' | 'active' | 'rejected'>('ALL');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State for New Reader Creation
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('1234');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRoutes, setNewRoutes] = useState<string[]>(['Poblacion']);

  // Modal State for Custom Route Assignment / Approval
  const [selectedReaderForEdit, setSelectedReaderForEdit] = useState<ReaderAccount | null>(null);
  const [editRoutes, setEditRoutes] = useState<string[]>([]);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<boolean>(false);

  // Load and sync readers from both local DB and central API
  const loadAndSyncReaders = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setIsSyncing(true);

    try {
      // 1. Get from local DB first
      const local = await DatabaseHelper.getLocalReaders();
      
      // 2. Fetch/Sync with Central API
      try {
        const res = await universalApiFetch('/api/readers', {
          headers: { 'Accept': 'application/json' },
        });

        if (res.ok) {
          const text = await res.text();
          if (text) {
            const data = JSON.parse(text);
            const serverList: ReaderAccount[] = data.readers || data.staff || data.data || [];
            
            // Merge unique readers
            const map = new Map<string, ReaderAccount>();
            local.forEach(r => map.set((r.username || r.id).toLowerCase(), r));
            serverList.forEach(r => map.set((r.username || r.id).toLowerCase(), r));

            const merged = Array.from(map.values());
            // Sort: pending first, then by creation date / name
            merged.sort((a, b) => {
              if (a.status === 'pending' && b.status !== 'pending') return -1;
              if (b.status === 'pending' && a.status !== 'pending') return 1;
              return (b.createdAt || '').localeCompare(a.createdAt || '');
            });

            setReaders(merged);
            // Cache back to local DB
            for (const r of merged) {
              await DatabaseHelper.saveLocalReader(r);
            }
            setIsSyncing(false);
            if (showLoading) setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to local
      }

      // If network fails, use local
      setReaders(local);
    } catch (err: any) {
      console.warn('Error loading readers:', err);
    } finally {
      setIsSyncing(false);
      if (showLoading) setLoading(false);
    }
  }, []);

  // Initial load and periodic live polling (every 3.5 seconds)
  useEffect(() => {
    loadAndSyncReaders(true);

    const interval = setInterval(() => {
      loadAndSyncReaders(false);
    }, 3500);

    // WebSocket real-time subscription
    const unsub = WebSocketService.subscribe((msg) => {
      if (msg.type === 'READER_REGISTERED_PENDING' || msg.type === 'READER_APPROVED_ACTIVE' || msg.type === 'READER_STATUS_CHANGED') {
        loadAndSyncReaders(false);
        if (msg.type === 'READER_REGISTERED_PENDING') {
          setActionSuccessMessage(`🔔 New meter reader registration received from mobile: ${msg.payload?.reader?.name || 'Applicant'}`);
          setTimeout(() => setActionSuccessMessage(null), 5000);
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [loadAndSyncReaders]);

  // Handle Instant One-Click Approval
  const handleApproveReader = async (reader: ReaderAccount, assignedRoutes?: string[]) => {
    setIsSubmittingApproval(true);
    setErrorMessage(null);
    const routesToAssign = assignedRoutes || reader.assignedRoutes || ['Poblacion'];

    try {
      // 1. Central Server Update
      const res = await universalApiFetch(`/api/readers/${encodeURIComponent(reader.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          assignedRoutes: routesToAssign,
          approvedBy: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Administrator',
        }),
      });

      let updatedRecord: ReaderAccount = {
        ...reader,
        status: 'active',
        assignedRoutes: routesToAssign,
        approvedAt: new Date().toISOString(),
        approvedBy: currentUser?.name || 'Administrator',
      };

      if (res.ok) {
        try {
          const data = await res.json();
          if (data.reader) updatedRecord = data.reader;
        } catch { /* ignore */ }
      }

      // 2. Local Database Update
      await DatabaseHelper.updateLocalReaderStatus(
        reader.id,
        'active',
        routesToAssign,
        currentUser?.name || 'Administrator'
      );

      // 3. Log Audit Trail
      await LoggerService.log(
        'READER_APPROVED',
        `Administrator approved meter reader ${reader.name} (${reader.employeeId}) for routes: ${routesToAssign.join(', ')}`
      );

      setActionSuccessMessage(`✅ Reader '${reader.name}' has been APPROVED and activated for mobile terminal access!`);
      setSelectedReaderForEdit(null);
      await loadAndSyncReaders(false);

      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(`Failed to approve reader: ${err?.message || 'Network error'}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Handle Reject / Deactivate Reader
  const handleRejectReader = async (reader: ReaderAccount) => {
    if (!window.confirm(`Are you sure you want to reject / revoke access for reader ${reader.name}?`)) {
      return;
    }

    try {
      await universalApiFetch(`/api/readers/${encodeURIComponent(reader.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          approvedBy: currentUser?.name || 'Administrator',
        }),
      });

      await DatabaseHelper.updateLocalReaderStatus(
        reader.id,
        'rejected',
        reader.assignedRoutes,
        currentUser?.name || 'Administrator'
      );

      await LoggerService.log(
        'READER_REJECTED',
        `Administrator rejected meter reader account for ${reader.name} (${reader.employeeId})`
      );

      setActionSuccessMessage(`Account for '${reader.name}' marked as rejected.`);
      await loadAndSyncReaders(false);
      setTimeout(() => setActionSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Error updating status: ${err?.message || 'Unknown error'}`);
    }
  };

  // Handle Create New Reader Directly in Admin
  const handleCreateReaderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim()) {
      setErrorMessage('Name and Username are required');
      return;
    }

    const createdReader: ReaderAccount = {
      id: `RDR-${Date.now().toString().slice(-4)}`,
      employeeId: newEmployeeId.trim() || `TWD-2026-${Math.floor(100 + Math.random() * 900)}`,
      name: newName.trim(),
      username: newUsername.trim(),
      pin: newPin.trim() || '1234',
      contactNumber: newContact.trim(),
      email: newEmail.trim() || `${newUsername.toLowerCase()}@tagoloanwater.gov.ph`,
      assignedRoutes: newRoutes.length > 0 ? newRoutes : ['Poblacion'],
      status: 'active', // Direct admin created readers start as active
      deviceInfo: 'Admin Portal Direct Enrolment',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser?.name || 'Administrator',
    };

    try {
      await universalApiFetch('/api/readers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createdReader),
      });

      await DatabaseHelper.saveLocalReader(createdReader);
      await LoggerService.log(
        'READER_CREATED_ADMIN',
        `Administrator directly enrolled meter reader ${createdReader.name} (${createdReader.employeeId})`
      );

      setIsAddModalOpen(false);
      setNewName('');
      setNewUsername('');
      setNewEmployeeId('');
      setNewContact('');
      setNewEmail('');
      setNewRoutes(['Poblacion']);
      setActionSuccessMessage(`🎉 Reader '${createdReader.name}' created and immediately activated!`);
      await loadAndSyncReaders(false);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(`Failed to create reader: ${err?.message || 'Error saving reader'}`);
    }
  };

  // Filtered Readers list
  const filteredReaders = readers.filter((r) => {
    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      r.name.toLowerCase().includes(q) ||
      r.username.toLowerCase().includes(q) ||
      (r.employeeId && r.employeeId.toLowerCase().includes(q)) ||
      (r.assignedRoutes && r.assignedRoutes.some(rt => rt.toLowerCase().includes(q)));
    return matchesStatus && matchesSearch;
  });

  const pendingCount = readers.filter(r => r.status === 'pending').length;
  const activeCount = readers.filter(r => r.status === 'active').length;

  return (
    <div className="flex-1 p-3.5 sm:p-5 lg:p-7 flex flex-col gap-4 max-w-7xl mx-auto w-full pb-16">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                <span>Meter Readers & Staff Directory</span>
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Sync Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Review mobile registration attempts, assign reading routes, and grant terminal authorization
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadAndSyncReaders(true)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Directory'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 text-xs font-bold shadow-md shadow-sky-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Meter Reader</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      <AnimatePresence>
        {actionSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-medium flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button onClick={() => setActionSuccessMessage(null)} className="text-emerald-400 hover:text-white">
              ✕
            </button>
          </motion.div>
        )}

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs font-medium flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Registered</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-white font-mono">{readers.length}</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
        </div>

        <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pending Approval</span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-amber-300 font-mono">{pendingCount}</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          {pendingCount > 0 && (
            <p className="text-[10px] text-amber-400/80 mt-0.5">Mobile accounts awaiting approval</p>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Active in Field</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-300 font-mono">{activeCount}</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Coverage Zones</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-sky-400 font-mono">{AVAILABLE_ROUTES.length}</span>
            <MapPin className="w-4 h-4 text-sky-400" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filterStatus === 'ALL'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Readers ({readers.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'pending'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-amber-400 hover:text-amber-300 border border-amber-500/20'
            }`}
          >
            <span>Pending Approval</span>
            {pendingCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                filterStatus === 'pending' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500 text-slate-950'
              }`}>
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filterStatus === 'active'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800 text-emerald-400 hover:text-emerald-300'
            }`}
          >
            Active ({activeCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              filterStatus === 'rejected'
                ? 'bg-rose-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Rejected / Inactive
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, ID, route..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Readers Grid / List */}
      {loading ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-white">Loading Meter Readers Directory...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to Tagoloan District central database</p>
        </div>
      ) : filteredReaders.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-bold text-white">No Meter Readers Found</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm 
              ? `No readers match your search query '${searchTerm}'.`
              : filterStatus === 'pending'
                ? 'No pending account approvals right now. All mobile registrations have been processed.'
                : 'No meter readers currently registered. Create one using the button above or register from the mobile terminal.'}
          </p>
          {filterStatus !== 'ALL' && (
            <button
              onClick={() => setFilterStatus('ALL')}
              className="mt-4 px-3 py-1.5 rounded-xl bg-slate-800 text-sky-400 text-xs font-bold hover:bg-slate-750"
            >
              View All Readers
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredReaders.map((reader) => {
            const isPending = reader.status === 'pending';
            const isActive = reader.status === 'active';
            const isRejected = reader.status === 'rejected';

            return (
              <div
                key={reader.id || reader.username}
                className={`bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-all shadow-sm relative overflow-hidden ${
                  isPending 
                    ? 'border-amber-500/60 bg-gradient-to-b from-amber-950/20 to-slate-900 shadow-amber-500/5' 
                    : isActive
                      ? 'border-slate-800 hover:border-slate-700'
                      : 'border-rose-900/40 opacity-75'
                }`}
              >
                {/* Pending Badge Banner */}
                {isPending && (
                  <div className="absolute top-0 right-0 left-0 bg-amber-500/20 border-b border-amber-500/30 px-3 py-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400 animate-spin" />
                      <span>MOBILE REGISTRATION ATTEMPT</span>
                    </span>
                    <span className="text-[9px] font-mono text-amber-400">Needs Review</span>
                  </div>
                )}

                <div className={`space-y-2.5 ${isPending ? 'pt-4' : ''}`}>
                  {/* Header: Name, Status & Employee ID */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-white">{reader.name}</h3>
                      </div>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        @{reader.username} • {reader.employeeId || 'No ID'}
                      </p>
                    </div>

                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                      isActive 
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                        : isPending
                          ? 'bg-amber-950/80 text-amber-300 border-amber-700/60 font-bold'
                          : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                    }`}>
                      {isActive && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      {isPending && <Clock className="w-3 h-3 text-amber-400" />}
                      {isRejected && <XCircle className="w-3 h-3 text-rose-400" />}
                      <span className="uppercase">{reader.status}</span>
                    </span>
                  </div>

                  {/* Contact & Registration Metadata */}
                  <div className="space-y-1 text-[11px] text-slate-400 font-mono">
                    {reader.contactNumber && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{reader.contactNumber}</span>
                      </div>
                    )}
                    {reader.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{reader.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3 h-3 text-slate-500" />
                      <span className="truncate">{reader.deviceInfo || 'Field Mobile Device'}</span>
                    </div>
                  </div>

                  {/* Assigned Routes / Barangays */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Assigned Reading Routes:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {reader.assignedRoutes && reader.assignedRoutes.length > 0 ? (
                        reader.assignedRoutes.map((rt) => (
                          <span
                            key={rt}
                            className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-sky-400 text-[10px] font-mono"
                          >
                            {rt}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">No routes assigned yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  {isPending ? (
                    <div className="flex items-center gap-2 w-full">
                      {/* One-Click Quick Approve */}
                      <button
                        type="button"
                        onClick={() => handleApproveReader(reader)}
                        disabled={isSubmittingApproval}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-500/20"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Unlock</span>
                      </button>

                      {/* Customize Routes before approval */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReaderForEdit(reader);
                          setEditRoutes(reader.assignedRoutes || ['Poblacion']);
                        }}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs transition cursor-pointer"
                        title="Configure assigned barangays"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>

                      {/* Reject */}
                      <button
                        type="button"
                        onClick={() => handleRejectReader(reader)}
                        className="p-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 border border-rose-800/40 text-xs transition cursor-pointer"
                        title="Reject application"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReaderForEdit(reader);
                            setEditRoutes(reader.assignedRoutes || ['Poblacion']);
                          }}
                          className="text-[11px] font-bold text-sky-400 hover:text-sky-300 transition cursor-pointer"
                        >
                          Edit Routes
                        </button>
                        <span className="text-slate-600">•</span>
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => handleRejectReader(reader)}
                            className="text-[11px] text-rose-400 hover:text-rose-300 transition cursor-pointer"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApproveReader(reader)}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>

                      {/* Direct Test Login as this reader */}
                      {onSwitchUser && isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            onSwitchUser({
                              id: reader.id,
                              employeeId: reader.employeeId,
                              username: reader.username,
                              name: reader.name,
                              role: 'Meter Reader I',
                              zone: (reader.assignedRoutes || ['Poblacion']).join(', '),
                              assignedRoutes: reader.assignedRoutes || ['Poblacion'],
                              status: 'active',
                            });
                            onNavigate('dashboard');
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-800/60 px-2 py-0.5 rounded-lg transition"
                          title="Open Field Mobile Terminal as this Reader"
                        >
                          <LogIn className="w-3 h-3" />
                          <span>Terminal</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Custom Route Assignment & Approval */}
      <AnimatePresence>
        {selectedReaderForEdit && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Assign Reading Routes
                  </h3>
                  <p className="text-xs text-slate-400">
                    For {selectedReaderForEdit.name} ({selectedReaderForEdit.employeeId})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedReaderForEdit(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-300 block mb-2">
                  Select Barangays & Coverage Zones:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_ROUTES.map((route) => {
                    const isSelected = editRoutes.includes(route);
                    return (
                      <button
                        key={route}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setEditRoutes(editRoutes.filter(r => r !== route));
                          } else {
                            setEditRoutes([...editRoutes, route]);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span>{route}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReaderForEdit(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveReader(selectedReaderForEdit, editRoutes)}
                  disabled={editRoutes.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold disabled:opacity-50"
                >
                  Save & Authorize
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Direct Meter Reader Enrolment */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-sky-400" />
                    <span>Enrol New Meter Reader</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Creates an active field terminal account immediately
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateReaderSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. jdelacruz"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Security PIN *
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="1234"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      value={newEmployeeId}
                      onChange={(e) => setNewEmployeeId(e.target.value)}
                      placeholder="TWD-2026-004"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Contact No.
                    </label>
                    <input
                      type="text"
                      value={newContact}
                      onChange={(e) => setNewContact(e.target.value)}
                      placeholder="0917-123-4567"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Assign Coverage Routes
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800">
                    {AVAILABLE_ROUTES.map((route) => {
                      const isChecked = newRoutes.includes(route);
                      return (
                        <button
                          key={route}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setNewRoutes(newRoutes.filter(r => r !== route));
                            } else {
                              setNewRoutes([...newRoutes, route]);
                            }
                          }}
                          className={`p-1.5 rounded-lg text-[11px] flex items-center justify-between border transition ${
                            isChecked
                              ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span>{route}</span>
                          {isChecked && <Check className="w-3 h-3 text-sky-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-slate-950 text-xs font-bold shadow-md"
                  >
                    Enrol Reader
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
