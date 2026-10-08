/**
 * Tagoloan Water District (WDT) - Standalone Backend Server Entry Point
 */

import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket as WsClient } from 'ws';
import apiRouter from './routes';
import { WebSocketService } from './services/websocketService';
import { config } from './config';
import { WS_EVENTS } from './config/websocket';

dotenv.config();

export function createBackendApp() {
  const app = express();

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // CORS Middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', config.cors.origin);
    res.header('Access-Control-Allow-Methods', config.cors.methods.join(', '));
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Mount API router
  app.use('/api', apiRouter);

  return app;
}

export function setupBackendWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const rawUrl = request.url || '';
    const pathname = rawUrl.split('?')[0];

    if (pathname === '/ws' || pathname === '/ws/') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WsClient, req: http.IncomingMessage) => {
    WebSocketService.registerClient(ws);
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    console.log(`[WS] Field Device connected from ${clientIp}. Total active: ${WebSocketService.getActiveCount()}`);

    ws.send(
      JSON.stringify({
        type: WS_EVENTS.CONNECTION_ESTABLISHED,
        timestamp: new Date().toISOString(),
        payload: {
          status: 'CONNECTED',
          server: 'Tagoloan Water District Central Billing Node',
          district: 'WDT-MISOR',
        },
      })
    );

    ws.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch (e) {
        // ignore
      }
    });

    ws.on('close', () => {
      WebSocketService.removeClient(ws);
      console.log(`[WS] Field Device disconnected. Remaining: ${WebSocketService.getActiveCount()}`);
    });
  });

  return wss;
}
