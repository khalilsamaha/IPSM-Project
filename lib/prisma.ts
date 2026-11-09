import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Reset and operational transactions must not commit decisions from mutually
    // inconsistent snapshots. Serialization failures are surfaced for retry.
    transactionOptions: { isolationLevel: "Serializable" },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
