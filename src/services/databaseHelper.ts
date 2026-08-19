import { Consumer, MeterReading, AuditLog, AppConfig, StaffUser } from '../types';
import { INITIAL_CONSUMERS } from '../data/seedConsumers';

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
    const all = await this.getAllConsumers();
    const clean = tag.trim().toLowerCase();
    return (
      all.find(
        (c) =>
          (c.meterNumber && c.meterNumber.toLowerCase() === clean) ||
          c.meterSerial.toLowerCase() === clean ||
          c.accountNumber.toLowerCase() === clean ||
          c.accountNumber.replace(/-/g, '').toLowerCase() === clean.replace(/-/g, '')
      ) || null
    );
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

  // Initialize Database Helper and ensure default consumers are seeded
  static async init(): Promise<void> {
    try {
      const existing = await this.getAllConsumers();
      if (!existing || existing.length === 0) {
        await this.saveConsumers(INITIAL_CONSUMERS);
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
