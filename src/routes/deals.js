import { Router } from "express";
import { createDeal, deleteDeal, listDeals, updateDealStage } from "../controllers/dealController.js";
import { createDealComment, listDealComments } from "../controllers/dealCommentController.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();

router.get("/", requirePermission("deals:read"), listDeals);
router.post("/", requirePermission("deals:create"), createDeal);
router.patch("/:id/stage", requirePermission("deals:update"), updateDealStage);
router.delete("/:id", requirePermission("deals:delete"), deleteDeal);
router.get("/:dealId/comments", requirePermission("deal-comments:read"), listDealComments);
router.post("/:dealId/comments", requirePermission("deal-comments:create"), createDealComment);

export default router;
