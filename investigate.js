import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findFirst({
    where: { email: 'azzayabayartai07@gmail.com' }
  });
  console.log(user);
}

check().catch(console.error).finally(() => prisma.$disconnect());
