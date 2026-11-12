import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Ban, ShieldAlert } from 'lucide-react';
import { 
  Consumer, 
  MeterReading, 
  StaffUser, 
  SyncState, 
  ActiveScreen, 
  AuditLog 
} from './types';
import { DatabaseHelper } from './services/databaseHelper';
import { SyncService } from './services/syncService';
import { LoggerService } from './services/loggerService';
import { WebSocketService, WSConnectionStatus } from './services/websocketService';
import { WDTHeader } from './components/WDTHeader';
import { WDTBottomNav } from './components/WDTBottomNav';
import { MobileFrameWrapper } from './components/MobileFrameWrapper';
import { DownloadApkModal } from './components/DownloadApkModal';
import { ScreenTransition } from './components/ScreenTransition';
import { ModuleLoadingScreen, LoadingProcessInfo } from './components/ModuleLoadingScreen';
import { AppSplashScreen } from './components/AppSplashScreen';

// Screens
import { LandingScreen } from './screens/LandingScreen';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ConsumersScreen } from './screens/ConsumersScreen';
import { ConsumerDetailsScreen } from './screens/ConsumerDetailsScreen';
import { ReadingEntryScreen } from './screens/ReadingEntryScreen';
import { ScanMeterScreen } from './screens/ScanMeterScreen';
import { BatchSubmissionScreen } from './screens/BatchSubmissionScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { AuditLogScreen } from './screens/AuditLogScreen';
import { DebugScreen } from './screens/DebugScreen';
import { MeterReadersScreen } from './screens/MeterReadersScreen';
import { FlutterConfigScreen } from './screens/FlutterConfigScreen';
import { SystemConnectionScreen } from './screens/SystemConnectionScreen';
import { ArchitectureSecurityScreen } from './screens/ArchitectureSecurityScreen';
import { AppErrorBoundary, ScreenErrorBoundary } from './components/ErrorBoundary';

export function App() {
  // Restore persistent meter reader session if user exited without logging out
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('twd_active_user') || localStorage.getItem('wdt_reader_user');
      if (saved) {
        const user = JSON.parse(saved);
        if (user && user.id && user.name) {
          // If deactivated / terminated, reject
          if (user.status === 'terminated' || user.status === 'rejected') {
            localStorage.removeItem('twd_active_user');
            localStorage.removeItem('wdt_reader_user');
            return null;
          }
          return user;
        }
      }
    } catch (e) {
      console.warn('Error restoring persisted session:', e);
    }
    return null;
  });
  
  // Starting screen: if user is already logged in, resume on dashboard/last active screen; otherwise landing
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>(() => {
    if (typeof window === 'undefined') return 'landing';
    try {
      const savedUser = localStorage.getItem('twd_active_user') || localStorage.getItem('wdt_reader_user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        if (user && user.id && user.status !== 'terminated' && user.status !== 'rejected') {
          const savedScreen = localStorage.getItem('twd_active_screen_v1');
          if (savedScreen && savedScreen !== 'landing' && savedScreen !== 'login') {
            return savedScreen as ActiveScreen;
          }
          return 'dashboard';
        }
      }
    } catch {}
    return 'landing';
  });

  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [syncState, setSyncState] = useState<SyncState>(SyncService.getSyncState());
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null);
  const [isMobileChassis, setIsMobileChassis] = useState<boolean>(true);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);
  const [liveAdminAlert, setLiveAdminAlert] = useState<{
    type: 'status_deactivated' | 'status_activated' | 'meter_deactivated' | 'meter_activated' | 'id_issued' | 'reading_approved';
    title: string;
    message: string;
    timestamp: string;
  } | null>(null);
  const [terminatedLockout, setTerminatedLockout] = useState<{
    name: string;
    employeeId?: string;
    reason?: string;
  } | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [wsStatus, setWsStatus] = useState<WSConnectionStatus>('CONNECTING');
  const [loadingProcess, setLoadingProcess] = useState<LoadingProcessInfo | null>(null);
  const [isBootSplash, setIsBootSplash] = useState<boolean>(true);
  const [loginInitialMode, setLoginInitialMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Clear any stale legacy hash from previous sessions only if not logged in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!currentUser && window.location.hash !== '#landing' && window.location.hash !== '') {
        window.location.hash = 'landing';
      }
    }
  }, [currentUser]);

  // Listen for native Android WebAPK beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // OCR transfer state
  const [ocrInitialData, setOcrInitialData] = useState<{
    readingValue?: number;
    photoUrl?: string;
    confidence?: number;
  }>({});

  const currentUserRef = useRef<StaffUser | null>(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Initialize DB, WebSocket and background services
  useEffect(() => {
    const initApp = async () => {
      // Initialize DatabaseHelper (loads default Tagoloan seed data if empty)
      await DatabaseHelper.init();
      
      const user = currentUserRef.current;
      const routes = user?.assignedRoutes || (user?.zone ? [user.zone] : undefined);
      const [initialConsumers, allReadings, allLogs] = await Promise.all([
        user ? DatabaseHelper.getConsumersForReader(routes) : Promise.resolve([]),
        DatabaseHelper.getAllReadings(),
        DatabaseHelper.getAllAuditLogs(),
      ]);

      setConsumers(initialConsumers);
      setReadings(allReadings);
      setAuditLogs(allLogs);

      // Start Sync engine
      SyncService.init();
      if (user) {
        SyncService.setActiveReader(user);
        SyncService.setActiveRoutes(routes || ['Poblacion']);
      }
      SyncService.startAutoSync();

      // Initialize Real-time WebSocket engine
      WebSocketService.init();
    };

    initApp();

    // Subscribe to SyncService
    const unsubscribeSync = SyncService.subscribe((state) => {
      setSyncState(state);
      const user = currentUserRef.current;
      if (user) {
        const routes = user.assignedRoutes || (user.zone ? [user.zone] : undefined);
        DatabaseHelper.getConsumersForReader(routes).then(setConsumers);
      } else {
        setConsumers([]);
      }
      DatabaseHelper.getAllReadings().then(setReadings);
      DatabaseHelper.getAllAuditLogs().then(setAuditLogs);
    });

    // Subscribe to WebSocket status
    const unsubscribeWSStatus = WebSocketService.subscribeStatus((status) => {
      setWsStatus(status);
    });

    // Subscribe to WebSocket broadcast events
    const unsubscribeWSEvents = WebSocketService.subscribe((event) => {
      if (event.type === 'BATCH_SYNC_PROCESSED') {
        DatabaseHelper.getAllReadings().then(setReadings).catch(() => {});
        DatabaseHelper.getAllAuditLogs().then(setAuditLogs).catch(() => {});
      } else if (event.type === 'METER_STATUS_UPDATED') {
        const payload = event.payload;
        const newStatus = (payload.newStatus || '').toLowerCase();
        const isDeactivated = newStatus === 'inactive' || newStatus === 'damaged' || newStatus === 'maintenance' || newStatus === 'unassigned';

        // 1. Immediately update local IndexedDB record
        DatabaseHelper.updateMeterStatus(payload.meterNumber, payload.newStatus, payload.remarks)
          .then(() => {
            const user = currentUserRef.current;
            const routes = user?.assignedRoutes || (user?.zone ? [user.zone] : undefined);
            return DatabaseHelper.getConsumersForReader(routes);
          })
          .then(setConsumers)
          .catch((err) => console.warn('Meter status sync error:', err));

        // 2. Synchronize selectedConsumer if currently open in terminal or camera
        setSelectedConsumer((prev) => {
          if (!prev) return null;
          const cleanTag = (payload.meterNumber || '').toUpperCase();
          if (
            (prev.meterNumber && prev.meterNumber.toUpperCase() === cleanTag) ||
            (prev.meterSerial && prev.meterSerial.toUpperCase() === cleanTag) ||
            (payload.accountNumber && prev.accountNumber === payload.accountNumber)
          ) {
            return {
              ...prev,
              meterStatus: payload.newStatus,
              meterStatusRemarks: payload.remarks,
            };
          }
          return prev;
        });

        // 3. Trigger Real-time Alert Banner
        setLiveAdminAlert({
          type: isDeactivated ? 'meter_deactivated' : 'meter_activated',
          title: isDeactivated
            ? `⚠️ Water Meter Deactivated: Tag #${payload.meterNumber}`
            : `✅ Water Meter Restored to Active: Tag #${payload.meterNumber}`,
          message: isDeactivated
            ? `Admin changed meter status to ${payload.newStatus?.toUpperCase()} (${payload.remarks || 'No remarks provided'}). This consumer is now unavailable for field readings.`
            : `Admin restored meter to Active. The consumer is once again available for field readings.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      } else if (event.type === 'CONSUMER_STATUS_CHANGED') {
        const payload = event.payload;
        const newStatus = (payload.newStatus || '').toLowerCase();
        const isDeactivated = newStatus !== 'active' && newStatus !== 'reconnected';

        // 1. Update local IndexedDB
        DatabaseHelper.updateConsumerStatus(payload.consumerId || payload.accountNumber, payload.newStatus, undefined, payload.statusReason)
          .then(() => {
            const user = currentUserRef.current;
            const routes = user?.assignedRoutes || (user?.zone ? [user.zone] : undefined);
            return DatabaseHelper.getConsumersForReader(routes);
          })
          .then(setConsumers)
          .catch((err) => console.warn('Consumer status sync error:', err));

        // 2. Update selectedConsumer if currently open
        setSelectedConsumer((prev) => {
          if (!prev) return null;
          if (prev.id === payload.consumerId || prev.accountNumber === payload.accountNumber) {
            return {
              ...prev,
              status: payload.newStatus,
              statusReason: payload.statusReason,
            };
          }
          return prev;
        });

        // 3. Trigger Real-time Alert Banner
        setLiveAdminAlert({
          type: isDeactivated ? 'status_deactivated' : 'status_activated',
          title: isDeactivated
            ? `🚫 Consumer Account Deactivated: #${payload.accountNumber}`
            : `✅ Consumer Account Activated: #${payload.accountNumber}`,
          message: isDeactivated
            ? `Admin marked account as ${payload.newStatus}. This consumer is now unavailable for field readings.`
            : `Admin restored account to Active. Consumer is now available for field readings.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      } else if (event.type === 'CONSUMER_ACTIVATED_FOR_READER' || event.type === 'CONSUMER_UPDATED' || event.type === 'CONSUMER_REGISTRY_UPDATED') {
        const user = currentUserRef.current;
        const routes = user?.assignedRoutes || (user?.zone ? [user.zone] : undefined);
        if (event.payload?.consumer) {
          DatabaseHelper.saveConsumers([event.payload.consumer])
            .then(() => DatabaseHelper.getConsumersForReader(routes))
            .then(setConsumers)
            .catch((err) => console.warn('Consumer save sync error:', err));
        } else {
          DatabaseHelper.getConsumersForReader(routes).then(setConsumers).catch(() => {});
        }

        if (event.type === 'CONSUMER_ACTIVATED_FOR_READER' && event.payload?.consumer) {
          setLiveAdminAlert({
            type: 'id_issued',
            title: `✅ New Consumer Activated: #${event.payload.consumer.accountNumber}`,
            message: `Admin issued Account Number and Meter Tag #${event.payload.consumer.meterNumber || event.payload.consumer.meterSerial} for ${event.payload.consumer.name}. Synchronized to route.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        }
      } else if (
        event.type === 'READER_ACCOUNT_TERMINATED' || 
        event.type === 'READER_TERMINATED' || 
        event.type === 'staff:terminated'
      ) {
        const user = currentUserRef.current;
        const p = event.payload || {};
        const isTarget = user && (
          (p.readerId && p.readerId.toLowerCase() === user.id.toLowerCase()) ||
          (p.id && p.id.toLowerCase() === user.id.toLowerCase()) ||
          (p.employeeId && user.employeeId && p.employeeId.toLowerCase() === user.employeeId.toLowerCase()) ||
          (p.username && user.username && p.username.toLowerCase() === user.username.toLowerCase())
        );

        // Update local database record & automatically release assigned area routes
        const termId = p.readerId || p.id || p.employeeId || p.username;
        if (termId) {
          DatabaseHelper.updateLocalReaderStatus(termId, 'terminated', []).catch(() => {});
        }

        if (isTarget) {
          // Current user was terminated by Admin in Central Admin!
          setTerminatedLockout({
            name: user.name,
            employeeId: user.employeeId,
            reason: p.reason || 'Account revoked or terminated by Administrator in Central Admin.',
          });
          try {
            localStorage.removeItem('wdt_reader_user');
            localStorage.removeItem('twd_active_user');
            localStorage.removeItem('wdt_auth_token');
          } catch {}
          setCurrentUser(null);
          setActiveScreen('login');
        } else {
          // Another reader account was deactivated: routes are now automatically available
          setLiveAdminAlert({
            type: 'status_deactivated',
            title: '⚡ Route Automatically Released & Available',
            message: `Account for ${p.name || 'reader'} was deactivated. Assigned coverage routes have been automatically freed for assignment.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
          reloadData();
        }
      } else if (event.type === 'READING_APPROVED_BILL_ISSUED' || event.type === 'READING_APPROVED') {
        const p = event.payload || {};
        const readingKey = p.accountNumber || p.readingId || (p.reading && (p.reading.accountNumber || p.reading.id));
        const accNum = p.accountNumber || (p.reading && p.reading.accountNumber);
        
        // 1. Immediately update IndexedDB reading status to approved & advance consumer baseline
        if (readingKey) {
          DatabaseHelper.updateReadingApprovalStatus(readingKey, 'approved', {
            accountNumber: accNum,
            approvedBy: p.approvedBy || 'Admin Supervisor',
            approvedAt: p.timestamp || new Date().toISOString(),
            currentReading: p.currentReading,
            previousReading: p.previousReading,
            consumption: p.consumption,
          }).then(({ consumer: updatedC }) => {
            if (updatedC) {
              setSelectedConsumer((prev) => {
                if (!prev) return null;
                if (prev.id === updatedC.id || prev.accountNumber === updatedC.accountNumber) {
                  return {
                    ...prev,
                    previousReading: updatedC.previousReading,
                    previousConsumption: updatedC.previousConsumption,
                    isReadThisMonth: true,
                    currentMonthReading: updatedC.currentMonthReading,
                  };
                }
                return prev;
              });
            }
          }).catch(() => {});
        }

        reloadData();

        try {
          window.dispatchEvent(new CustomEvent('twd:reading_approved', { detail: p }));
        } catch {}

        setLiveAdminAlert({
          type: 'reading_approved',
          title: `✅ Reading Approved by Admin: #${p.accountNumber || 'Verified'}`,
          message: `Admin verified present reading (${p.currentReading ?? '✓'} cu.m.) for ${p.consumerName || 'Account'}. Status updated to APPROVED, billing statement issued & baseline saved.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      } else if (event.type === 'READING_REJECTED_REINSPECT' || event.type === 'READING_REJECTED') {
        const p = event.payload || {};
        const readingKey = p.readingId || p.accountNumber || (p.reading && (p.reading.id || p.reading.accountNumber));

        if (readingKey) {
          DatabaseHelper.updateReadingApprovalStatus(readingKey, 'rejected', {
            rejectionReason: p.reason,
          }).catch(() => {});
        }

        reloadData();

        try {
          window.dispatchEvent(new CustomEvent('twd:reading_rejected', { detail: p }));
        } catch {}

        setLiveAdminAlert({
          type: 'status_deactivated',
          title: `⚠️ Reading Flagged: #${p.accountNumber}`,
          message: `Admin requested re-inspection: ${p.reason || 'Reading index or photo verification needed'}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      } else if (event.type === 'READER_REGISTERED_ACTIVE') {
        const p = event.payload || {};
        setLiveAdminAlert({
          type: 'status_activated',
          title: `⚡ Reader Enrolled: ${p.reader?.name || 'Field Staff'}`,
          message: `Auto-synced into Central Admin Meter Readers module (${p.reader?.employeeId || ''}). Status ACTIVE.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    });

    return () => {
      unsubscribeSync();
      unsubscribeWSStatus();
      unsubscribeWSEvents();
      SyncService.stopAutoSync();
    };
  }, []);

  // Reload data helper
  const reloadData = useCallback(async () => {
    const readerRoutes = currentUser?.assignedRoutes || (currentUser?.zone ? [currentUser.zone] : undefined);
    const [c, r, l] = await Promise.all([
      DatabaseHelper.getConsumersForReader(readerRoutes),
      DatabaseHelper.getAllReadings(),
      DatabaseHelper.getAllAuditLogs(),
    ]);
    setConsumers(c);
    setReadings(r);
    setAuditLogs(l);
  }, [currentUser]);

  // Unified Navigation with Process Loading Screen and WebSocket Dispatcher
  const navigateTo = (
    targetScreen: ActiveScreen, 
    customProcess?: Partial<LoadingProcessInfo>
  ) => {
    if (activeScreen === targetScreen && !customProcess) return;

    if (currentUser && targetScreen !== 'login' && targetScreen !== 'landing') {
      try {
        localStorage.setItem('twd_active_screen_v1', targetScreen);
      } catch {}
    }

    // 1. Emit real-time WebSocket packet to central server & peers
    WebSocketService.notifyModuleNavigation(activeScreen, targetScreen, currentUser, {
      previousScreen: activeScreen,
      timestamp: new Date().toISOString(),
      metadata: customProcess?.metadata || {},
    });

    // 2. Trigger sleek module loading screen with process telemetry
    setLoadingProcess({
      type: customProcess?.type || 'module_transition',
      targetModule: targetScreen,
      title: customProcess?.title || '',
      subtitle: customProcess?.subtitle || '',
      steps: customProcess?.steps,
      durationMs: customProcess?.durationMs || 280,
      metadata: customProcess?.metadata,
    });
  };

  const handleFinishLoadingProcess = () => {
    if (loadingProcess?.targetModule) {
      setActiveScreen(loadingProcess.targetModule);
      if (currentUser && loadingProcess.targetModule !== 'login' && loadingProcess.targetModule !== 'landing') {
        try {
          localStorage.setItem('twd_active_screen_v1', loadingProcess.targetModule);
        } catch {}
      }
    }
    setLoadingProcess(null);
  };

  // Handlers
  const handleLogin = async (user: StaffUser) => {
    currentUserRef.current = user;
    setCurrentUser(user);

    // Persist session so user remains logged in when exiting app without signing out
    try {
      localStorage.setItem('twd_active_user', JSON.stringify(user));
      localStorage.setItem('wdt_reader_user', JSON.stringify(user));
      localStorage.setItem('twd_active_screen_v1', 'dashboard');
    } catch (e) {
      console.warn('Failed to persist user session:', e);
    }
    
    // Configure background sync & database queries strictly for reader's coverage zones
    const routes = user.assignedRoutes || (user.zone ? [user.zone] : ['Poblacion']);
    SyncService.setActiveRoutes(routes);
    SyncService.setActiveReader(user);

    // Broadcast login over WebSocket
    WebSocketService.send('FIELD_STAFF_ACTIVITY', {
      action: 'LOGIN',
      readerId: user.id,
      readerName: user.name,
      timestamp: new Date().toISOString(),
    });

    await LoggerService.logAction(
      'STAFF_LOGIN',
      user.id,
      user.name,
      `Field Reader ${user.name} logged into WDT Mobile Terminal (Coverage: ${routes.join(', ')}).`
    );
    
    navigateTo('dashboard', {
      type: 'login',
      title: 'Authenticating Field Reader',
      subtitle: `Welcome, ${user.name} (${user.role})`,
      durationMs: 380,
    });

    const [assignedConsumers, allReadings, allLogs] = await Promise.all([
      DatabaseHelper.getConsumersForReader(routes),
      DatabaseHelper.getAllReadings(),
      DatabaseHelper.getAllAuditLogs(),
    ]);
    setConsumers(assignedConsumers);
    setReadings(allReadings);
    setAuditLogs(allLogs);

    // Trigger instant targeted sync for assigned coverage areas
    SyncService.syncNow()
      .then(() => {
        DatabaseHelper.getConsumersForReader(routes).then(setConsumers);
      })
      .catch(() => {});
  };

  const handleLogout = async () => {
    // Explicit sign out clears persistent session
    try {
      localStorage.removeItem('twd_active_user');
      localStorage.removeItem('wdt_reader_user');
      localStorage.removeItem('twd_active_screen_v1');
    } catch {}

    if (currentUser) {
      await LoggerService.logAction(
        'STAFF_LOGOUT',
        currentUser.id,
        currentUser.name,
        `Field Reader ${currentUser.name} signed out.`
      );

      WebSocketService.send('FIELD_STAFF_ACTIVITY', {
        action: 'LOGOUT',
        readerId: currentUser.id,
        readerName: currentUser.name,
        timestamp: new Date().toISOString(),
      });
    }

    currentUserRef.current = null;
    SyncService.setActiveRoutes([]);
    SyncService.setActiveReader(null);
    setCurrentUser(null);
    setConsumers([]);

    setLoadingProcess({
      type: 'logout',
      targetModule: 'landing',
      title: 'Signing Out Terminal Session',
      subtitle: 'Securing offline SQLite caches...',
      durationMs: 300,
    });

    setTimeout(() => {
      setCurrentUser(null);
      setActiveScreen('landing');
      setLoadingProcess(null);
    }, 300);
  };

  const handleStartReading = (consumer: Consumer) => {
    setSelectedConsumer(consumer);
    setOcrInitialData({});

    WebSocketService.notifyProcessEvent('START_READING', 'STARTING', {
      accountNumber: consumer.accountNumber,
      consumerName: consumer.name,
      previousReading: consumer.previousReading,
    });

    navigateTo('reading_entry', {
      title: 'Opening Consumer Billing Terminal',
      subtitle: `${consumer.name} • ${consumer.accountNumber}`,
      durationMs: 320,
    });
  };

  const handleScanMeter = (consumer?: Consumer) => {
    if (consumer) {
      setSelectedConsumer(consumer);
    }

    WebSocketService.notifyProcessEvent('CAMERA_SCAN_INIT', 'STARTING', {
      consumerId: consumer?.id,
      accountNumber: consumer?.accountNumber,
    });

    navigateTo('scan_meter', {
      title: 'Booting Optical Odometer Vision Sensor',
      subtitle: 'Configuring 6-Crop Multi-ROI & 5-Digit Detection',
      durationMs: 350,
    });
  };

  const handleOCRComplete = (data: { readingValue: number; photoUrl: string; confidence: number }) => {
    setOcrInitialData(data);

    WebSocketService.notifyProcessEvent('OCR_ANALYSIS_COMPLETED', 'COMPLETED', {
      detectedValue: data.readingValue,
      confidence: data.confidence,
    });

    navigateTo('reading_entry', {
      title: 'Applying 5-Digit Odometer Capture',
      subtitle: `Verified Index: ${data.readingValue} cu.m (${(data.confidence * 100).toFixed(0)}% optical confidence)`,
      durationMs: 320,
    });
  };

  const handleSaveReading = async (reading: MeterReading) => {
    // Strictly prevent saving if current reading is less than previous reading
    if (reading.currentReading < reading.previousReading) {
      console.error('Validation Error: Current reading cannot be less than previous reading');
      return;
    }

    // Save to local database (IndexedDB / SQLite)
    await DatabaseHelper.saveReading(reading);
    
    // Broadcast live reading via WebSocket to Central Portal
    WebSocketService.send('FIELD_READING_RECORDED', {
      readingId: reading.id,
      accountNumber: reading.accountNumber,
      consumerName: reading.consumerName,
      consumption: reading.consumption,
      totalAmount: reading.billCalculation.totalAmountDue,
      readerId: reading.readerId,
    });

    await LoggerService.logAction(
      'RECORD_READING',
      currentUser?.id || 'SYSTEM',
      currentUser?.name || 'Reader',
      `Logged reading ${reading.currentReading} cu.m for Acc: ${reading.accountNumber} (${reading.consumerName}). Consumption: ${reading.consumption} cu.m. Stored locally.`
    );
    await reloadData();
    setSelectedConsumer((prev) => {
      if (!prev) return null;
      if (prev.id === reading.consumerId || prev.accountNumber === reading.accountNumber) {
        return {
          ...prev,
          isReadThisMonth: true,
          currentMonthReading: reading,
        };
      }
      return prev;
    });
  };

  const handleTriggerSync = async () => {
    setLoadingProcess({
      type: 'batch_sync',
      targetModule: 'batch_submission',
      title: 'Synchronizing Central Database',
      subtitle: 'Transmitting offline field batches over WebSocket & REST',
      steps: [
        'Extracting pending readings from local storage',
        'Generating batch SHA-256 integrity hash',
        'Establishing WebSocket stream with central billing gateway',
        'Reconciling consumer profiles & billing statuses',
        'Finalizing sync confirmation ledger',
      ],
      durationMs: 500,
    });

    WebSocketService.notifyProcessEvent('MANUAL_SYNC_TRIGGERED', 'IN_PROGRESS', {
      readerId: currentUser?.id,
      pendingCount: pendingReadings.length,
    });

    let res: any = null;
    try {
      res = await SyncService.performSync();
    } catch {
      res = {
        success: true,
        syncedReadingsCount: 0,
        pulledConsumersCount: 0,
        message: 'Local storage verified (Offline ready)',
      };
    }

    setTimeout(() => {
      setLoadingProcess(null);
      navigateTo('batch_submission');
    }, 500);

    return res;
  };

  const handleResetDatabase = async () => {
    setLoadingProcess({
      type: 'reset_database',
      targetModule: 'dashboard',
      title: 'Resetting Local SQLite Database',
      subtitle: 'Restoring Tagoloan Water District seed registry',
      steps: [
        'Clearing local indexedDB storage collections',
        'Reloading initial Misamis Oriental consumer routes',
        'Broadcasting diagnostic event over WebSocket',
        'Resetting device cache',
      ],
      durationMs: 450,
    });

    await DatabaseHelper.clearAllData();
    await DatabaseHelper.init();
    await reloadData();

    WebSocketService.notifyProcessEvent('DATABASE_RESET', 'COMPLETED', {
      readerId: currentUser?.id,
    });

    setTimeout(() => {
      setLoadingProcess(null);
      setActiveScreen('dashboard');
    }, 450);
  };

  const pendingReadings = readings.filter((r: MeterReading) => r.status === 'PENDING_SYNC');
  const syncedReadings = readings.filter((r: MeterReading) => r.status === 'SYNCED');

  // Initial App Opening Loading Screen with Official Logo & Dark Blue Screen
  if (isBootSplash) {
    return <AppSplashScreen onFinish={() => setIsBootSplash(false)} />;
  }

  // If on Landing Screen, render the mobile-framed 3D Landing Page immediately
  if (activeScreen === 'landing') {
    return (
      <MobileFrameWrapper isMobileChassis={isMobileChassis}>
        {/* Dynamic Module & Process Loading Screen */}
        {loadingProcess && (
          <ModuleLoadingScreen
            processInfo={loadingProcess}
            currentUser={currentUser}
            onFinished={handleFinishLoadingProcess}
          />
        )}

        <LandingScreen
          user={currentUser}
          syncState={syncState}
          onNavigate={navigateTo}
          onOpenLogin={(mode = 'LOGIN') => {
            setLoginInitialMode(mode);
            navigateTo('login');
          }}
          onOpenApkModal={() => setIsApkModalOpen(true)}
          wsStatus={wsStatus}
          isMobileChassis={isMobileChassis}
          onToggleChassis={() => setIsMobileChassis(!isMobileChassis)}
        />


        {/* Android APK & Mobile Installation Modal */}
        {isApkModalOpen && (
          <DownloadApkModal
            onClose={() => setIsApkModalOpen(false)}
            deferredPrompt={deferredInstallPrompt}
          />
        )}
      </MobileFrameWrapper>
    );
  }

  // If no user is logged in or user explicitly navigates to login, show Login Screen
  if (!currentUser || activeScreen === 'login') {
    return (
      <MobileFrameWrapper isMobileChassis={isMobileChassis}>
        {loadingProcess && (
          <ModuleLoadingScreen
            processInfo={loadingProcess}
            currentUser={currentUser}
            onFinished={handleFinishLoadingProcess}
          />
        )}

        <LoginScreen 
          onLogin={handleLogin} 
          onBackToLanding={() => navigateTo('landing')}
          initialMode={loginInitialMode}
          onOpenApkModal={() => setIsApkModalOpen(true)}
          deferredPrompt={deferredInstallPrompt}
        />

        {/* Android APK & Mobile Installation Modal on Login Screen */}
        {isApkModalOpen && (
          <DownloadApkModal
            onClose={() => setIsApkModalOpen(false)}
            deferredPrompt={deferredInstallPrompt}
          />
        )}
      </MobileFrameWrapper>
    );
  }

  return (
    <MobileFrameWrapper isMobileChassis={isMobileChassis}>
      {/* Dynamic Module & Process Loading Screen */}
      {loadingProcess && (
        <ModuleLoadingScreen
          processInfo={loadingProcess}
          currentUser={currentUser}
          onFinished={handleFinishLoadingProcess}
        />
      )}

      {/* Official Tagoloan Water District Navigation Bar - Hidden on Camera Viewfinder */}
      {activeScreen !== 'scan_meter' && (
        <WDTHeader
          user={currentUser}
          syncState={syncState}
          onSyncTrigger={handleTriggerSync}
          onLogout={handleLogout}
          onNavigate={navigateTo}
          currentScreen={activeScreen}
          isMobileChassis={isMobileChassis}
          onToggleChassis={() => setIsMobileChassis(!isMobileChassis)}
          onOpenApkModal={() => setIsApkModalOpen(true)}
          wsStatus={wsStatus}
        />
      )}

      {/* Real-time Administrator Event Alert Banner */}
      {liveAdminAlert && (
        <div className={`px-4 py-2.5 text-xs flex items-center justify-between border-b shrink-0 animate-in slide-in-from-top-2 z-30 ${
          liveAdminAlert.type.includes('deactivated')
            ? 'bg-rose-950/90 border-rose-800 text-rose-200'
            : liveAdminAlert.type === 'id_issued'
            ? 'bg-sky-950/90 border-sky-800 text-sky-200'
            : 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
        }`}>
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              liveAdminAlert.type.includes('deactivated') ? 'bg-rose-400' : 'bg-emerald-400'
            }`} />
            <div className="truncate">
              <strong className="block text-white text-xs">{liveAdminAlert.title}</strong>
              <span className="text-xs opacity-90 truncate block">{liveAdminAlert.message}</span>
            </div>
          </div>
          <button
            onClick={() => setLiveAdminAlert(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-white font-bold text-xs shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Dynamic View with Flutter Material 3 Screen Transitions */}
      <main
        className={`flex-1 min-h-0 flex flex-col bg-slate-950 ${
          activeScreen === 'scan_meter'
            ? 'h-full overflow-hidden p-0 m-0 [overscroll-behavior:none]'
            : 'overflow-y-auto overflow-x-hidden [overscroll-behavior:contain] pb-4'
        }`}
      >
        <ScreenTransition screenKey={activeScreen}>
          {activeScreen === 'dashboard' && (
            <ScreenErrorBoundary screenName="Dashboard" onRecoverToDashboard={() => navigateTo('dashboard')}>
              <DashboardScreen
                user={currentUser}
                consumers={consumers}
                readings={readings}
                syncState={syncState}
                onNavigate={navigateTo}
                onSelectConsumer={(c: Consumer) => {
                  setSelectedConsumer(c);
                  navigateTo('consumer_details', {
                    title: 'Loading Consumer Profile',
                    subtitle: `${c.name} (${c.accountNumber})`,
                  });
                }}
                onStartReading={handleStartReading}
                onSyncTrigger={handleTriggerSync}
                onOpenApkModal={() => setIsApkModalOpen(true)}
              />
            </ScreenErrorBoundary>
          )}

          {activeScreen === 'consumers' && (
            <ScreenErrorBoundary screenName="Consumers Directory" onRecoverToDashboard={() => navigateTo('dashboard')}>
              <ConsumersScreen
                consumers={consumers}
                currentUser={currentUser}
                onSelectConsumer={(c: Consumer) => {
                  setSelectedConsumer(c);
                  navigateTo('consumer_details', {
                    title: 'Loading Consumer Profile',
                    subtitle: `${c.name} (${c.accountNumber})`,
                  });
                }}
                onNavigate={navigateTo}
                onStartReading={handleStartReading}
              />
            </ScreenErrorBoundary>
          )}

          {activeScreen === 'consumer_details' && (
            <ScreenErrorBoundary screenName="Consumer Details" onRecoverToDashboard={() => navigateTo('dashboard')}>
              {selectedConsumer ? (
                <ConsumerDetailsScreen
                  consumer={selectedConsumer}
                  readings={readings}
                  onStartReading={handleStartReading}
                  onScanMeter={handleScanMeter}
                  onNavigate={navigateTo}
                />
              ) : (
                <ConsumersScreen
                  consumers={consumers}
                  currentUser={currentUser}
                  onSelectConsumer={(c: Consumer) => {
                    setSelectedConsumer(c);
                    navigateTo('consumer_details', {
                      title: 'Loading Consumer Profile',
                      subtitle: `${c.name} (${c.accountNumber})`,
                    });
                  }}
                  onNavigate={navigateTo}
                  onStartReading={handleStartReading}
                />
              )}
            </ScreenErrorBoundary>
          )}

          {activeScreen === 'reading_entry' && (
            <ScreenErrorBoundary screenName="Reading Entry Form" onRecoverToDashboard={() => navigateTo('dashboard')}>
              {selectedConsumer ? (
                <ReadingEntryScreen
                  consumer={selectedConsumer}
                  user={currentUser}
                  allConsumers={consumers}
                  initialReadingValue={ocrInitialData.readingValue}
                  initialPhotoUrl={ocrInitialData.photoUrl}
                  initialOcrConfidence={ocrInitialData.confidence}
                  onSaveReading={handleSaveReading}
                  onNavigate={navigateTo}
                  onScanWithCamera={handleScanMeter}
                  onSelectNextConsumer={(c: Consumer) => setSelectedConsumer(c)}
                />
              ) : (
                <ConsumersScreen
                  consumers={consumers}
                  currentUser={currentUser}
                  onSelectConsumer={(c: Consumer) => {
                    setSelectedConsumer(c);
                    navigateTo('reading_entry', {
                      title: 'Loading Reading Form',
                      subtitle: `${c.name} (${c.accountNumber})`,
                    });
                  }}
                  onNavigate={navigateTo}
                  onStartReading={handleStartReading}
                />
              )}
            </ScreenErrorBoundary>
          )}

          {activeScreen === 'scan_meter' && (
            <ScreenErrorBoundary screenName="Camera OCR Viewfinder" onRecoverToDashboard={() => navigateTo('dashboard')}>
              <ScanMeterScreen
                consumer={selectedConsumer}
                currentUser={currentUser}
                onNavigate={navigateTo}
                onOCRComplete={handleOCRComplete}
                onSelectConsumer={(c: Consumer) => setSelectedConsumer(c)}
                onSaveReading={handleSaveReading}
                onReloadData={reloadData}
              />
            </ScreenErrorBoundary>
          )}

          {activeScreen === 'batch_submission' && (
            <ScreenErrorBoundary screenName="Batch Submission" onRecoverToDashboard={() => navigateTo('dashboard')}>
              <BatchSubmissionScreen
                pendingReadings={pendingReadings}
                syncedReadings={syncedReadings}
                syncState={syncState}
                onSyncTrigger={handleTriggerSync}
                onNavigate={navigateTo}
              />
            </ScreenErrorBoundary>
          )}

          {activeScreen === 'history' && (
            <ScreenErrorBoundary screenName="Reading History" onRecoverToDashboard={() => navigateTo('dashboard')}>
              <HistoryScreen
                readings={readings}
                consumers={consumers}
                onSelectConsumer={(c: Consumer) => {
                  setSelectedConsumer(c);
                  navigateTo('consumer_details', {
                    title: 'Loading Consumer Profile',
                    subtitle: `${c.name} (${c.accountNumber})`,
                  });
                }}
                onNavigate={navigateTo}
                onReload={reloadData}
              />
            </ScreenErrorBoundary>
          )}

          {activeScreen === 'audit_log' && (
            <ScreenErrorBoundary screenName="Audit Log" onRecoverToDashboard={() => navigateTo('dashboard')}>
              <AuditLogScreen
                logs={auditLogs}
                onNavigate={navigateTo}
              />
            </ScreenErrorBoundary>
          )}

          {activeScreen === 'debug' && (
            <ScreenErrorBoundary screenName="Diagnostics" onRecoverToDashboard={() => navigateTo('dashboard')}>
              <DebugScreen
                syncState={syncState}
                onNavigate={navigateTo}
                onResetDatabase={handleResetDatabase}
                onSyncTrigger={handleTriggerSync}
              />
            </ScreenErrorBoundary>
          )}

          {activeScreen === 'architecture_security' && (
            <ScreenErrorBoundary screenName="Security & Resilience Architecture" onRecoverToDashboard={() => navigateTo('dashboard')}>
              <ArchitectureSecurityScreen
                user={currentUser}
                onNavigate={navigateTo}
              />
            </ScreenErrorBoundary>
          )}

          {activeScreen === 'meter_readers' && (
            <ScreenErrorBoundary screenName="Meter Readers" onRecoverToDashboard={() => navigateTo('dashboard')}>
              <MeterReadersScreen
                currentUser={currentUser}
                onNavigate={navigateTo}
                onSwitchUser={(user) => {
                  try {
                    localStorage.setItem('twd_active_user', JSON.stringify(user));
                    localStorage.setItem('wdt_reader_user', JSON.stringify(user));
                  } catch {}
                  setCurrentUser(user);
                  SyncService.setActiveReader(user);
                  reloadData();
                }}
              />
            </ScreenErrorBoundary>
          )}

          {(activeScreen === 'system_connection' || activeScreen === 'flutter_config' || activeScreen === 'token_setup') && (
            <ScreenErrorBoundary screenName="System Connection" onRecoverToDashboard={() => navigateTo('dashboard')}>
              <SystemConnectionScreen
                user={currentUser}
                onNavigate={navigateTo}
                onOpenApkModal={() => setIsApkModalOpen(true)}
                onSyncTrigger={handleTriggerSync}
              />
            </ScreenErrorBoundary>
          )}
        </ScreenTransition>
      </main>


      {/* Elegant Dark Persistent Navigation Bar (Pinned and Locked) */}
      {activeScreen !== 'scan_meter' && (
        <WDTBottomNav
          activeScreen={activeScreen}
          onNavigate={navigateTo}
          pendingCount={pendingReadings.length}
        />
      )}

      {/* Android APK & Mobile Installation Modal */}
      {isApkModalOpen && (
        <DownloadApkModal
          onClose={() => setIsApkModalOpen(false)}
          deferredPrompt={deferredInstallPrompt}
        />
      )}

      {/* 🚫 FULL-SCREEN LOCKOUT MODAL WHEN READER TERMINATED BY CENTRAL ADMIN */}
      {terminatedLockout && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-500 w-full max-w-sm rounded-2xl p-5 shadow-2xl text-center space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border-2 border-rose-500 flex items-center justify-center mx-auto text-rose-400 shadow-lg shadow-rose-950/50">
              <Ban className="w-8 h-8 text-rose-400" />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-mono uppercase tracking-widest px-3 py-1 rounded-full bg-rose-950 border border-rose-700 text-rose-300 font-bold">
                ACCESS REVOKED BY ADMIN
              </span>
              <h3 className="text-xl font-black text-white pt-1">
                Account Terminated
              </h3>
              <p className="text-xs font-semibold text-rose-300">
                {terminatedLockout.name} {terminatedLockout.employeeId ? `(${terminatedLockout.employeeId})` : ''}
              </p>
            </div>

            <div className="p-3.5 bg-rose-950/40 border border-rose-900/80 rounded-xl text-left text-xs text-rose-200 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-rose-300">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Termination Notice:</span>
              </div>
              <p className="text-xs leading-relaxed text-rose-200/90">
                {terminatedLockout.reason || 'This account has been deactivated or terminated by the Central Administrator.'}
              </p>
              <p className="text-xs text-slate-400 pt-1 leading-normal border-t border-rose-900/50">
                Field operations, route access, and reading submissions have been blocked for this device. Please report to the Tagoloan Water District office.
              </p>
            </div>

            <button
              onClick={() => {
                setTerminatedLockout(null);
                setActiveScreen('login');
              }}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm uppercase tracking-wider shadow-md transition active:scale-95 cursor-pointer"
            >
              Exit to Login Screen
            </button>
          </div>
        </div>
      )}
    </MobileFrameWrapper>
  );
}

export default App;
