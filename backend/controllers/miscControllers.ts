import { Request, Response } from 'express';
import { db } from '@/database/db';
import { WebSocketService } from '../services/websocketService';
import { OcrService } from '../services/ocrService';

export class ReaderController {
  public static getAll(req: Request, res: Response) {
    const readers = db.getReaders();
    return res.json({ success: true, count: readers.length, data: readers });
  }

  public static updateStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'active', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const ok = db.updateReaderStatus(id, status);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Reader not found' });
    }

    WebSocketService.broadcast('READER_STATUS_CHANGED', { readerId: id, status });
    db.logAudit('READER_STATUS_UPDATE', 'Supervisor', `Updated reader ${id} status to ${status}`);

    return res.json({ success: true, message: `Reader status updated to ${status}` });
  }
}

export class StatsController {
  public static getDashboardStats(req: Request, res: Response) {
    const consumers = db.getConsumers();
    const readings = db.getReadings();
    const totalConsumers = consumers.length;
    const readCount = readings.length;
    const pendingCount = Math.max(0, totalConsumers - readCount);
    const totalConsumption = readings.reduce((sum, r) => sum + r.consumption, 0);
    const totalBilled = readings.reduce((sum, r) => sum + r.totalAmount, 0);
    const anomaliesCount = readings.filter((r) => r.anomalyDetected).length;

    return res.json({
      success: true,
      stats: {
        totalConsumers,
        readCount,
        pendingCount,
        completionPercentage: totalConsumers > 0 ? Math.round((readCount / totalConsumers) * 100) : 0,
        totalConsumptionCuM: totalConsumption,
        totalBilledPhp: totalBilled,
        anomaliesCount,
        activeWsPeers: WebSocketService.getActiveCount(),
      },
    });
  }
}

export class AuditController {
  public static getAll(req: Request, res: Response) {
    const logs = db.getAuditLogs();
    return res.json({ success: true, count: logs.length, data: logs });
  }
}

export class OcrController {
  public static async analyze(req: Request, res: Response) {
    const { imageBase64, meterSerial } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 image string is required' });
    }

    try {
      const result = await OcrService.analyzeMeterPhoto(imageBase64, meterSerial);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to analyze meter photo',
      });
    }
  }
}
