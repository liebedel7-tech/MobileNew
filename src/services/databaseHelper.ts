import { Consumer, MeterReading, AuditLog, AppConfig, StaffUser, ReaderAccount, ReaderStatus } from '../types';
import { universalApiFetch, getApiEndpoint } from './apiConfig';

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

  // Initial Seed Consumers for Tagoloan Water District (WDT), Misamis Oriental
  private static DEFAULT_SEED_CONSUMERS: Consumer[] = [
    {
      id: 'WDT-ACC-01042',
      accountNumber: '01-042-0091',
      name: 'AMORATO, VICENTE G.',
      address: 'Zone 2, Brgy. Poblacion, Tagoloan, Misamis Oriental',
      barangay: 'Poblacion',
      meterSerial: 'MTR-8849201',
      meterNumber: 'TAG-01042',
      meterSize: '1/2"',
      category: 'Residential',
      status: 'Active',
      previousReading: 342,
      previousReadingDate: '2026-07-14',
      previousConsumption: 18,
      averageConsumption: 18,
      rateCode: 'RES-01',
      gpsCoordinates: { lat: 8.5398, lng: 124.7523 },
      routeCode: 'RT-POB-04',
      sequenceNo: 1,
      contactNumber: '+63 917 234 5678',
      lastSyncDate: new Date().toISOString(),
    },
    {
      id: 'WDT-ACC-01043',
      accountNumber: '01-042-0092',
      name: 'CABALLERO, MA. ELENA S.',
      address: 'Purok 4, Brgy. Baluarte, Tagoloan, Misamis Oriental',
      barangay: 'Baluarte',
      meterSerial: 'MTR-7738291',
      meterNumber: 'TAG-01043',
      meterSize: '1/2"',
      category: 'Residential',
      status: 'Active',
      previousReading: 512,
      previousReadingDate: '2026-07-14',
      previousConsumption: 22,
      averageConsumption: 22,
      rateCode: 'RES-01',
      gpsCoordinates: { lat: 8.5462, lng: 124.7611 },
      routeCode: 'RT-BAL-01',
      sequenceNo: 2,
      contactNumber: '+63 928 891 2345',
      lastSyncDate: new Date().toISOString(),
    },
    {
      id: 'WDT-ACC-01044',
      accountNumber: '02-019-0115',
      name: 'TAGOLOAN GRAIN MILL & TRADING',
      address: 'National Highway, Brgy. Casinglot, Tagoloan',
      barangay: 'Casinglot',
      meterSerial: 'MTR-COM-44912',
      meterNumber: 'TAG-01044',
      meterSize: '1"',
      category: 'Commercial A',
      status: 'Active',
      previousReading: 1289,
      previousReadingDate: '2026-07-13',
      previousConsumption: 85,
      averageConsumption: 85,
      rateCode: 'COM-A-01',
      gpsCoordinates: { lat: 8.5312, lng: 124.7435 },
      routeCode: 'RT-CAS-02',
      sequenceNo: 3,
      contactNumber: '+63 939 123 4567',
      lastSyncDate: new Date().toISOString(),
    },
    {
      id: 'WDT-ACC-01045',
      accountNumber: '01-088-0044',
      name: 'RODRIGUEZ, BENJAMIN T.',
      address: 'Zone 1, Brgy. Mohon, Tagoloan, Misamis Oriental',
      barangay: 'Mohon',
      meterSerial: 'MTR-9021844',
      meterNumber: 'TAG-01045',
      meterSize: '1/2"',
      category: 'Residential',
      status: 'Active',
      previousReading: 198,
      previousReadingDate: '2026-07-15',
      previousConsumption: 14,
      averageConsumption: 14,
      rateCode: 'RES-01',
      gpsCoordinates: { lat: 8.5284, lng: 124.7698 },
      routeCode: 'RT-MOH-01',
      sequenceNo: 4,
      contactNumber: '+63 915 678 9012',
      lastSyncDate: new Date().toISOString(),
    },
    {
      id: 'WDT-ACC-01046',
      accountNumber: '03-005-0012',
      name: 'SANTA CRUZ FISH PROCESSING CORP.',
      address: 'Coastal Road, Brgy. Santa Cruz, Tagoloan',
      barangay: 'Santa Cruz',
      meterSerial: 'MTR-IND-99120',
      meterNumber: 'TAG-01046',
      meterSize: '2"',
      category: 'Industrial',
      status: 'Active',
      previousReading: 4890,
      previousReadingDate: '2026-07-12',
      previousConsumption: 320,
      averageConsumption: 320,
      rateCode: 'IND-01',
      gpsCoordinates: { lat: 8.5521, lng: 124.7389 },
      routeCode: 'RT-STC-01',
      sequenceNo: 5,
      contactNumber: '+63 917 889 0012',
      lastSyncDate: new Date().toISOString(),
    },
    {
      id: 'WDT-ACC-01047',
      accountNumber: '01-042-0105',
      name: 'VILLANUEVA, TERESITA L.',
      address: 'Purok 2, Brgy. Poblacion, Tagoloan, Misamis Oriental',
      barangay: 'Poblacion',
      meterSerial: 'MTR-8849312',
      meterNumber: 'TAG-01047',
      meterSize: '1/2"',
      category: 'Residential',
      status: 'Active',
      previousReading: 412,
      previousReadingDate: '2026-07-14',
      previousConsumption: 19,
      averageConsumption: 19,
      rateCode: 'RES-01',
      gpsCoordinates: { lat: 8.5412, lng: 124.7541 },
      routeCode: 'RT-POB-04',
      sequenceNo: 6,
      contactNumber: '+63 920 445 6789',
      lastSyncDate: new Date().toISOString(),
    }
  ];

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
