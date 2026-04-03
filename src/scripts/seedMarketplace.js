import { randomUUID } from "crypto";
import { prisma } from "../config/prisma.js";

async function main() {
  const user = await prisma.user.findFirst({
    where: { deletedAt: null },
    select: { id: true, tenantId: true }
  });

  if (!user) {
    throw new Error("No user found. Please register/login first so a user exists in the database.");
  }

  const companiesToCreate = [
    {
      name: "Demo Vendor Co",
      industry: "Retail",
      website: "https://demo-vendor.example",
      description: "Demo vendor for marketplace testing",
      logo: null,
      isVendor: true
    },
    {
      name: "Demo Supply Ltd",
      industry: "Manufacturing",
      website: "https://demo-supply.example",
      description: "Second demo vendor",
      logo: null,
      isVendor: true
    }
  ];

  const createdCompanyIds = [];

  for (const c of companiesToCreate) {
    const existing = await prisma.company.findFirst({
      where: { tenantId: user.tenantId, name: c.name, deletedAt: null },
      select: { id: true }
    });

    if (existing) {
      createdCompanyIds.push(existing.id);
      continue;
    }

    const id = randomUUID();
    await prisma.company.create({
      data: {
        id,
        tenantId: user.tenantId,
        name: c.name,
        industry: c.industry,
        website: c.website,
        description: c.description,
        logo: c.logo,
        isVendor: c.isVendor,
        createdBy: user.id
      }
    });
    createdCompanyIds.push(id);
  }

  const [vendorAId, vendorBId] = createdCompanyIds;

  const productsToCreate = [
    {
      companyId: vendorAId,
      name: "Demo Product A",
      description: "Sample product A",
      price: "49.99",
      category: "Software",
      imageUrl: null,
      inStock: true
    },
    {
      companyId: vendorAId,
      name: "Demo Product B",
      description: "Sample product B",
      price: "129.00",
      category: "Hardware",
      imageUrl: null,
      inStock: true
    },
    {
      companyId: vendorBId,
      name: "Demo Product C",
      description: "Sample product C",
      price: "9.99",
      category: "Accessories",
      imageUrl: null,
      inStock: true
    }
  ];

  let createdProducts = 0;

  for (const p of productsToCreate) {
    const existing = await prisma.product.findFirst({
      where: {
        tenantId: user.tenantId,
        companyId: p.companyId,
        name: p.name,
        deletedAt: null
      },
      select: { id: true }
    });

    if (existing) continue;

    await prisma.product.create({
      data: {
        id: randomUUID(),
        tenantId: user.tenantId,
        companyId: p.companyId,
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category,
        imageUrl: p.imageUrl,
        inStock: p.inStock,
        createdBy: user.id
      }
    });
    createdProducts += 1;
  }

  console.log("Seed complete");
  console.log("Tenant:", user.tenantId);
  console.log("Created/Existing vendors:", createdCompanyIds);
  console.log("New products created:", createdProducts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
