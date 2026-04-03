import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  const users = await prisma.user.updateMany({
    where: { role: 'sales' },
    data: { role: 'user' }
  });
  console.log(`Updated ${users.count} users from sales to user.`);
  // Note: if admin@marketplace.com was sales, it's now user. Wait, admin@marketplace.com should be admin!
  const adminFix = await prisma.user.updateMany({
    where: { email: 'admin@marketplace.com' },
    data: { role: 'admin' }
  });
  console.log(`Ensured admin@marketplace.com is admin: ${adminFix.count}`);
}

fix().catch(console.error).finally(() => prisma.$disconnect());
