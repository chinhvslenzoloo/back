import { Router } from "express";
import {
  createConversation,
  listConversations,
  listConversationMessages,
  sendConversationMessage
} from "../controllers/conversationController.js";
import { requirePermission } from "../middleware/rbac.js";

const router = Router();

router.post("/", requirePermission("conversations:send"), createConversation);
router.get("/", requirePermission("conversations:read"), listConversations);
router.get("/:id/messages", requirePermission("conversations:read"), listConversationMessages);
router.post("/:id/messages", requirePermission("conversations:send"), sendConversationMessage);

export default router;

