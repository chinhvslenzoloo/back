import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const newPassword = 'Admin1234!';
  const hash = await bcrypt.hash(newPassword, 10);

  const updated = await prisma.user.update({
    where: { email: 'admin@marketplace.com' },
    data: { passwordHash: hash, role: 'admin' }
  });

  console.log(`Password reset successful!`);
  console.log(`Email: admin@marketplace.com`);
  console.log(`Password: ${newPassword}`);
  console.log(`Role updated to: admin`);
}
main().finally(() => prisma.$disconnect());
