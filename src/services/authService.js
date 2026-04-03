import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export function signToken(user) {
  const tenantId = user.tenantId ?? user.tenant_id;
  return jwt.sign(
    {
      userId: user.id,
      tenantId,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function hashPassword(plainPassword) {
  const saltRounds = 10;
  return bcrypt.hash(plainPassword, saltRounds);
}

export async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}
