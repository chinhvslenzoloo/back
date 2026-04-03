import { Router } from "express";
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact
} from "../controllers/contactController.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();

router.get("/", requirePermission("contacts:read"), listContacts);
router.post("/", requirePermission("contacts:create"), createContact);
router.patch("/:id", requirePermission("contacts:update"), updateContact);
router.delete("/:id", requirePermission("contacts:delete"), deleteContact);

export default router;
