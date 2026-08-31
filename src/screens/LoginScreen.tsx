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
  const [regSelectedRoutes, setRegSelectedRoutes] = useState<string[]>(['Poblacion']);
  const [isRegistering, setIsRegistering] = useState(false);

  const TAGOLOAN_BARANGAYS = [
    'Poblacion',
    'Baluarte',
    'Casinglot',
    'Mohon',
    'Natumolan',
    'Sta. Cruz',
    'Sta. Ana',
    'Sugbongcogon',
    'Gracia',
    'Rosario',
  ];

  const toggleRouteSelection = (route: string) => {
    setRegSelectedRoutes((prev) => {
      if (prev.includes(route)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter((r) => r !== route);
      } else {
        return [...prev, route];
      }
    });
  };

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
              zone: (msg.payload.assignedRoutes || regSelectedRoutes).join(', '),
              assignedRoutes: msg.payload.assignedRoutes || regSelectedRoutes,
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
  }, [authMode, pendingReader, regSelectedRoutes, onLogin]);

  // Handle Staff Sign In
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUsername = username.trim();
    const cleanPin = pin.trim();

    if (!cleanUsername) {
      setError('Please enter your username');
      setLoading(false);
      return;
    }
    if (!cleanPin) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try server API login
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
          setLoading(false);
          return;
        }

        if (response.ok && data?.user) {
          if (data.user.status === 'terminated' || data.user.status === 'rejected') {
            setError('This account has been terminated or revoked by administration. Please contact the Tagoloan Water District office.');
            setLoading(false);
            return;
          }
          setLoading(false);
          onLogin(data.user);
          return;
        }

        // If server returned 401/403 with specific user error, show message
        if (response.status < 500 && data?.message) {
          setError(data.message);
          setLoading(false);
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
          if (matched.pin && matched.pin !== cleanPin) {
            setError('Incorrect password. Please try again.');
            setLoading(false);
            return;
          }

          if (matched.status === 'rejected' || matched.status === 'terminated') {
            setError('This account has been terminated or revoked by administration. Please contact the Tagoloan Water District office.');
            setLoading(false);
            return;
          }

          // Automatic access: newly registered and active readers can log right in
          setLoading(false);
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

      // 3. Check default known readers for offline fallback
      const DEFAULT_STAFF: StaffUser[] = [
        {
          id: 'WDT-MR04',
          employeeId: 'TWD-2026-088',
          username: 'reader04',
          name: 'Juan Carlo Bautista',
          role: 'Meter Reader III',
          zone: 'Poblacion, Baluarte',
          assignedRoutes: ['Poblacion', 'Baluarte'],
          status: 'active',
        },
        {
          id: 'WDT-MR02',
          employeeId: 'TWD-2026-042',
          username: 'reader02',
          name: 'Maria Lourdes Santos',
          role: 'Meter Reader II',
          zone: 'Casinglot, Mohon',
          assignedRoutes: ['Casinglot', 'Mohon'],
          status: 'active',
        }
      ];

      const seedMatched = DEFAULT_STAFF.find(
        (s) =>
          s.username.toLowerCase() === cleanUsername.toLowerCase() ||
          s.id.toLowerCase() === cleanUsername.toLowerCase() ||
          (s.employeeId && s.employeeId.toLowerCase() === cleanUsername.toLowerCase())
      );

      if (seedMatched) {
        if (cleanPin === '1234') {
          setLoading(false);
          onLogin(seedMatched);
          return;
        } else {
          setError('Incorrect password. Please try again.');
          setLoading(false);
          return;
        }
      }

      setError('Invalid username or password. Please verify your credentials or register as a new reader.');
    } catch (err: any) {
      setError(err?.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Quick fill recommended accounts into input fields without auto-submitting
  const handleSelectRecommendedAccount = (accountUsername: string, accountPin: string) => {
    setUsername(accountUsername);
    setPin(accountPin);
    setError(null);
    // Explicitly do NOT auto-login. The user can review the inputs and tap the "Log In" button.
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
      assignedRoutes: regSelectedRoutes.length > 0 ? regSelectedRoutes : ['Poblacion'],
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

    // Configure sync engine for the reader's chosen routes
    SyncService.setActiveRoutes(localReaderRecord.assignedRoutes);

    // 3. Immediately launch meter reader terminal for instant operational use
    setIsRegistering(false);
    onLogin({
      id: localReaderRecord.id,
      employeeId: localReaderRecord.employeeId,
      username: localReaderRecord.username,
      name: localReaderRecord.name,
      role: 'Meter Reader I',
      zone: localReaderRecord.assignedRoutes.join(', '),
      assignedRoutes: localReaderRecord.assignedRoutes,
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
    <div className="w-full h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-start px-3 sm:px-4 py-3 sm:py-4 max-w-md mx-auto scrollbar-thin scrollbar-thumb-slate-800">
      {/* Return to Portal Header */}
      {onBackToLanding && (
        <div className="mb-2 shrink-0">
          <button
            type="button"
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Field Portal</span>
          </button>
        </div>
      )}

      {/* Official District Emblem - Compact in Register Mode */}
      <div className={`text-center flex flex-col items-center shrink-0 ${authMode === 'REGISTER' ? 'mb-2.5' : 'mb-3.5'}`}>
        <div className={authMode === 'REGISTER' ? 'mb-1 scale-90 sm:scale-100 origin-center' : 'mb-1.5'}>
          <OfficialLogo size={authMode === 'REGISTER' ? 'md' : 'lg'} glow />
        </div>

        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[9px] font-mono font-medium mb-1">
          <Sparkles className="w-2.5 h-2.5 text-sky-400 animate-pulse" />
          <span>{APP_OFFICIAL_BADGE}</span>
        </div>

        <h1 className={`${authMode === 'REGISTER' ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} font-black tracking-tight text-white uppercase`}>
          {APP_OFFICIAL_TITLE}
        </h1>
        <p className="text-[11px] text-sky-400 font-semibold mt-0.5">
          Field Meter Reader & Billing System (WDT)
        </p>
      </div>

      {/* Auth Mode Toggle Tabs (Sign In vs Register) */}
      {authMode !== 'PENDING_APPROVAL' && (
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 mb-2.5 shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => {
              setAuthMode('LOGIN');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
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
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
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
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-2xl backdrop-blur-sm space-y-3 shrink-0">
        {/* ================= MODE 1: SIGN IN ================= */}
        {authMode === 'LOGIN' && (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
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
              <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3">
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setUsername(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Username"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
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
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setPin(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Password"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono tracking-widest"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{loading ? 'Logging in...' : 'Log In'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Recommended Official Reader Accounts (Fills fields only, requires pressing Log In) */}
            <div className="pt-2.5 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">
                  Recommended Accounts
                </span>
                <span className="text-[9.5px] text-sky-400 font-mono">
                  Tap to fill • Click Log In
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectRecommendedAccount('reader04', '1234')}
                  className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                    username.toLowerCase() === 'reader04'
                      ? 'bg-sky-950/70 border-sky-500 ring-1 ring-sky-500/50'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white font-mono">reader04</span>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/60">
                      PIN: 1234
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">Juan Carlo Bautista</p>
                  <p className="text-[9px] text-sky-400/80 font-mono truncate">Poblacion, Baluarte</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectRecommendedAccount('reader02', '1234')}
                  className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                    username.toLowerCase() === 'reader02'
                      ? 'bg-sky-950/70 border-sky-500 ring-1 ring-sky-500/50'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white font-mono">reader02</span>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/60">
                      PIN: 1234
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">Maria Lourdes Santos</p>
                  <p className="text-[9px] text-sky-400/80 font-mono truncate">Casinglot, Mohon</p>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================= MODE 2: NEW READER REGISTRATION ================= */}
        {authMode === 'REGISTER' && (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Create Reader Account
                </h2>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                Instant Access
              </span>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegUsername(e.target.value)}
                    placeholder="Username"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="password"
                      value={regPin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegPin(e.target.value)}
                      placeholder="Password"
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white font-mono tracking-wider focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Coverage Area Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Assigned Coverage Areas <span className="text-emerald-400 font-normal">({regSelectedRoutes.length} selected)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (regSelectedRoutes.length === TAGOLOAN_BARANGAYS.length) {
                        setRegSelectedRoutes(['Poblacion']);
                      } else {
                        setRegSelectedRoutes([...TAGOLOAN_BARANGAYS]);
                      }
                    }}
                    className="text-[10px] text-sky-400 hover:text-sky-300 font-mono underline cursor-pointer"
                  >
                    {regSelectedRoutes.length === TAGOLOAN_BARANGAYS.length ? 'Reset to 1' : 'Select All'}
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-1 max-h-32 overflow-y-auto p-1.5 bg-slate-950/90 border border-slate-700/80 rounded-xl scrollbar-thin scrollbar-thumb-slate-800">
                  {TAGOLOAN_BARANGAYS.map((brgy) => {
                    const isSelected = regSelectedRoutes.includes(brgy);
                    return (
                      <button
                        key={brgy}
                        type="button"
                        onClick={() => toggleRouteSelection(brgy)}
                        className={`flex items-center justify-between px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer border text-left touch-manipulation ${
                          isSelected
                            ? 'bg-sky-600/30 border-sky-500 text-white font-bold shadow-sm'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="truncate">{brgy}</span>
                        {isSelected ? (
                          <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0 ml-1" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-slate-600 shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50 active:scale-[0.99] mt-1"
              >
                <span>{isRegistering ? 'Creating Account...' : 'Create Account & Start'}</span>
                <BadgeCheck className="w-4 h-4" />
              </button>
            </form>
          </>
        )}

        {/* ================= MODE 3: PENDING APPROVAL VIEW ================= */}
        {authMode === 'PENDING_APPROVAL' && pendingReader && (
          <div className="space-y-3 text-center py-1">
            <div className="w-12 h-12 bg-amber-950/80 border border-amber-600/60 rounded-2xl mx-auto flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/50">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-800 mb-1">
                Status: Pending Admin Review
              </span>
              <h3 className="text-sm font-black text-white">
                {pendingReader.name}
              </h3>
              <p className="text-[11px] font-mono text-sky-400 mt-0.5">
                Employee ID: {pendingReader.employeeId || 'TWD-RDR'}
              </p>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-left text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Requested Route:</span>
                <span className="text-white font-bold">{pendingReader.assignedRoutes?.join(', ') || regSelectedRoutes.join(', ')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Central Portal Sync:</span>
                <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Received
                </span>
              </div>
            </div>

            {statusMessage && (
              <div className="p-2 bg-sky-950/80 border border-sky-800 rounded-xl text-xs text-sky-300 text-left">
                {statusMessage}
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={checkApprovalStatus}
                disabled={isCheckingStatus}
                className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition cursor-pointer"
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
                className="w-full py-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 text-center text-[10px] text-slate-500 space-y-0.5 shrink-0 pb-2">
        <p>© 2026 Tagoloan Water District. All rights reserved.</p>
        <p>Offline-First SQLite Architecture • Encrypted Vault</p>
      </div>
    </div>
  );
};
