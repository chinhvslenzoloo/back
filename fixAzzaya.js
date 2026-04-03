import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  await prisma.user.updateMany({
    where: { email: 'azzayabayartai07@gmail.com' },
    data: { role: 'staff' }
  });
  console.log('Updated azzayabayartai07@gmail.com to staff');
}

fix().catch(console.error).finally(() => prisma.$disconnect());
