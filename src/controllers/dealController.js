import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { writeAuditLog } from "../services/auditService.js";
import { invalidateDashboardCache } from "../services/cacheService.js";
import { requireFields } from "../utils/validators.js";
import { pickPagination } from "../utils/helpers.js";
import { buildTenantScope } from "../utils/scope.js";

export async function listDeals(req, res, next) {
  try {
    const { limit, offset } = pickPagination(req.query);
    const scope = buildTenantScope(req);
    const where = {
      ...scope,
      deletedAt: null,
      ...(req.query.stage ? { stage: req.query.stage } : {}),
      ...(req.query.contactId ? { contactId: req.query.contactId } : {}),
      ...(req.query.minAmount ? { amount: { gte: Number(req.query.minAmount) } } : {}),
      ...(req.query.maxAmount
        ? { amount: { ...(req.query.minAmount ? { gte: Number(req.query.minAmount) } : {}), lte: Number(req.query.maxAmount) } }
        : {}),
      ...(req.query.deadlineFrom || req.query.deadlineTo
        ? {
            deadline: {
              ...(req.query.deadlineFrom ? { gte: new Date(req.query.deadlineFrom) } : {}),
              ...(req.query.deadlineTo ? { lte: new Date(req.query.deadlineTo) } : {})
            }
          }
        : {}),
      ...(req.query.q
        ? {
            title: {
              contains: String(req.query.q),
              mode: "insensitive"
            }
          }
        : {})
    };

    if (req.user.role === "user") {
      where.createdBy = req.user.userId;
    }

    const sortBy = ["createdAt", "deadline", "amount", "stage", "title"].includes(String(req.query.sortBy))
      ? String(req.query.sortBy)
      : "createdAt";
    const sortDir = String(req.query.sortDir).toLowerCase() === "asc" ? "asc" : "desc";

    const rows = await prisma.deal.findMany({
      where,
      select: {
        id: true,
        title: true,
        amount: true,
        stage: true,
        deadline: true,
        contactId: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true
          }
        }
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

export async function createDeal(req, res, next) {
  try {
    requireFields(req.body, ["title"]);
    const id = randomUUID();
    await prisma.deal.create({
      data: {
        id,
        tenantId: req.user.tenantId,
        contactId: req.body.contactId || null,
        title: req.body.title,
        amount: req.body.amount || 0,
        stage: req.body.stage || "prospect",
        deadline: req.body.deadline ? new Date(req.body.deadline) : null,
        createdBy: req.user.userId,
        productId: req.body.productId || null
      }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "deal.create",
      entityType: "deal",
      entityId: id,
      after: req.body
    });
    await invalidateDashboardCache(req.user.tenantId);

    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
}

export async function updateDealStage(req, res, next) {
  try {
    requireFields(req.body, ["stage"]);
    const scope = buildTenantScope(req);
    const existing = await prisma.deal.findFirst({
      where: { ...scope, id: req.params.id, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ message: "Deal not found" });
    }

    await prisma.deal.update({
      where: { id: req.params.id },
      data: { stage: req.body.stage }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "deal.stage.update",
      entityType: "deal",
      entityId: req.params.id,
      before: { stage: existing.stage },
      after: { stage: req.body.stage }
    });
    await invalidateDashboardCache(req.user.tenantId);

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

export async function deleteDeal(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const existing = await prisma.deal.findFirst({
      where: { ...scope, id: req.params.id, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ message: "Deal not found" });
    }

    await prisma.deal.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "deal.delete",
      entityType: "deal",
      entityId: req.params.id,
      before: existing
    });
    await invalidateDashboardCache(req.user.tenantId);

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}
