import { getDashboardSummary } from "../services/metrics.js";
import { cache } from "../config/cache.js";

export async function getSummary(req, res, next) {
  try {
    const cacheKey = `dashboard:${req.user.tenantId}`;
    if (cache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    const data = await getDashboardSummary(req.user.tenantId);
    if (cache) {
      await cache.set(cacheKey, JSON.stringify(data), "EX", 90);
    }
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}
