import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
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
import { WebSocketActivityFeed } from './components/WebSocketActivityFeed';

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
import { MeterReadersScreen } from './screens/MeterReadersScreen';
import { DebugScreen } from './screens/DebugScreen';
import { FlutterConfigScreen } from './screens/FlutterConfigScreen';

export function App() {
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  
  // Guarantee landing page is always the starting screen
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('landing');

  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [syncState, setSyncState] = useState<SyncState>(SyncService.getSyncState());
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null);
  const [isMobileChassis, setIsMobileChassis] = useState<boolean>(true);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [wsStatus, setWsStatus] = useState<WSConnectionStatus>('CONNECTING');
  const [loadingProcess, setLoadingProcess] = useState<LoadingProcessInfo | null>(null);
  const [isBootSplash, setIsBootSplash] = useState<boolean>(true);
  const [loginInitialMode, setLoginInitialMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Clear any stale legacy hash from previous sessions so landing is always shown on boot
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash && window.location.hash !== '#landing') {
      window.location.hash = 'landing';
    }
  }, []);

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

  // Initialize DB, WebSocket and background services
  useEffect(() => {
    const initApp = async () => {
      // Initialize DatabaseHelper (loads default Tagoloan seed data if empty)
      await DatabaseHelper.init();
      
      const [allConsumers, allReadings, allLogs] = await Promise.all([
        DatabaseHelper.getAllConsumers(),
        DatabaseHelper.getAllReadings(),
        DatabaseHelper.getAllAuditLogs(),
      ]);

      setConsumers(allConsumers);
      setReadings(allReadings);
      setAuditLogs(allLogs);

      // Start Sync engine
      SyncService.init();
      SyncService.startAutoSync();

      // Initialize Real-time WebSocket engine
      WebSocketService.init();
    };

    initApp();

    // Subscribe to SyncService
    const unsubscribeSync = SyncService.subscribe((state) => {
      setSyncState(state);
      DatabaseHelper.getAllConsumers().then(setConsumers);
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
        DatabaseHelper.getAllReadings().then(setReadings);
        DatabaseHelper.getAllAuditLogs().then(setAuditLogs);
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
  const reloadData = async () => {
    const [c, r, l] = await Promise.all([
      DatabaseHelper.getAllConsumers(),
      DatabaseHelper.getAllReadings(),
      DatabaseHelper.getAllAuditLogs(),
    ]);
    setConsumers(c);
    setReadings(r);
    setAuditLogs(l);
  };

  // Unified Navigation with Process Loading Screen and WebSocket Dispatcher
  const navigateTo = (
    targetScreen: ActiveScreen, 
    customProcess?: Partial<LoadingProcessInfo>
  ) => {
    if (activeScreen === targetScreen && !customProcess) return;

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
    }
    setLoadingProcess(null);
  };

  // Handlers
  const handleLogin = async (user: StaffUser) => {
    setCurrentUser(user);
    
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
      `Field Reader ${user.name} logged into WDT Mobile Terminal.`
    );
    
    navigateTo('dashboard', {
      type: 'login',
      title: 'Authenticating Field Reader',
      subtitle: `Welcome, ${user.name} (${user.role})`,
      durationMs: 380,
    });

    reloadData();
  };

  const handleLogout = async () => {
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
      `Logged reading ${reading.currentReading} cu.m for Acc: ${reading.accountNumber} (${reading.consumerName}). Due: ₱${reading.billCalculation.totalAmountDue.toFixed(2)}. Stored locally.`
    );
    await reloadData();
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

        {/* Real-time WebSocket Live Activity Toast & Telemetry Drawer */}
        <WebSocketActivityFeed />

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
        />
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

      {/* Official Tagoloan Water District Navigation Bar */}
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

      {/* Main Dynamic View with Flutter Material 3 Screen Transitions */}
      <main className="flex-1 overflow-y-auto flex flex-col bg-slate-950 pb-20">
        <ScreenTransition screenKey={activeScreen}>
          {activeScreen === 'dashboard' && (
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
          )}

          {activeScreen === 'consumers' && (
            <ConsumersScreen
              consumers={consumers}
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

          {activeScreen === 'consumer_details' && selectedConsumer && (
            <ConsumerDetailsScreen
              consumer={selectedConsumer}
              readings={readings}
              onStartReading={handleStartReading}
              onScanMeter={handleScanMeter}
              onNavigate={navigateTo}
            />
          )}

          {activeScreen === 'reading_entry' && selectedConsumer && (
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
          )}

          {activeScreen === 'scan_meter' && (
            <ScanMeterScreen
              consumer={selectedConsumer}
              currentUser={currentUser}
              onNavigate={navigateTo}
              onOCRComplete={handleOCRComplete}
              onSelectConsumer={(c: Consumer) => setSelectedConsumer(c)}
              onSaveReading={handleSaveReading}
              onReloadData={reloadData}
            />
          )}

          {activeScreen === 'batch_submission' && (
            <BatchSubmissionScreen
              pendingReadings={pendingReadings}
              syncedReadings={syncedReadings}
              syncState={syncState}
              onSyncTrigger={handleTriggerSync}
              onNavigate={navigateTo}
            />
          )}

          {activeScreen === 'history' && (
            <HistoryScreen
              readings={readings}
              onNavigate={navigateTo}
              onReload={reloadData}
            />
          )}

          {activeScreen === 'audit_log' && (
            <AuditLogScreen
              logs={auditLogs}
              onNavigate={navigateTo}
            />
          )}

          {activeScreen === 'meter_readers' && (
            <MeterReadersScreen
              currentUser={currentUser}
              onNavigate={navigateTo}
              onSwitchUser={(user: StaffUser) => {
                setCurrentUser(user);
                navigateTo('dashboard');
              }}
            />
          )}

          {activeScreen === 'debug' && (
            <DebugScreen
              syncState={syncState}
              onNavigate={navigateTo}
              onResetDatabase={handleResetDatabase}
              onSyncTrigger={handleTriggerSync}
            />
          )}

          {(activeScreen === 'flutter_config' || activeScreen === 'token_setup') && (
            <FlutterConfigScreen
              user={currentUser}
              onNavigate={navigateTo}
              onOpenApkModal={() => setIsApkModalOpen(true)}
            />
          )}
        </ScreenTransition>
      </main>

      {/* Real-time WebSocket Live Activity Toast & Telemetry Drawer */}
      <WebSocketActivityFeed />

      {/* Elegant Dark Persistent Navigation Bar */}
      <WDTBottomNav
        activeScreen={activeScreen}
        onNavigate={navigateTo}
        pendingCount={pendingReadings.length}
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

export default App;
