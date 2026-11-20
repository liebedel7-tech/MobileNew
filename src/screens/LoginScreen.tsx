import React, { useState, useEffect, useCallback } from 'react';
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
  Download,
  AlertCircle,
  Ban,
  UserCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { StaffUser, ReaderAccount } from '../types';
import { WebSocketService } from '../services/websocketService';
import { DatabaseHelper } from '../services/databaseHelper';
import { SyncService } from '../services/syncService';
import { universalApiFetch, getApiEndpoint } from '../services/apiConfig';
import { OfficialLogo } from '../components/OfficialLogo';
import { LogoGlassBackdrop } from '../components/LogoGlassBackdrop';
import { APP_OFFICIAL_BADGE, APP_OFFICIAL_TITLE } from '../constants/branding';
import { useDeviceInstallStatus } from '../services/installService';
import { 
  TAGOLOAN_BARANGAYS, 
  calculateLocationOccupancies, 
  checkIsLocationOccupied, 
  areLocationsEqual,
  isReaderAccountDeactivated,
  LocationOccupancy 
} from '../constants/routes';

interface LoginScreenProps {
  onLogin: (user: StaffUser) => void;
  onBackToLanding?: () => void;
  initialMode?: 'LOGIN' | 'REGISTER';
  onOpenApkModal?: () => void;
  deferredPrompt?: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLogin, 
  onBackToLanding,
  initialMode = 'LOGIN',
  onOpenApkModal,
  deferredPrompt,
}) => {
  const { isInstalled } = useDeviceInstallStatus();
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>(initialMode === 'REGISTER' ? 'REGISTER' : 'LOGIN');

  useEffect(() => {
    if (initialMode === 'LOGIN' || initialMode === 'REGISTER') {
      setAuthMode(initialMode);
    }
  }, [initialMode]);

  // Sign In State
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registered Readers State for Real-Time Location Occupancy
  const [registeredReaders, setRegisteredReaders] = useState<ReaderAccount[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmployeeId, setRegEmployeeId] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPin, setRegPin] = useState('');
  const [showRegPin, setShowRegPin] = useState(false);
  const [regContact, setRegContact] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSelectedRoutes, setRegSelectedRoutes] = useState<string[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);

  // Fetch current readers from local database and Central Server to determine occupied routes
  const loadReadersAndOccupancy = useCallback(async () => {
    try {
      const local = await DatabaseHelper.getLocalReaders();
      setRegisteredReaders(local);

      try {
        // 1. Fetch live readers list from Central Server
        const res = await universalApiFetch('/api/readers');
        if (res.ok) {
          const data = await res.json();
          const serverList: ReaderAccount[] = data.readers || data.staff || [];
          if (Array.isArray(serverList) && serverList.length > 0) {
            const map = new Map<string, ReaderAccount>();
            // Add local readers first
            local.forEach(r => map.set((r.username || r.id).toLowerCase(), r));

            // Central server is the single source of truth across all devices
            for (const sr of serverList) {
              const key = (sr.username || sr.id).toLowerCase();
              const existingLocal = map.get(key);
              const isServerActive = sr.status === 'active' || (sr as any).employmentStatus === 'active';

              if (isServerActive) {
                const activeRecord: ReaderAccount = {
                  ...(existingLocal || {}),
                  ...sr,
                  status: 'active',
                  assignedRoutes: Array.isArray(sr.assignedRoutes) ? sr.assignedRoutes : (existingLocal?.assignedRoutes || []),
                };
                map.set(key, activeRecord);
                // Crucial for multi-device: persist active server reader to local storage on this device
                DatabaseHelper.saveLocalReader(activeRecord).catch(() => {});
              } else {
                const isDeactivated = isReaderAccountDeactivated(sr);
                if (isDeactivated) {
                  const deactivatedRecord: ReaderAccount = {
                    ...(existingLocal || sr),
                    ...sr,
                    status: 'terminated',
                    assignedRoutes: [], // Area route assigned is freed
                  };
                  map.set(key, deactivatedRecord);
                  DatabaseHelper.updateLocalReaderStatus(key, 'terminated', []).catch(() => {});
                } else {
                  map.set(key, { ...(existingLocal || {}), ...sr });
                }
              }
            }

            const merged = Array.from(map.values());
            setRegisteredReaders(merged);
          }
        }
      } catch {
        // Offline fallback is already loaded
      }
    } catch (err) {
      console.warn('Error loading readers for occupancy:', err);
    }
  }, []);

  useEffect(() => {
    loadReadersAndOccupancy();
    const interval = setInterval(loadReadersAndOccupancy, 3500);

    // Live WebSocket Listener: When mobile detects any account deactivation/termination, immediately reload & free routes!
    const unsubWs = WebSocketService.subscribe((msg) => {
      if (
        msg.type === 'READER_ACCOUNT_TERMINATED' || 
        msg.type === 'READER_TERMINATED' || 
        msg.type === 'staff:terminated' ||
        msg.type === 'READER_STATUS_CHANGED' ||
        msg.type === 'READER_REGISTERED_ACTIVE' ||
        msg.type === 'READER_APPROVED_ACTIVE'
      ) {
        loadReadersAndOccupancy();
      }
    });

    return () => {
      clearInterval(interval);
      unsubWs();
    };
  }, [loadReadersAndOccupancy]);

  // Compute live location occupancies
  const locationOccupancies: LocationOccupancy[] = calculateLocationOccupancies(registeredReaders);
  const availableLocations = locationOccupancies.filter(l => !l.isOccupied).map(l => l.location);
  const occupiedLocations = locationOccupancies.filter(l => l.isOccupied);

  // Set default initial selection to the first available/unoccupied route
  useEffect(() => {
    if (availableLocations.length > 0) {
      setRegSelectedRoutes(prev => {
        // Filter out any previously selected routes that are now occupied
        const stillAvailable = prev.filter(r => availableLocations.some(av => areLocationsEqual(av, r)));
        if (stillAvailable.length > 0) return stillAvailable;
        return [availableLocations[0]];
      });
    } else {
      setRegSelectedRoutes([]);
    }
  }, [registeredReaders]);

  const toggleRouteSelection = (route: string) => {
    const occ = locationOccupancies.find(l => areLocationsEqual(l.location, route));
    if (occ && occ.isOccupied) {
      // Location is occupied by an active reader - cannot select!
      setError(`⚠️ Location "${route}" is already occupied by assigned reader ${occ.assignedReaderName}. Please select an available location.`);
      return;
    }

    setError(null);
    setRegSelectedRoutes((prev) => {
      if (prev.some(r => areLocationsEqual(r, route))) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter((r) => !areLocationsEqual(r, route));
      } else {
        return [...prev, route];
      }
    });
  };

  // Instant registration success or operational notification
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  // Handle New Meter Reader Registration - Instant Access + Background Admin Sync
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regUsername.trim() || !regPin.trim()) {
      setError('Please fill in Name, Username, and Password');
      return;
    }

    if (regSelectedRoutes.length === 0) {
      setError('Please select at least one available coverage area');
      return;
    }

    // Verify none of the selected routes are occupied by an active reader
    const occupiedConflicts: Array<{ route: string; occupiedBy: string }> = [];
    for (const route of regSelectedRoutes) {
      const occ = locationOccupancies.find(l => areLocationsEqual(l.location, route));
      if (occ && occ.isOccupied) {
        occupiedConflicts.push({ route, occupiedBy: occ.assignedReaderName || 'another meter reader' });
      }
    }

    if (occupiedConflicts.length > 0) {
      const details = occupiedConflicts.map(c => `"${c.route}" (assigned to ${c.occupiedBy})`).join(', ');
      setError(`Cannot register: Location ${details} is already occupied. Please select only available locations.`);
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
      assignedRoutes: [...regSelectedRoutes],
      status: 'active', // Automatically active immediately upon creation
      deviceInfo: navigator.userAgent || 'Field Mobile Device',
      createdAt: new Date().toISOString(),
    };

    try {
      // 1. Instantly save to local database
      await DatabaseHelper.saveLocalReader(localReaderRecord);

      // 2. Dispatch background synchronization to central admin
      try {
        const response = await universalApiFetch('/api/readers/register', {
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
        });

        if (!response.ok) {
          const resData = await response.json().catch(() => null);
          if (resData && resData.message) {
            setError(resData.message);
            setIsRegistering(false);
            return;
          }
        }
      } catch {
        // Continue with local save if offline
      }

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
    } catch (err: any) {
      setIsRegistering(false);
      setError(err?.message || 'Failed to complete registration. Please try again.');
    }
  };



  return (
    <div className="relative w-full h-full min-h-0 flex-1 overflow-hidden flex flex-col bg-slate-950">
      <LogoGlassBackdrop intensity="balanced" />

      <div className="relative z-10 w-full h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-start px-4 py-4 max-w-md mx-auto scrollbar-thin scrollbar-thumb-slate-700/60">
        {/* Return to Portal & Mobile Install Button Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          {onBackToLanding ? (
            <button
              type="button"
              onClick={onBackToLanding}
              className="flex items-center gap-1.5 min-h-[36px] text-xs font-semibold text-sky-300 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Portal</span>
            </button>
          ) : <div />}

          {/* Install Mobile WebAPK / PWA Button on Phone Browser */}
          {!isInstalled && onOpenApkModal && (
            <button
              type="button"
              onClick={onOpenApkModal}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 text-emerald-300 hover:text-white transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-sm"
              title="Install App on Phone"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Install App</span>
            </button>
          )}
        </div>

        {/* Unboxed Official District Emblem & Header over Full-Screen Glass Backdrop */}
        <div className={`text-center flex flex-col items-center shrink-0 ${authMode === 'REGISTER' ? 'mb-3' : 'mb-4'}`}>
          <div className={authMode === 'REGISTER' ? 'mb-2 scale-90 sm:scale-100 origin-center' : 'mb-2.5'}>
            <OfficialLogo size={authMode === 'REGISTER' ? 'md' : 'xl'} />
          </div>

          <p className="text-[11px] font-semibold tracking-wider text-sky-300/90 uppercase mb-1">
            {APP_OFFICIAL_BADGE}
          </p>

          <h1 className={`${authMode === 'REGISTER' ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} font-extrabold tracking-tight text-white drop-shadow-sm`}>
            {APP_OFFICIAL_TITLE}
          </h1>
          <p className="text-xs text-slate-300/90 font-medium mt-0.5">
            Field Meter Reader Mobile Terminal
          </p>
        </div>

        {/* Install App Prompt Bar for Phone Browser - Borderless */}
        {!isInstalled && onOpenApkModal && (
          <button
            type="button"
            onClick={onOpenApkModal}
            className="w-full mb-3 p-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-md text-slate-100 flex items-center justify-between text-xs sm:text-sm transition cursor-pointer active:scale-[0.99] shrink-0"
          >
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="text-left">
                <span className="font-semibold text-white block text-xs sm:text-sm">Install App on Phone</span>
                <span className="text-xs text-slate-300/80">Offline camera scan &amp; field reading</span>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </span>
          </button>
        )}

        {/* Auth Mode Toggle Tabs (Sign In vs Register) - Borderless */}
        <div className="flex bg-white/[0.08] backdrop-blur-md p-1 rounded-xl mb-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              setAuthMode('LOGIN');
              setShowPin(false);
              setShowRegPin(false);
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'LOGIN'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('REGISTER');
              setShowPin(false);
              setShowRegPin(false);
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'REGISTER'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register</span>
          </button>
        </div>

        {/* Seamless Unboxed Auth Content on Full-Screen Glass */}
        <div className="space-y-4 shrink-0">
          {/* ================= MODE 1: SIGN IN ================= */}
          {authMode === 'LOGIN' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Sign In
                  </h2>
                </div>
                <span className="text-xs text-emerald-400 font-semibold">
                  Meter Reader
                </span>
              </div>

              {error && (
                <div className="p-3 bg-rose-950/75 backdrop-blur-md border border-rose-500/40 rounded-xl text-sm text-rose-100 flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setUsername(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter your username"
                    required
                    className="w-full bg-white/10 backdrop-blur-md rounded-xl pl-10 pr-3.5 py-2.5 text-sm sm:text-base text-white placeholder:text-slate-300/70 focus:outline-none focus:bg-white/15 focus:ring-2 focus:ring-sky-400/70 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-300">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setPin(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter your password"
                    required
                    className={`w-full bg-white/10 backdrop-blur-md rounded-xl pl-10 pr-11 py-2.5 text-sm sm:text-base text-white placeholder:text-slate-300/70 focus:outline-none focus:bg-white/15 focus:ring-2 focus:ring-sky-400/70 transition ${
                      showPin ? 'tracking-normal' : 'tracking-widest'
                    }`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPin((prev) => !prev);
                    }}
                    className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-slate-300 hover:text-sky-400 active:text-sky-300 transition cursor-pointer touch-manipulation focus:outline-none z-10 select-none"
                    aria-label={showPin ? "Hide password" : "Show password"}
                    title={showPin ? "Hide password" : "Show password"}
                  >
                    {showPin ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-3 rounded-xl shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </>
        )}

        {/* ================= MODE 2: NEW READER REGISTRATION ================= */}
        {authMode === 'REGISTER' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Create Reader Account
                </h2>
              </div>
              <span className="text-xs text-emerald-400 font-semibold">
                Instant Activation
              </span>
            </div>

            {/* Instant Terminal Availability Note */}
            <div className="py-1 text-xs text-slate-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-white">Immediate Field Access</span>
                <p className="text-xs text-slate-300/85 mt-0.5">
                  Your mobile reader terminal activates immediately with your selected barangay assignment.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/75 backdrop-blur-md border border-rose-500/40 rounded-xl text-sm text-rose-100 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    required
                    className="w-full bg-white/10 backdrop-blur-md rounded-xl pl-10 pr-3.5 py-2.5 text-sm sm:text-base text-white placeholder:text-slate-300/70 focus:outline-none focus:bg-white/15 focus:ring-2 focus:ring-sky-400/70 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-1">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegUsername(e.target.value)}
                    placeholder="Username"
                    required
                    className="w-full bg-white/10 backdrop-blur-md rounded-xl px-3 py-2.5 text-sm sm:text-base text-white placeholder:text-slate-300/70 focus:outline-none focus:bg-white/15 focus:ring-2 focus:ring-sky-400/70 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-1">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-300">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showRegPin ? "text" : "password"}
                      value={regPin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegPin(e.target.value)}
                      placeholder="Password"
                      required
                      className={`w-full bg-white/10 backdrop-blur-md rounded-xl pl-9 pr-10 py-2.5 text-sm sm:text-base text-white placeholder:text-slate-300/70 transition focus:outline-none focus:bg-white/15 focus:ring-2 focus:ring-sky-400/70 ${
                        showRegPin ? 'tracking-normal' : 'tracking-widest'
                      }`}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowRegPin((prev) => !prev);
                      }}
                      className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-slate-400 hover:text-sky-400 active:text-sky-300 transition cursor-pointer touch-manipulation focus:outline-none z-10 select-none"
                      aria-label={showRegPin ? "Hide password" : "Show password"}
                      title={showRegPin ? "Hide password" : "Show password"}
                    >
                      {showRegPin ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Coverage Area Selection with Real-Time Occupancy Detection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-200">
                      Assigned Barangay / Route
                    </label>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      <span className="text-emerald-400 font-semibold">{availableLocations.length} Available</span>
                      {' • '}
                      <span className="text-amber-400 font-semibold">{occupiedLocations.length} Occupied</span>
                      {' • '}
                      <span className="text-sky-300 font-bold">{regSelectedRoutes.length} Selected</span>
                    </span>
                  </div>
                  {availableLocations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (regSelectedRoutes.length === availableLocations.length) {
                          setRegSelectedRoutes([availableLocations[0]]);
                        } else {
                          setRegSelectedRoutes([...availableLocations]);
                        }
                      }}
                      className="text-xs text-sky-400 hover:text-sky-300 underline cursor-pointer"
                    >
                      {regSelectedRoutes.length === availableLocations.length ? 'Pick Single' : 'Select All Available'}
                    </button>
                  )}
                </div>

                {availableLocations.length === 0 ? (
                  <div className="p-3.5 bg-amber-950/70 border border-amber-800/80 rounded-xl text-xs sm:text-sm text-amber-200 flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-amber-300">All Locations Occupied</span>
                      <p className="text-xs text-amber-200/90 mt-0.5">
                        All 10 barangays in Tagoloan Water District currently have active meter readers assigned. Please coordinate with district supervisors.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-white/[0.06] backdrop-blur-md rounded-xl scrollbar-thin scrollbar-thumb-slate-700">
                    {locationOccupancies.map((loc) => {
                      const isOccupied = loc.isOccupied;
                      const isSelected = regSelectedRoutes.some(r => areLocationsEqual(r, loc.location));

                      if (isOccupied) {
                        return (
                          <div
                            key={loc.location}
                            className="flex items-center justify-between p-2.5 rounded-lg text-xs sm:text-sm bg-white/[0.04] text-slate-500 opacity-60 cursor-not-allowed select-none transition"
                            title={`Unavailable: Already assigned to active meter reader ${loc.assignedReaderName}`}
                          >
                            <div className="flex flex-col min-w-0 pr-1.5">
                              <div className="flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="font-semibold text-slate-400 line-through truncate">{loc.location}</span>
                              </div>
                              <span className="text-xs text-amber-400 truncate mt-0.5">
                                Assigned to {loc.assignedReaderName}
                              </span>
                            </div>
                            <span className="text-amber-300 text-xs font-semibold shrink-0">
                              Occupied
                            </span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={loc.location}
                          type="button"
                          onClick={() => toggleRouteSelection(loc.location)}
                          className={`flex items-center justify-between p-2.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer text-left touch-manipulation ${
                            isSelected
                              ? 'bg-sky-500/30 ring-1 ring-sky-400/70 text-white shadow-sm'
                              : 'bg-white/[0.07] text-slate-200 hover:bg-white/[0.12] hover:text-white'
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-1">
                            <span className="truncate">{loc.location}</span>
                            <span className="text-xs text-emerald-400 mt-0.5 font-normal">
                              Available
                            </span>
                          </div>
                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 ml-1" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-500 shrink-0 ml-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isRegistering || availableLocations.length === 0 || regSelectedRoutes.length === 0}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] mt-2"
              >
                <span>{isRegistering ? 'Registering Account...' : 'Register & Launch Terminal'}</span>
                <BadgeCheck className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
        </div>

        <div className="mt-4 text-center text-xs text-slate-300/80 space-y-0.5 shrink-0 pb-2">
          <p>© 2026 Tagoloan Water District. All rights reserved.</p>
          <p>Offline-Ready Field Terminal</p>
        </div>
      </div>
    </div>
  );
};
