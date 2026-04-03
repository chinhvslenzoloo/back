import dotenv from "dotenv";
import { reminderQueue } from "./reminderQueue.js";
import { prisma } from "../config/prisma.js";
import { sendReminderEmail } from "../services/emailService.js";
import { writeAuditLog } from "../services/auditService.js";

dotenv.config();

reminderQueue.process(5, async (job) => {
  const { reminderId } = job.data;
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, status: "pending" },
    include: { user: true }
  });

  if (!reminder) {
    return;
  }

  try {
    await sendReminderEmail({
      to: reminder.user.email,
      subject: `Reminder: ${reminder.subject}`,
      html: `<p>${reminder.subject}</p><p>Entity: ${reminder.entityType} (${reminder.entityId})</p>`
    });

    await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: "sent",
        sentAt: new Date()
      }
    });

    await writeAuditLog({
      tenantId: reminder.tenantId,
      actorUserId: reminder.userId,
      action: "reminder.sent",
      entityType: "reminder",
      entityId: reminder.id
    });
  } catch (error) {
    if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { status: "failed" }
      });
      await writeAuditLog({
        tenantId: reminder.tenantId,
        actorUserId: reminder.userId,
        action: "reminder.failed",
        entityType: "reminder",
        entityId: reminder.id,
        after: { message: error.message }
      });
    }
    throw error;
  }
});
