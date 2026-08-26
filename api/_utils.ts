// Helper for universal Vercel serverless / Edge / Node compatibility
export function sendJson(req: any, res: any, status: number, data: any) {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);

  if (res) {
    try {
      if (typeof res.setHeader === 'function') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      if (typeof res.status === 'function') {
        if (typeof res.json === 'function' && typeof data === 'object') {
          return res.status(status).json(data);
        }
        return res.status(status).end(jsonStr);
      }
      res.statusCode = status;
      if (typeof res.end === 'function') {
        return res.end(jsonStr);
      }
    } catch {
      // ignore
    }
  }

  return new Response(jsonStr, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export function parseRequest(req: any) {
  const query: Record<string, string> = {};
  let body: any = {};

  try {
    if (req) {
      if (req.query && typeof req.query === 'object') {
        for (const [k, v] of Object.entries(req.query)) {
          if (typeof v === 'string') query[k] = v;
          else if (Array.isArray(v) && v[0]) query[k] = String(v[0]);
        }
      } else if (req.url) {
        try {
          const u = new URL(req.url, 'http://localhost');
          u.searchParams.forEach((val, key) => {
            query[key] = val;
          });
        } catch {}
      }

      if (req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    }
  } catch {}

  return { query, body };
}
