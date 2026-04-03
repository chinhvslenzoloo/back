import { prisma } from "../config/prisma.js";

export async function writeAuditLog({
  tenantId,
  actorUserId,
  action,
  entityType,
  entityId,
  before = null,
  after = null
}) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      actorUserId,
      action,
      entityType,
      entityId,
      beforeJson: before,
      afterJson: after
    }
  });
}
