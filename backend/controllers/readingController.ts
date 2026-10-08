import { Request, Response } from 'express';
import { db } from '@/database/db';
import { BillingService } from '../services/billingService';
import { WebSocketService } from '../services/websocketService';
import { SyncService } from '../services/syncService';
import { WaterDistrictReading } from '@/database/seeds/seedData';

export class ReadingController {
  public static getAll(req: Request, res: Response) {
    const list = db.getReadings();
    return res.json({ success: true, count: list.length, data: list });
  }

  public static create(req: Request, res: Response) {
    const {
      accountNumber,
      consumerName,
      barangay,
      meterSerial,
      readerId,
      readerName,
      previousReading,
      currentReading,
      readingMethod,
      meterCondition,
      photoEvidenceUrl,
      gpsCoordinates,
    } = req.body;

    const consumption = Math.max(0, currentReading - previousReading);
    const bill = BillingService.calculateBill(consumption, 'Residential');
    const anomaly = BillingService.detectAnomaly(consumption, 18);

    const newReading: WaterDistrictReading = {
      id: `RDG-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      accountNumber,
      consumerName: consumerName || 'Valued Consumer',
      barangay: barangay || 'Poblacion',
      meterSerial: meterSerial || 'MTR-UNKNOWN',
      readerId: readerId || 'WDT-FIELD',
      readerName: readerName || 'Field Meter Reader',
      previousReading,
      currentReading,
      consumption,
      totalAmount: bill.totalAmount,
      billingPeriod: 'August 2026',
      readingDate: new Date().toISOString(),
      dueDate: bill.dueDate,
      readingMethod: readingMethod || 'MANUAL',
      meterCondition: meterCondition || 'NORMAL',
      anomalyDetected: anomaly.isAnomaly,
      anomalyType: anomaly.anomalyType,
      photoEvidenceUrl,
      gpsCoordinates,
      status: 'PENDING_APPROVAL',
      isOfflineSync: false,
      syncedAt: new Date().toISOString(),
    };

    db.addReading(newReading);
    db.updateConsumerReading(accountNumber, currentReading, newReading.readingDate.split('T')[0]);

    db.logAudit(
      'METER_READING_SUBMITTED',
      newReading.readerName,
      `Recorded reading ${currentReading} cu.m for Acc# ${accountNumber} (Vol: ${consumption} cu.m, Total: ₱${bill.totalAmount})`
    );

    // Broadcast real-time WebSocket event to all supervisors and connected devices
    WebSocketService.broadcast('READING_SUBMITTED', newReading);

    return res.status(201).json({
      success: true,
      data: newReading,
      billComputation: bill,
    });
  }

  public static syncBatch(req: Request, res: Response) {
    const { readings } = req.body;
    if (!Array.isArray(readings)) {
      return res.status(400).json({ success: false, error: 'readings must be an array' });
    }

    const result = SyncService.processBatch(readings);
    return res.json({ success: true, ...result });
  }

  public static updateStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const reading = db.getReadingById(id);

    if (!reading) {
      return res.status(404).json({ success: false, error: 'Reading record not found' });
    }

    reading.status = status;
    db.logAudit('READING_STATUS_UPDATE', 'Supervisor', `Updated reading ${id} to ${status}. Remarks: ${remarks || 'None'}`);

    WebSocketService.broadcast('READING_STATUS_CHANGED', { id, status, remarks });

    return res.json({ success: true, data: reading });
  }
}
