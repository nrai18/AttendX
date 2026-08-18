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

    const data = await fetcher();
    
    try {
      await this.set(userId, specificKey, data);
    } catch (redisError) {
      console.warn(`Redis SET failed for ${fullKey}:`, redisError);
    }
    
    return data;
  }

  static async invalidateUser(userId: string): Promise<void> {
    try {
      // Find all keys for this user matching the cache pattern
      const keys = await redisClient.keys(`cache:${userId}:*`);
      
      // Also grab any legacy tracked keys just in case
      const trackedKeys = await redisClient.smembers(`user_keys:${userId}`);
      
      const allKeys = Array.from(new Set([...keys, ...trackedKeys]));
      
      if (allKeys.length > 0) {
        await redisClient.del(...allKeys);
      }
      await redisClient.del(`user_keys:${userId}`);
    } catch (redisError) {
      console.warn(`Redis invalidateUser failed for ${userId}:`, redisError);
    }
  }
}
