import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";
import { requireFields } from "../utils/validators.js";
import { writeAuditLog } from "../services/auditService.js";
import { buildTenantScope } from "../utils/scope.js";

export async function listCompanies(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const where = {
      ...scope,
      deletedAt: null,
      ...(req.query.isVendor !== undefined ? { isVendor: req.query.isVendor === 'true' } : {}),
      ...(req.query.q
        ? {
            OR: [
              { name: { contains: String(req.query.q), mode: "insensitive" } },
              { industry: { contains: String(req.query.q), mode: "insensitive" } },
              { description: { contains: String(req.query.q), mode: "insensitive" } }
            ]
          }
        : {})
    };

    const sortBy = ["createdAt", "name", "industry"].includes(String(req.query.sortBy)) ? String(req.query.sortBy) : "createdAt";
    const sortDir = String(req.query.sortDir).toLowerCase() === "asc" ? "asc" : "desc";
    
    const rows = await prisma.company.findMany({
      where,
      select: { 
        id: true, 
        name: true, 
        industry: true, 
        website: true, 
        description: true,
        logo: true,
        isVendor: true,
        createdAt: true, 
        updatedAt: true,
        _count: {
          select: {
            products: {
              where: { deletedAt: null }
            }
          }
        }
      },
      orderBy: { [sortBy]: sortDir }
    });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

export async function createCompany(req, res, next) {
  try {
    requireFields(req.body, ["name"]);
    const id = randomUUID();
    await prisma.company.create({
      data: {
        id,
        tenantId: req.user.tenantId,
        name: req.body.name,
        industry: req.body.industry || null,
        website: req.body.website || null,
        description: req.body.description || null,
        logo: req.body.logo || null,
        isVendor: req.body.isVendor !== undefined ? req.body.isVendor : false,
        createdBy: req.user.userId
      }
    });
    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "company.create",
      entityType: "company",
      entityId: id,
      after: req.body
    });
    return res.status(201).json({ id });
  } catch (error) {
    return next(error);
  }
}

export async function updateCompany(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const existing = await prisma.company.findFirst({
      where: { ...scope, id: req.params.id, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ message: "Company not found" });

    await prisma.company.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name ?? existing.name,
        industry: req.body.industry ?? existing.industry,
        website: req.body.website ?? existing.website,
        description: req.body.description ?? existing.description,
        logo: req.body.logo ?? existing.logo,
        isVendor: req.body.isVendor ?? existing.isVendor
      }
    });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "company.update",
      entityType: "company",
      entityId: req.params.id,
      before: existing,
      after: req.body
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

export async function deleteCompany(req, res, next) {
  try {
    const scope = buildTenantScope(req);
    const existing = await prisma.company.findFirst({
      where: { ...scope, id: req.params.id, deletedAt: null }
    });
    if (!existing) return res.status(404).json({ message: "Company not found" });

    await prisma.company.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });

    await writeAuditLog({
      tenantId: req.user.tenantId,
      actorUserId: req.user.userId,
      action: "company.delete",
      entityType: "company",
      entityId: req.params.id,
      before: existing
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}
