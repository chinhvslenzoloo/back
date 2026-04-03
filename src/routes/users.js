import { Router } from "express";
import { createUser, disableUser, listUsers, updateUserRole } from "../controllers/userController.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();

router.get("/", requirePermission("users:read"), listUsers);
router.post("/", requirePermission("users:create"), createUser);
router.patch("/:id/role", requirePermission("users:update"), updateUserRole);
router.delete("/:id", requirePermission("users:disable"), disableUser);

export default router;
