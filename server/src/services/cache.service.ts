import { redisClient } from '../lib/redis';

interface L1Entry {
  value: any;
  freshUntil: number;
  staleUntil: number;
}

export class CacheService {
  private static TTL = 24 * 60 * 60; // 24 hours
  private static L1_TTL_MS = 30 * 60 * 1000; // 30 minutes fresh L1 in-memory cache
  private static L1_STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours stale-while-revalidate L1 retention
  private static MAX_REDIS_PAYLOAD_BYTES = 32 * 1024; // Keep >32KB payloads in L1 only to prevent WAN write ECONNRESET
  private static readonly BOOT_EPOCH = Date.now().toString(36);
  private static l1Cache = new Map<string, L1Entry>();
  private static pendingFetches = new Map<string, Promise<any>>();
  private static userGenerations = new Map<string, number>();
  private static pendingRedisInvalidations = new Set<string>();
  private static isRedisListenerAttached = false;

  private static ensureRedisReconnectFlush() {
    if (this.isRedisListenerAttached) return;
    this.isRedisListenerAttached = true;

    const flushPending = async () => {
      if (this.pendingRedisInvalidations.size === 0 || redisClient.status !== 'ready') return;
      const users = Array.from(this.pendingRedisInvalidations);
      for (const uid of users) {
        this.pendingRedisInvalidations.delete(uid);
        await this.flushRedisKeysForUser(uid);
      }
    };

    redisClient.on('ready', () => { flushPending().catch(() => {}); });
    redisClient.on('connect', () => { flushPending().catch(() => {}); });
  }

  private static async flushRedisKeysForUser(userId: string): Promise<void> {
    if (redisClient.status !== 'ready') {
      this.pendingRedisInvalidations.add(userId);
      return;
    }
    try {
      const keysToDelete: string[] = [
        `backup:predictive_insights:${userId}`,
        `rag_cache:${userId}`,
      ];
      const [trackedV1, trackedV2, trackedV3, trackedV4] = await Promise.all([
        this.withFastTimeout(redisClient.smembers(`user_keys:${userId}`), 400).catch(() => []),
        this.withFastTimeout(redisClient.smembers(`user_keys:v2:${userId}`), 400).catch(() => []),
        this.withFastTimeout(redisClient.smembers(`user_keys:v3:${userId}`), 400).catch(() => []),
        this.withFastTimeout(redisClient.smembers(`user_keys:v4:${userId}`), 400).catch(() => []),
      ]);
      for (const list of [trackedV1, trackedV2, trackedV3, trackedV4]) {
        if (Array.isArray(list) && list.length > 0) keysToDelete.push(...list);
      }
      const uniqueKeys = Array.from(new Set(keysToDelete));
      if (uniqueKeys.length > 0) {
        await this.withFastTimeout(redisClient.del(...uniqueKeys), 500);
      }
      await this.withFastTimeout(
        redisClient.del(
          `user_keys:${userId}`,
          `user_keys:v2:${userId}`,
          `user_keys:v3:${userId}`,
          `user_keys:v4:${userId}`,
        ),
        500,
      );
    } catch {
      this.pendingRedisInvalidations.add(userId);
    }
  }

  private static withFastTimeout<T>(promise: Promise<T>, ms = 300): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), ms)
      ),
    ]);
  }

  static async get<T>(key: string, userId?: string): Promise<T | null> {
    this.ensureRedisReconnectFlush();
    const l1 = this.l1Cache.get(key);
    if (l1) {
      if (Date.now() < l1.staleUntil) {
        return l1.value as T;
      }
      this.l1Cache.delete(key);
    }

    if (redisClient.status !== 'ready') return null;
    if (userId && this.pendingRedisInvalidations.has(userId)) return null;

    const data = await this.withFastTimeout(redisClient.get(key), 300);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data) as T;
      const now = Date.now();
      this.l1Cache.set(key, {
        value: parsed,
        freshUntil: now + this.L1_TTL_MS,
        staleUntil: now + this.L1_STALE_TTL_MS,
      });
      return parsed;
    } catch (e) {
      return null;
    }
  }

  private static buildKey(userId: string, specificKey: string): string {
    const gen = this.userGenerations.get(userId) || 0;
    return `cache:v4:${this.BOOT_EPOCH}:${userId}:g${gen}:${specificKey}`;
  }

  static async set(userId: string, specificKey: string, value: any): Promise<void> {
    if (value === undefined) return;
    const fullKey = this.buildKey(userId, specificKey);
    // Never cache an empty weekday agenda in 24h Redis (prevents transient empty responses from sticking)
    if (specificKey.startsWith("agenda:") && Array.isArray(value) && value.length === 0) {
      const datePart = specificKey.slice("agenda:".length);
      const d = new Date(`${datePart}T00:00:00Z`);
      const utcDay = d.getUTCDay();
      if (utcDay >= 1 && utcDay <= 5) {
        return;
      }
    }
    // Never persist empty subjects in long-lived Redis; keep in short L1 only
    if (specificKey.startsWith("subjects:") && Array.isArray(value) && value.length === 0) {
      const now = Date.now();
      this.l1Cache.set(fullKey, {
        value,
        freshUntil: now + 2000,
        staleUntil: now + 2000,
      });
      return;
    }
    // Never persist empty timetable slots in long-lived Redis; keep in short L1 only (prevents sticky blank schedules)
    if (specificKey.startsWith("timetable:") && Array.isArray(value) && value.length === 0) {
      const now = Date.now();
      this.l1Cache.set(fullKey, {
        value,
        freshUntil: now + 2000,
        staleUntil: now + 2000,
      });
      return;
    }
    const now = Date.now();
    this.l1Cache.set(fullKey, {
      value,
      freshUntil: now + this.L1_TTL_MS,
      staleUntil: now + this.L1_STALE_TTL_MS,
    });

    if (redisClient.status !== 'ready') return;

    // Non-blocking background write to Redis; skip >32KB payloads so WAN sockets never suffer write ECONNRESET
    try {
      const serialized = JSON.stringify(value);
      if (serialized.length > this.MAX_REDIS_PAYLOAD_BYTES) return;
      Promise.all([
        this.withFastTimeout(redisClient.set(fullKey, serialized, 'EX', this.TTL), 1500),
        this.withFastTimeout(redisClient.sadd(`user_keys:v4:${userId}`, fullKey), 1500),
      ]).catch(() => {});
    } catch {
      // Ignore serialization errors
    }
  }

  static async getOrSet<T>(userId: string, specificKey: string, fetcher: () => Promise<T>): Promise<T> {
    const fullKey = this.buildKey(userId, specificKey);
    const l1 = this.l1Cache.get(fullKey);
    const now = Date.now();
    if (l1 && now < l1.staleUntil) {
      // If entry is stale (>30m old) and not already refreshing, trigger background refresh without blocking caller (0ms return!)
      if (now >= l1.freshUntil && !this.pendingFetches.has(fullKey)) {
        const genAtStart = this.userGenerations.get(userId) || 0;
        const bgPromise = (async () => {
          try {
            const fresh = await fetcher();
            const currentGen = this.userGenerations.get(userId) || 0;
            if (currentGen === genAtStart && fresh !== undefined && fresh !== null) {
              await this.set(userId, specificKey, fresh);
            }
          } catch {
            // Keep serving stale L1 entry on transient DB error
          } finally {
            this.pendingFetches.delete(fullKey);
          }
        })();
        this.pendingFetches.set(fullKey, bgPromise);
      }
      return l1.value as T;
    }

    // Synchronous singleflight coalescing BEFORE any async Redis/DB await so concurrent requests never stampede
    if (this.pendingFetches.has(fullKey)) {
      return this.pendingFetches.get(fullKey) as Promise<T>;
    }

    const genAtStart = this.userGenerations.get(userId) || 0;

    let fetchPromise: Promise<T> | undefined;
    fetchPromise = (async () => {
      try {
        try {
          const cached = await this.get<T>(fullKey, userId);
          if (cached !== null) {
            if (specificKey.startsWith("agenda:") && Array.isArray(cached) && cached.length === 0) {
              const datePart = specificKey.slice("agenda:".length);
              const d = new Date(`${datePart}T00:00:00Z`);
              const utcDay = d.getUTCDay();
              if (utcDay >= 1 && utcDay <= 5) {
                this.l1Cache.delete(fullKey);
              } else {
                return cached;
              }
            } else {
              return cached;
            }
          }
        } catch {
          // Fall back to DB immediately on Redis timeout/ECONNRESET
        }

        const data = await fetcher();
        // Only write to cache if the user's cache was NOT invalidated while this DB query was in-flight
        const currentGen = this.userGenerations.get(userId) || 0;
        if (currentGen === genAtStart && data !== undefined && data !== null) {
          this.set(userId, specificKey, data).catch(() => {});
        }
        return data;
      } finally {
        if (this.pendingFetches.get(fullKey) === fetchPromise) {
          this.pendingFetches.delete(fullKey);
        }
      }
    })();

    this.pendingFetches.set(fullKey, fetchPromise);
    return fetchPromise;
  }

  static async del(userId: string, specificKey: string): Promise<void> {
    const gen = this.userGenerations.get(userId) || 0;
    const v4Key = `cache:v4:${this.BOOT_EPOCH}:${userId}:g${gen}:${specificKey}`;
    const v3Key = `cache:v3:${userId}:g${gen}:${specificKey}`;
    const fullKey = `cache:v2:${userId}:${specificKey}`;
    const legacyKey = `cache:${userId}:${specificKey}`;
    this.l1Cache.delete(v4Key);
    this.l1Cache.delete(v3Key);
    this.l1Cache.delete(fullKey);
    this.l1Cache.delete(legacyKey);
    this.pendingFetches.delete(v4Key);
    this.pendingFetches.delete(v3Key);
    this.pendingFetches.delete(fullKey);
    this.pendingFetches.delete(legacyKey);

    if (redisClient.status !== 'ready') return;
    try {
      await this.withFastTimeout(redisClient.del(v4Key, v3Key, fullKey, legacyKey), 600);
      await this.withFastTimeout(redisClient.srem(`user_keys:v4:${userId}`, v4Key), 600);
      await this.withFastTimeout(redisClient.srem(`user_keys:v3:${userId}`, v3Key), 600);
      await this.withFastTimeout(redisClient.srem(`user_keys:v2:${userId}`, fullKey), 600);
      await this.withFastTimeout(redisClient.srem(`user_keys:${userId}`, legacyKey), 600);
    } catch {
      // Ignore Redis network resets
    }
  }

  static async invalidateUser(userId: string): Promise<void> {
    this.ensureRedisReconnectFlush();
    // Bump generation and evict L1 + any in-flight fetches synchronously (0ms)
    this.userGenerations.set(userId, (this.userGenerations.get(userId) || 0) + 1);
    const prefixes = [
      `cache:${userId}:`,
      `cache:v2:${userId}:`,
      `cache:v3:${userId}:`,
      `cache:v4:${this.BOOT_EPOCH}:${userId}:`,
    ];
    for (const key of this.l1Cache.keys()) {
      if (prefixes.some((p) => key.startsWith(p))) {
        this.l1Cache.delete(key);
      }
    }
    this.l1Cache.delete(`backup:predictive_insights:${userId}`);
    this.l1Cache.delete(`rag_cache:${userId}`);

    for (const key of this.pendingFetches.keys()) {
      if (prefixes.some((p) => key.startsWith(p))) {
        this.pendingFetches.delete(key);
      }
    }

    if (redisClient.status !== 'ready') {
      this.pendingRedisInvalidations.add(userId);
      return;
    }

    await this.flushRedisKeysForUser(userId);
  }
}
