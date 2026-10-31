/**
 * Server-side sliding-window rate limiter for PlagiShield AI.
 * Protects analysis execution, queue processing, and external API integrations
 * from abusive bursts, automated spam, and upstream API quota exhaustion.
 */

export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
  actionName: string;
};

export type RateLimitResult = {
  isAllowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSeconds: number;
  message?: string;
};

type Entry = {
  timestamps: number[];
  lastCleanup: number;
};

// In-memory sliding window bucket store
const store = new Map<string, Entry>();

// Periodic garbage collection for expired buckets
const CLEANUP_INTERVAL_MS = 3 * 60 * 1000;
let lastGlobalCleanup = Date.now();

function pruneStore() {
  const now = Date.now();
  if (now - lastGlobalCleanup < CLEANUP_INTERVAL_MS) return;
  lastGlobalCleanup = now;

  const maxWindow = 10 * 60 * 1000; // 10 minutes
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < maxWindow);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/** Pre-configured limits per system operation */
export const RATE_LIMITS = {
  /** Maximum document analysis runs per user */
  ANALYSIS_RUN: {
    maxRequests: 6,
    windowMs: 60 * 1000, // 6 analyses per minute
    actionName: "Analysis Engine",
  },
  /** Queue drain triggers per user */
  QUEUE_PROCESS: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 20 per minute
    actionName: "Analysis Queue",
  },
  /** External LanguageTool public API caller */
  LANGUAGE_TOOL: {
    maxRequests: 18,
    windowMs: 60 * 1000, // Public LT allows max 20/min per IP
    actionName: "LanguageTool Grammar Service",
  },
  /** Search and retrieval queries */
  SOURCE_RETRIEVAL: {
    maxRequests: 40,
    windowMs: 60 * 1000,
    actionName: "Scholarly Source Retrieval",
  },
} as const;

/**
 * Check and record a request in the sliding window.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  pruneStore();

  const now = Date.now();
  const bucketKey = `${config.actionName}:${identifier}`;
  const entry = store.get(bucketKey) ?? { timestamps: [], lastCleanup: now };

  // Retain only timestamps within the current sliding window
  const windowStart = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  const count = entry.timestamps.length;
  const remaining = Math.max(0, config.maxRequests - count);

  if (count >= config.maxRequests) {
    // Oldest timestamp in window determines when the next slot frees up
    const oldest = entry.timestamps[0] ?? now;
    const resetMs = Math.max(1000, oldest + config.windowMs - now);
    const retryAfterSeconds = Math.ceil(resetMs / 1000);

    return {
      isAllowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetMs,
      retryAfterSeconds,
      message: `Rate limit exceeded for ${config.actionName}. Please wait ${retryAfterSeconds}s before retrying.`,
    };
  }

  // Record this request
  entry.timestamps.push(now);
  store.set(bucketKey, entry);

  const resetMs = config.windowMs;
  return {
    isAllowed: true,
    limit: config.maxRequests,
    remaining: remaining - 1,
    resetMs,
    retryAfterSeconds: 0,
  };
}

/** Reset rate limit state for a given key (used in tests or manual unblock) */
export function resetRateLimit(identifier: string, actionName: string) {
  store.delete(`${actionName}:${identifier}`);
}
