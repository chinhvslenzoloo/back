import { Router } from "express";
import multer from "multer";
import { downloadImportReport, exportContactsCsv, getImportJobStatus, importContactsCsv } from "../controllers/csvController.js";
import { requirePermission } from "../middleware/rbac.js";

const upload = multer({ dest: "tmp/" });
const router = Router();

router.post("/import/contacts", requirePermission("csv:import"), upload.single("file"), importContactsCsv);
router.get("/import/:jobId", requirePermission("csv:import"), getImportJobStatus);
router.get("/import/:jobId/report", requirePermission("csv:import"), downloadImportReport);
router.get("/export/contacts", requirePermission("csv:export"), exportContactsCsv);

export default router;
