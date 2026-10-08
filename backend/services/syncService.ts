/**
 * Tagoloan Water District (WDT) - Sync Service
 * Manages offline queue synchronizations, batch uploads, and conflict resolution.
 */

import { db } from '@/database/db';
import { WaterDistrictReading } from '@/database/seeds/seedData';
import { WebSocketService } from './websocketService';

export class SyncService {
  /**
   * Process a batch of field readings collected while offline
   */
  public static processBatch(readings: WaterDistrictReading[]): {
    success: boolean;
    syncedCount: number;
    failedCount: number;
    items: Array<{ id: string; status: string; message?: string }>;
  } {
    let synced = 0;
    let failed = 0;
    const items: Array<{ id: string; status: string; message?: string }> = [];

    for (const r of readings) {
      try {
        const prepared: WaterDistrictReading = {
          ...r,
          isOfflineSync: true,
          syncedAt: new Date().toISOString(),
          status: r.status || 'PENDING_APPROVAL',
        };
        db.addReading(prepared);
        db.updateConsumerReading(prepared.accountNumber, prepared.currentReading, prepared.readingDate.split('T')[0]);
        synced++;
        items.push({ id: prepared.id, status: 'SYNCED' });
      } catch (err: any) {
        failed++;
        items.push({ id: r.id, status: 'FAILED', message: err.message });
      }
    }

    // Broadcast batch sync event
    WebSocketService.broadcast('BATCH_SYNC_COMPLETED', {
      total: readings.length,
      syncedCount: synced,
      failedCount: failed,
    });

    db.logAudit('BATCH_OFFLINE_SYNC', 'Field Reader Sync Engine', `Processed batch of ${readings.length} readings (${synced} synced, ${failed} failed)`);

    return {
      success: failed === 0,
      syncedCount: synced,
      failedCount: failed,
      items,
    };
  }
}
