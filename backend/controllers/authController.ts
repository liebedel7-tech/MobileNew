import { Request, Response } from 'express';
import { db } from '@/database/db';
import { WebSocketService } from '../services/websocketService';

export class AuthController {
  public static login(req: Request, res: Response) {
    const { username, pin } = req.body;
    if (!username || !pin) {
      return res.status(400).json({ success: false, error: 'Username and PIN are required' });
    }

    const reader = db.getReaderByUsername(username);
    if (!reader) {
      return res.status(401).json({ success: false, error: 'Invalid reader credentials' });
    }

    if (reader.pin !== pin) {
      return res.status(401).json({ success: false, error: 'Incorrect PIN' });
    }

    if (reader.status === 'terminated' || reader.status === 'rejected') {
      return res.status(403).json({
        success: false,
        error: 'This meter reader account has been terminated by district administration. Mobile terminal access revoked.',
        status: 'terminated',
      });
    }

    db.logAudit('READER_LOGIN', reader.name, `Successful login from device: ${req.headers['user-agent'] || 'Mobile App'}`);

    return res.json({
      success: true,
      reader: {
        id: reader.id,
        employeeId: reader.employeeId,
        username: reader.username,
        name: reader.name,
        role: reader.role,
        assignedRoutes: reader.assignedRoutes,
        status: reader.status,
      },
      token: `wdt-jwt-${Buffer.from(reader.id).toString('base64')}-${Date.now()}`,
    });
  }

  public static register(req: Request, res: Response) {
    const { username, pin, name, contactNumber, email, role, employeeId } = req.body;
    if (!username || !pin || !name) {
      return res.status(400).json({ success: false, error: 'Name, username, and PIN are required' });
    }

    if (db.getReaderByUsername(username)) {
      return res.status(409).json({ success: false, error: 'Username already in use' });
    }

    const newReader = {
      id: `WDT-MR${String(db.getReaders().length + 1).padStart(2, '0')}`,
      employeeId: employeeId || `TWD-2026-${String(Math.floor(100 + Math.random() * 900))}`,
      username,
      pin,
      name,
      role: role || 'Meter Reader I',
      contactNumber: contactNumber || '',
      email: email || '',
      assignedRoutes: ['Poblacion'],
      status: 'active' as const,
      employmentStatus: 'active' as const,
      createdAt: new Date().toISOString(),
    };

    db.addReader(newReader);
    db.logAudit('READER_REGISTRATION', name, 'New field reader registered and automatically activated');

    WebSocketService.broadcast('READER_STATUS_CHANGED', {
      readerId: newReader.id,
      name: newReader.name,
      status: 'active',
    });

    return res.status(201).json({
      success: true,
      message: 'Meter reader registered successfully. Mobile terminal is automatically active.',
      reader: newReader,
    });
  }
}
