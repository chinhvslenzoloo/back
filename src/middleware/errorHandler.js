import { logger } from "../config/logger.js";

export function errorHandler(error, req, res, next) {
  logger.error(req.requestId, error);
  return res.status(error.statusCode || 500).json({
    message: error.message || "Internal server error"
  });
}
