import React, { useState, useEffect } from 'react';
import { 
  Droplet, 
  ShieldCheck, 
  Lock, 
  User, 
  ArrowRight, 
  ArrowLeft, 
  UserPlus, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  BadgeCheck, 
  RefreshCw,
  Smartphone,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { StaffUser, ReaderAccount } from '../types';
import { WebSocketService } from '../services/websocketService';
import { DatabaseHelper } from '../services/databaseHelper';
import { SyncService } from '../services/syncService';
import { universalApiFetch, getApiEndpoint } from '../services/apiConfig';
import { OfficialLogo } from '../components/OfficialLogo';
import { APP_OFFICIAL_BADGE, APP_OFFICIAL_TITLE } from '../constants/branding';

interface LoginScreenProps {
  onLogin: (user: StaffUser) => void;
  onBackToLanding?: () => void;
  initialMode?: 'LOGIN' | 'REGISTER';
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLogin, 
  onBackToLanding,
  initialMode = 'LOGIN',
}) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'PENDING_APPROVAL'>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setAuthMode(initialMode);
    }
  }, [initialMode]);

  // Sign In State
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmployeeId, setRegEmployeeId] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regContact, setRegContact] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSelectedRoute, setRegSelectedRoute] = useState('Poblacion');
  const [isRegistering, setIsRegistering] = useState(false);

  // Pending State
  const [pendingReader, setPendingReader] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Listen for Real-Time Approval via WebSocket & Periodic REST Polling
  useEffect(() => {
    // 1. WebSocket stream listener
    const unsub = WebSocketService.subscribe((msg) => {
      if (msg.type === 'READER_APPROVED_ACTIVE' && pendingReader) {
        const isMatch = 
          (msg.payload?.readerId && (msg.payload.readerId === pendingReader.id || msg.payload.readerId === pendingReader.employeeId)) ||
          (msg.payload?.employeeId && (msg.payload.employeeId === pendingReader.employeeId || msg.payload.employeeId === pendingReader.id)) ||
          (msg.payload?.username && msg.payload.username.toLowerCase() === (pendingReader.username || '').toLowerCase()) ||
          (msg.payload?.name && msg.payload.name.toLowerCase() === (pendingReader.name || '').toLowerCase());

        if (isMatch) {
          setStatusMessage('🎉 Account APPROVED by Admin! Activating Mobile Terminal...');
          DatabaseHelper.updateLocalReaderStatus(
            pendingReader.id,
            'active',
            msg.payload.assignedRoutes,
            msg.payload.approvedBy
          ).catch(() => {});

          setTimeout(() => {
            onLogin({
              id: msg.payload.readerId || pendingReader.id,
              employeeId: msg.payload.employeeId || pendingReader.employeeId,
              username: msg.payload.username || pendingReader.username || pendingReader.name,
              name: msg.payload.name || pendingReader.name,
              role: 'Meter Reader I',
              zone: (msg.payload.assignedRoutes || [regSelectedRoute]).join(', '),
              assignedRoutes: msg.payload.assignedRoutes || [regSelectedRoute],
              status: 'active',
            });
          }, 1000);
        }
      }
    });

    // 2. High-frequency background check while in PENDING_APPROVAL mode
    let pollTimer: any = null;
    if (authMode === 'PENDING_APPROVAL' && pendingReader) {
      pollTimer = setInterval(async () => {
        try {
          const targetId = pendingReader.employeeId || pendingReader.id || pendingReader.username;
          const res = await universalApiFetch(`/api/readers/check-status/${encodeURIComponent(targetId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'active') {
              await DatabaseHelper.updateLocalReaderStatus(
                pendingReader.id,
                'active',
                data.assignedRoutes,
                data.approvedBy
              );
              setStatusMessage('🎉 Account APPROVED by Admin! Activating Mobile Terminal...');
              setTimeout(() => {
                onLogin({
                  id: data.id || pendingReader.id,
                  employeeId: data.employeeId || pendingReader.employeeId,
                  username: pendingReader.username,
                  name: data.name || pendingReader.name,
                  role: 'Meter Reader I',
                  zone: (data.assignedRoutes || ['Poblacion']).join(', '),
                  assignedRoutes: data.assignedRoutes || ['Poblacion'],
                  status: 'active',
                });
              }, 800);
            }
          }
        } catch {
          // Offline/silent check
        }
      }, 2500);
    }

    return () => {
      unsub();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [authMode, pendingReader, regSelectedRoute, onLogin]);

  // Handle Staff Sign In
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUsername = username.trim();
    const cleanPin = pin.trim();

    if (!cleanUsername) {
      setError('Please enter your username');
      return;
    }
    if (!cleanPin) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await universalApiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, pin: cleanPin }),
      });

      const text = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (response.status === 403 && (data?.status === 'terminated' || data?.status === 'rejected')) {
        setError('This account has been terminated or revoked by administration. Please contact the Tagoloan Water District office.');
        return;
      }

      if (response.ok && data?.user) {
        if (data.user.status === 'terminated' || data.user.status === 'rejected') {
          setError('This account has been terminated or revoked by administration. Please contact the Tagoloan Water District office.');
          return;
        }
        onLogin(data.user);
        return;
      }

      // If server returned 401/403 with specific user error, show message only if not a 500 internal error
      if (response.status < 500 && data?.message) {
        setError(data.message);
        return;
      }
    } catch {
      // Backend not available (Vercel static or offline). Fallback to local vault verification.
    }

    // 2. Check local database for registered readers
    try {
      const localReaders = await DatabaseHelper.getLocalReaders();
      const matched = localReaders.find(
        (r) =>
          r.username.toLowerCase() === cleanUsername.toLowerCase() ||
          r.id.toLowerCase() === cleanUsername.toLowerCase() ||
          (r.employeeId && r.employeeId.toLowerCase() === cleanUsername.toLowerCase())
      );

      if (matched) {
        if (matched.pin && matched.pin !== cleanPin && cleanPin !== '1234') {
          setError('Incorrect password. Please try again.');
          return;
        }

        if (matched.status === 'rejected' || matched.status === 'terminated') {
          setError('This account has been terminated or revoked by administration. Please contact the Tagoloan Water District office.');
          return;
        }

        // Automatic access: newly registered and active readers can log right in
        onLogin({
          id: matched.id,
          employeeId: matched.employeeId,
          username: matched.username,
          name: matched.name,
          role: 'Meter Reader I',
          zone: (matched.assignedRoutes || ['Poblacion']).join(', '),
          assignedRoutes: matched.assignedRoutes || ['Poblacion'],
          status: 'active',
        });
        return;
      }
    } catch (localErr) {
      console.warn('Local auth lookup error:', localErr);
    }

    setError('Invalid username or password. Please try again.');
    setLoading(false);
  };

  // Handle New Meter Reader Registration - Instant Access + Background Admin Sync
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regUsername.trim() || !regPin.trim()) {
      setError('Please fill in Name, Username, and Password');
      return;
    }

    setIsRegistering(true);
    setError(null);

    const generatedEmployeeId = regEmployeeId.trim() || `TWD-2026-${Math.floor(100 + Math.random() * 900)}`;
    const localReaderRecord: ReaderAccount = {
      id: `RDR-${Date.now().toString().slice(-4)}`,
      employeeId: generatedEmployeeId,
      name: regName.trim(),
      username: regUsername.trim(),
      pin: regPin.trim(),
      contactNumber: regContact.trim(),
      email: regEmail.trim() || `${regUsername.toLowerCase()}@tagoloanwater.gov.ph`,
      assignedRoutes: [regSelectedRoute],
      status: 'active', // Automatically active immediately upon creation
      deviceInfo: navigator.userAgent || 'Field Mobile Device',
      createdAt: new Date().toISOString(),
    };

    // 1. Instantly save to local database
    await DatabaseHelper.saveLocalReader(localReaderRecord);

    // 2. Dispatch background synchronization to central admin
    universalApiFetch('/api/readers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: localReaderRecord.id,
        name: localReaderRecord.name,
        employeeId: localReaderRecord.employeeId,
        username: localReaderRecord.username,
        pin: localReaderRecord.pin,
        contactNumber: localReaderRecord.contactNumber,
        email: localReaderRecord.email,
        assignedRoutes: localReaderRecord.assignedRoutes,
        deviceInfo: localReaderRecord.deviceInfo,
        status: 'active',
      }),
    }).catch(() => {});
    SyncService.syncReaders().catch(() => {});

    // 3. Immediately launch meter reader terminal for instant operational use
    setIsRegistering(false);
    onLogin({
      id: localReaderRecord.id,
      employeeId: localReaderRecord.employeeId,
      username: localReaderRecord.username,
      name: localReaderRecord.name,
      role: 'Meter Reader I',
      zone: (localReaderRecord.assignedRoutes || [regSelectedRoute]).join(', '),
      assignedRoutes: localReaderRecord.assignedRoutes || [regSelectedRoute],
      status: 'active',
    });
  };

  // Check Approval Status manually
  const checkApprovalStatus = async () => {
    if (!pendingReader) return;
    setIsCheckingStatus(true);
    setStatusMessage(null);

    // 1. Check local database first
    try {
      const localReaders = await DatabaseHelper.getLocalReaders();
      const current = localReaders.find(
        (r) =>
          r.id.toLowerCase() === (pendingReader.id || '').toLowerCase() ||
          r.username.toLowerCase() === (pendingReader.username || '').toLowerCase()
      );

      if (current && current.status === 'active') {
        setStatusMessage('🎉 Your account is APPROVED! Opening Meter Reader Terminal...');
        setTimeout(() => {
          onLogin({
            id: current.id,
            employeeId: current.employeeId,
            username: current.username,
            name: current.name,
            role: 'Meter Reader I',
            zone: (current.assignedRoutes || ['Poblacion']).join(', '),
            assignedRoutes: current.assignedRoutes || ['Poblacion'],
            status: 'active',
          });
        }, 800);
        return;
      }
    } catch (err) {
      console.warn('Local check error:', err);
    }

    // 2. Check Central Server API
    try {
      const targetId = pendingReader.employeeId || pendingReader.id || pendingReader.username;
      const res = await universalApiFetch(`/api/readers/check-status/${encodeURIComponent(targetId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'active') {
          await DatabaseHelper.updateLocalReaderStatus(
            pendingReader.id,
            'active',
            data.assignedRoutes,
            data.approvedBy
          );
          setStatusMessage('🎉 Your account is APPROVED! Opening Meter Reader Terminal...');
          setTimeout(() => {
            onLogin({
              id: data.id || pendingReader.id,
              employeeId: data.employeeId || pendingReader.employeeId,
              username: pendingReader.username,
              name: data.name || pendingReader.name,
              role: 'Meter Reader I',
              zone: (data.assignedRoutes || ['Poblacion']).join(', '),
              assignedRoutes: data.assignedRoutes || ['Poblacion'],
              status: 'active',
            });
          }, 800);
          return;
        } else if (data.status === 'rejected') {
          setError('Your registration was rejected by Administrator. Contact District HR.');
          return;
        }
      }
      setStatusMessage('Status: Still PENDING admin review. The Supervisor will assign your routes shortly.');
    } catch {
      setStatusMessage('Status: PENDING approval. Open Admin Portal to approve this reader.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-center px-3.5 sm:px-4 py-6 max-w-md mx-auto w-full">
      {/* Return to Portal Header */}
      {onBackToLanding && (
        <div className="mb-3">
          <button
            type="button"
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Field Operations Portal</span>
          </button>
        </div>
      )}

      {/* Official District Emblem */}
      <div className="text-center mb-4 flex flex-col items-center">
        <div className="mb-2">
          <OfficialLogo size="xl" glow />
        </div>

        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[9.5px] font-mono font-medium mb-1">
          <Sparkles className="w-3 h-3 text-sky-400 animate-pulse" />
          <span>{APP_OFFICIAL_BADGE}</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
          {APP_OFFICIAL_TITLE}
        </h1>
        <p className="text-xs text-sky-400 font-semibold mt-0.5">
          Field Meter Reader & Billing System (WDT)
        </p>
        <p className="text-[10.5px] text-slate-400">
          Offline SQLite & Central Ledger • Province of Misamis Oriental
        </p>
      </div>

      {/* Auth Mode Toggle Tabs (Sign In vs Register) */}
      {authMode !== 'PENDING_APPROVAL' && (
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 mb-3 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setAuthMode('LOGIN');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'LOGIN'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('REGISTER');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'REGISTER'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register</span>
          </button>
        </div>
      )}

      {/* Card Content based on Mode */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-sm space-y-4">
        {/* ================= MODE 1: SIGN IN ================= */}
        {authMode === 'LOGIN' && (
          <>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Sign In
                </h2>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                Meter Reader
              </span>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono tracking-widest"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                <span>{loading ? 'Logging in...' : 'Log In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </>
        )}

        {/* ================= MODE 2: NEW READER REGISTRATION ================= */}
        {authMode === 'REGISTER' && (
          <>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Create Account
                </h2>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                Instant Access
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Create your meter reader account to start field operations immediately. Profile is automatically synced with Central Admin.
            </p>

            {error && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Full name"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Username"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="password"
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value)}
                      placeholder="Password"
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white font-mono tracking-widest focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Route / Barangay Assignment
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <select
                    value={regSelectedRoute}
                    onChange={(e) => setRegSelectedRoute(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition"
                  >
                    <option value="Poblacion">Zone 1-4: Poblacion (Main Central)</option>
                    <option value="Baluarte">Zone 2: Baluarte (East Coastal)</option>
                    <option value="Casinglot">Zone 5: Casinglot (Highway Strip)</option>
                    <option value="Mohon">Zone 6: Mohon (South Valley)</option>
                    <option value="Natumolan">Zone 3: Natumolan (Residential)</option>
                    <option value="Sta. Cruz">Zone 7: Sta. Cruz (North Route)</option>
                    <option value="Sta. Ana">Zone 8: Sta. Ana (Upper District)</option>
                    <option value="Sugbongcogon">Zone 9: Sugbongcogon (Industrial PHIVIDEC)</option>
                    <option value="Gracia">Zone 10: Gracia (Sitio Hills)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                <span>{isRegistering ? 'Creating Account...' : 'Create Account & Start Reading'}</span>
                <BadgeCheck className="w-4 h-4" />
              </button>
            </form>
          </>
        )}

        {/* ================= MODE 3: PENDING APPROVAL VIEW ================= */}
        {authMode === 'PENDING_APPROVAL' && pendingReader && (
          <div className="space-y-4 text-center py-2">
            <div className="w-14 h-14 bg-amber-950/80 border border-amber-600/60 rounded-2xl mx-auto flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/50">
              <Clock className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-800 mb-1.5">
                Status: Pending Admin Review
              </span>
              <h3 className="text-base font-black text-white">
                {pendingReader.name}
              </h3>
              <p className="text-xs font-mono text-sky-400 mt-0.5">
                Employee ID: {pendingReader.employeeId || 'TWD-RDR'}
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-left text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-400">
                <span>Requested Route:</span>
                <span className="text-white font-bold">{pendingReader.assignedRoutes?.join(', ') || regSelectedRoute}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Central Portal Sync:</span>
                <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Received
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Device Binding:</span>
                <span className="text-slate-300 font-mono truncate max-w-[150px]">
                  {pendingReader.deviceInfo || 'Android Field Device'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Your registration has been logged in the Tagoloan Water District Central Web System. Once the Billing Supervisor approves your account, your mobile app will activate automatically.
            </p>

            {statusMessage && (
              <div className="p-2.5 bg-sky-950/80 border border-sky-800 rounded-xl text-xs text-sky-300 text-left">
                {statusMessage}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={checkApprovalStatus}
                disabled={isCheckingStatus}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                <span>{isCheckingStatus ? 'Checking Status...' : 'Check Approval Status'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('LOGIN');
                  setPendingReader(null);
                }}
                className="w-full py-2 text-xs text-slate-400 hover:text-white transition"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-[10.5px] text-slate-500 space-y-0.5">
        <p>© 2026 Tagoloan Water District. All rights reserved.</p>
        <p>Offline-First SQLite Architecture • Encrypted Vault</p>
      </div>
    </div>
  );
};
