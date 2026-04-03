import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  importProducts,
  getTemplateCsv
} from "../controllers/productController.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validators.js";
import multer from "multer";

const upload = multer({ dest: "uploads/" });

const router = Router();

router.get(
  "/",
  requirePermission("products:read"),
  validate([
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
    query("companyId").optional().isUUID(),
    query("category").optional().isString(),
    query("inStock").optional().isBoolean(),
    query("q").optional().isString(),
    query("sortBy").optional().isIn(["createdAt", "name", "price", "category"]),
    query("sortDir").optional().isIn(["asc", "desc"])
  ]),
  listProducts
);

router.post(
  "/",
  requirePermission("products:create"),
  validate([
    body("name").isString().trim().isLength({ min: 1, max: 180 }),
    body("price").isFloat({ min: 0 }),
    body("companyId").isUUID(),
    body("description").optional().isString(),
    body("category").optional().isString(),
    body("imageUrl").optional().isURL(),
    body("quantity").optional().isInt({ min: 0 }),
    body("inStock").optional().isBoolean()
  ]),
  createProduct
);

router.get(
  "/:id",
  requirePermission("products:read"),
  validate([param("id").isUUID()]),
  getProduct
);

router.put(
  "/:id",
  requirePermission("products:update"),
  validate([
    param("id").isUUID(),
    body("name").optional().isString().trim().isLength({ min: 1, max: 180 }),
    body("price").optional().isFloat({ min: 0 }),
    body("companyId").optional().isUUID(),
    body("description").optional().isString(),
    body("category").optional().isString(),
    body("imageUrl").optional().isURL(),
    body("quantity").optional().isInt({ min: 0 }),
    body("inStock").optional().isBoolean()
  ]),
  updateProduct
);

router.delete(
  "/:id",
  requirePermission("products:delete"),
  validate([param("id").isUUID()]),
  deleteProduct
);

router.post(
  "/import/csv",
  requirePermission("products:create"),
  upload.single("file"),
  validate([
    body("companyId").isUUID()
  ]),
  importProducts
);

router.get("/template/csv", requirePermission("products:create"), getTemplateCsv);

export default router;
