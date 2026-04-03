import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  listOrders,
  createOrder,
  updateOrder,
  getOrder,
  getUserOrders
} from "../controllers/orderController.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validators.js";

const router = Router();

// Admin/owner routes
router.get(
  "/",
  requirePermission("orders:read"),
  validate([
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
    query("status").optional().isIn(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
    query("buyerId").optional().isUUID(),
    query("q").optional().isString(),
    query("sortBy").optional().isIn(["createdAt", "totalAmount", "status"]),
    query("sortDir").optional().isIn(["asc", "desc"])
  ]),
  listOrders
);

// User's own orders
router.get(
  "/my-orders",
  requirePermission("orders:read"),
  validate([
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
    query("status").optional().isIn(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
    query("sortBy").optional().isIn(["createdAt", "totalAmount", "status"]),
    query("sortDir").optional().isIn(["asc", "desc"])
  ]),
  getUserOrders
);

router.post(
  "/",
  requirePermission("orders:create"),
  validate([
    body("items").isArray({ min: 1 }),
    body("items.*.productId").isUUID(),
    body("items.*.quantity").optional().isInt({ min: 1 }),
    body("shippingAddress").optional().isObject(),
    body("notes").optional().isString()
  ]),
  createOrder
);

router.get(
  "/:id",
  requirePermission("orders:read"),
  validate([param("id").isUUID()]),
  getOrder
);

router.put(
  "/:id",
  requirePermission("orders:update"),
  validate([
    param("id").isUUID(),
    body("status").optional().isIn(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
    body("shippingAddress").optional().isObject(),
    body("notes").optional().isString()
  ]),
  updateOrder
);

export default router;
