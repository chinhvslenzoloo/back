export function buildTenantScope(req) {
  const base = { tenantId: req.user.tenantId };
  if (req.user.role === "sales") {
    return { ...base, createdBy: req.user.userId };
  }
  return base;
}

// For marketplace/products: all users see ALL products globally (Marketplace)
export function buildProductScope(req) {
  return {}; // No tenant restriction for marketplace products
}
