// Client-Side Request Rate Limiter and Token Bucket Engine
// Protects server from request floods, prevents UI thread lockups, and mitigates bot-like rapid calls

export interface RateLimiterOptions {
  maxTokens: number;        // Maximum tokens in the bucket (burst capacity)
  refillRatePerSec: number; // Tokens added per second
  windowMs?: number;        // Optional sliding window duration in ms
  maxRequestsPerWindow?: number;
}

export interface RateLimitStats {
  totalRequested: number;
  totalAllowed: number;
  totalThrottled: number;
  currentTokens: number;
  queueLength: number;
  lastRequestTime: number;
  activeBurstRate: number;
}

export class TokenBucketLimiter {
  private maxTokens: number;
  private refillRatePerSec: number;
  private currentTokens: number;
  private lastRefillTimestamp: number;
  private queue: Array<{ resolve: (allowed: boolean) => void; reject: (err: any) => void; timestamp: number }> = [];
  private stats: RateLimitStats = {
    totalRequested: 0,
    totalAllowed: 0,
    totalThrottled: 0,
    currentTokens: 0,
    queueLength: 0,
    lastRequestTime: 0,
    activeBurstRate: 0,
  };

  private listeners: Set<(stats: RateLimitStats) => void> = new Set();
  private processingQueue = false;

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.maxTokens;
    this.refillRatePerSec = options.refillRatePerSec;
    this.currentTokens = options.maxTokens;
    this.lastRefillTimestamp = Date.now();
    this.stats.currentTokens = this.currentTokens;
  }

  private refill() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTimestamp) / 1000;
    if (elapsedSeconds > 0) {
      const tokensToAdd = elapsedSeconds * this.refillRatePerSec;
      this.currentTokens = Math.min(this.maxTokens, this.currentTokens + tokensToAdd);
      this.lastRefillTimestamp = now;
      this.stats.currentTokens = Math.round(this.currentTokens * 10) / 10;
    }
  }

  /**
   * Tries to consume tokens immediately without waiting. Returns true if allowed, false if rate limited.
   */
  public tryConsume(tokens = 1): boolean {
    this.refill();
    this.stats.totalRequested += tokens;
    this.stats.lastRequestTime = Date.now();

    if (this.currentTokens >= tokens) {
      this.currentTokens -= tokens;
      this.stats.totalAllowed += tokens;
      this.stats.currentTokens = Math.round(this.currentTokens * 10) / 10;
      this.emitStats();
      return true;
    }

    this.stats.totalThrottled += tokens;
    this.emitStats();
    return false;
  }

  /**
   * Requests permission to execute. If rate limited, queues or delays execution until a token is available.
   * If maxWaitMs is exceeded, rejects with rate limit error.
   */
  public async acquire(tokens = 1, maxWaitMs = 5000): Promise<boolean> {
    this.refill();
    this.stats.totalRequested += tokens;
    this.stats.lastRequestTime = Date.now();

    if (this.currentTokens >= tokens) {
      this.currentTokens -= tokens;
      this.stats.totalAllowed += tokens;
      this.stats.currentTokens = Math.round(this.currentTokens * 10) / 10;
      this.emitStats();
      return true;
    }

    // Must wait for token refill
    this.stats.totalThrottled += tokens;
    this.emitStats();

    return new Promise<boolean>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from queue
        const idx = this.queue.findIndex(q => q.resolve === resolve);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          this.stats.queueLength = this.queue.length;
          this.emitStats();
        }
        resolve(false); // Timed out waiting for rate limit token
      }, maxWaitMs);

      this.queue.push({
        resolve: (allowed) => {
          clearTimeout(timeoutId);
          resolve(allowed);
        },
        reject,
        timestamp: Date.now(),
      });

      this.stats.queueLength = this.queue.length;
      this.emitStats();
      this.scheduleQueueProcessor();
    });
  }

  private scheduleQueueProcessor() {
    if (this.processingQueue || this.queue.length === 0) return;
    this.processingQueue = true;

    const interval = Math.max(50, Math.floor(1000 / this.refillRatePerSec));
    const processNext = () => {
      this.refill();
      while (this.queue.length > 0 && this.currentTokens >= 1) {
        this.currentTokens -= 1;
        this.stats.totalAllowed += 1;
        const item = this.queue.shift();
        if (item) {
          item.resolve(true);
        }
      }

      this.stats.queueLength = this.queue.length;
      this.stats.currentTokens = Math.round(this.currentTokens * 10) / 10;
      this.emitStats();

      if (this.queue.length > 0) {
        setTimeout(processNext, interval);
      } else {
        this.processingQueue = false;
      }
    };

    setTimeout(processNext, interval);
  }

  public getStats(): RateLimitStats {
    this.refill();
    return { ...this.stats, currentTokens: Math.round(this.currentTokens * 10) / 10 };
  }

  public subscribe(listener: (stats: RateLimitStats) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStats());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitStats() {
    const s = this.getStats();
    this.listeners.forEach(fn => {
      try {
        fn(s);
      } catch {
        // ignore
      }
    });
  }

  public reset() {
    this.currentTokens = this.maxTokens;
    this.stats.totalThrottled = 0;
    this.stats.totalAllowed = 0;
    this.stats.totalRequested = 0;
    this.queue = [];
    this.stats.queueLength = 0;
    this.emitStats();
  }
}

// Global Singleton Rate Limiters for App Services:

// 1. WebSocket Outbound Rate Limiter: Max 12 packets burst, refills 4 packets/sec
export const wsRateLimiter = new TokenBucketLimiter({
  maxTokens: 12,
  refillRatePerSec: 4,
});

// 2. HTTP API Call Rate Limiter: Max 20 concurrent requests burst, refills 6 requests/sec
export const apiRateLimiter = new TokenBucketLimiter({
  maxTokens: 20,
  refillRatePerSec: 6,
});

// 3. Sync Engine Batch Rate Limiter: Max 8 batch sync triggers burst, refills 2/sec
export const syncRateLimiter = new TokenBucketLimiter({
  maxTokens: 8,
  refillRatePerSec: 2,
});
