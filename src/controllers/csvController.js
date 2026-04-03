import { randomUUID } from "crypto";
import { format } from "@fast-csv/format";
import { prisma } from "../config/prisma.js";
import { csvImportQueue } from "../jobs/csvImportQueue.js";
import { writeAuditLog } from "../services/auditService.js";
import fs from "fs";

export async function importContactsCsv(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file required" });
    }

    const importJobId = randomUUID();
    await prisma.csvImportJob.create({
      data: {
        id: importJobId,
        tenantId: req.user.tenantId,
        createdBy: req.user.userId,
        filePath: req.file.path,
        status: "queued"
      }
    });

    await csvImportQueue.add(
      { importJobId, tenantId: req.user.tenantId, userId: req.user.userId, filePath: req.file.path },
      { attempts: 3, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: true }
    );

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "csv.import.queued",
      entityType: "csv_import_job",
      entityId: importJobId
    });

    return res.status(202).json({ importJobId, status: "queued" });
  } catch (error) {
    return next(error);
  }
}

export async function getImportJobStatus(req, res, next) {
  try {
    const job = await prisma.csvImportJob.findFirst({
      where: {
        id: req.params.jobId,
        tenantId: req.user.tenantId,
        ...(req.user.role === "sales" ? { createdBy: req.user.userId } : {})
      },
      select: {
        id: true,
        status: true,
        totalRows: true,
        insertedRows: true,
        failedRows: true,
        errorMessage: true,
        reportPath: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!job) {
      return res.status(404).json({ message: "Import job not found" });
    }
    return res.json(job);
  } catch (error) {
    return next(error);
  }
}

export async function downloadImportReport(req, res, next) {
  try {
    const job = await prisma.csvImportJob.findFirst({
      where: {
        id: req.params.jobId,
        tenantId: req.user.tenantId,
        ...(req.user.role === "sales" ? { createdBy: req.user.userId } : {})
      },
      select: { reportPath: true }
    });
    if (!job || !job.reportPath) {
      return res.status(404).json({ message: "Report not found" });
    }
    if (!fs.existsSync(job.reportPath)) {
      return res.status(404).json({ message: "Report file missing" });
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=contacts_import_report.csv");
    return fs.createReadStream(job.reportPath).pipe(res);
  } catch (error) {
    return next(error);
  }
}

export async function exportContactsCsv(req, res, next) {
  try {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=contacts.csv");

    const csv = format({ headers: true });
    csv.pipe(res);

    let cursorId = null;
    const pageSize = 1000;

    while (true) {
      const rows = await prisma.contact.findMany({
        where: {
          tenantId: req.user.tenantId,
          deletedAt: null,
          ...(cursorId ? { id: { gt: cursorId } } : {})
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          createdAt: true
        },
        orderBy: { id: "asc" },
        take: pageSize
      });

      if (rows.length === 0) {
        break;
      }

      rows.forEach((row) =>
        csv.write({
          name: row.name,
          phone: row.phone,
          email: row.email,
          status: row.status,
          created_at: row.createdAt
        })
      );
      cursorId = rows[rows.length - 1].id;
    }

    csv.end();
  } catch (error) {
    return next(error);
  }
}
