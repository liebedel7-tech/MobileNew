import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  // In dev / internal system, allow requests or validate token format
  if (!authHeader && req.path.startsWith('/api/admin')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required for administrative actions',
    });
  }
  next();
}

export function validationMiddleware(req: Request, res: Response, next: NextFunction) {
  // If reading entry is submitted, validate fields
  if (req.method === 'POST' && req.path === '/api/readings') {
    const { accountNumber, currentReading, previousReading } = req.body;
    if (!accountNumber) {
      return res.status(400).json({ success: false, error: 'accountNumber is required' });
    }
    if (typeof currentReading !== 'number' || isNaN(currentReading)) {
      return res.status(400).json({ success: false, error: 'Valid numerical currentReading is required' });
    }
    if (currentReading < (previousReading || 0)) {
      return res.status(400).json({ success: false, error: 'Current reading cannot be lower than previous reading' });
    }
  }
  next();
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[API Server Error]', err);
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
  });
}
