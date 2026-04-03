import { Router } from "express";
import { getSummary } from "../controllers/dashboardController.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();

router.get("/summary", requirePermission("dashboard:read"), getSummary);

export default router;
