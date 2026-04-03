import fs from "fs";
import { parse } from "@fast-csv/parse";
import { format } from "@fast-csv/format";
import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { csvImportQueue } from "./csvImportQueue.js";
import { writeAuditLog } from "../services/auditService.js";

csvImportQueue.process(2, async (job) => {
  const { importJobId, tenantId, userId, filePath } = job.data;
  let totalRows = 0;
  let insertedRows = 0;
  let failedRows = 0;
  const reportDir = "tmp/csv-reports";
  const reportPath = `${reportDir}/${importJobId}.csv`;
  let reportStream = null;

  await prisma.csvImportJob.update({
    where: { id: importJobId },
    data: { status: "processing" }
  });

  try {
    if (!fs.existsSync("tmp")) fs.mkdirSync("tmp");
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    reportStream = format({ headers: true });
    reportStream.pipe(fs.createWriteStream(reportPath));

    const stream = fs.createReadStream(filePath).pipe(parse({ headers: true }));
    let batch = [];

    for await (const row of stream) {
      totalRows += 1;
      batch.push(row);
      if (batch.length >= 500) {
        const { inserted, failed } = await flushBatch({ tenantId, userId, rows: batch, reportStream });
        insertedRows += inserted;
        failedRows += failed;
        batch = [];
        await prisma.csvImportJob.update({
          where: { id: importJobId },
          data: { totalRows, insertedRows, failedRows }
        });
      }
    }

    if (batch.length > 0) {
      const { inserted, failed } = await flushBatch({ tenantId, userId, rows: batch, reportStream });
      insertedRows += inserted;
      failedRows += failed;
    }

    reportStream.end();

    await prisma.csvImportJob.update({
      where: { id: importJobId },
      data: {
        status: "completed",
        totalRows,
        insertedRows,
        failedRows,
        reportPath: failedRows > 0 ? reportPath : null
      }
    });

    await writeAuditLog({
      tenantId,
      actorUserId: userId,
      action: "csv.import.completed",
      entityType: "csv_import_job",
      entityId: importJobId,
      after: { totalRows, insertedRows, failedRows }
    });
  } catch (error) {
    if (reportStream) {
      try {
        reportStream.end();
      } catch {
        // ignore
      }
    }
    await prisma.csvImportJob.update({
      where: { id: importJobId },
      data: {
        status: "failed",
        totalRows,
        insertedRows,
        failedRows,
        errorMessage: error.message,
        reportPath: fs.existsSync(reportPath) ? reportPath : null
      }
    });
    throw error;
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

async function flushBatch({ tenantId, userId, rows, reportStream }) {
  const prepared = [];
  let failed = 0;

  for (const row of rows) {
    if (!row.name) {
      reportStream?.write({ error: "Missing name", ...row });
      failed += 1;
      continue;
    }
    if (row.email && !String(row.email).includes("@")) {
      reportStream?.write({ error: "Invalid email", ...row });
      failed += 1;
      continue;
    }
    prepared.push({
      id: randomUUID(),
      tenantId,
      name: row.name,
      phone: row.phone || null,
      email: row.email || null,
      status: row.status || "lead",
      createdBy: userId
    });
  }

  if (prepared.length === 0) {
    return { inserted: 0, failed };
  }

  await prisma.contact.createMany({
    data: prepared
  });

  return { inserted: prepared.length, failed };
}
