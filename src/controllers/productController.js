import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { writeAuditLog } from "../services/auditService.js";
import { pickPagination } from "../utils/helpers.js";
import fs from "fs";
import { parseFile } from "@fast-csv/parse";
import { requireFields } from "../utils/validators.js";
import { buildTenantScope, buildProductScope } from "../utils/scope.js";

export async function listProducts(req, res, next) {
  try {
    const { limit, offset } = pickPagination(req.query);
    const scope = buildProductScope(req);
    const where = {
      ...scope,
      deletedAt: null,
      ...(req.query.companyId ? { companyId: req.query.companyId } : {}),
      ...(req.query.category ? { category: req.query.category } : {}),
      ...(req.query.inStock !== undefined ? { inStock: req.query.inStock === 'true' } : {}),
      ...(req.query.q
        ? {
            OR: [
              { name: { contains: String(req.query.q), mode: "insensitive" } },
              { description: { contains: String(req.query.q), mode: "insensitive" } },
              { category: { contains: String(req.query.q), mode: "insensitive" } }
            ]
          }
        : {})
    };

    const sortBy = ["createdAt", "name", "price", "category"].includes(String(req.query.sortBy)) ? String(req.query.sortBy) : "createdAt";
    const sortDir = String(req.query.sortDir).toLowerCase() === "asc" ? "asc" : "desc";
    
    const rows = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: true,
        imageUrl: true,
        quantity: true,
        inStock: true,
        companyId: true,
        createdBy: true,
        company: {
          select: { id: true, name: true, createdBy: true, website: true }
        },
        creator: {
          select: { fullName: true, email: true }
        },
        createdAt: true,
        updatedAt: true
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

export async function createProduct(req, res, next) {
  try {
    requireFields(req.body, ["name", "price", "companyId"]);
    const id = randomUUID();
    await prisma.product.create({
      data: {
        id,
        tenantId: req.user.tenantId,
        companyId: req.body.companyId,
        name: req.body.name,
        description: req.body.description || null,
        price: req.body.price,
        category: req.body.category || null,
        imageUrl: req.body.imageUrl || null,
        quantity: req.body.quantity !== undefined ? req.body.quantity : 10,
        inStock: req.body.quantity !== undefined ? req.body.quantity > 0 : (req.body.inStock !== undefined ? req.body.inStock : true),
        createdBy: req.user.userId
      }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "product.create",
      entityType: "product",
      entityId: id,
      after: req.body
    });

    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const existing = await prisma.product.findFirst({
      where: { ...scope, id: req.params.id, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ message: "Product not found" });
    }

    await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name ?? existing.name,
        description: req.body.description ?? existing.description,
        price: req.body.price ?? existing.price,
        category: req.body.category ?? existing.category,
        imageUrl: req.body.imageUrl ?? existing.imageUrl,
        quantity: req.body.quantity !== undefined ? req.body.quantity : existing.quantity,
        inStock: req.body.quantity !== undefined ? req.body.quantity > 0 : (req.body.inStock ?? existing.inStock),
        companyId: req.body.companyId ?? existing.companyId
      }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "product.update",
      entityType: "product",
      entityId: req.params.id,
      before: existing,
      after: req.body
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const existing = await prisma.product.findFirst({
      where: { ...scope, id: req.params.id, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ message: "Product not found" });
    }

    await prisma.product.update({ 
      where: { id: req.params.id }, 
      data: { deletedAt: new Date() } 
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "product.delete",
      entityType: "product",
      entityId: req.params.id,
      before: existing
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

export async function getProduct(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const product = await prisma.product.findFirst({
      where: { ...scope, id: req.params.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: true,
        imageUrl: true,
        quantity: true,
        inStock: true,
        companyId: true,
        createdBy: true,
        company: {
          select: { id: true, name: true, description: true, logo: true, createdBy: true }
        },
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    return res.json(product);
  } catch (error) {
    return next(error);
  }
}

export async function importProducts(req, res, next) {
  try {
    const { companyId } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: "No CSV file provided" });
    }

    const tenantId = req.user.tenantId;

    // Verify company belongs to tenant
    const company = await prisma.company.findFirst({
      where: { id: companyId, tenantId, deletedAt: null }
    });
    if (!company) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Company not found" });
    }

    const rows = [];
    let processedCount = 0;
    
    // Process stream
    parseFile(req.file.path, { headers: true, trim: true })
      .on("error", (error) => {
        fs.unlinkSync(req.file.path);
        next(error);
      })
      .on("data", (row) => {
        // Validate minimum required fields
        if (row.name && row.price) {
          rows.push({
            id: randomUUID(),
            tenantId,
            companyId,
            name: row.name,
            description: row.description || null,
            price: parseFloat(row.price) || 0,
            category: row.category || null,
            imageUrl: row.imageUrl || null,
            quantity: row.quantity ? parseInt(row.quantity, 10) : 10,
            inStock: row.quantity ? parseInt(row.quantity, 10) > 0 : (row.inStock ? String(row.inStock).toLowerCase() === "true" : true),
            createdBy: req.user.userId
          });
        }
      })
      .on("end", async (rowCount) => {
        fs.unlinkSync(req.file.path);

        try {
          // Batch insert in chunks of 500 to prevent packet too large errors
          const BATCH_SIZE = 500;
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const chunk = rows.slice(i, i + BATCH_SIZE);
            await prisma.product.createMany({ data: chunk });
            processedCount += chunk.length;
          }

          if (processedCount > 0) {
            await writeAuditLog({
              tenantId,
              actorUserId: req.user.userId,
              action: "product.import",
              entityType: "product",
              entityId: companyId,
              after: { importedCount: processedCount }
            });
          }

          return res.json({ message: "Import successful", count: processedCount, totalRowsParsed: rowCount });
        } catch (dbError) {
          next(dbError);
        }
      });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    return next(error);
  }
}

export function getTemplateCsv(req, res) {
  const csvFormat = "name,price,category,description,inStock,imageUrl\n" +
                    "\"Premium Laptop\",1299.99,\"Electronics\",\"High end laptop\",true,\"https://example.com/img.png\"\n" +
                    "\"Wireless Mouse\",29.50,\"Electronics\",\"Ergonomic mouse\",true,\"\"\n";
  
  res.header("Content-Type", "text/csv");
  res.attachment("product_import_template.csv");
  return res.send(csvFormat);
}
