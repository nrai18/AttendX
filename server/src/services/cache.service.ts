import { redisClient } from '../lib/redis';

export class CacheService {
  private static TTL = 24 * 60 * 60; // 24 hours

  static async get<T>(key: string): Promise<T | null> {
    const data = await redisClient.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch (e) {
      return null;
    }
  }

  static async set(userId: string, specificKey: string, value: any): Promise<void> {
    const fullKey = `cache:${userId}:${specificKey}`;
    await redisClient.set(fullKey, JSON.stringify(value), 'EX', this.TTL);
    // Keep track of keys to invalidate
    await redisClient.sadd(`user_keys:${userId}`, fullKey);
  }

  private static pendingFetches = new Map<string, Promise<any>>();

  static async getOrSet<T>(userId: string, specificKey: string, fetcher: () => Promise<T>): Promise<T> {
    const fullKey = `cache:${userId}:${specificKey}`;
    try {
      const cached = await this.get<T>(fullKey);
      if (cached) {
        return cached;
      }
    } catch (redisError) {
      console.warn(`Redis GET failed for ${fullKey}, falling back to DB:`, redisError);
    }

    // Cache Stampede Prevention:
    if (this.pendingFetches.has(fullKey)) {
      return this.pendingFetches.get(fullKey) as Promise<T>;
    }

    const fetchPromise = (async () => {
      try {
        const data = await fetcher();
        try {
          await this.set(userId, specificKey, data);
        } catch (redisError) {
          console.warn(`Redis SET failed for ${fullKey}:`, redisError);
        }
        return data;
      } finally {
        this.pendingFetches.delete(fullKey);
      }
    })();

    this.pendingFetches.set(fullKey, fetchPromise);
    return fetchPromise;
  }

  static async invalidateUser(userId: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];

      // 1. Get keys from the explicit tracker SET
      const trackedKeys = await redisClient.smembers(`user_keys:${userId}`);
      if (trackedKeys && trackedKeys.length > 0) {
        keysToDelete.push(...trackedKeys);
      }

      // 2. Also try SCAN as a fallback
      const pattern = `cache:${userId}:*`;
      let cursor = '0';
      do {
        const res = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
        cursor = res[0];
        if (res[1].length > 0) {
          keysToDelete.push(...res[1]);
        }
      } while (cursor !== '0');

      // Deduplicate keys
      const uniqueKeys = Array.from(new Set(keysToDelete));

      if (uniqueKeys.length > 0) {
        await redisClient.del(...uniqueKeys);
      }
      
      await redisClient.del(`user_keys:${userId}`);
    } catch (redisError) {
      console.warn(`Redis invalidateUser failed for ${userId}:`, redisError);
    }
  }
}
