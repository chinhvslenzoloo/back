import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { writeAuditLog } from "../services/auditService.js";
import { pickPagination } from "../utils/helpers.js";
import { requireFields } from "../utils/validators.js";
import { buildTenantScope, buildProductScope } from "../utils/scope.js";

export async function listOrders(req, res, next) {
  try {
    const { limit, offset } = pickPagination(req.query);
    const scope = buildTenantScope(req);
    const where = {
      ...scope,
      ...(req.query.status ? { status: req.query.status } : {}),
      ...(req.query.buyerId ? { buyerId: req.query.buyerId } : {}),
      ...(req.query.q
        ? {
            OR: [
              { notes: { contains: String(req.query.q), mode: "insensitive" } }
            ]
          }
        : {})
    };

    const sortBy = ["createdAt", "totalAmount", "status"].includes(String(req.query.sortBy)) ? String(req.query.sortBy) : "createdAt";
    const sortDir = String(req.query.sortDir).toLowerCase() === "asc" ? "asc" : "desc";
    
    const rows = await prisma.order.findMany({
      where,
      select: {
        id: true,
        totalAmount: true,
        status: true,
        shippingAddress: true,
        notes: true,
        buyerId: true,
        buyer: {
          select: { id: true, fullName: true, email: true }
        },
        createdAt: true,
        updatedAt: true,
        orderItems: {
          select: {
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                company: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { [sortBy]: sortDir },
      take: limit,
      skip: offset
    });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

export async function createOrder(req, res, next) {
  try {
    requireFields(req.body, ["items"]);
    const { items, shippingAddress, notes, dealId } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order must contain at least one item" });
    }

    const scope = buildTenantScope(req);
    
    // Verify all products exist and are in stock
    const productIds = items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { 
        tenantId: req.user.tenantId,
        id: { in: productIds }, 
        deletedAt: null,
        inStock: true 
      }
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ message: "Some products are not available or out of stock" });
    }

    // Calculate total amount
    let totalAmount = 0;
    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const unitPrice = product.price;
      const quantity = item.quantity || 1;
      totalAmount += unitPrice * quantity;
      
      return {
        id: randomUUID(),
        productId: item.productId,
        quantity,
        unitPrice
      };
    });

    const id = randomUUID();
    
    await prisma.$transaction(async (tx) => {
      // Create order
      await tx.order.create({
        data: {
          id,
          tenantId: req.user.tenantId,
          buyerId: req.user.userId,
          totalAmount,
          status: "pending",
          shippingAddress: shippingAddress || null,
          notes: notes || null,
          dealId: dealId || null
        }
      });

      // Create order items
      await tx.orderItem.createMany({
        data: orderItems.map(item => ({
          ...item,
          orderId: id
        }))
      });

      // If a deal is linked, update it to 'won'
      if (dealId) {
        await tx.deal.updateMany({
          where: { id: dealId, tenantId: req.user.tenantId },
          data: { stage: "won" }
        });
      }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "order.create",
      entityType: "order",
      entityId: id,
      after: { items, totalAmount, shippingAddress, notes }
    });

    return res.status(201).json({ id, totalAmount });
  } catch (error) {
    return next(error);
  }
}

export async function updateOrder(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const existing = await prisma.order.findFirst({
      where: { ...scope, id: req.params.id }
    });
    if (!existing) {
      return res.status(404).json({ message: "Order not found" });
    }

    const allowedStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
    const newStatus = req.body.status;
    
    if (newStatus && !allowedStatuses.includes(newStatus)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status ?? existing.status,
        shippingAddress: req.body.shippingAddress ?? existing.shippingAddress,
        notes: req.body.notes ?? existing.notes
      }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "order.update",
      entityType: "order",
      entityId: req.params.id,
      before: existing,
      after: req.body
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

export async function getOrder(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const order = await prisma.order.findFirst({
      where: { ...scope, id: req.params.id },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        shippingAddress: true,
        notes: true,
        buyerId: true,
        buyer: {
          select: { id: true, fullName: true, email: true }
        },
        createdAt: true,
        updatedAt: true,
        orderItems: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
                company: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    return res.json(order);
  } catch (error) {
    return next(error);
  }
}

export async function getUserOrders(req, res, next) {
  try {
    const { limit, offset } = pickPagination(req.query);
    const where = {
      tenantId: req.user.tenantId,
      buyerId: req.user.userId,
      ...(req.query.status ? { status: req.query.status } : {})
    };

    const sortBy = ["createdAt", "totalAmount", "status"].includes(String(req.query.sortBy)) ? String(req.query.sortBy) : "createdAt";
    const sortDir = String(req.query.sortDir).toLowerCase() === "asc" ? "asc" : "desc";
    
    const rows = await prisma.order.findMany({
      where,
      select: {
        id: true,
        totalAmount: true,
        status: true,
        shippingAddress: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        orderItems: {
          select: {
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                company: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { [sortBy]: sortDir },
      take: limit,
      skip: offset
    });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}
