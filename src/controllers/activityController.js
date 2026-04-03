import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { requireFields } from "../utils/validators.js";
import { writeAuditLog } from "../services/auditService.js";
import { buildTenantScope } from "../utils/scope.js";

export async function createActivity(req, res, next) {
  try {
    requireFields(req.body, ["contactId", "type", "note", "happenedAt"]);
    const scope = buildTenantScope(req);
    const contact = await prisma.contact.findFirst({
      where: { ...scope, id: req.body.contactId, deletedAt: null },
      select: { id: true }
    });
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const id = randomUUID();
    await prisma.activity.create({
      data: {
        id,
        tenantId: req.user.tenantId,
        contactId: req.body.contactId,
        type: req.body.type,
        note: req.body.note,
        durationMinutes: req.body.durationMinutes ?? null,
        outcome: req.body.outcome ?? null,
        happenedAt: new Date(req.body.happenedAt),
        createdBy: req.user.userId
      }
    });
    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "activity.create",
      entityType: "activity",
      entityId: id,
      after: req.body
    });
    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
}

export async function listActivities(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const rows = await prisma.activity.findMany({
      where: { ...scope, deletedAt: null, ...(req.query.contactId ? { contactId: req.query.contactId } : {}) },
      select: {
        id: true,
        contactId: true,
        type: true,
        note: true,
        durationMinutes: true,
        outcome: true,
        happenedAt: true,
        createdAt: true
      },
      orderBy: { happenedAt: "desc" }
    });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}
