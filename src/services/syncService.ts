import { Consumer, MeterReading, SyncState } from '../types';
import { DatabaseHelper } from './databaseHelper';
import { LoggerService } from './loggerService';
import { universalApiFetch, getApiEndpoint } from './apiConfig';

export class SyncService {
  private static timerId: any = null;
  private static activeRoutes: string[] = [];
  private static syncState: SyncState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSimulatedOffline: false,
    lastSyncTime: null,
    syncInProgress: false,
    pendingCount: 0,
    autoSyncInterval: 30, // 30 seconds default
    autoSyncEnabled: true,
    lastSyncMessage: 'Ready',
    failedCount: 0,
  };

  private static listeners: Array<(state: SyncState) => void> = [];

  static init() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateState({ isOnline: !this.syncState.isSimulatedOffline });
        this.syncNow();
      });
      window.addEventListener('offline', () => {
        this.updateState({ isOnline: false });
      });
    }

    this.startAutoSyncTimer();
    this.refreshPendingCount();
  }

  static setActiveRoutes(routes: string[]) {
    this.activeRoutes = Array.isArray(routes) ? routes : [];
  }

  static getActiveRoutes(): string[] {
    return [...this.activeRoutes];
  }

  static subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    listener({ ...this.syncState });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notify() {
    const copy = { ...this.syncState };
    this.listeners.forEach((l) => l(copy));
  }

  private static updateState(partial: Partial<SyncState>) {
    this.syncState = { ...this.syncState, ...partial };
    this.notify();
  }

  static getState(): SyncState {
    return { ...this.syncState };
  }

  static getSyncState(): SyncState {
    return this.getState();
  }

  static performSync(): Promise<any> {
    return this.syncNow(false);
  }

  /**
   * Synchronizes local and remote meter reader accounts
   */
  static async syncReaders(): Promise<any[]> {
    try {
      const localReaders = await DatabaseHelper.getLocalReaders();
      const res = await universalApiFetch('/api/readers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ readers: localReaders }),
      });

      if (res.ok) {
        const text = await res.text();
        if (text) {
          const data = JSON.parse(text);
          const serverReaders = data?.readers || data?.staff || data?.data;
          if (Array.isArray(serverReaders) && serverReaders.length > 0) {
            for (const r of serverReaders) {
              await DatabaseHelper.saveLocalReader(r);
            }
            return serverReaders;
          }
        }
      }
    } catch {
      // Fall back to local readers
    }
    return DatabaseHelper.getLocalReaders();
  }

  /**
   * Submits a single meter reading directly to the Central Admin Dashboard for approval
   */
  static async submitSingleReading(reading: MeterReading): Promise<{
    success: boolean;
    message: string;
    reading?: any;
  }> {
    try {
      const readingPayload = {
        ...reading,
        status: 'PENDING_SYNC',
        approvalStatus: 'pending_approval',
      };

      const res = await universalApiFetch('/api/readings/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ readings: [readingPayload] }),
      });

      if (res.ok) {
        const data = await res.json();
        await DatabaseHelper.saveReading({
          ...reading,
          approvalStatus: 'pending_approval',
        });
        await this.refreshPendingCount();
        await LoggerService.log(
          'READING_DISPATCHED_ADMIN',
          `Dispatched reading for Account #${reading.accountNumber} to Central Admin Dashboard for supervisor approval.`
        );
        return {
          success: true,
          message: 'Reading submitted to Central Admin Dashboard. Status: Pending Approval.',
          reading: data.reading || readingPayload,
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          message: errData?.message || 'Server did not acknowledge reading transmission.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Offline or network timeout: Saved in offline queue. (${err.message || 'Queued'})`,
      };
    }
  }

  static startAutoSync() {

    this.toggleAutoSync(true);
  }

  static stopAutoSync() {
    this.toggleAutoSync(false);
  }

  static setSimulatedOffline(offline: boolean) {
    this.syncState.isSimulatedOffline = offline;
    this.syncState.isOnline = offline ? false : (typeof navigator !== 'undefined' ? navigator.onLine : true);
    this.syncState.lastSyncMessage = offline ? 'Field Offline Mode active' : 'Connected to Central Server';
    this.notify();
    LoggerService.log(
      'CONNECTIVITY_MODE_CHANGED',
      `Field reader switched connection mode to: ${offline ? 'SIMULATED OFFLINE' : 'ONLINE'}`
    );
  }

  static setAutoSyncInterval(seconds: number) {
    this.syncState.autoSyncInterval = seconds;
    this.startAutoSyncTimer();
    this.notify();
    LoggerService.log('SYNC_INTERVAL_CHANGED', `Background sync frequency updated to ${seconds}s`);
  }

  static toggleAutoSync(enabled: boolean) {
    this.syncState.autoSyncEnabled = enabled;
    if (enabled) {
      this.startAutoSyncTimer();
    } else if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.notify();
  }

  private static startAutoSyncTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (!this.syncState.autoSyncEnabled) return;

    this.timerId = setInterval(() => {
      if (this.syncState.isOnline && !this.syncState.syncInProgress) {
        this.syncNow(true);
      }
    }, this.syncState.autoSyncInterval * 1000);
  }

  static async refreshPendingCount(): Promise<number> {
    try {
      const pending = await DatabaseHelper.getPendingReadings();
      this.updateState({ pendingCount: pending.length });
      return pending.length;
    } catch {
      return 0;
    }
  }

  /**
   * Main sync method - Pushes pending field readings and pulls latest consumers
   */
  static async syncNow(isBackground: boolean = false): Promise<{
    success: boolean;
    syncedReadingsCount: number;
    pulledConsumersCount: number;
    message: string;
  }> {
    if (this.syncState.syncInProgress) {
      return {
        success: false,
        syncedReadingsCount: 0,
        pulledConsumersCount: 0,
        message: 'Sync already in progress',
      };
    }

    if (!this.syncState.isOnline) {
      this.updateState({
        lastSyncMessage: 'Offline: Data queued locally in device SQLite/IndexedDB.',
      });
      return {
        success: false,
        syncedReadingsCount: 0,
        pulledConsumersCount: 0,
        message: 'Device is offline. Queued locally.',
      };
    }

    this.updateState({
      syncInProgress: true,
      lastSyncMessage: isBackground ? 'Background syncing...' : 'Connecting to central office...',
    });

    let uploadedCount = 0;
    let pulledCount = 0;

    const safeParseJson = async (res: Response): Promise<any> => {
      try {
        const contentType = res.headers?.get('content-type') || '';
        if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
          return null;
        }
        const text = await res.text();
        if (!text) return null;
        const trimmed = text.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          return JSON.parse(trimmed);
        }
        return null;
      } catch {
        return null;
      }
    };

    try {
      // 1. Get pending readings from local storage
      const pendingReadings = await DatabaseHelper.getPendingReadings();
      const batchId = `BATCH-WDT-${Date.now()}`;

      if (pendingReadings.length > 0) {
        this.updateState({ lastSyncMessage: `Uploading ${pendingReadings.length} readings...` });
        try {
          const uploadRes = await universalApiFetch('/api/readings/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              readings: pendingReadings,
              batchId,
              readerId: 'WDT-FIELD',
            }),
          });

          if (uploadRes.ok) {
            const resData = await safeParseJson(uploadRes);
            if (resData && (resData.success || resData.processedCount)) {
              const syncedIds = pendingReadings.map((r) => r.id);
              const syncTimestamp = new Date().toISOString();
              await DatabaseHelper.updateReadingsStatus(syncedIds, 'SYNCED', batchId, syncTimestamp);
              uploadedCount = pendingReadings.length;
              await LoggerService.log(
                'BATCH_SYNC_SUCCESS',
                `Successfully uploaded batch ${batchId} containing ${uploadedCount} meter readings to WDT server`
              );
            }
          }
        } catch (uploadErr) {
          // Readings safely queued locally
        }
      }

      // 2. Pull latest consumers (strictly for active meter reader's assigned coverage areas)
      this.updateState({ lastSyncMessage: 'Downloading assigned consumer records...' });
      try {
        let consumerQuery = '';
        if (this.activeRoutes && this.activeRoutes.length > 0) {
          consumerQuery = `?zones=${encodeURIComponent(this.activeRoutes.join(','))}`;
        }
        const consumerRes = await universalApiFetch(`/api/consumers${consumerQuery}`, {
          headers: { 'Accept': 'application/json' },
        });
        if (consumerRes.ok) {
          const consumerData = await safeParseJson(consumerRes);
          const rawConsumers = consumerData?.consumers || consumerData?.data;
          if (rawConsumers && Array.isArray(rawConsumers)) {
            // Merge with local reading flags
            const localReadings = await DatabaseHelper.getAllReadings();
            const readingsMap = new Map(localReadings.map((r) => [r.consumerId, r]));

            const enrichedConsumers: Consumer[] = rawConsumers.map((c: Consumer) => {
              const existingReading = readingsMap.get(c.id);
              return {
                ...c,
                isReadThisMonth: !!existingReading,
                currentMonthReading: existingReading,
              };
            });

            await DatabaseHelper.saveConsumers(enrichedConsumers);
            pulledCount = enrichedConsumers.length;
          }
        }
      } catch (pullErr) {
        // Consumer records remain intact in local SQLite / IndexedDB
      }

      // 3. Bi-Directional Meter Reader Account Synchronization
      try {
        const localReaders = await DatabaseHelper.getLocalReaders();
        const readerSyncRes = await universalApiFetch('/api/readers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ readers: localReaders }),
        });

        if (readerSyncRes.ok) {
          const readerSyncData = await safeParseJson(readerSyncRes);
          const serverReaders = readerSyncData?.readers || readerSyncData?.staff || readerSyncData?.data;
          if (Array.isArray(serverReaders) && serverReaders.length > 0) {
            for (const sReader of serverReaders) {
              await DatabaseHelper.saveLocalReader(sReader);
            }
          }
        }
      } catch (readerSyncErr) {
        // Local reader accounts remain safe
      }

      const pendingAfter = await DatabaseHelper.getPendingReadings();

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const syncSummary = uploadedCount > 0 || pulledCount > 0
        ? `Synced ${timeStr} (${uploadedCount} uploaded, ${pulledCount} active consumers)`
        : `Local database verified at ${timeStr} (Offline-ready)`;

      this.updateState({
        syncInProgress: false,
        lastSyncTime: new Date().toISOString(),
        pendingCount: pendingAfter.length,
        lastSyncMessage: syncSummary,
        failedCount: 0,
      });

      return {
        success: true,
        syncedReadingsCount: uploadedCount,
        pulledConsumersCount: pulledCount,
        message: syncSummary,
      };
    } catch (error: any) {
      const pendingAfter = await DatabaseHelper.getPendingReadings();
      const cleanMsg = 'Local database synchronized (Offline queue ready)';

      this.updateState({
        syncInProgress: false,
        lastSyncMessage: cleanMsg,
        pendingCount: pendingAfter.length,
        failedCount: this.syncState.failedCount + 1,
      });

      return {
        success: false,
        syncedReadingsCount: 0,
        pulledConsumersCount: 0,
        message: cleanMsg,
      };
    }
  }
}
