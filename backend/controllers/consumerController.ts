import { Request, Response } from 'express';
import { db } from '@/database/db';

export class ConsumerController {
  public static getAll(req: Request, res: Response) {
    const { barangay, search } = req.query;
    let list = db.getConsumers();

    if (barangay && typeof barangay === 'string' && barangay !== 'All') {
      list = list.filter((c) => c.barangay.toLowerCase() === barangay.toLowerCase());
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.accountNumber.toLowerCase().includes(q) ||
          c.meterSerial.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q)
      );
    }

    return res.json({ success: true, count: list.length, data: list });
  }

  public static getByAccountNumber(req: Request, res: Response) {
    const { accountNumber } = req.params;
    const consumer = db.getConsumerByAccountNumber(accountNumber);
    if (!consumer) {
      return res.status(404).json({ success: false, error: 'Consumer not found' });
    }
    return res.json({ success: true, data: consumer });
  }
}
