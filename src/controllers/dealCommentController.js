import { prisma } from "../config/prisma.js";
import { requireFields } from "../utils/validators.js";
import { writeAuditLog } from "../services/auditService.js";
import { buildTenantScope } from "../utils/scope.js";
import { randomUUID } from "crypto";

export async function listDealComments(req, res, next) {
  try {
    const dealId = req.params.dealId;
    const scope = buildTenantScope(req);

    const deal = await prisma.deal.findFirst({
      where: { ...scope, id: dealId, deletedAt: null },
      select: { id: true }
    });
    if (!deal && req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(404).json({ message: "Deal not found" });
    }

    const comments = await prisma.dealComment.findMany({
      where: { tenantId: req.user.tenantId, dealId, deletedAt: null },
      select: { id: true, authorId: true, body: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "asc" }
    });

    return res.json(comments);
  } catch (error) {
    return next(error);
  }
}

export async function createDealComment(req, res, next) {
  try {
    requireFields(req.body, ["body"]);
    const dealId = req.params.dealId;
    const scope = buildTenantScope(req);

    const deal = await prisma.deal.findFirst({
      where: { ...scope, id: dealId, deletedAt: null },
      select: { id: true }
    });

    if (!deal && req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(404).json({ message: "Deal not found" });
    }

    const id = randomUUID();
    await prisma.dealComment.create({
      data: {
        id,
        tenantId: req.user.tenantId,
        dealId,
        authorId: req.user.userId,
        body: req.body.body
      }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "deal.comment.create",
      entityType: "deal_comment",
      entityId: id,
      after: req.body
    });

    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
}

