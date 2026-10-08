/**
 * Tagoloan Water District (WDT) - Central Database Store
 * Encapsulates persistent queries, transactional mutations, and in-memory caches.
 */

import { INITIAL_CONSUMERS, INITIAL_READERS, DistrictConsumer, DistrictReader, WaterDistrictReading } from './seeds/seedData';

class DatabaseStore {
  private consumers: DistrictConsumer[] = [...INITIAL_CONSUMERS];
  private readers: DistrictReader[] = [...INITIAL_READERS];
  private readings: WaterDistrictReading[] = [];
  private auditLogs: Array<{
    id: string;
    action: string;
    performedBy: string;
    details: string;
    timestamp: string;
  }> = [];

  // CONSUMERS REPOSITORY
  public getConsumers(): DistrictConsumer[] {
    return this.consumers;
  }

  public getConsumerByAccountNumber(accNo: string): DistrictConsumer | undefined {
    return this.consumers.find((c) => c.accountNumber === accNo);
  }

  public getConsumersByBarangay(barangay: string): DistrictConsumer[] {
    return this.consumers.filter((c) => c.barangay.toLowerCase() === barangay.toLowerCase());
  }

  public updateConsumerReading(accountNumber: string, newReading: number, newDate: string): boolean {
    const idx = this.consumers.findIndex((c) => c.accountNumber === accountNumber);
    if (idx !== -1) {
      this.consumers[idx].previousReading = newReading;
      this.consumers[idx].previousReadingDate = newDate;
      this.consumers[idx].lastSyncDate = new Date().toISOString();
      return true;
    }
    return false;
  }

  // READINGS REPOSITORY
  public getReadings(): WaterDistrictReading[] {
    return this.readings;
  }

  public addReading(reading: WaterDistrictReading): WaterDistrictReading {
    this.readings.unshift(reading);
    return reading;
  }

  public getReadingById(id: string): WaterDistrictReading | undefined {
    return this.readings.find((r) => r.id === id);
  }

  // READERS REPOSITORY
  public getReaders(): DistrictReader[] {
    return this.readers;
  }

  public getReaderByUsername(username: string): DistrictReader | undefined {
    return this.readers.find((r) => r.username.toLowerCase() === username.toLowerCase());
  }

  public addReader(reader: DistrictReader): DistrictReader {
    this.readers.push(reader);
    return reader;
  }

  public updateReaderStatus(id: string, status: 'pending' | 'active' | 'rejected'): boolean {
    const reader = this.readers.find((r) => r.id === id);
    if (reader) {
      reader.status = status;
      reader.employmentStatus = status;
      return true;
    }
    return false;
  }

  // AUDIT LOG REPOSITORY
  public logAudit(action: string, performedBy: string, details: string) {
    this.auditLogs.unshift({
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action,
      performedBy,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  public getAuditLogs() {
    return this.auditLogs;
  }
}

export const db = new DatabaseStore();
