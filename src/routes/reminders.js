import { Router } from "express";
import { createReminder, listReminders } from "../controllers/reminderController.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();

router.get("/", requirePermission("reminders:read"), listReminders);
router.post("/", requirePermission("reminders:create"), createReminder);

export default router;
