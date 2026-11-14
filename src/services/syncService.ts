import { Consumer, MeterReading, SyncState } from '../types';
import { DatabaseHelper } from './databaseHelper';
import { LoggerService } from './loggerService';
import { universalApiFetch, getApiEndpoint } from './apiConfig';
import { isConsumerInAssignedAreas, isValidatedForFieldReading, isConsumerAccountIssued, parseReadingTimestamp } from '../constants/routes';

export class SyncService {
  private static timerId: any = null;
  private static activeRoutes: string[] = [];
  private static activeReaderId: string = '';
  private static activeReaderUsername: string = '';
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
      const storedSimulated = window.localStorage?.getItem('twd_simulated_offline') === 'true';
      const isNavOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      this.syncState.isSimulatedOffline = storedSimulated;
      this.syncState.isOnline = storedSimulated ? false : isNavOnline;
      this.syncState.lastSyncMessage = !this.syncState.isOnline ? 'Field Offline Mode active' : 'Connected to Central Server';

      window.addEventListener('online', () => {
        const isStillSimulated = window.localStorage?.getItem('twd_simulated_offline') === 'true';
        this.updateState({ isOnline: !isStillSimulated });
        if (!isStillSimulated) {
          this.syncNow();
        }
      });
      window.addEventListener('offline', () => {
        this.updateState({ isOnline: false, lastSyncMessage: 'Device offline. Data queued locally in SQLite/IndexedDB.' });
      });
    }

    this.startAutoSyncTimer();
    this.refreshPendingCount();
  }

  static setActiveRoutes(routes: string[]) {
    this.activeRoutes = Array.isArray(routes) ? routes : [];
  }

  static setActiveReader(reader: { id?: string; username?: string; assignedRoutes?: string[] } | null) {
    if (reader) {
      this.activeReaderId = reader.id || '';
      this.activeReaderUsername = reader.username || '';
      if (reader.assignedRoutes) {
        this.activeRoutes = Array.isArray(reader.assignedRoutes) ? reader.assignedRoutes : [];
      }
    } else {
      this.activeReaderId = '';
      this.activeReaderUsername = '';
      this.activeRoutes = [];
    }
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
   * If offline or in simulated offline mode, saves directly to local IndexedDB/SQLite queue without blocking.
   */
  static async submitSingleReading(reading: MeterReading): Promise<{
    success: boolean;
    message: string;
    reading?: any;
  }> {
    const readingPayload: MeterReading = {
      ...reading,
      accountNumber: reading.accountNumber,
      currentReading: reading.currentReading,
      previousReading: reading.previousReading,
      consumption: reading.consumption,
      readerId: reading.readerId,
      readerName: reading.readerName,
      readingDate: reading.readingDate,
      photoUrl: reading.photoUrl,
      remarks: reading.remarks,
      status: 'PENDING_SYNC',
      approvalStatus: 'pending_approval',
    };

    const isOffline = !this.syncState.isOnline || 
      (typeof navigator !== 'undefined' && !navigator.onLine) || 
      this.syncState.isSimulatedOffline;

    // 1. Direct Offline Save: If field reader is offline, queue directly into local database
    if (isOffline) {
      await DatabaseHelper.saveReading(readingPayload);
      await this.refreshPendingCount();
      await LoggerService.log(
        'READING_SAVED_OFFLINE',
        `Meter reading for Account #${reading.accountNumber} saved in offline queue (Pending Sync with Admin).`
      );
      return {
        success: true,
        message: 'Saved to local offline queue (Pending Sync with Admin).',
        reading: readingPayload,
      };
    }

    // 2. Online Transmission
    try {
      const res = await universalApiFetch('/api/readings/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          ...readingPayload,
          readings: [readingPayload],
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        // If API returned synthetic offline fallback
        if (data?.isOfflineFallback) {
          await DatabaseHelper.saveReading(readingPayload);
          await this.refreshPendingCount();
          return {
            success: true,
            message: 'Saved to local offline queue (Pending Sync with Admin).',
            reading: readingPayload,
          };
        }

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
        // Server returned non-ok, safely queue locally
        await DatabaseHelper.saveReading(readingPayload);
        await this.refreshPendingCount();
        return {
          success: true,
          message: 'Server unreachable: Saved to local offline queue.',
          reading: readingPayload,
        };
      }
    } catch (err: any) {
      // Safe fallback: queue reading locally in IndexedDB
      await DatabaseHelper.saveReading(readingPayload);
      await this.refreshPendingCount();
      return {
        success: true,
        message: 'Saved to local offline queue (Pending Sync with Admin).',
        reading: readingPayload,
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
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem('twd_simulated_offline', offline ? 'true' : 'false');
    }
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
      if (!isBackground) {
        this.updateState({
          lastSyncMessage: 'Offline: Data queued locally in device SQLite/IndexedDB.',
        });
      }
      return {
        success: false,
        syncedReadingsCount: 0,
        pulledConsumersCount: 0,
        message: 'Device is offline. Queued locally.',
      };
    }

    const pendingAtStart = await DatabaseHelper.getPendingReadings().catch(() => []);
    const shouldShowSyncPulse = !isBackground || pendingAtStart.length > 0;

    if (shouldShowSyncPulse) {
      this.updateState({
        syncInProgress: true,
        lastSyncMessage: pendingAtStart.length > 0
          ? `Uploading ${pendingAtStart.length} reading${pendingAtStart.length === 1 ? '' : 's'}...`
          : 'Connecting to central office...',
      });
    }

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
      const pendingReadings = pendingAtStart.length > 0 ? pendingAtStart : await DatabaseHelper.getPendingReadings();
      const batchId = `BATCH-WDT-${Date.now()}`;

      if (pendingReadings.length > 0) {
        if (!this.syncState.syncInProgress) {
          this.updateState({
            syncInProgress: true,
            lastSyncMessage: `Uploading ${pendingReadings.length} readings...`,
          });
        }
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
            if (resData && (resData.success || resData.processedCount || resData.count || (resData.syncedIds && resData.syncedIds.length > 0))) {
              const syncedIds = (resData.syncedIds && Array.isArray(resData.syncedIds) && resData.syncedIds.length > 0)
                ? resData.syncedIds
                : pendingReadings.map((r) => r.id);
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
      if (shouldShowSyncPulse) {
        this.updateState({ lastSyncMessage: 'Downloading assigned consumer records...' });
      }
      try {
        const params = new URLSearchParams();
        if (this.activeRoutes && this.activeRoutes.length > 0) {
          params.append('zones', this.activeRoutes.join(','));
        }
        if (this.activeReaderId) {
          params.append('readerId', this.activeReaderId);
        }
        if (this.activeReaderUsername) {
          params.append('username', this.activeReaderUsername);
        }
        // Pull complete operational statuses (active + deactivated) for assigned route so local offline cache reflects admin deactivations
        params.append('includeInactive', 'true');

        const consumerQuery = params.toString() ? `?${params.toString()}` : '';
        const consumerRes = await universalApiFetch(`/api/consumers${consumerQuery}`, {
          headers: { 
            'Accept': 'application/json',
            'x-reader-id': this.activeReaderId,
            'x-assigned-routes': (this.activeRoutes || []).join(','),
          },
        });
        if (consumerRes.ok) {
          const consumerData = await safeParseJson(consumerRes);
          const rawConsumers = consumerData?.consumers || consumerData?.data;
          if (rawConsumers && Array.isArray(rawConsumers)) {
            // Strictly enforce Admin ID Issuance Gate: Consumers only sync when Admin issues Account # and Meter Tag #
            const issuedConsumers = rawConsumers.filter(isConsumerAccountIssued);

            // Merge with local reading flags so consumers never lose track of present readings
            const localReadings = await DatabaseHelper.getAllReadings();
            const sortedLocal = [...localReadings].sort((a, b) => {
              const timeA = parseReadingTimestamp(a);
              const timeB = parseReadingTimestamp(b);
              if (timeB !== timeA) return timeB - timeA;
              return (a.id || '').localeCompare(b.id || '');
            });

            const enrichedConsumers: Consumer[] = issuedConsumers.map((c: Consumer) => {
              const currentCycleReading = sortedLocal.find((r) => {
                const matchesAccount =
                  r.consumerId === c.id ||
                  (Boolean(r.accountNumber) &&
                    Boolean(c.accountNumber) &&
                    r.accountNumber.trim().toLowerCase() === c.accountNumber.trim().toLowerCase());
                if (!matchesAccount) return false;

                // Pending readings awaiting admin approval
                const isPending =
                  r.approvalStatus === 'pending_approval' ||
                  r.status === 'PENDING_SYNC';
                if (isPending) return true;

                // Approved reading that represents a newly taken present reading beyond baseline
                if (c.isReadThisMonth && (r.status === 'APPROVED' || r.approvalStatus === 'approved')) {
                  return true;
                }
                if (Number(r.currentReading) > Number(c.previousReading) && (r.status === 'APPROVED' || r.approvalStatus === 'approved')) {
                  return true;
                }
                return false;
              });

              return {
                ...c,
                isReadThisMonth: !!currentCycleReading,
                currentMonthReading: currentCycleReading,
              };
            });

            await DatabaseHelper.saveConsumers(enrichedConsumers);
            const routeConsumers = this.activeRoutes && this.activeRoutes.length > 0
              ? enrichedConsumers.filter((c: Consumer) => isConsumerInAssignedAreas(c, this.activeRoutes) && isValidatedForFieldReading(c))
              : enrichedConsumers.filter(isValidatedForFieldReading);
            pulledCount = routeConsumers.length;
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

      // 4. Synchronize Admin Reading Approvals from Central Server
      try {
        const readingsRes = await universalApiFetch('/api/readings', {
          headers: { 'Accept': 'application/json' },
        });
        if (readingsRes.ok) {
          const readingsData = await safeParseJson(readingsRes);
          const sReadings: any[] = readingsData?.readings || readingsData?.data || [];
          if (Array.isArray(sReadings) && sReadings.length > 0) {
            for (const sr of sReadings) {
              if (sr.approvalStatus === 'approved' || sr.status === 'APPROVED' || sr.status === 'approved') {
                await DatabaseHelper.updateReadingApprovalStatus(sr.accountNumber || sr.id, 'approved', {
                  accountNumber: sr.accountNumber,
                  approvedBy: sr.approvedBy || 'Admin Supervisor',
                  approvedAt: sr.approvedAt || sr.receivedAt || new Date().toISOString(),
                  currentReading: sr.currentReading,
                  previousReading: sr.previousReading,
                  consumption: sr.consumption,
                });
              } else if (sr.approvalStatus === 'rejected') {
                await DatabaseHelper.updateReadingApprovalStatus(sr.accountNumber || sr.id, 'rejected', {
                  accountNumber: sr.accountNumber,
                  rejectionReason: sr.rejectionReason,
                });
              }
            }
          }
        }
      } catch {
        // Reading approvals sync safe
      }

      const pendingAfter = await DatabaseHelper.getPendingReadings();

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const syncSummary = uploadedCount > 0 || pulledCount > 0
        ? `Synced ${timeStr} (${uploadedCount} uploaded, ${pulledCount} active consumers)`
        : `Local database verified at ${timeStr} (Offline-ready)`;

      if (shouldShowSyncPulse || uploadedCount > 0 || pendingAfter.length !== this.syncState.pendingCount) {
        this.updateState({
          syncInProgress: false,
          lastSyncTime: new Date().toISOString(),
          pendingCount: pendingAfter.length,
          lastSyncMessage: syncSummary,
          failedCount: 0,
        });
      }

      return {
        success: true,
        syncedReadingsCount: uploadedCount,
        pulledConsumersCount: pulledCount,
        message: syncSummary,
      };
    } catch (error: any) {
      const pendingAfter = await DatabaseHelper.getPendingReadings();
      const cleanMsg = 'Local database synchronized (Offline queue ready)';

      if (shouldShowSyncPulse || pendingAfter.length !== this.syncState.pendingCount) {
        this.updateState({
          syncInProgress: false,
          lastSyncMessage: cleanMsg,
          pendingCount: pendingAfter.length,
          failedCount: this.syncState.failedCount + 1,
        });
      }

      return {
        success: false,
        syncedReadingsCount: 0,
        pulledConsumersCount: 0,
        message: cleanMsg,
      };
    }
  }
}
