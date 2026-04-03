import { randomUUID } from "crypto";

export function requestId(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
