import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserCheck, 
  UserX, 
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
  Sliders,
  LogIn,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Ban
} from 'lucide-react';
import { ReaderAccount, ActiveScreen, StaffUser, ReaderStatus } from '../types';
import { DatabaseHelper } from '../services/databaseHelper';
import { WebSocketService } from '../services/websocketService';
import { universalApiFetch } from '../services/apiConfig';
import { LoggerService } from '../services/loggerService';
import { 
  TAGOLOAN_BARANGAYS, 
  calculateLocationOccupancies, 
  areLocationsEqual
} from '../constants/routes';

interface MeterReadersScreenProps {
  currentUser: StaffUser | null;
  onNavigate: (screen: ActiveScreen) => void;
  onSwitchUser?: (user: StaffUser) => void;
}

const AVAILABLE_ROUTES = TAGOLOAN_BARANGAYS;

export const MeterReadersScreen: React.FC<MeterReadersScreenProps> = ({
  currentUser,
  onNavigate,
  onSwitchUser,
}) => {
  const [readers, setReaders] = useState<ReaderAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'terminated'>('ALL');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State for New Reader Enrolment
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('1234');
  const [showNewPin, setShowNewPin] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRoutes, setNewRoutes] = useState<string[]>(['Poblacion']);

  // Modal State for Route Assignment
  const [selectedReaderForEdit, setSelectedReaderForEdit] = useState<ReaderAccount | null>(null);
  const [editRoutes, setEditRoutes] = useState<string[]>([]);
  const [isSubmittingRoutes, setIsSubmittingRoutes] = useState<boolean>(false);

  // Modal State for Account Termination (Admin's primary single option)
  const [readerToTerminate, setReaderToTerminate] = useState<ReaderAccount | null>(null);
  const [terminationReason, setTerminationReason] = useState<string>('Account terminated by administrator');
  const [isTerminating, setIsTerminating] = useState<boolean>(false);

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
            // Sort: active first, then alphabetically by name
            merged.sort((a, b) => {
              if (a.status === 'active' && b.status !== 'active') return -1;
              if (b.status === 'active' && a.status !== 'active') return 1;
              return (a.name || '').localeCompare(b.name || '');
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
      if (
        msg.type === 'READER_REGISTERED_ACTIVE' || 
        msg.type === 'READER_ACCOUNT_TERMINATED' || 
        msg.type === 'READER_STATUS_CHANGED'
      ) {
        loadAndSyncReaders(false);
        if (msg.type === 'READER_REGISTERED_ACTIVE') {
          setActionSuccessMessage(`⚡ New meter reader registered from mobile & automatically active: ${msg.payload?.reader?.name || 'Field Reader'}`);
          setTimeout(() => setActionSuccessMessage(null), 5000);
        } else if (msg.type === 'READER_ACCOUNT_TERMINATED') {
          setActionSuccessMessage(`⚠️ Meter reader account ${msg.payload?.name || ''} has been terminated.`);
          setTimeout(() => setActionSuccessMessage(null), 4000);
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [loadAndSyncReaders]);

  // Handle Terminate Reader (The Admin's Single Action Option)
  const confirmTerminateReader = async () => {
    if (!readerToTerminate) return;
    setIsTerminating(true);
    setErrorMessage(null);

    const target = readerToTerminate;
    const reasonText = terminationReason.trim() || 'Account revoked by administrator';

    try {
      // 1. Central Server Update (supports both /terminate and status PATCH)
      try {
        await universalApiFetch(`/api/readers/${encodeURIComponent(target.id)}/terminate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: reasonText,
            terminatedBy: currentUser?.name || 'Administrator',
          }),
        });
      } catch {
        // Fallback PATCH if POST /terminate is unavailable
        await universalApiFetch(`/api/readers/${encodeURIComponent(target.id)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'terminated',
            reason: reasonText,
            approvedBy: currentUser?.name || 'Administrator',
          }),
        }).catch(() => {});
      }

      // 2. Local Database Update
      await DatabaseHelper.updateLocalReaderStatus(
        target.id,
        'terminated',
        target.assignedRoutes,
        currentUser?.name || 'Administrator'
      );

      // 3. Log Audit Trail
      await LoggerService.log(
        'READER_TERMINATED',
        `Administrator terminated meter reader account for ${target.name} (${target.employeeId}). Reason: ${reasonText}`
      );

      setActionSuccessMessage(`⛔ Meter reader '${target.name}' has been TERMINATED. Mobile terminal access revoked.`);
      setReaderToTerminate(null);
      setTerminationReason('Account terminated by administrator');
      await loadAndSyncReaders(false);

      setTimeout(() => setActionSuccessMessage(null), 4500);
    } catch (err: any) {
      setErrorMessage(`Failed to terminate reader: ${err?.message || 'Error updating status'}`);
    } finally {
      setIsTerminating(false);
    }
  };

  // Optional Administrative Recovery: Reactivate / Reinstate Terminated Account
  const handleReactivateReader = async (reader: ReaderAccount) => {
    if (!window.confirm(`Reactivate meter reader account for ${reader.name}? They will regain mobile terminal access.`)) {
      return;
    }

    try {
      await universalApiFetch(`/api/readers/${encodeURIComponent(reader.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          approvedBy: currentUser?.name || 'Administrator',
        }),
      });

      await DatabaseHelper.updateLocalReaderStatus(
        reader.id,
        'active',
        reader.assignedRoutes,
        currentUser?.name || 'Administrator'
      );

      await LoggerService.log(
        'READER_REINSTATED',
        `Administrator reactivated meter reader ${reader.name} (${reader.employeeId})`
      );

      setActionSuccessMessage(`✅ Reader '${reader.name}' reinstated and activated for mobile terminal access.`);
      await loadAndSyncReaders(false);
      setTimeout(() => setActionSuccessMessage(null), 3500);
    } catch (err: any) {
      setErrorMessage(`Error updating status: ${err?.message || 'Unknown error'}`);
    }
  };

  // Handle Route Assignment Update
  const handleUpdateRoutesSubmit = async (reader: ReaderAccount, assignedRoutes: string[]) => {
    setIsSubmittingRoutes(true);
    setErrorMessage(null);

    // Local occupancy pre-check
    const otherOccupancies = calculateLocationOccupancies(readers, reader.id);
    const occupiedConflicts = assignedRoutes.filter(rt => {
      const occ = otherOccupancies.find(o => areLocationsEqual(o.location, rt));
      return occ && occ.isOccupied;
    });

    if (occupiedConflicts.length > 0) {
      const conflictMsg = occupiedConflicts.map(rt => {
        const occ = otherOccupancies.find(o => areLocationsEqual(o.location, rt));
        return `"${rt}" (occupied by ${occ?.assignedReaderName})`;
      }).join(', ');
      setErrorMessage(`Cannot assign routes: ${conflictMsg}. Please select available locations.`);
      setIsSubmittingRoutes(false);
      return;
    }

    try {
      await universalApiFetch(`/api/readers/${encodeURIComponent(reader.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedRoutes,
          approvedBy: currentUser?.name || 'Administrator',
        }),
      });

      await DatabaseHelper.updateLocalReaderStatus(
        reader.id,
        reader.status,
        assignedRoutes,
        currentUser?.name || 'Administrator'
      );

      await LoggerService.log(
        'READER_ROUTES_UPDATED',
        `Administrator updated route coverage for ${reader.name} (${reader.employeeId}): ${assignedRoutes.join(', ')}`
      );

      setActionSuccessMessage(`✅ Route coverage updated for '${reader.name}' (${assignedRoutes.join(', ')}).`);
      setSelectedReaderForEdit(null);
      await loadAndSyncReaders(false);
      setTimeout(() => setActionSuccessMessage(null), 3500);
    } catch (err: any) {
      setErrorMessage(`Failed to update routes: ${err?.message || 'Network error'}`);
    } finally {
      setIsSubmittingRoutes(false);
    }
  };

  // Handle Create New Reader Directly in Admin (Automatically active)
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
      status: 'active', // Automatically active immediately upon creation
      deviceInfo: 'Admin Portal Enrolment',
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
        `Administrator enrolled meter reader ${createdReader.name} (${createdReader.employeeId})`
      );

      setIsAddModalOpen(false);
      setNewName('');
      setNewUsername('');
      setNewEmployeeId('');
      setNewContact('');
      setNewEmail('');
      setNewRoutes(['Poblacion']);
      setActionSuccessMessage(`🎉 Reader '${createdReader.name}' enrolled and immediately active for field operations!`);
      await loadAndSyncReaders(false);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(`Failed to create reader: ${err?.message || 'Error saving reader'}`);
    }
  };

  // Filtered Readers list
  const filteredReaders = readers.filter((r) => {
    const isTerminated = r.status === 'terminated' || r.status === 'rejected';
    const matchesStatus = 
      filterStatus === 'ALL' || 
      (filterStatus === 'active' && r.status === 'active') ||
      (filterStatus === 'terminated' && isTerminated);

    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      r.name.toLowerCase().includes(q) ||
      r.username.toLowerCase().includes(q) ||
      (r.employeeId && r.employeeId.toLowerCase().includes(q)) ||
      (r.assignedRoutes && r.assignedRoutes.some(rt => rt.toLowerCase().includes(q)));
    return matchesStatus && matchesSearch;
  });

  const activeCount = readers.filter(r => r.status === 'active').length;
  const terminatedCount = readers.filter(r => r.status === 'terminated' || r.status === 'rejected').length;

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
                <span>Meter Readers Directory & Administration</span>
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Instant Mobile Activation</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Meter readers are automatically active upon registration. Administrator holds authority to terminate accounts.
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
            <span>Enrol Meter Reader</span>
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
          <p className="text-[10px] text-slate-500 mt-1">Field roster count</p>
        </div>

        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Active in Field</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-300 font-mono">{activeCount}</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-[10px] text-emerald-400/80 mt-1">Auto-active terminal status</p>
        </div>

        <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Terminated Accounts</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-rose-300 font-mono">{terminatedCount}</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-[10px] text-rose-400/80 mt-1">Revoked by administrator</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Coverage Zones</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-sky-400 font-mono">{AVAILABLE_ROUTES.length}</span>
            <MapPin className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Tagoloan Barangays</p>
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
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'active'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800 text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Active in Field ({activeCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('terminated')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'terminated'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 text-rose-400 hover:text-rose-300'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Terminated ({terminatedCount})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, username, ID, route..."
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
              : filterStatus === 'terminated'
                ? 'No terminated meter reader accounts on record.'
                : 'No meter readers registered yet. Readers can register directly on mobile or be enrolled using the button above.'}
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
            const isTerminated = reader.status === 'terminated' || reader.status === 'rejected';
            const isActive = !isTerminated;

            return (
              <div
                key={reader.id || reader.username}
                className={`bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-all shadow-sm relative overflow-hidden ${
                  isTerminated
                    ? 'border-rose-900/40 bg-gradient-to-b from-rose-950/10 to-slate-900 opacity-80'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-2.5">
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
                        : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                    }`}>
                      {isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>ACTIVE IN FIELD</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-3 h-3 text-rose-400" />
                          <span>TERMINATED</span>
                        </>
                      )}
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
                      <span className="truncate">{reader.deviceInfo || 'Android Field Mobile Terminal'}</span>
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
                        <span className="text-[10px] text-slate-500 italic">No routes assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer: Admin's 1 Option is Terminate Account */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  {isActive ? (
                    <div className="flex items-center justify-between w-full">
                      {/* Admin's Single Action Option: TERMINATE THE ACCOUNT / METER READER */}
                      <button
                        type="button"
                        onClick={() => setReaderToTerminate(reader)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-white text-xs font-bold transition cursor-pointer shadow-sm shadow-rose-950/40"
                        title="Terminate Account - Revoke Field Mobile Access"
                      >
                        <UserX className="w-3.5 h-3.5 text-rose-400" />
                        <span>Terminate Meter Reader</span>
                      </button>

                      {/* Direct Test Login / Terminal Preview */}
                      {onSwitchUser && (
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
                          className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-800/60 px-2 py-1 rounded-lg transition"
                          title="Launch Field Mobile Terminal as this Reader"
                        >
                          <LogIn className="w-3 h-3" />
                          <span>Terminal</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full text-xs">
                      <span className="text-[11px] text-rose-400 font-mono flex items-center gap-1">
                        <Ban className="w-3 h-3 shrink-0" />
                        <span>Terminal Access Revoked</span>
                      </span>

                      {/* Optional Administrative Safety: Reinstate Account */}
                      <button
                        type="button"
                        onClick={() => handleReactivateReader(reader)}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold transition cursor-pointer underline decoration-dotted"
                      >
                        Reinstate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: TERMINATE METER READER ACCOUNT ================= */}
      <AnimatePresence>
        {readerToTerminate && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-rose-800/60 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-700 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-black text-white">
                    Terminate Meter Reader Account
                  </h3>
                  <p className="text-xs text-rose-300/90 mt-0.5 font-medium">
                    Revoke all field mobile terminal authorization immediately
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReaderToTerminate(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Meter Reader:</span>
                  <span className="text-white font-bold">{readerToTerminate.name}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Employee ID:</span>
                  <span className="text-sky-400">{readerToTerminate.employeeId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Username:</span>
                  <span className="text-slate-300">@{readerToTerminate.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Coverage Routes:</span>
                  <span className="text-slate-300">{readerToTerminate.assignedRoutes?.join(', ') || 'None'}</span>
                </div>
              </div>

              <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-200">
                <p className="font-semibold text-rose-300 mb-1">Administrative Action Effect:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-200/90">
                  <li>Immediately blocks this meter reader from logging into the mobile terminal.</li>
                  <li>Rejects any in-progress batch sync submissions from their device.</li>
                  <li>Frees assigned barangay coverage routes for reassignment.</li>
                </ul>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Reason for Termination:
                </label>
                <select
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500 mb-2"
                >
                  <option value="Account terminated by administrator">Account terminated by administrator</option>
                  <option value="Field employment terminated / resigned">Field employment terminated / resigned</option>
                  <option value="Device lost or security compromised">Device lost or security compromised</option>
                  <option value="Disciplinary policy violation">Disciplinary policy violation</option>
                  <option value="Route transfer / Roster restructuring">Route transfer / Roster restructuring</option>
                </select>
                <input
                  type="text"
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  placeholder="Specify custom reason..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReaderToTerminate(null)}
                  disabled={isTerminating}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmTerminateReader}
                  disabled={isTerminating}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50 cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>{isTerminating ? 'Terminating...' : 'Confirm Termination'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: ROUTE ASSIGNMENT ================= */}
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
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300">
                    Select Barangays & Coverage Zones:
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {editRoutes.length} selected
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800 scrollbar-thin scrollbar-thumb-slate-800">
                  {calculateLocationOccupancies(readers, selectedReaderForEdit.id).map((loc) => {
                    const route = loc.location;
                    const isSelected = editRoutes.some(r => areLocationsEqual(r, route));
                    const isOccupiedByOther = loc.isOccupied;

                    if (isOccupiedByOther) {
                      return (
                        <div
                          key={route}
                          className="p-2 rounded-xl border border-slate-800 bg-slate-900/30 text-slate-500 opacity-60 flex items-center justify-between cursor-not-allowed select-none"
                          title={`Assigned to ${loc.assignedReaderName}`}
                        >
                          <div className="flex flex-col min-w-0 pr-1">
                            <div className="flex items-center gap-1.5">
                              <Lock className="w-3 h-3 text-amber-500/80 shrink-0" />
                              <span className="text-xs line-through truncate text-slate-400 font-medium">{route}</span>
                            </div>
                            <span className="text-[9px] text-amber-500/80 truncate font-mono">
                              By: {loc.assignedReaderName}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800/50 text-amber-400 text-[8.5px] font-bold uppercase shrink-0">
                            Occupied
                          </span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={route}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setEditRoutes(editRoutes.filter(r => !areLocationsEqual(r, route)));
                          } else {
                            setEditRoutes([...editRoutes, route]);
                          }
                        }}
                        className={`p-2 rounded-xl border text-xs font-medium flex items-center justify-between transition cursor-pointer text-left ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-1">
                          <span className="truncate">{route}</span>
                          <span className="text-[9px] text-emerald-400/90 font-mono">
                            🟢 Available
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-1" />}
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
                  onClick={() => handleUpdateRoutesSubmit(selectedReaderForEdit, editRoutes)}
                  disabled={editRoutes.length === 0 || isSubmittingRoutes}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold disabled:opacity-50"
                >
                  {isSubmittingRoutes ? 'Saving...' : 'Save Routes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: DIRECT METER READER ENROLMENT ================= */}
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
                    <div className="relative">
                      <input
                        type={showNewPin ? "text" : "password"}
                        required
                        maxLength={6}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        placeholder="1234"
                        className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPin(!showNewPin)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-200 transition focus:outline-none"
                        aria-label={showNewPin ? "Hide PIN" : "Show PIN"}
                      >
                        {showNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Assign Coverage Routes
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {newRoutes.length} selected
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800 scrollbar-thin scrollbar-thumb-slate-800">
                    {calculateLocationOccupancies(readers).map((loc) => {
                      const route = loc.location;
                      const isChecked = newRoutes.some(r => areLocationsEqual(r, route));
                      const isOccupied = loc.isOccupied;

                      if (isOccupied) {
                        return (
                          <div
                            key={route}
                            className="p-2 rounded-lg text-[11px] bg-slate-900/40 border border-slate-800 text-slate-500 opacity-60 flex items-center justify-between cursor-not-allowed select-none"
                            title={`Unavailable: Assigned to ${loc.assignedReaderName}`}
                          >
                            <div className="flex flex-col min-w-0 pr-1">
                              <div className="flex items-center gap-1.5">
                                <Lock className="w-3 h-3 text-amber-500/80 shrink-0" />
                                <span className="line-through text-slate-400 truncate">{route}</span>
                              </div>
                              <span className="text-[9px] text-amber-500/80 truncate font-mono">
                                Taken by: {loc.assignedReaderName}
                              </span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800/50 text-amber-400 text-[8.5px] font-bold uppercase shrink-0">
                              Occupied
                            </span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={route}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setNewRoutes(newRoutes.filter(r => !areLocationsEqual(r, route)));
                            } else {
                              setNewRoutes([...newRoutes, route]);
                            }
                          }}
                          className={`p-2 rounded-lg text-[11px] flex items-center justify-between border transition text-left cursor-pointer ${
                            isChecked
                              ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-1">
                            <span className="truncate">{route}</span>
                            <span className="text-[9px] text-emerald-400/90 font-mono">
                              🟢 Available
                            </span>
                          </div>
                          {isChecked && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-1" />}
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
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-slate-950 text-xs font-bold shadow-md cursor-pointer"
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
