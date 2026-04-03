import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { hashPassword } from "../services/authService.js";
import { requireFields } from "../utils/validators.js";

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function ensureRole(role) {
  const r = String(role);
  if (r !== "admin" && r !== "sales" && r !== "staff" && r !== "user") {
    const err = new Error("Invalid role");
    err.statusCode = 400;
    throw err;
  }
  return r;
}

function normalizeSystemOwnerEmail() {
  return process.env.SYSTEM_OWNER_EMAIL ? String(process.env.SYSTEM_OWNER_EMAIL).trim().toLowerCase() : null;
}

export async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.user.tenantId, deletedAt: null },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true }
    });
    return res.json({ users });
  } catch (error) {
    return next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    requireFields(req.body, ["fullName", "email", "password", "role"]);

    const id = randomUUID();
    const passwordHash = await hashPassword(String(req.body.password));
    const role = ensureRole(req.body.role);

    if (role === "admin" && req.user.role !== "owner") {
      return res.status(403).json({ message: "Only owner can create admins" });
    }

    const user = await prisma.user.create({
      data: {
        id,
        tenantId: req.user.tenantId,
        fullName: String(req.body.fullName),
        email: normalizeEmail(req.body.email),
        passwordHash,
        role
      },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true }
    });

    return res.status(201).json({ user });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Email already exists" });
    }
    return next(error);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    requireFields(req.body, ["role"]);
    const role = ensureRole(req.body.role);

    const targetId = String(req.params.id);

    if (role === "admin" && req.user.role !== "owner") {
      return res.status(403).json({ message: "Only owner can promote to admin" });
    }

    const existing = await prisma.user.findFirst({
      where: { id: targetId, tenantId: req.user.tenantId, deletedAt: null },
      select: { id: true, email: true, role: true }
    });
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    const systemOwnerEmail = normalizeSystemOwnerEmail();
    const normalizedTargetEmail = normalizeEmail(existing.email);
    if (existing.role === "owner" || (systemOwnerEmail && normalizedTargetEmail === systemOwnerEmail)) {
      return res.status(403).json({ message: "Cannot change owner role" });
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true }
    });

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

export async function disableUser(req, res, next) {
  try {
    const targetId = String(req.params.id);

    const existing = await prisma.user.findFirst({
      where: { id: targetId, tenantId: req.user.tenantId, deletedAt: null },
      select: { id: true, email: true, role: true }
    });
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    const systemOwnerEmail = normalizeSystemOwnerEmail();
    const normalizedTargetEmail = normalizeEmail(existing.email);
    if (existing.role === "owner" || (systemOwnerEmail && normalizedTargetEmail === systemOwnerEmail)) {
      return res.status(403).json({ message: "Cannot disable owner" });
    }

    if (existing.role === "admin" && req.user.role !== "owner") {
      return res.status(403).json({ message: "Only owner can disable admins" });
    }

    await prisma.user.update({
      where: { id: targetId },
      data: { deletedAt: new Date() }
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}
