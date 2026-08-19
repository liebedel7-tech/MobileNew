// Real-Time WebSocket Client Engine for Tagoloan Water District Field System

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
}

class WebSocketServiceClass {
  private socket: WebSocket | null = null;
  private listeners: Set<WSEventCallback> = new Set();
  private statusListeners: Set<(status: WSConnectionStatus) => void> = new Set();
  private statsListeners: Set<(stats: WSTelemetryStats) => void> = new Set();
  private status: WSConnectionStatus = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private reconnectTimeoutId: any = null;
  private heartbeatIntervalId: any = null;
  private isExplicitlyClosed = false;
  private pingTimestamp = 0;
  
  // Telemetry stats
  private stats: WSTelemetryStats = {
    status: 'DISCONNECTED',
    latencyMs: 12,
    messagesSent: 0,
    messagesReceived: 0,
    lastEventTime: null,
    lastEventType: null,
    activePeers: 1,
    serverNode: 'WDT Central Node (Tagoloan, Misamis Oriental)',
  };

  private recentEvents: WSEventPacket[] = [];

  public init() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.isExplicitlyClosed = false;
    this.connect();
  }

  private updateStats(partial: Partial<WSTelemetryStats>) {
    this.stats = { ...this.stats, ...partial, status: this.status };
    this.statsListeners.forEach((listener) => {
      try {
        listener(this.stats);
      } catch (e) {
        console.error('Error in WS stats listener:', e);
      }
    });
  }

  public getStats(): WSTelemetryStats {
    return this.stats;
  }

  public getRecentEvents(): WSEventPacket[] {
    return this.recentEvents;
  }

  private setStatus(newStatus: WSConnectionStatus) {
    this.status = newStatus;
    this.updateStats({ status: newStatus });
    this.statusListeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (e) {
        console.error('Error in WS status listener:', e);
      }
    });
  }

  public getStatus(): WSConnectionStatus {
    return this.status;
  }

  private connect() {
    try {
      this.setStatus('CONNECTING');
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('CONNECTED');
        console.log('[WS] Connected to Tagoloan District Central Billing WebSocket Server');

        // Ping pulse & stats
        this.ping();
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed: WSEventPacket = JSON.parse(event.data);
          
          // Calculate latency on PONG
          if (parsed.type === 'PONG' && this.pingTimestamp > 0) {
            const latency = Math.max(1, Math.round(Date.now() - this.pingTimestamp));
            this.updateStats({ latencyMs: latency });
          }

          if (parsed.type === 'CONNECTION_ESTABLISHED' && parsed.payload) {
            this.updateStats({
              activePeers: parsed.payload.activePeers || 1,
              serverNode: parsed.payload.server || this.stats.serverNode,
            });
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

          // Keep last 30 recent events in ring buffer
          this.recentEvents = [parsed, ...this.recentEvents.slice(0, 29)];

          this.listeners.forEach((callback) => {
            try {
              callback(parsed);
            } catch (err) {
              console.error('Error in WS event listener:', err);
            }
          });
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();
        if (!this.isExplicitlyClosed) {
          this.setStatus('DISCONNECTED');
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[WS] WebSocket connection encountered error/offline status.');
        if (this.socket) {
          this.socket.close();
        }
      };
    } catch (e) {
      console.warn('[WS] Failed to initialize WebSocket client:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeoutId) clearTimeout(this.reconnectTimeoutId);
    this.reconnectAttempts++;
    
    // Exponential backoff with jitter
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts) + Math.random() * 500, this.maxReconnectDelay);
    
    this.setStatus('RECONNECTING');
    this.reconnectTimeoutId = setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  public ping() {
    this.pingTimestamp = Date.now();
    this.send('PING', { clientTime: Date.now(), platform: 'Tagoloan Field Flutter Terminal' });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatIntervalId = setInterval(() => {
      this.ping();
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  public send(type: string, payload: any): boolean {
    const packet: WSEventPacket = { 
      type, 
      timestamp: new Date().toISOString(), 
      payload 
    };

    // Track in recent events
    this.recentEvents = [packet, ...this.recentEvents.slice(0, 29)];
    this.stats.messagesSent++;
    this.stats.lastEventTime = new Date().toLocaleTimeString();
    this.stats.lastEventType = type;
    this.updateStats({});

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(packet));
        return true;
      } catch (err) {
        console.error('[WS] Send error:', err);
        return false;
      }
    }
    return false;
  }

  // Convenient typed dispatchers
  public notifyModuleNavigation(fromModule: string, toModule: string, user?: { id: string; name: string } | null, metadata?: any) {
    return this.send('MODULE_NAVIGATION', {
      fromModule,
      toModule,
      readerId: user?.id || 'WDT-MR-FIELD',
      readerName: user?.name || 'Field Meter Reader',
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
    });
  }

  public notifyProcessEvent(processName: string, status: 'STARTING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED', details?: any) {
    return this.send('PROCESS_EVENT', {
      processName,
      status,
      timestamp: new Date().toISOString(),
      details: details || {},
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

  public disconnect() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('DISCONNECTED');
  }
}

export const WebSocketService = new WebSocketServiceClass();

