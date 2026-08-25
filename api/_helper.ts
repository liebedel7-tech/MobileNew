// Unified, fail-safe HTTP response helper for Vercel Serverless & Node.js functions

export function setCorsHeaders(res: any) {
  try {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-client-version, x-app-id, X-CSRF-Token');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  } catch {}
}

export function sendJson(res: any, statusCode: number, data: any) {
  setCorsHeaders(res);

  // Vercel / Express helper method
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    try {
      return res.status(statusCode).json(data);
    } catch {}
  }

  // Standard Node.js ServerResponse
  try {
    res.statusCode = statusCode;
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    return res.end(JSON.stringify(data));
  } catch {
    try {
      if (typeof res.writeHead === 'function') {
        res.writeHead(statusCode, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
      }
      return res.end(JSON.stringify(data));
    } catch {}
  }
}

export function parseRequestBody(req: any): any {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}
