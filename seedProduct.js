import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  // Check if there is already a product in the DB to avoid duplicates
  const existingProduct = await prisma.product.findFirst();
  if (existingProduct) {
    console.log('Product already exists:', existingProduct);
    return;
  }

  const tId = uuidv4();
  const tenant = await prisma.tenant.create({
    data: {
      id: tId,
      name: 'Default Tenant',
    }
  });

  const uId = uuidv4();
  const user = await prisma.user.create({
    data: {
      id: uId,
      tenantId: tId,
      fullName: 'System Admin',
      email: 'admin@marketplace.com',
      passwordHash: 'dummyhash123',
    }
  });

  const cId = uuidv4();
  const company = await prisma.company.create({
    data: {
      id: cId,
      tenantId: tId,
      name: 'TechStore',
      createdBy: uId,
      isVendor: true
    }
  });

  const pId = uuidv4();
  const product = await prisma.product.create({
    data: {
      id: pId,
      tenantId: tId,
      companyId: cId,
      name: 'MacBook Pro M3 Max',
      description: 'The most powerful MacBook Pro ever created. Features the M3 Max chip, 36GB RAM, and 1TB SSD.',
      price: 3499.00,
      category: 'Laptops',
      imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8',
      createdBy: uId
    }
  });

  console.log('Successfully created a new dummy product!');
  console.log('Product Details:', product);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
