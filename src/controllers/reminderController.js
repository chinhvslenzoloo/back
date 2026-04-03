import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { reminderQueue } from "../jobs/reminderQueue.js";
import { writeAuditLog } from "../services/auditService.js";
import { requireFields } from "../utils/validators.js";

export async function createReminder(req, res, next) {
  try {
    requireFields(req.body, ["entityType", "entityId", "subject", "remindAt"]);
    const id = randomUUID();
    await prisma.reminder.create({
      data: {
        id,
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        entityType: req.body.entityType,
        entityId: req.body.entityId,
        subject: req.body.subject,
        remindAt: new Date(req.body.remindAt)
      }
    });

    const delayMs = Math.max(new Date(req.body.remindAt).getTime() - Date.now(), 0);
    await reminderQueue.add(
      { reminderId: id },
      {
        delay: delayMs,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true
      }
    );

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "reminder.create",
      entityType: "reminder",
      entityId: id,
      after: req.body
    });

    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
}

export async function listReminders(req, res, next) {
  try {
    const where = {
      tenantId: req.user.tenantId,
      ...(req.user.role === "sales" ? { userId: req.user.userId } : {})
    };
    const rows = await prisma.reminder.findMany({
      where,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        subject: true,
        remindAt: true,
        status: true,
        sentAt: true
      },
      orderBy: { remindAt: "asc" }
    });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}
