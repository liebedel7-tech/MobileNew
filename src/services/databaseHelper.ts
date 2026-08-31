import { Consumer, MeterReading, AuditLog, AppConfig, StaffUser, ReaderAccount, ReaderStatus } from '../types';
import { universalApiFetch, getApiEndpoint } from './apiConfig';
import { INITIAL_CONSUMERS as FULL_SEED_CONSUMERS } from '../data/seedData';

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
        reject(request.error);
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
      consumers.forEach((consumer) => {
        store.put(consumer);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getAllConsumers(): Promise<Consumer[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consumers', 'readonly');
      const store = tx.objectStore('consumers');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Returns only the consumers that fall under the meter reader's assigned coverage areas / barangays
   */
  static async getConsumersForReader(routes?: string[] | string): Promise<Consumer[]> {
    const all = await this.getAllConsumers();
    if (!routes) return all;

    const allowed = (Array.isArray(routes) ? routes : routes.split(','))
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);

    if (allowed.length === 0 || allowed.some((r) => r === 'all' || r === 'all tagoloan districts')) {
      return all;
    }

    return all.filter((c) => {
      const brgy = (c.barangay || '').toLowerCase();
      const route = (c.routeCode || '').toLowerCase();
      const addr = (c.address || '').toLowerCase();
      return allowed.some(
        (z) =>
          brgy.includes(z) ||
          route.includes(z) ||
          addr.includes(z) ||
          (z === 'sta. cruz' && brgy.includes('santa cruz')) ||
          (z === 'santa cruz' && brgy.includes('sta. cruz')) ||
          (z === 'sta. ana' && brgy.includes('santa ana')) ||
          (z === 'santa ana' && brgy.includes('sta. ana'))
      );
    });
  }

  static async getConsumerById(id: string): Promise<Consumer | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consumers', 'readonly');
      const store = tx.objectStore('consumers');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  static async getConsumerByAccountNumber(accNo: string): Promise<Consumer | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consumers', 'readonly');
      const store = tx.objectStore('consumers');
      const index = store.index('accountNumber');
      const request = index.get(accNo);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  static async getConsumerByMeterSerial(serial: string): Promise<Consumer | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('consumers', 'readonly');
      const store = tx.objectStore('consumers');
      const index = store.index('meterSerial');
      const request = index.get(serial);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  static async getConsumerByTagOrMeterNumber(tag: string): Promise<Consumer | null> {
    if (!tag) return null;
    const all = await this.getAllConsumers();
    const rawClean = tag.trim().toLowerCase();
    const alphanumericOnly = rawClean.replace(/[^a-z0-9]/g, '');

    if (!alphanumericOnly) return null;

    // 1. Exact string match
    const exact = all.find(
      (c) =>
        (c.meterNumber && c.meterNumber.toLowerCase() === rawClean) ||
        c.meterSerial.toLowerCase() === rawClean ||
        c.accountNumber.toLowerCase() === rawClean ||
        c.accountNumber.replace(/-/g, '').toLowerCase() === rawClean.replace(/-/g, '')
    );
    if (exact) return exact;

    // 2. Normalized alphanumeric match
    const normalizedMatch = all.find((c) => {
      const cTag = (c.meterNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cSerial = (c.meterSerial || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cAcc = (c.accountNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      return (
        (cTag && (cTag === alphanumericOnly || (cTag.length >= 4 && alphanumericOnly.includes(cTag)) || (alphanumericOnly.length >= 4 && cTag.includes(alphanumericOnly)))) ||
        (cSerial && (cSerial === alphanumericOnly || (cSerial.length >= 4 && alphanumericOnly.includes(cSerial)) || (alphanumericOnly.length >= 4 && cSerial.includes(alphanumericOnly)))) ||
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
  static async saveReading(reading: MeterReading): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['readings', 'consumers'], 'readwrite');
      const readingStore = tx.objectStore('readings');
      const consumerStore = tx.objectStore('consumers');

      readingStore.put(reading);

      // Update consumer's status for this month
      const consumerReq = consumerStore.get(reading.consumerId);
      consumerReq.onsuccess = () => {
        if (consumerReq.result) {
          const updatedConsumer: Consumer = {
            ...consumerReq.result,
            isReadThisMonth: true,
            currentMonthReading: reading,
          };
          consumerStore.put(updatedConsumer);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getAllReadings(): Promise<MeterReading[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('readings', 'readonly');
      const store = tx.objectStore('readings');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
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
      request.onerror = () => reject(request.error);
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

  // Audit Logs
  static async addAuditLog(log: AuditLog): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audit_logs', 'readwrite');
      const store = tx.objectStore('audit_logs');
      store.put(log);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
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
      request.onerror = () => reject(request.error);
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
      tx.onerror = () => reject(tx.error);
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
      (fromDB || []).forEach(r => map.set((r.username || r.id).toLowerCase(), r));
      (fromLS || []).forEach(r => map.set((r.username || r.id).toLowerCase(), r));
      return Array.from(map.values());
    } catch {
      return [];
    }
  }

  static async saveLocalReader(reader: ReaderAccount): Promise<void> {
    try {
      const existing = await this.getLocalReaders();
      const updated = existing.filter(
        r => r.username.toLowerCase() !== reader.username.toLowerCase() && 
             r.id.toLowerCase() !== reader.id.toLowerCase()
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
      const updated = readers.map((r) => {
        if (
          r.id.toLowerCase() === identifier.toLowerCase() ||
          r.username.toLowerCase() === identifier.toLowerCase() ||
          (r.employeeId && r.employeeId.toLowerCase() === identifier.toLowerCase())
        ) {
          const mod = {
            ...r,
            status,
            assignedRoutes: assignedRoutes && assignedRoutes.length > 0 ? assignedRoutes : r.assignedRoutes,
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
      if (!existing || existing.length === 0) {
        // Seed default consumers immediately to ensure instant offline capability
        await this.saveConsumers(this.DEFAULT_SEED_CONSUMERS);
        
        try {
          const res = await universalApiFetch('/api/consumers');
          if (res.ok) {
            const data = await res.json();
            if (data && (data.consumers || data.data) && Array.isArray(data.consumers || data.data)) {
              await this.saveConsumers(data.consumers || data.data);
            }
          }
        } catch {
          // Offline fallback is already loaded
        }
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
      tx.onerror = () => reject(tx.error);
    });
  }
}
