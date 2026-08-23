import { AuditLog } from '../types';
import { DatabaseHelper } from './databaseHelper';
import { universalApiFetch, getApiEndpoint } from './apiConfig';

export class LoggerService {
  private static subscribers: Array<(log: AuditLog) => void> = [];

  static subscribe(callback: (log: AuditLog) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  static async log(
    action: string,
    details: string,
    userId: string = 'WDT-FIELD',
    userName: string = 'Meter Reader'
  ): Promise<AuditLog> {
    const logItem: AuditLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      action,
      userId,
      userName,
      details,
      deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Field Device',
    };

    try {
      await DatabaseHelper.addAuditLog(logItem);
      // Notify live subscribers
      this.subscribers.forEach((fn) => fn(logItem));

      // Attempt non-blocking server log sync if online
      universalApiFetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logItem),
      }).catch(() => {
        // Offline logs remain safe in local IndexedDB
      });
    } catch (err) {
      console.error('Error recording audit log:', err);
    }

    return logItem;
  }

  static async logAction(
    action: string,
    userId: string = 'WDT-FIELD',
    userName: string = 'Meter Reader',
    details: string = ''
  ): Promise<AuditLog> {
    return this.log(action, details, userId, userName);
  }
}
