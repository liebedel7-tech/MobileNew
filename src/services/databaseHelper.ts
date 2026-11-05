import { Consumer, MeterReading, AuditLog, AppConfig, StaffUser, ReaderAccount, ReaderStatus, ConnectionStatus, WaterMeterStatus } from '../types';
import { universalApiFetch, getApiEndpoint } from './apiConfig';
import { INITIAL_CONSUMERS as FULL_SEED_CONSUMERS, INITIAL_READERS } from '../data/seedData';
import { isConsumerInAssignedAreas, isValidatedForFieldReading } from '../constants/routes';

const DB_NAME = 'WDT_MeterReader_DB_v2';
const DB_VERSION = 1;

export class DatabaseHelper {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Consumers Store
        if (!db.objectStoreNames.contains('consumers')) {
          const consumerStore = db.createObjectStore('consumers', { keyPath: 'id' });
          consumerStore.createIndex('accountNumber', 'accountNumber', { unique: true });
          consumerStore.createIndex('meterSerial', 'meterSerial', { unique: false });
          consumerStore.createIndex('barangay', 'barangay', { unique: false });
          consumerStore.createIndex('routeCode', 'routeCode', { unique: false });
        }

        // Meter Readings Store
        if (!db.objectStoreNames.contains('readings')) {
          const readingStore = db.createObjectStore('readings', { keyPath: 'id' });
          readingStore.createIndex('consumerId', 'consumerId', { unique: false });
          readingStore.createIndex('accountNumber', 'accountNumber', { unique: false });
          readingStore.createIndex('status', 'status', { unique: false });
          readingStore.createIndex('readingDate', 'readingDate', { unique: false });
        }

        // Audit Logs Store
        if (!db.objectStoreNames.contains('audit_logs')) {
          const logStore = db.createObjectStore('audit_logs', { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Config & Key-Value Store
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error || new Error('Failed to open IndexedDB database'));
      };
    });

    return this.dbPromise;
  }

  // Consumers Operations
  static async saveConsumers(consumers: Consumer[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consumers', 'readwrite');
      const store = tx.objectStore('consumers');
      consumers.forEach((consumer, idx) => {
        const acc = (consumer.accountNumber || '').trim();
        const meter = (consumer.meterNumber || consumer.meterSerial || '').trim();
        const id = consumer.id || (acc ? `WDT-ACC-${acc.replace(/[^a-zA-Z0-9]/g, '')}` : `WDT-APP-${Date.now()}-${idx}`);

        const normalized: Consumer = {
          ...consumer,
          id,
          accountNumber: acc,
          meterSerial: meter,
          meterNumber: meter,
          category: consumer.category || (consumer as any).consumerType || 'Residential',
          consumerType: (consumer as any).consumerType || consumer.category || 'Residential',
          routeCode: consumer.routeCode || (consumer as any).sitioZone || consumer.barangay || 'Poblacion',
          previousReading: Number(consumer.previousReading || 0),
          previousReadingDate: consumer.previousReadingDate || (consumer as any).lastReadingDate || '2026-10-25',
          previousConsumption: consumer.previousConsumption !== undefined 
            ? Number(consumer.previousConsumption) 
            : (consumer.previousReading > 0 ? Math.min(25, Number(consumer.previousReading)) : 15),
          averageConsumption: Number(consumer.averageConsumption || 18),
          rateCode: consumer.rateCode || 'RES-01',
          status: consumer.status || 'Active',
          lastSyncDate: new Date().toISOString(),
        };

        store.put(normalized);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction error while saving consumers'));
    });
  }

  static async getAllConsumers(): Promise<Consumer[]> {
    const db = await this.getDB();
    const [rawConsumers, allReadings] = await Promise.all([
      new Promise<Consumer[]>((resolve, reject) => {
        const tx = db.transaction('consumers', 'readonly');
        const store = tx.objectStore('consumers');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error('Failed to load consumers'));
      }),
      new Promise<MeterReading[]>((resolve, reject) => {
        const tx = db.transaction('readings', 'readonly');
        const store = tx.objectStore('readings');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error('Failed to load readings'));
      }),
    ]);

    // Sort readings newest first to ensure the latest reading is always attached
    const sortedReadings = [...allReadings].sort((a, b) => {
      const timeA = new Date(`${a.readingDate}T${a.readingTime || '00:00:00'}`).getTime();
      const timeB = new Date(`${b.readingDate}T${b.readingTime || '00:00:00'}`).getTime();
      return timeB - timeA;
    });

    return rawConsumers.map((consumer) => {
      const latestReading = sortedReadings.find(
        (r) => r.consumerId === consumer.id || r.accountNumber === consumer.accountNumber
      );

      if (latestReading) {
        return {
          ...consumer,
          isReadThisMonth: true,
          currentMonthReading: latestReading,
        };
      }

      return consumer;
    });
  }

  /**
   * Returns only active, officially validated consumers available for field meter readings.
   * Consumers that have been deactivated or whose water meter status is not active (e.g. damaged, maintenance)
   * are strictly excluded.
   */
  static async getConsumersForReader(routes?: string[] | string | null): Promise<Consumer[]> {
    const all = await this.getAllConsumers();
    if (!routes) return all.filter(isValidatedForFieldReading);

    if (Array.isArray(routes) && routes.length === 0) {
      return [];
    }

    return all.filter((c) => isValidatedForFieldReading(c) && isConsumerInAssignedAreas(c, routes));
  }

  /**
   * Returns all consumer records on the assigned route (both active and deactivated/excluded).
   * Useful for viewing status breakdowns or understanding why certain meters are locked.
   */
  static async getAllConsumersForRoute(routes?: string[] | string | null): Promise<Consumer[]> {
    const all = await this.getAllConsumers();
    if (!routes) return all;
    if (Array.isArray(routes) && routes.length === 0) return [];
    return all.filter((c) => isConsumerInAssignedAreas(c, routes));
  }

  /**
   * Returns deactivated or disabled consumers on the assigned route.
   */
  static async getDeactivatedConsumersForReader(routes?: string[] | string | null): Promise<Consumer[]> {
    const all = await this.getAllConsumers();
    if (!routes) return all.filter((c) => !isValidatedForFieldReading(c));
    return all.filter((c) => !isValidatedForFieldReading(c) && isConsumerInAssignedAreas(c, routes));
  }

  /**
   * Updates an individual consumer's account and/or meter status in local IndexedDB.
   */
  static async updateConsumerStatus(
    identifier: string, 
    status: ConnectionStatus, 
    meterStatus?: WaterMeterStatus,
    remarks?: string
  ): Promise<Consumer | null> {
    const db = await this.getDB();
    const cleanId = (identifier || '').toLowerCase().trim();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('consumers', 'readwrite');
      const store = tx.objectStore('consumers');
      const req = store.getAll();

      req.onsuccess = () => {
        const all: Consumer[] = req.result || [];
        const consumer = all.find(
          c => (c.id && c.id.toLowerCase() === cleanId) || 
               (c.accountNumber && c.accountNumber.toLowerCase() === cleanId)
        );

        if (consumer) {
          const updated: Consumer = {
            ...consumer,
            status,
            meterStatus: meterStatus || consumer.meterStatus,
            meterStatusRemarks: remarks !== undefined ? remarks : consumer.meterStatusRemarks,
            lastSyncDate: new Date().toISOString(),
          };
          store.put(updated);
          resolve(updated);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => reject(req.error || new Error('Failed to update consumer status'));
    });
  }

  /**
   * Updates a water meter's operational status across all matching consumer records in local IndexedDB.
   */
  static async updateMeterStatus(
    meterNumber: string, 
    status: WaterMeterStatus, 
    remarks?: string
  ): Promise<Consumer | null> {
    const db = await this.getDB();
    const cleanTag = (meterNumber || '').toUpperCase().trim();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('consumers', 'readwrite');
      const store = tx.objectStore('consumers');
      const req = store.getAll();

      req.onsuccess = () => {
        const all: Consumer[] = req.result || [];
        let matchedConsumer: Consumer | null = null;

        all.forEach((consumer) => {
          const cTag = (consumer.meterNumber || '').toUpperCase().trim();
          const cSerial = (consumer.meterSerial || '').toUpperCase().trim();

          if (cTag === cleanTag || cSerial === cleanTag) {
            const updated: Consumer = {
              ...consumer,
              meterStatus: status,
              meterStatusRemarks: remarks !== undefined ? remarks : consumer.meterStatusRemarks,
              lastSyncDate: new Date().toISOString(),
            };
            store.put(updated);
            matchedConsumer = updated;
          }
        });

        resolve(matchedConsumer);
      };

      req.onerror = () => reject(req.error || new Error('Failed to update meter status'));
    });
  }

  static async getConsumerById(id: string, routes?: string[] | string | null): Promise<Consumer | null> {
    const all = await this.getAllConsumers();
    const consumer = all.find((c) => c.id === id);
    if (consumer && routes && !isConsumerInAssignedAreas(consumer, routes)) {
      return null;
    }
    return consumer || null;
  }

  static async getConsumerByAccountNumber(accNo: string, routes?: string[] | string | null): Promise<Consumer | null> {
    const all = await this.getAllConsumers();
    const consumer = all.find((c) => c.accountNumber === accNo);
    if (consumer && routes && !isConsumerInAssignedAreas(consumer, routes)) {
      return null;
    }
    return consumer || null;
  }

  static async getConsumerByMeterSerial(serial: string, routes?: string[] | string | null): Promise<Consumer | null> {
    const all = await this.getAllConsumers();
    const consumer = all.find((c) => c.meterSerial === serial || c.meterNumber === serial);
    if (consumer && routes && !isConsumerInAssignedAreas(consumer, routes)) {
      return null;
    }
    return consumer || null;
  }

  static async getConsumerByTagOrMeterNumber(tag: string, routes?: string[] | string | null): Promise<Consumer | null> {
    if (!tag) return null;
    const all = routes ? await this.getConsumersForReader(routes) : await this.getAllConsumers();
    const rawClean = tag.trim().toLowerCase();
    const alphanumericOnly = rawClean.replace(/[^a-z0-9]/g, '');

    if (!alphanumericOnly) return null;

    // 1. Exact string match
    const exact = all.find(
      (c) =>
        (c.meterNumber && c.meterNumber.toLowerCase() === rawClean) ||
        (c.meterSerial && c.meterSerial.toLowerCase() === rawClean) ||
        (c.accountNumber && c.accountNumber.toLowerCase() === rawClean) ||
        (c.accountNumber && c.accountNumber.replace(/-/g, '').toLowerCase() === rawClean.replace(/-/g, ''))
    );
    if (exact) return exact;

    // 2. Normalized alphanumeric match
    const GENERIC_LABELS = new Set([
      'tag', 'twd', 'wdt', 'mtr', 'meter', 'water', 'district', 'philippines', 
      'class', 'classb', 'classc', 'iso', 'iso4064', 'lxsg', 'lxsg15', 'barangay', 
      'poblacion', 'baluarte', 'casinglot', 'mohon', 'natumolan', 'stacruz', 'staana', 
      'sugbongcogon', 'gracia', 'rosario', 'misamis', 'oriental', 'serial', 'model'
    ]);

    if (GENERIC_LABELS.has(alphanumericOnly) || GENERIC_LABELS.has(rawClean)) {
      return null;
    }

    const normalizedMatch = all.find((c) => {
      const cTag = (c.meterNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cSerial = (c.meterSerial || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cAcc = (c.accountNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      return (
        (cTag && (cTag === alphanumericOnly || (cTag.length >= 4 && alphanumericOnly.includes(cTag)))) ||
        (cSerial && (cSerial === alphanumericOnly || (cSerial.length >= 4 && alphanumericOnly.includes(cSerial)))) ||
        (cAcc && (cAcc === alphanumericOnly || (cAcc.length >= 4 && alphanumericOnly.includes(cAcc))))
      );
    });

    if (normalizedMatch) return normalizedMatch;

    // 3. Numeric digits extraction match (e.g. "01042" matching "TAG-01042")
    const digitsOnly = rawClean.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 4) {
      const digitMatch = all.find((c) => {
        const cTagDigits = (c.meterNumber || '').replace(/[^0-9]/g, '');
        const cSerialDigits = (c.meterSerial || '').replace(/[^0-9]/g, '');
        const cAccDigits = (c.accountNumber || '').replace(/[^0-9]/g, '');

        return (
          (cTagDigits.length >= 4 && (cTagDigits === digitsOnly || cTagDigits.endsWith(digitsOnly) || digitsOnly.endsWith(cTagDigits))) ||
          (cSerialDigits.length >= 4 && (cSerialDigits === digitsOnly || cSerialDigits.endsWith(digitsOnly) || digitsOnly.endsWith(cSerialDigits))) ||
          (cAccDigits.length >= 4 && cAccDigits === digitsOnly)
        );
      });
      if (digitMatch) return digitMatch;
    }

    return null;
  }

  // Readings Operations
  static async saveReading(reading: MeterReading): Promise<MeterReading> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['readings', 'consumers'], 'readwrite');
      const readingStore = tx.objectStore('readings');
      const consumerStore = tx.objectStore('consumers');

      const getAllReq = readingStore.getAll();
      getAllReq.onsuccess = () => {
        const all: MeterReading[] = getAllReq.result || [];
        const cleanAcc = (reading.accountNumber || '').trim().toLowerCase();
        const cleanMeter = (reading.meterSerial || reading.meterNumber || '').trim().toLowerCase();

        // Check if an unapproved pending reading already exists for this water meter
        const existingPending = all.find((r) => {
          const isPending = r.approvalStatus === 'pending_approval' || (r.status as string) === 'PENDING_APPROVAL' || r.status === 'PENDING_SYNC';
          if (!isPending) return false;
          if (r.id === reading.id) return true;
          const rAcc = (r.accountNumber || '').trim().toLowerCase();
          const rMeter = (r.meterSerial || r.meterNumber || '').trim().toLowerCase();
          return (cleanAcc && rAcc === cleanAcc) || (cleanMeter && rMeter === cleanMeter);
        });

        // If a pending record exists, reuse its ID to edit/update in place rather than duplicate
        const targetReading: MeterReading = existingPending && existingPending.id !== reading.id
          ? { ...reading, id: existingPending.id }
          : reading;

        readingStore.put(targetReading);

        // Update consumer's status for this month
        const consumerReq = consumerStore.get(targetReading.consumerId);
        consumerReq.onsuccess = () => {
          if (consumerReq.result) {
            const updatedConsumer: Consumer = {
              ...consumerReq.result,
              isReadThisMonth: true,
              currentMonthReading: targetReading,
            };
            consumerStore.put(updatedConsumer);
          } else {
            // If not found by ID, search by accountNumber index
            try {
              const accIndex = consumerStore.index('accountNumber');
              const accReq = accIndex.get(targetReading.accountNumber);
              accReq.onsuccess = () => {
                if (accReq.result) {
                  const updatedConsumer: Consumer = {
                    ...accReq.result,
                    isReadThisMonth: true,
                    currentMonthReading: targetReading,
                  };
                  consumerStore.put(updatedConsumer);
                }
              };
            } catch (e) {
              console.debug('Account lookup note:', e);
            }
          }
        };

        tx.oncomplete = () => resolve(targetReading);
      };

      getAllReq.onerror = () => {
        readingStore.put(reading);
        tx.oncomplete = () => resolve(reading);
      };

      tx.onerror = () => reject(tx.error || new Error('Transaction error while saving reading'));
    });
  }

  /**
   * Retrieves the latest APPROVED reading for a specific water meter identified by Account Number & Meter Number.
   * Its present reading will serve as the previous reading baseline for the next submission cycle.
   */
  static async getLatestApprovedReading(accountNumber: string, meterNumber?: string): Promise<MeterReading | null> {
    const db = await this.getDB();
    const cleanAcc = (accountNumber || '').trim().toLowerCase();
    const cleanMeter = (meterNumber || '').trim().toLowerCase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('readings', 'readonly');
      const store = tx.objectStore('readings');
      const request = store.getAll();

      request.onsuccess = () => {
        const all: MeterReading[] = request.result || [];
        const approved = all.filter((r) => {
          const isApp = r.approvalStatus === 'approved' || r.status === 'APPROVED';
          if (!isApp) return false;
          const rAcc = (r.accountNumber || '').trim().toLowerCase();
          const rMeter = (r.meterSerial || r.meterNumber || '').trim().toLowerCase();

          return (cleanAcc && rAcc === cleanAcc) || (cleanMeter && (rMeter === cleanMeter || rMeter.includes(cleanMeter) || cleanMeter.includes(rMeter)));
        });

        if (approved.length === 0) {
          resolve(null);
          return;
        }

        // Sort by approvedAt or readingDate descending
        approved.sort((a, b) => {
          const timeA = new Date(a.approvedAt || `${a.readingDate}T${a.readingTime || '00:00:00'}`).getTime();
          const timeB = new Date(b.approvedAt || `${b.readingDate}T${b.readingTime || '00:00:00'}`).getTime();
          return timeB - timeA;
        });

        resolve(approved[0]);
      };

      request.onerror = () => reject(request.error || new Error('Failed to retrieve approved reading'));
    });
  }

  /**
   * Retrieves any existing pending reading awaiting admin approval for a specific water meter.
   */
  static async getPendingReadingForMeter(accountNumber: string, meterNumber?: string): Promise<MeterReading | null> {
    const db = await this.getDB();
    const cleanAcc = (accountNumber || '').trim().toLowerCase();
    const cleanMeter = (meterNumber || '').trim().toLowerCase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('readings', 'readonly');
      const store = tx.objectStore('readings');
      const request = store.getAll();

      request.onsuccess = () => {
        const all: MeterReading[] = request.result || [];
        const pending = all.filter((r) => {
          const isPending = r.approvalStatus === 'pending_approval' || (r.status as string) === 'PENDING_APPROVAL' || r.status === 'PENDING_SYNC';
          if (!isPending) return false;
          const rAcc = (r.accountNumber || '').trim().toLowerCase();
          const rMeter = (r.meterSerial || r.meterNumber || '').trim().toLowerCase();

          return (cleanAcc && rAcc === cleanAcc) || (cleanMeter && (rMeter === cleanMeter || rMeter.includes(cleanMeter) || cleanMeter.includes(rMeter)));
        });

        if (pending.length === 0) {
          resolve(null);
          return;
        }

        pending.sort((a, b) => {
          const timeA = new Date(`${a.readingDate}T${a.readingTime || '00:00:00'}`).getTime();
          const timeB = new Date(`${b.readingDate}T${b.readingTime || '00:00:00'}`).getTime();
          return timeB - timeA;
        });

        resolve(pending[0]);
      };

      request.onerror = () => reject(request.error || new Error('Failed to retrieve pending reading'));
    });
  }

  static async getAllReadings(): Promise<MeterReading[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('readings', 'readonly');
      const store = tx.objectStore('readings');
      const request = store.getAll();
      request.onsuccess = () => {
        const rawList: MeterReading[] = request.result || [];

        // Sort in strict chronological order: newest first
        const sorted = [...rawList].sort((a, b) => {
          const timeA = new Date(a.approvedAt || `${a.readingDate}T${a.readingTime || '00:00:00'}`).getTime();
          const timeB = new Date(b.approvedAt || `${b.readingDate}T${b.readingTime || '00:00:00'}`).getTime();
          return timeB - timeA;
        });

        // Deduplicate exact record matches by ID
        const seenIds = new Set<string>();
        const deduplicated: MeterReading[] = [];
        sorted.forEach((r) => {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            deduplicated.push(r);
          }
        });

        resolve(deduplicated);
      };
      request.onerror = () => reject(request.error || new Error('Failed to fetch readings'));
    });
  }

  static async getPendingReadings(): Promise<MeterReading[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('readings', 'readonly');
      const store = tx.objectStore('readings');
      const index = store.index('status');
      const request = index.getAll('PENDING_SYNC');
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Failed to fetch pending sync readings'));
    });
  }

  static async updateReadingsStatus(
    ids: string[],
    status: 'SYNCED' | 'FAILED',
    batchId: string,
    syncTimestamp: string
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('readings', 'readwrite');
      const store = tx.objectStore('readings');

      ids.forEach((id) => {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) {
            const updated: MeterReading = {
              ...req.result,
              status,
              batchId,
              syncTimestamp,
            };
            store.put(updated);
          }
        };
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Updates a meter reading's approval status (approved / rejected) in local IndexedDB.
   * When approved by Admin:
   * 1. The reading's status changes from 'pending_approval' to 'approved' and status to 'APPROVED'.
   * 2. The reading's approved data (approvedAt, approvedBy, billNumber) is persisted.
   * 3. The linked consumer's baseline is saved: previousReading advances to the approved currentReading,
   *    isReadThisMonth is set to true, and currentMonthReading is updated.
   */
  static async updateReadingApprovalStatus(
    readingIdOrAccountNumber: string,
    approvalStatus: 'approved' | 'rejected',
    details?: {
      accountNumber?: string;
      approvedBy?: string;
      approvedAt?: string;
      rejectionReason?: string;
      currentReading?: number;
      previousReading?: number;
      consumption?: number;
    }
  ): Promise<{ reading: MeterReading | null; consumer: Consumer | null }> {
    const db = await this.getDB();
    const cleanKey = (readingIdOrAccountNumber || '').trim().toLowerCase();
    const cleanAccount = (details?.accountNumber || '').trim().toLowerCase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['readings', 'consumers'], 'readwrite');
      const readingStore = tx.objectStore('readings');
      const consumerStore = tx.objectStore('consumers');

      const readingReq = readingStore.getAll();
      let matchedReading: MeterReading | null = null;
      let matchedConsumer: Consumer | null = null;

      readingReq.onsuccess = () => {
        const allReadings: MeterReading[] = readingReq.result || [];
        
        // Find ALL readings matching this consumer / account or id
        const matchingReadings = allReadings.filter(
          (r) =>
            (cleanKey && (
              (r.id && r.id.toLowerCase() === cleanKey) ||
              (r.accountNumber && r.accountNumber.toLowerCase() === cleanKey) ||
              (r.consumerId && r.consumerId.toLowerCase() === cleanKey)
            )) ||
            (cleanAccount && r.accountNumber && r.accountNumber.toLowerCase() === cleanAccount)
        );

        const nowIso = details?.approvedAt || new Date().toISOString();
        const adminName = details?.approvedBy || 'Admin Supervisor';

        if (matchingReadings.length > 0) {
          // Update all matching readings for this account to APPROVED/REJECTED so there are never dual statuses!
          matchingReadings.forEach((rItem, idx) => {
            const updatedReading: MeterReading = {
              ...rItem,
              approvalStatus,
              status: approvalStatus === 'approved' ? 'APPROVED' : 'REJECTED',
              approvedAt: approvalStatus === 'approved' ? nowIso : rItem.approvedAt,
              approvedBy: approvalStatus === 'approved' ? adminName : rItem.approvedBy,
              remarks: details?.rejectionReason || rItem.remarks,
              currentReading: details?.currentReading !== undefined ? details.currentReading : rItem.currentReading,
              previousReading: details?.previousReading !== undefined ? details.previousReading : rItem.previousReading,
              consumption: details?.consumption !== undefined ? details.consumption : rItem.consumption,
            };

            readingStore.put(updatedReading);
            if (idx === 0) matchedReading = updatedReading;
          });

          // Find linked consumer to save approved data & advance baseline
          const consumerReq = consumerStore.getAll();
          consumerReq.onsuccess = () => {
            const allConsumers: Consumer[] = consumerReq.result || [];
            matchedConsumer = allConsumers.find(
              (c) =>
                (matchedReading && (c.id === matchedReading.consumerId || c.accountNumber === matchedReading.accountNumber)) ||
                (cleanAccount && c.accountNumber && c.accountNumber.toLowerCase() === cleanAccount) ||
                (cleanKey && ((c.id && c.id.toLowerCase() === cleanKey) || (c.accountNumber && c.accountNumber.toLowerCase() === cleanKey)))
            ) || null;

            if (matchedConsumer && matchedReading) {
              const updatedConsumer: Consumer = {
                ...matchedConsumer,
                // Advance consumer baseline so next reading cycle uses this approved reading
                previousReading: approvalStatus === 'approved' 
                  ? matchedReading.currentReading 
                  : matchedConsumer.previousReading,
                previousConsumption: approvalStatus === 'approved' 
                  ? matchedReading.consumption 
                  : matchedConsumer.previousConsumption,
                previousReadingDate: approvalStatus === 'approved' 
                  ? (matchedReading.readingDate || nowIso.split('T')[0]) 
                  : matchedConsumer.previousReadingDate,
                isReadThisMonth: true,
                currentMonthReading: matchedReading,
                lastSyncDate: nowIso,
              };

              consumerStore.put(updatedConsumer);
              matchedConsumer = updatedConsumer;
            }
          };
        } else {
          // If reading was not found directly in reading store, still check if consumer exists to update baseline
          const consumerReq = consumerStore.getAll();
          consumerReq.onsuccess = () => {
            const allConsumers: Consumer[] = consumerReq.result || [];
            matchedConsumer = allConsumers.find(
              (c) =>
                (cleanAccount && c.accountNumber && c.accountNumber.toLowerCase() === cleanAccount) ||
                (cleanKey && ((c.id && c.id.toLowerCase() === cleanKey) || (c.accountNumber && c.accountNumber.toLowerCase() === cleanKey)))
            ) || null;

            if (matchedConsumer && approvalStatus === 'approved' && details?.currentReading !== undefined) {
              const prev = details.previousReading !== undefined ? details.previousReading : matchedConsumer.previousReading;
              const curr = details.currentReading;
              const cons = details.consumption !== undefined ? details.consumption : Math.max(0, curr - prev);
              
              const syntheticReading: MeterReading = {
                id: `RDG-APP-${matchedConsumer.accountNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
                consumerId: matchedConsumer.id,
                accountNumber: matchedConsumer.accountNumber,
                consumerName: matchedConsumer.name,
                meterSerial: matchedConsumer.meterSerial,
                category: matchedConsumer.category,
                barangay: matchedConsumer.barangay,
                routeCode: matchedConsumer.routeCode,
                previousReading: prev,
                currentReading: curr,
                consumption: cons,
                readingDate: nowIso.split('T')[0],
                readingTime: new Date(nowIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                readerId: 'ADMIN_APPROVED',
                readerName: adminName,
                gpsCoordinates: matchedConsumer.gpsCoordinates || { lat: 8.5398, lng: 124.7523 },
                meterCondition: 'NORMAL',
                approvalStatus: 'approved',
                status: 'APPROVED',
                approvedAt: nowIso,
                approvedBy: adminName,
                billCalculation: {
                  consumption: cons,
                  minimumCharge: 0,
                  commodityCharge: 0,
                  breakdown: [],
                  subTotal: 0,
                  environmentalFee: 0,
                  franchiseTax: 0,
                  maintenanceFee: 10,
                  seniorDiscount: 0,
                  totalAmountDue: 0,
                  penaltyAfterDue: 0,
                  grossAmountAfterDue: 0,
                  billingPeriod: nowIso.slice(0, 7),
                  dueDate: '',
                  disconnectionDate: '',
                },
              };

              readingStore.put(syntheticReading);
              matchedReading = syntheticReading;

              const updatedConsumer: Consumer = {
                ...matchedConsumer,
                previousReading: curr,
                previousConsumption: cons,
                previousReadingDate: nowIso.split('T')[0],
                isReadThisMonth: true,
                currentMonthReading: syntheticReading,
                lastSyncDate: nowIso,
              };

              consumerStore.put(updatedConsumer);
              matchedConsumer = updatedConsumer;
            }
          };
        }
      };

      tx.oncomplete = () => resolve({ reading: matchedReading, consumer: matchedConsumer });
      tx.onerror = () => reject(tx.error || new Error('Transaction error while updating reading approval status'));
    });
  }

  // Audit Logs
  static async addAuditLog(log: AuditLog): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audit_logs', 'readwrite');
      const store = tx.objectStore('audit_logs');
      store.put(log);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to add audit log'));
    });
  }

  static async getAllAuditLogs(): Promise<AuditLog[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audit_logs', 'readonly');
      const store = tx.objectStore('audit_logs');
      const request = store.getAll();
      request.onsuccess = () => {
        const logs = request.result || [];
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(logs);
      };
      request.onerror = () => reject(request.error || new Error('Failed to get audit logs'));
    });
  }

  // Key-Value Session / Config Storage
  static async setItem(key: string, value: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('keyval', 'readwrite');
      const store = tx.objectStore('keyval');
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to save session item'));
    });
  }

  static async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('keyval', 'readonly');
        const store = tx.objectStore('keyval');
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.value !== undefined) {
            resolve(req.result.value as T);
          } else {
            resolve(defaultValue);
          }
        };
        req.onerror = () => resolve(defaultValue);
      });
    } catch {
      return defaultValue;
    }
  }

  // Default Initial Readers for Tagoloan Water District
  private static DEFAULT_INITIAL_READERS: ReaderAccount[] = [...(INITIAL_READERS as any)];

  // Local Registered Readers (supports offline field operations & Vercel static fallback)
  static async getLocalReaders(): Promise<ReaderAccount[]> {
    try {
      const fromDB = await this.getItem<ReaderAccount[]>('twd_registered_readers', []);
      let fromLS: ReaderAccount[] = [];
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('twd_registered_readers');
        if (raw) {
          try { fromLS = JSON.parse(raw); } catch { /* ignore */ }
        }
      }
      
      // Merge unique by username / id
      const map = new Map<string, ReaderAccount>();
      // Base defaults
      this.DEFAULT_INITIAL_READERS.forEach(r => map.set((r.username || r.id).toLowerCase(), r));
      (fromDB || []).forEach(r => map.set((r.username || r.id).toLowerCase(), r));
      (fromLS || []).forEach(r => map.set((r.username || r.id).toLowerCase(), r));
      return Array.from(map.values());
    } catch {
      return [...this.DEFAULT_INITIAL_READERS];
    }
  }

  static async saveLocalReader(reader: ReaderAccount): Promise<void> {
    try {
      const existing = await this.getLocalReaders();
      const updated = existing.filter(
        r => ((r.username && reader.username) ? r.username.toLowerCase() !== reader.username.toLowerCase() : true) && 
             ((r.id && reader.id) ? r.id.toLowerCase() !== reader.id.toLowerCase() : true)
      );
      updated.push(reader);

      await this.setItem('twd_registered_readers', updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('twd_registered_readers', JSON.stringify(updated));
        localStorage.setItem('twd_reader_id', reader.id);
        localStorage.setItem('twd_reader_status', reader.status);
      }
    } catch (err) {
      console.warn('Error saving local reader:', err);
    }
  }

  static async updateLocalReaderStatus(
    identifier: string, 
    status: ReaderStatus, 
    assignedRoutes?: string[],
    approvedBy?: string
  ): Promise<ReaderAccount | null> {
    try {
      const readers = await this.getLocalReaders();
      let updatedReader: ReaderAccount | null = null;
      const cleanId = (identifier || '').toLowerCase();
      const updated = readers.map((r) => {
        if (
          (r.id && r.id.toLowerCase() === cleanId) ||
          (r.username && r.username.toLowerCase() === cleanId) ||
          (r.employeeId && r.employeeId.toLowerCase() === cleanId)
        ) {
          const isDeactivating = status === 'terminated' || status === 'rejected';
          // When mobile detects a deactivated account, the assigned area routes are automatically released and made available
          const updatedRoutes = isDeactivating
            ? (assignedRoutes !== undefined ? assignedRoutes : [])
            : (assignedRoutes && assignedRoutes.length > 0 ? assignedRoutes : r.assignedRoutes);

          const mod = {
            ...r,
            status,
            assignedRoutes: updatedRoutes,
            previousAssignedRoutes: isDeactivating && r.assignedRoutes && r.assignedRoutes.length > 0
              ? r.assignedRoutes
              : (r as any).previousAssignedRoutes,
            approvedAt: status === 'active' ? new Date().toISOString() : r.approvedAt,
            approvedBy: approvedBy || 'Admin Supervisor',
          };
          updatedReader = mod;
          return mod;
        }
        return r;
      });

      await this.setItem('twd_registered_readers', updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('twd_registered_readers', JSON.stringify(updated));
        if (updatedReader) {
          localStorage.setItem('twd_reader_status', status);
        }
      }
      return updatedReader;
    } catch {
      return null;
    }
  }

  // Initial Seed Consumers for Tagoloan Water District (WDT), Misamis Oriental (All Barangays)
  private static DEFAULT_SEED_CONSUMERS: Consumer[] = [...(FULL_SEED_CONSUMERS as unknown as Consumer[])];

  // Initialize Database Helper and synchronize real consumers from server
  static async init(): Promise<void> {
    try {
      const existing = await this.getAllConsumers();
      // If store is empty or contains legacy partial data (< 30 consumers)
      const needsFullSync = !existing || existing.length < 30;

      if (needsFullSync) {
        await this.saveConsumers(this.DEFAULT_SEED_CONSUMERS);
      } else {
        // Automatically merge any newly added seed consumers into existing local storage
        const missing = this.DEFAULT_SEED_CONSUMERS.filter(
          (sc) => !existing.some((ec) => ec.id === sc.id || ec.accountNumber === sc.accountNumber)
        );
        if (missing.length > 0) {
          await this.saveConsumers(missing);
        }
      }

      try {
        const res = await universalApiFetch('/api/consumers?includeInactive=true');
        if (res.ok) {
          const data = await res.json();
          const serverConsumers = data?.consumers || data?.data;
          if (Array.isArray(serverConsumers) && serverConsumers.length > 0) {
            await this.saveConsumers(serverConsumers);
          }
        }
      } catch {
        // Offline fallback is already loaded
      }
    } catch (err) {
      console.warn('DatabaseHelper init error:', err);
    }
  }

  // Database Reset & Clear
  static async clearAllData(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['consumers', 'readings', 'audit_logs', 'keyval'], 'readwrite');
      tx.objectStore('consumers').clear();
      tx.objectStore('readings').clear();
      tx.objectStore('audit_logs').clear();
      tx.objectStore('keyval').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to clear database'));
    });
  }
}
