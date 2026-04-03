import { Router } from "express";
import { createCompany, deleteCompany, listCompanies, updateCompany } from "../controllers/companyController.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();

router.get("/", requirePermission("companies:read"), listCompanies);
router.post("/", requirePermission("companies:create"), createCompany);
router.patch("/:id", requirePermission("companies:update"), updateCompany);
router.delete("/:id", requirePermission("companies:delete"), deleteCompany);

export default router;
