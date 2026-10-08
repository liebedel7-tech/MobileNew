/**
 * Tagoloan Water District (WDT) - WebSocket Configuration & Event Constants
 */

export const WS_EVENTS = {
  CONNECTION_ESTABLISHED: 'CONNECTION_ESTABLISHED',
  READING_SUBMITTED: 'READING_SUBMITTED',
  BATCH_SYNC_COMPLETED: 'BATCH_SYNC_COMPLETED',
  READER_STATUS_CHANGED: 'READER_STATUS_CHANGED',
  ANOMALY_ALERT: 'ANOMALY_ALERT',
  AUDIT_LOG_ENTRY: 'AUDIT_LOG_ENTRY',
  PING: 'PING',
  PONG: 'PONG',
} as const;

export const WS_CONFIG = {
  path: '/ws',
  heartbeatIntervalMs: 30000,
  maxPayloadBytes: 10 * 1024 * 1024, // 10MB
};
