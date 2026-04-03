import { createHash, randomBytes, randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { comparePassword, hashPassword, signToken } from "../services/authService.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { logger } from "../config/logger.js";
import { requireFields } from "../utils/validators.js";

export async function register(req, res, next) {
  try {
    requireFields(req.body, ["tenantName", "fullName", "email", "password"]);
    const tenantId = randomUUID();
    const userId = randomUUID();
    const passwordHash = await hashPassword(req.body.password);

    const normalizedEmail = String(req.body.email).trim().toLowerCase();
    const systemOwnerEmail = process.env.SYSTEM_OWNER_EMAIL ? String(process.env.SYSTEM_OWNER_EMAIL).trim().toLowerCase() : null;
    const role = systemOwnerEmail && normalizedEmail === systemOwnerEmail ? "owner" : "user";

    await prisma.$transaction([
      prisma.tenant.create({
        data: {
          id: tenantId,
          name: req.body.tenantName
        }
      }),
      prisma.user.create({
        data: {
          id: userId,
          tenantId,
          fullName: req.body.fullName,
          email: normalizedEmail,
          passwordHash,
          role
        }
      })
    ]);

    const token = signToken({ id: userId, tenantId, role });
    return res.status(201).json({ token });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Email already exists" });
    }
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    requireFields(req.body, ["email", "password"]);
    const user = await prisma.user.findFirst({
      where: {
        email: req.body.email,
        deletedAt: null
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        role: true,
        passwordHash: true
      }
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await comparePassword(req.body.password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const systemOwnerEmail = process.env.SYSTEM_OWNER_EMAIL ? String(process.env.SYSTEM_OWNER_EMAIL).trim().toLowerCase() : null;
    const normalizedEmail = String(user.email).trim().toLowerCase();
    let effectiveRole = user.role;
    if (effectiveRole === "owner" && systemOwnerEmail && normalizedEmail !== systemOwnerEmail) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: "staff" },
        select: { role: true }
      });
      effectiveRole = updated.role;
    }

    const token = signToken({ id: user.id, tenantId: user.tenantId, role: effectiveRole });
    return res.json({ token });
  } catch (error) {
    return next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    requireFields(req.body, ["email"]);

    const email = String(req.body.email).trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true }
    });

    if (!user) {
      return res.json({ ok: true });
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    const appBaseUrl = process.env.APP_BASE_URL || req.headers.origin;
    if (!appBaseUrl) {
      logger.warn("APP_BASE_URL is missing and request origin is unavailable; cannot build password reset URL");
      return res.json({ ok: true });
    }

    const resetUrl = new URL("/reset-password", appBaseUrl);
    resetUrl.searchParams.set("token", token);

    await sendPasswordResetEmail({ to: user.email, resetUrl: resetUrl.toString() });

    if (process.env.NODE_ENV === "development") {
      return res.json({ ok: true, devResetUrl: resetUrl.toString() });
    }
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Missing token" });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, fullName: true, role: true, tenantId: true }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    requireFields(req.body, ["token", "newPassword"]);

    const token = String(req.body.token);
    const newPassword = String(req.body.newPassword);
    if (newPassword.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const prt = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      select: { id: true, userId: true }
    });

    if (!prt) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: prt.userId },
        data: { passwordHash }
      }),
      prisma.passwordResetToken.update({
        where: { id: prt.id },
        data: { usedAt: new Date() }
      })
    ]);

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}
