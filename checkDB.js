import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany();
  console.log("Users:");
  console.log(users.map(u => ({ id: u.id, email: u.email, tenantId: u.tenantId })));
}
main().finally(() => prisma.$disconnect());
