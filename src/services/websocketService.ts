// Real-Time WebSocket & Telemetry Client Engine for Tagoloan Water District Field System
// Features exponential backoff reconnection, offline message buffering, and telemetry diagnostics

import { getApiBaseUrl } from './apiConfig';

export type WSConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export interface WSEventPacket {
  type: string;
  timestamp: string;
  payload: any;
}

export type WSEventCallback = (data: WSEventPacket) => void;

export interface WSTelemetryStats {
  status: WSConnectionStatus;
  latencyMs: number;
  messagesSent: number;
  messagesReceived: number;
  lastEventTime: string | null;
  lastEventType: string | null;
  activePeers: number;
  serverNode: string;
  reconnectAttempts: number;
  nextReconnectDelayMs: number | null;
  bufferedMessagesCount: number;
  connectionUrl: string;
  isReconnecting: boolean;
}

class WebSocketServiceClass {
  private socket: WebSocket | null = null;
  private listeners: Set<WSEventCallback> = new Set();
  private statusListeners: Set<(status: WSConnectionStatus) => void> = new Set();
  private statsListeners: Set<(stats: WSTelemetryStats) => void> = new Set();

  private status: WSConnectionStatus = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private reconnectTimeoutId: any = null;
  private heartbeatIntervalId: any = null;
  private isExplicitlyClosed = false;
  private pingTimestamp = 0;
  private lastPongReceivedTime = 0;
  private outboundQueue: WSEventPacket[] = [];
  private connectionLogs: string[] = [];
  private currentWsUrl = '';

  // Telemetry stats
  private stats: WSTelemetryStats = {
    status: 'DISCONNECTED',
    latencyMs: 0,
    messagesSent: 0,
    messagesReceived: 0,
    lastEventTime: null,
    lastEventType: null,
    activePeers: 1,
    serverNode: 'Tagoloan District Central Cloud',
    reconnectAttempts: 0,
    nextReconnectDelayMs: null,
    bufferedMessagesCount: 0,
    connectionUrl: '',
    isReconnecting: false,
  };

  private recentEvents: WSEventPacket[] = [];

  constructor() {
    this.setupWindowListeners();
  }

  private setupWindowListeners() {
    if (typeof window === 'undefined') return;

    // Auto-reconnect on network online event
    window.addEventListener('online', () => {
      this.log('Network status changed: ONLINE. Re-establishing WebSocket link...');
      if (!this.isExplicitlyClosed && this.status !== 'CONNECTED') {
        this.reconnectAttempts = 0;
        this.connect();
      }
    });

    // Auto-reconnect when tab becomes active / visible again
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.isExplicitlyClosed && this.status !== 'CONNECTED' && this.status !== 'CONNECTING') {
            this.log('Tab became visible. Checking connection status...');
            this.forceReconnect();
          }
        }
      });
    }
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${message}`;
    this.connectionLogs.unshift(formatted);
    if (this.connectionLogs.length > 50) {
      this.connectionLogs.pop();
    }

    if (level === 'error') {
      console.error(`[TWD-WS] ${formatted}`);
    } else if (level === 'warn') {
      console.warn(`[TWD-WS] ${formatted}`);
    } else {
      console.log(`[TWD-WS] ${formatted}`);
    }
  }

  /**
   * Resolves the WebSocket target URL dynamically based on environment and custom API configuration
   */
  private resolveWsUrl(): string {
    if (typeof window === 'undefined') return '';

    try {
      const customBase = getApiBaseUrl();
      if (customBase && (customBase.startsWith('http://') || customBase.startsWith('https://'))) {
        const parsed = new URL(customBase);
        const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${parsed.host}/ws`;
      }
    } catch {
      // Fallback to location
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  public init() {
    this.isExplicitlyClosed = false;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.reconnectAttempts = 0;
    this.connect();
  }

  public forceReconnect() {
    this.isExplicitlyClosed = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.stopHeartbeat();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.log('Manual reconnect requested. Initiating connection immediately...');
    this.connect();
  }

  private connect() {
    if (this.isExplicitlyClosed) {
      return;
    }

    const wsUrl = this.resolveWsUrl();
    this.currentWsUrl = wsUrl;

    if (!wsUrl) {
      this.log('Unable to resolve WebSocket URL (window undefined).', 'warn');
      return;
    }

    try {
      this.setStatus('CONNECTING');
      this.log(`Attempting connection to ${wsUrl} (attempt #${this.reconnectAttempts + 1})...`);

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.log(`Connection established with Central Node: ${wsUrl}`);
        this.reconnectAttempts = 0;
        this.lastPongReceivedTime = Date.now();
        this.setStatus('CONNECTED');
        this.updateStats({
          serverNode: 'Tagoloan Central Gateway (Live WebSocket)',
          nextReconnectDelayMs: null,
          connectionUrl: wsUrl,
          isReconnecting: false,
        });

        // Ping immediately to measure round-trip latency
        this.ping();
        this.startHeartbeat();

        // Flush queued outbound messages
        this.flushOutboundQueue();
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed: WSEventPacket = JSON.parse(event.data);
          this.lastPongReceivedTime = Date.now();

          if (parsed.type === 'PONG' && this.pingTimestamp > 0) {
            const latency = Math.max(1, Math.round(Date.now() - this.pingTimestamp));
            this.updateStats({ latencyMs: latency });
          }

          if (parsed.type === 'CONNECTION_ESTABLISHED' && parsed.payload) {
            this.updateStats({
              activePeers: parsed.payload.activePeers || 1,
              serverNode: parsed.payload.server || this.stats.serverNode,
            });
            this.log(`Handshake confirmed: ${parsed.payload.server || 'Tagoloan Billing Node'}`);
          }

          if (parsed.type === 'SERVER_HEARTBEAT' && parsed.payload) {
            this.updateStats({
              activePeers: parsed.payload.activeClientsCount || this.stats.activePeers,
            });
          }

          this.stats.messagesReceived++;
          this.stats.lastEventTime = new Date().toLocaleTimeString();
          this.stats.lastEventType = parsed.type;
          this.updateStats({});

          this.recentEvents = [parsed, ...this.recentEvents.slice(0, 49)];

          this.listeners.forEach((callback) => {
            try {
              callback(parsed);
            } catch (err) {
              console.error('[TWD-WS] Error in event listener:', err);
            }
          });
        } catch (err) {
          console.warn('[TWD-WS] Failed to parse message payload:', err);
        }
      };

      this.socket.onclose = (event) => {
        this.stopHeartbeat();
        const reasonStr = event.reason ? ` - ${event.reason}` : '';
        this.log(
          `Socket closed (code: ${event.code}${reasonStr}, clean: ${event.wasClean}).`,
          event.wasClean ? 'info' : 'warn'
        );

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        } else {
          this.setStatus('DISCONNECTED');
        }
      };

      this.socket.onerror = (error) => {
        this.log(`Socket error encountered on ${wsUrl}. Will retry via backoff strategy.`, 'warn');
        // onclose will be called by browser after onerror, where scheduleReconnect is triggered
      };
    } catch (err: any) {
      this.log(`Failed to instantiate WebSocket: ${err?.message || err}`, 'error');
      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Calculates exponential backoff delay with random jitter
   */
  private calculateReconnectDelay(): number {
    // 1st attempt: 1000ms
    // 2nd: ~1500ms
    // 3rd: ~2250ms
    // 4th: ~3375ms
    // 5th: ~5000ms
    // Max cap: 30000ms (30s)
    const base = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    const jitter = Math.floor(Math.random() * 800);
    return Math.round(base + jitter);
  }

  private scheduleReconnect() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    this.reconnectAttempts++;
    const delay = this.calculateReconnectDelay();

    this.setStatus('RECONNECTING');
    this.updateStats({
      reconnectAttempts: this.reconnectAttempts,
      nextReconnectDelayMs: delay,
      isReconnecting: true,
      serverNode: 'Tagoloan District Central Gateway (Reconnecting...)',
    });

    this.log(`Scheduling reconnect attempt #${this.reconnectAttempts} in ${Math.round(delay / 100) / 10}s...`);

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  public ping() {
    this.pingTimestamp = Date.now();
    this.send('PING', {
      clientTime: Date.now(),
      platform: 'Tagoloan Field Mobile Web Terminal',
      reconnectAttempts: this.reconnectAttempts,
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatIntervalId = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        // If no message or pong has been received in 35 seconds, consider socket dead
        if (this.lastPongReceivedTime > 0 && Date.now() - this.lastPongReceivedTime > 35000) {
          this.log('Heartbeat timeout: no server ping/pong received in 35s. Forcing reconnect...', 'warn');
          this.forceReconnect();
          return;
        }
        this.ping();
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  private flushOutboundQueue() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.outboundQueue.length === 0) {
      return;
    }

    this.log(`Flushing ${this.outboundQueue.length} queued messages to server...`);
    const queueToFlush = [...this.outboundQueue];
    this.outboundQueue = [];
    this.updateStats({ bufferedMessagesCount: 0 });

    for (const packet of queueToFlush) {
      try {
        this.socket.send(JSON.stringify(packet));
        this.stats.messagesSent++;
      } catch (e) {
        this.log(`Failed to transmit queued message: ${packet.type}`, 'warn');
      }
    }
  }

  public send(type: string, payload: any): boolean {
    const packet: WSEventPacket = {
      type,
      timestamp: new Date().toISOString(),
      payload,
    };

    // Track in recent events
    this.recentEvents = [packet, ...this.recentEvents.slice(0, 49)];
    this.stats.lastEventTime = new Date().toLocaleTimeString();
    this.stats.lastEventType = type;

    // Notify local event subscribers so UI updates immediately
    this.listeners.forEach((callback) => {
      try {
        callback(packet);
      } catch {
        // ignore
      }
    });

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(packet));
        this.stats.messagesSent++;
        this.updateStats({});
        return true;
      } catch (err) {
        this.log(`Socket send failure for ${type}. Enqueuing packet...`, 'warn');
        this.enqueueMessage(packet);
        return false;
      }
    } else {
      // Buffer packet for later delivery when reconnected
      if (type !== 'PING') {
        this.enqueueMessage(packet);
      }
      return false;
    }
  }

  private enqueueMessage(packet: WSEventPacket) {
    if (this.outboundQueue.length >= 50) {
      this.outboundQueue.shift(); // Drop oldest to avoid unbounded memory growth
    }
    this.outboundQueue.push(packet);
    this.updateStats({ bufferedMessagesCount: this.outboundQueue.length });
  }

  // Convenient typed dispatchers
  public notifyModuleNavigation(
    fromModule: string,
    toModule: string,
    user?: { id: string; name: string } | null,
    metadata?: any
  ) {
    return this.send('MODULE_NAVIGATION', {
      fromModule,
      toModule,
      readerId: user?.id || 'WDT-MR-FIELD',
      readerName: user?.name || 'Field Meter Reader',
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
    });
  }

  public notifyProcessEvent(
    processName: string,
    status: 'STARTING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
    details?: any
  ) {
    return this.send('PROCESS_EVENT', {
      processName,
      status,
      timestamp: new Date().toISOString(),
      details: details || {},
    });
  }

  public notifyFieldReading(accountNumber: string, readingValue: number, readerName: string, route: string) {
    return this.send('FIELD_READING_RECORDED', {
      accountNumber,
      readingValue,
      readerName,
      route,
      timestamp: new Date().toISOString(),
    });
  }

  public subscribe(callback: WSEventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public subscribeStatus(callback: (status: WSConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public subscribeStats(callback: (stats: WSTelemetryStats) => void): () => void {
    this.statsListeners.add(callback);
    callback(this.stats);
    return () => {
      this.statsListeners.delete(callback);
    };
  }

  private setStatus(newStatus: WSConnectionStatus) {
    this.status = newStatus;
    this.updateStats({ status: newStatus });
    this.statusListeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (e) {
        console.error('[TWD-WS] Error in status listener:', e);
      }
    });
  }

  private updateStats(partial: Partial<WSTelemetryStats>) {
    this.stats = { ...this.stats, ...partial, status: this.status };
    this.statsListeners.forEach((listener) => {
      try {
        listener(this.stats);
      } catch (e) {
        console.error('[TWD-WS] Error in stats listener:', e);
      }
    });
  }

  public getStats(): WSTelemetryStats {
    return { ...this.stats };
  }

  public getStatus(): WSConnectionStatus {
    return this.status;
  }

  public getRecentEvents(): WSEventPacket[] {
    return [...this.recentEvents];
  }

  public getConnectionLogs(): string[] {
    return [...this.connectionLogs];
  }

  public clearConnectionLogs() {
    this.connectionLogs = [];
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.socket) {
      try {
        this.socket.close(1000, 'User / Application requested disconnect');
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.setStatus('DISCONNECTED');
    this.log('WebSocket explicitly disconnected.');
  }
}

export const WebSocketService = new WebSocketServiceClass();
