import rateLimitPkg from "express-rate-limit";

export const rateLimit = rateLimitPkg({
  windowMs: 60 * 1000,
  limit: 5000,
  standardHeaders: true,
  legacyHeaders: false
});
