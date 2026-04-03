import Redis from "ioredis";

export function createCacheClient() {
  if (!process.env.REDIS_URL) return null;
  return new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
}

export const cache = createCacheClient();
