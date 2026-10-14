import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let hasLoggedInitialConnect = false;
let lastErrorLogAt = 0;

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  connectTimeout: 8000,
  commandTimeout: 8000,
  enableReadyCheck: false,
  keepAlive: 15000,
  enableOfflineQueue: false,
  retryStrategy(times) {
    return Math.min(times * 1000, 15000);
  },
});

redisClient.on('error', (err: any) => {
  const now = Date.now();
  // Throttle transient WAN Redis reset/timeout logs to at most once every 60s
  if (now - lastErrorLogAt > 60000) {
    lastErrorLogAt = now;
    console.warn(`[Redis] Transient connection warning (${err?.code || err?.message || 'unknown'}) — L1 in-memory cache active.`);
  }
});

redisClient.on('connect', () => {
  if (!hasLoggedInitialConnect) {
    hasLoggedInitialConnect = true;
    console.log('Redis Client Connected');
  }
});
