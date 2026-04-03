import app from "./app.js";
import { logger } from "./config/logger.js";
import "./jobs/reminderWorker.js";
import "./jobs/csvImportWorker.js";

// Dev үед Redis/Bull/Prisma холбооны алдаа ирэхэд процесс унахгүй байлгах зорилготой.
process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", reason?.message || reason);
});

// const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  logger.info(`API running on :${port}`);
});
