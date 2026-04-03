import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { writeAuditLog } from "../services/auditService.js";
import { pickPagination } from "../utils/helpers.js";
import { requireFields } from "../utils/validators.js";
import { buildTenantScope } from "../utils/scope.js";

export async function listContacts(req, res, next) {
  try {
    const { limit, offset } = pickPagination(req.query);
    const scope = buildTenantScope(req);
    const where = {
      ...scope,
      deletedAt: null,
      ...(req.query.status ? { status: req.query.status } : {}),
      ...(req.query.companyId ? { companyId: req.query.companyId } : {}),
      ...(req.query.q
        ? {
            OR: [
              { name: { contains: String(req.query.q), mode: "insensitive" } },
              { email: { contains: String(req.query.q), mode: "insensitive" } },
              { phone: { contains: String(req.query.q), mode: "insensitive" } }
            ]
          }
        : {})
    };

    const sortBy = ["createdAt", "name", "status"].includes(String(req.query.sortBy)) ? String(req.query.sortBy) : "createdAt";
    const sortDir = String(req.query.sortDir).toLowerCase() === "asc" ? "asc" : "desc";
    const rows = await prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        companyId: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { [sortBy]: sortDir },
      take: limit,
      skip: offset
    });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

export async function createContact(req, res, next) {
  try {
    requireFields(req.body, ["name"]);
    const id = randomUUID();
    await prisma.contact.create({
      data: {
        id,
        tenantId: req.user.tenantId,
        companyId: req.body.companyId || null,
        name: req.body.name,
        phone: req.body.phone || null,
        email: req.body.email || null,
        status: req.body.status || "lead",
        createdBy: req.user.userId
      }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "contact.create",
      entityType: "contact",
      entityId: id,
      after: req.body
    });

    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
}

export async function updateContact(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const existing = await prisma.contact.findFirst({
      where: { ...scope, id: req.params.id, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ message: "Contact not found" });
    }

    await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name ?? existing.name,
        phone: req.body.phone ?? existing.phone,
        email: req.body.email ?? existing.email,
        companyId: req.body.companyId ?? existing.companyId,
        status: req.body.status ?? existing.status
      }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "contact.update",
      entityType: "contact",
      entityId: req.params.id,
      before: existing,
      after: req.body
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

export async function deleteContact(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const existing = await prisma.contact.findFirst({
      where: { ...scope, id: req.params.id, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ message: "Contact not found" });
    }

    await prisma.contact.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "contact.delete",
      entityType: "contact",
      entityId: req.params.id,
      before: existing
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}
