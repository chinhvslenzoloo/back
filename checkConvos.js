import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, tenantId: true, role: true } });
  console.log("=== USERS ===");
  for (const u of users) {
    console.log(`EMAIL: ${u.email}`);
    console.log(`  role: ${u.role}`);
    console.log(`  tenantId: ${u.tenantId}`);
    console.log(`  id: ${u.id}`);
    console.log("---");
  }

  console.log("\n=== CONVERSATIONS ===");
  const convos = await prisma.conversation.findMany({
    select: { id: true, userAId: true, userBId: true, dealId: true, tenantId: true }
  });
  for (const c of convos) {
    const userA = users.find(u => u.id === c.userAId);
    const userB = users.find(u => u.id === c.userBId);
    console.log(`CONV: ${c.id}`);
    console.log(`  UserA: ${userA?.email || 'UNKNOWN ' + c.userAId}`);
    console.log(`  UserB: ${userB?.email || 'UNKNOWN ' + c.userBId}`);
    console.log(`  Deal: ${c.dealId || 'none'}`);
    console.log(`  Tenant: ${c.tenantId}`);
    console.log("---");
  }
}
main().finally(() => prisma.$disconnect());
