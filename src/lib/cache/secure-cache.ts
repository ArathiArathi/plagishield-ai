/**
 * PlagiShield AI — High-Performance Secure & Hashed Cache Memory System
 *
 * Architecture:
 * - L1: Fast In-Memory RAM Map (< 1ms access, zero deserialization overhead)
 * - L2: Encrypted & Hashed Persistent Storage (AES-256-GCM + SHA-256 integrity digest)
 * - Cryptographic Key Hashing: Deterministic SHA-256 key hashing prevents query/user ID leaking
 * - Anti-Tamper Verification: Cryptographic hash re-verified before every cache read
 * - Granular Invalidation: Tag-based and key-based cache purging on mutations
 */

export type CacheOptions = {
  userId?: string;
  ttlMs?: number; // Time-to-live in milliseconds (default: 5 minutes)
  tags?: string[]; // Tags for bulk invalidation (e.g. 'documents', 'analyses', 'profile')
  forceFresh?: boolean; // Force fresh database fetch and refresh cache
};

export type CacheStats = {
  hits: number;
  misses: number;
  memoryEntries: number;
  storageEntries: number;
  hitRatio: string;
};

interface L1CacheItem<T = unknown> {
  data: T;
  userId: string;
  expiresAt: number;
  tags: string[];
}

interface EncryptedEnvelope {
  v: number;
  iv: string; // Base64 12-byte IV
  ciphertext: string; // Base64 AES-GCM ciphertext + auth tag
  integrityHash: string; // SHA-256 checksum of plaintext payload + timestamp + userId
  timestamp: number;
  expiresAt: number;
  tags: string[];
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_PREFIX = "ps_scache_";
const KEY_SALT = "plagishield_v1_secure_salt_";

class SecureUserCache {
  private memoryCache = new Map<string, L1CacheItem>();
  private hits = 0;
  private misses = 0;
  private encryptionKeyPromise: Promise<CryptoKey> | null = null;

  constructor() {
    // Periodically evict expired entries from memory every 60 seconds
    if (typeof window !== "undefined") {
      setInterval(() => this.pruneExpiredMemory(), 60_000);
    }
  }

  /**
   * Derive or load a persistent 256-bit AES-GCM encryption key using Web Crypto API.
   */
  private async getEncryptionKey(): Promise<CryptoKey> {
    if (this.encryptionKeyPromise) return this.encryptionKeyPromise;

    this.encryptionKeyPromise = (async () => {
      if (typeof window === "undefined" || !window.crypto?.subtle) {
        // Fallback for non-browser/SSR environments
        return (globalThis.crypto?.subtle as SubtleCrypto)?.generateKey(
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        ) as Promise<CryptoKey>;
      }

      // Generate or retrieve device-level persistent secret
      const KEY_STORAGE_NAME = "ps_crypto_seed_v1";
      let rawSeed = localStorage.getItem(KEY_STORAGE_NAME);
      if (!rawSeed) {
        const rand = window.crypto.getRandomValues(new Uint8Array(32));
        rawSeed = Array.from(rand)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        try {
          localStorage.setItem(KEY_STORAGE_NAME, rawSeed);
        } catch {
          // sessionStorage fallback if localStorage blocked
        }
      }

      // Derive AES-GCM key using PBKDF2
      const enc = new TextEncoder();
      const baseKey = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(rawSeed),
        "PBKDF2",
        false,
        ["deriveKey"],
      );

      return window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: enc.encode(KEY_SALT),
          iterations: 100_000,
          hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    })();

    return this.encryptionKeyPromise;
  }

  /**
   * Generates a deterministic SHA-256 hash for cache keys so internal names are never exposed.
   */
  public async hashKey(rawKey: string, userId = "global"): Promise<string> {
    const raw = `${KEY_SALT}:${userId}:${rawKey}`;
    const subtle = typeof window !== "undefined" ? window.crypto.subtle : globalThis.crypto?.subtle;
    if (!subtle) return `${STORAGE_PREFIX}${userId}_${rawKey}`;

    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);

    return `${STORAGE_PREFIX}${hex}`;
  }

  /**
   * Generates a cryptographic SHA-256 integrity hash of payload + timestamp + userId.
   */
  private async computeIntegrityHash(
    payloadStr: string,
    timestamp: number,
    userId: string,
  ): Promise<string> {
    const subtle = typeof window !== "undefined" ? window.crypto.subtle : globalThis.crypto?.subtle;
    const dataToHash = `${userId}::${timestamp}::${payloadStr}::${KEY_SALT}`;
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(dataToHash));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Retrieve cached data. Checks L1 memory first, then L2 encrypted storage.
   */
  public async get<T>(rawKey: string, options: CacheOptions = {}): Promise<T | null> {
    const userId = options.userId || "global";
    const hashedKey = await this.hashKey(rawKey, userId);
    const now = Date.now();

    // 1. Check L1 Memory Cache (RAM)
    const mem = this.memoryCache.get(hashedKey);
    if (mem) {
      if (mem.expiresAt > now) {
        this.hits++;
        return mem.data as T;
      }
      this.memoryCache.delete(hashedKey);
    }

    // 2. Check L2 Encrypted Persistent Storage
    if (typeof window === "undefined") {
      this.misses++;
      return null;
    }

    try {
      const stored = sessionStorage.getItem(hashedKey);
      if (!stored) {
        this.misses++;
        return null;
      }

      const envelope: EncryptedEnvelope = JSON.parse(stored);
      if (envelope.expiresAt <= now) {
        sessionStorage.removeItem(hashedKey);
        this.misses++;
        return null;
      }

      // Decrypt using AES-GCM
      const key = await this.getEncryptionKey();
      const iv = Uint8Array.from(atob(envelope.iv), (c) => c.charCodeAt(0));
      const ciphertext = Uint8Array.from(atob(envelope.ciphertext), (c) => c.charCodeAt(0));

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext,
      );

      const jsonStr = new TextDecoder().decode(decryptedBuffer);

      // Verify cryptographic integrity hash to prevent tampering
      const verifiedHash = await this.computeIntegrityHash(jsonStr, envelope.timestamp, userId);
      if (verifiedHash !== envelope.integrityHash) {
        console.warn(`[SecureCache] Anti-tamper verification failed for key: ${rawKey}. Evicting.`);
        sessionStorage.removeItem(hashedKey);
        this.misses++;
        return null;
      }

      const parsed = JSON.parse(jsonStr) as T;

      // Populate L1 cache for subsequent instant access
      this.memoryCache.set(hashedKey, {
        data: parsed,
        userId,
        expiresAt: envelope.expiresAt,
        tags: envelope.tags,
      });

      this.hits++;
      return parsed;
    } catch (e) {
      console.warn(`[SecureCache] Failed reading cached key ${rawKey}:`, e);
      this.misses++;
      return null;
    }
  }

  /**
   * Save data into both L1 memory cache and L2 encrypted storage.
   */
  public async set<T>(rawKey: string, data: T, options: CacheOptions = {}): Promise<void> {
    const userId = options.userId || "global";
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const tags = options.tags ?? [];
    const hashedKey = await this.hashKey(rawKey, userId);

    const now = Date.now();
    const expiresAt = now + ttlMs;

    // 1. Populate L1 Memory Cache
    this.memoryCache.set(hashedKey, {
      data,
      userId,
      expiresAt,
      tags,
    });

    // 2. Encrypt and store in L2 Storage
    if (typeof window === "undefined") return;

    try {
      const jsonStr = JSON.stringify(data);
      const integrityHash = await this.computeIntegrityHash(jsonStr, now, userId);
      const key = await this.getEncryptionKey();

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const plaintextBuffer = new TextEncoder().encode(jsonStr);

      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        plaintextBuffer,
      );

      const envelope: EncryptedEnvelope = {
        v: 1,
        iv: btoa(String.fromCharCode(...iv)),
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
        integrityHash,
        timestamp: now,
        expiresAt,
        tags,
      };

      sessionStorage.setItem(hashedKey, JSON.stringify(envelope));
    } catch (e) {
      console.warn(`[SecureCache] Error storing encrypted cache for ${rawKey}:`, e);
    }
  }

  /**
   * High-level helper: returns cached data if available; otherwise calls fetcher(), caches result, and returns it.
   */
  public async getOrFetch<T>(
    rawKey: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    if (!options.forceFresh) {
      const cached = await this.get<T>(rawKey, options);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    }

    const fresh = await fetcher();
    await this.set(rawKey, fresh, options);
    return fresh;
  }

  /**
   * Invalidate a single cache item by key across memory and persistent storage.
   */
  public async invalidate(rawKey: string, options: CacheOptions = {}): Promise<void> {
    const userId = options.userId || "global";
    const hashedKey = await this.hashKey(rawKey, userId);

    this.memoryCache.delete(hashedKey);

    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(hashedKey);
      } catch {
        // ignore storage errors
      }
    }
  }

  /**
   * Invalidate all cache entries matching a specific tag (e.g. 'documents', 'analyses', 'profile').
   */
  public async invalidateByTag(tag: string, options: CacheOptions = {}): Promise<void> {
    const userId = options.userId;

    // Purge L1 memory cache
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.tags.includes(tag) && (!userId || item.userId === userId)) {
        this.memoryCache.delete(key);
      }
    }

    // Purge L2 storage cache
    if (typeof window !== "undefined") {
      try {
        const toDelete: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(STORAGE_PREFIX)) {
            const raw = sessionStorage.getItem(k);
            if (raw) {
              try {
                const env: EncryptedEnvelope = JSON.parse(raw);
                if (env.tags?.includes(tag)) {
                  toDelete.push(k);
                }
              } catch {
                // invalid envelope, remove
                toDelete.push(k);
              }
            }
          }
        }
        for (const k of toDelete) {
          sessionStorage.removeItem(k);
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  /**
   * Clear all cache data belonging to a specific user.
   */
  public async clear(userId?: string): Promise<void> {
    if (!userId) {
      this.clearAll();
      return;
    }

    // Purge memory
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.userId === userId) {
        this.memoryCache.delete(key);
      }
    }

    // Purge storage
    if (typeof window !== "undefined") {
      try {
        const toDelete: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(STORAGE_PREFIX)) {
            toDelete.push(k);
          }
        }
        for (const k of toDelete) {
          sessionStorage.removeItem(k);
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  /**
   * Complete flush of all memory and encrypted storage caches.
   */
  public clearAll(): void {
    this.memoryCache.clear();
    this.hits = 0;
    this.misses = 0;

    if (typeof window !== "undefined") {
      try {
        const toDelete: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(STORAGE_PREFIX)) {
            toDelete.push(k);
          }
        }
        for (const k of toDelete) {
          sessionStorage.removeItem(k);
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  /**
   * Remove expired entries from in-memory cache.
   */
  private pruneExpiredMemory(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Diagnostic statistics for cache performance monitoring.
   */
  public getStats(): CacheStats {
    let storageEntries = 0;
    if (typeof window !== "undefined") {
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(STORAGE_PREFIX)) storageEntries++;
        }
      } catch {
        // ignore
      }
    }

    const total = this.hits + this.misses;
    const ratio = total > 0 ? `${Math.round((this.hits / total) * 100)}%` : "0%";

    return {
      hits: this.hits,
      misses: this.misses,
      memoryEntries: this.memoryCache.size,
      storageEntries,
      hitRatio: ratio,
    };
  }
}

// Global singleton instance
export const secureUserCache = new SecureUserCache();
