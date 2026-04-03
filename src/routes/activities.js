import { Router } from "express";
import { createActivity, listActivities } from "../controllers/activityController.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();

router.get("/", requirePermission("activities:read"), listActivities);
router.post("/", requirePermission("activities:create"), createActivity);

export default router;
