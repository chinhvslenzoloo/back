import { prisma } from "../config/prisma.js";

const c = await prisma.user.count();
console.log("user_count", c);
await prisma.$disconnect();

