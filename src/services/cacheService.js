import { cache } from "../config/cache.js";

export async function invalidateDashboardCache(tenantId) {
  if (!cache) return;
  await cache.del(`dashboard:${tenantId}`);
}
