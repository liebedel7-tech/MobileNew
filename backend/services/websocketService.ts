/**
 * Tagoloan Water District (WDT) - WebSocket Service
 * Manages active connected mobile field devices, telemetry broadcasts, and heartbeats.
 */

import { WebSocket as WsClient } from 'ws';

export class WebSocketService {
  private static clients: Set<WsClient> = new Set();

  public static registerClient(client: WsClient) {
    this.clients.add(client);
  }

  public static removeClient(client: WsClient) {
    this.clients.delete(client);
  }

  public static getActiveCount(): number {
    return this.clients.size;
  }

  public static broadcast(eventType: string, payload: any) {
    if (this.clients.size === 0) return;
    const message = JSON.stringify({
      type: eventType,
      timestamp: new Date().toISOString(),
      payload,
    });

    for (const client of this.clients) {
      if (client.readyState === 1 /* OPEN */) {
        try {
          client.send(message);
        } catch (err) {
          console.error('[WS Broadcast Error]', err);
        }
      }
    }
  }
}
