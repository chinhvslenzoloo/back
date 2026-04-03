import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  for (const tenant of tenants) {
    const adminUser = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    if (!adminUser) continue;
    
    // Check if they already have the dummy product
    const existingP = await prisma.product.findFirst({ where: { tenantId: tenant.id, name: 'MacBook Pro M3 Max' } });
    if (existingP) continue;

    const cId = uuidv4();
    const company = await prisma.company.create({
      data: {
        id: cId,
        tenantId: tenant.id,
        name: 'TechStore (Demo)',
        createdBy: adminUser.id,
        isVendor: true
      }
    });

    const pId = uuidv4();
    await prisma.product.create({
      data: {
        id: pId,
        tenantId: tenant.id,
        companyId: cId,
        name: 'MacBook Pro M3 Max',
        description: 'The most powerful MacBook Pro ever created. Features the M3 Max chip, 36GB RAM, and 1TB SSD.',
        price: 3499.00,
        category: 'Laptops',
        imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
        createdBy: adminUser.id,
        inStock: true
      }
    });
    console.log(`Created dummy product for tenant ${tenant.id} (attached to user ${adminUser.email})`);
  }
}
main().finally(() => prisma.$disconnect());
