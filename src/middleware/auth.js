import jwt from "jsonwebtoken";

export function auth(req, res, next) {
  const raw = req.headers.authorization || "";
  let token = raw.startsWith("Bearer ") ? raw.slice(7) : null;
  if (!token) {
    token = req.cookies?.auth_token || null;
  }
  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}
