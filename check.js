import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { email: true, tenantId: true } });
  
  for (const u of users) {
    const productsCount = await prisma.product.count({ where: { tenantId: u.tenantId } });
    const compCount = await prisma.company.count({ where: { tenantId: u.tenantId } });
    console.log(`User: ${u.email} (Tenant: ${u.tenantId}) -> Products: ${productsCount}, Companies: ${compCount}`);
  }
}

main().finally(() => prisma.$disconnect());
