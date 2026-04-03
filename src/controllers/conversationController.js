import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { requireFields } from "../utils/validators.js";

function canonicalPair(userIdA, userIdB) {
  return String(userIdA) < String(userIdB) ? [userIdA, userIdB] : [userIdB, userIdA];
}

function conversationWhereForParticipant(req, { userAId, userBId, conversationId } = {}) {
  const base = { deletedAt: null };
  if (conversationId) {
    return {
      ...base,
      id: conversationId,
      OR: [{ userAId: req.user.userId }, { userBId: req.user.userId }]
    };
  }
  return { ...base, userAId, userBId };
}

export async function createConversation(req, res, next) {
  try {
    requireFields(req.body, ["otherUserId"]);
    const otherUserId = String(req.body.otherUserId);
    if (otherUserId === req.user.userId) {
      return res.status(400).json({ message: "otherUserId must be different" });
    }

    const other = await prisma.user.findFirst({
      where: { id: otherUserId, deletedAt: null },
      select: { id: true, tenantId: true }
    });
    if (!other) {
      return res.status(404).json({ message: "User not found" });
    }

    const [userAId, userBId] = canonicalPair(req.user.userId, otherUserId);

    const existing = await prisma.conversation.findFirst({
      where: { userAId, userBId, deletedAt: null }
    });

    const conversation = existing
      ? existing
      : await prisma.conversation.create({
          data: {
            id: randomUUID(),
            tenantId: req.user.tenantId,
            userAId,
            userBId,
            dealId: req.body.dealId || null,
            productId: req.body.productId || null,
            contactId: req.body.contactId || null,
            assignedTo: req.body.assignedTo || null
          }
        });

    return res.status(201).json({ id: conversation.id });
  } catch (error) {
    return next(error);
  }
}

export async function listConversations(req, res, next) {
  try {
    const rows = await prisma.conversation.findMany({
      where: {
        deletedAt: null,
        OR: [{ userAId: req.user.userId }, { userBId: req.user.userId }]
      },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        dealId: true,
        createdAt: true,
        userA: { select: { id: true, fullName: true, email: true } },
        userB: { select: { id: true, fullName: true, email: true } },
        deal: {
          select: {
            id: true,
            title: true,
            stage: true,
            product: { select: { id: true, name: true, imageUrl: true, price: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

export async function listConversationMessages(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const { id } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: conversationWhereForParticipant(req, { conversationId: id }),
      select: { id: true }
    });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const messages = await prisma.conversationMessage.findMany({
      where: { conversationId: id, deletedAt: null },
      select: { id: true, senderId: true, body: true, createdAt: true, sender: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset
    });

    return res.json(messages);
  } catch (error) {
    return next(error);
  }
}

export async function sendConversationMessage(req, res, next) {
  try {
    requireFields(req.body, ["body"]);
    const { id } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: conversationWhereForParticipant(req, { conversationId: id }),
      select: { id: true, tenantId: true }
    });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const msg = await prisma.conversationMessage.create({
      data: {
        id: randomUUID(),
        tenantId: conversation.tenantId,
        conversationId: id,
        senderId: req.user.userId,
        body: req.body.body
      }
    });

    return res.status(201).json({ id: msg.id });
  } catch (error) {
    return next(error);
  }
}

