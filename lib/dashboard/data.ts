import { PrismaClient } from "@prisma/client";
import { calculateDashboardMetrics } from "./metrics";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function getDashboardMetrics() {
  const [students, families, invoices, expenses] = await Promise.all([
    prisma.student.findMany({ select: { status: true } }),
    prisma.family.findMany({ select: { status: true } }),
    prisma.invoice.findMany({ select: { status: true, totalCents: true, balanceCents: true, issuedAt: true } }),
    prisma.expense.findMany({ select: { amountCents: true, incurredAt: true } }),
  ]);

  return calculateDashboardMetrics({ students, families, invoices, expenses });
}
