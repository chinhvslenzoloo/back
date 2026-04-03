import { prisma } from "../config/prisma.js";

export async function getDashboardSummary(tenantId) {
  const won = await prisma.deal.aggregate({
    where: { tenantId, stage: "won", deletedAt: null },
    _sum: { amount: true }
  });
  const closedTotal = await prisma.deal.count({
    where: { tenantId, deletedAt: null, stage: { in: ["won", "lost"] } }
  });
  const wonTotal = await prisma.deal.count({
    where: { tenantId, deletedAt: null, stage: "won" }
  });
  const deadlines = await prisma.deal.findMany({
    where: { tenantId, deletedAt: null, deadline: { not: null, gte: new Date() } },
    select: { id: true, title: true, deadline: true, amount: true, stage: true },
    orderBy: { deadline: "asc" },
    take: 10
  });

  const conversionRate =
    Number(closedTotal || 0) > 0
      ? Number(wonTotal) / Number(closedTotal)
      : 0;

  return {
    wonAmount: Number(won._sum.amount || 0),
    conversionRate,
    upcomingDeadlines: deadlines
  };
}
