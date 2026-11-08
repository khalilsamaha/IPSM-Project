import { randomUUID } from "node:crypto";
import { allocateBusinessIdentifier, inIdentifierTransaction, type IdentifierStore } from "@/lib/business-identifiers";
import type { Prisma, PrismaClient } from "@prisma/client";

export function formatFamilyLabel(family: { familyCode: string; name: string }) {
  return `${family.familyCode} — ${family.name}`;
}

export async function generateFamilyCode(client: IdentifierStore, ownerId: string, createdAt = new Date()) {
  return allocateBusinessIdentifier(client, "FAM", ownerId, createdAt);
}

export async function createFamilyWithCode(client: Prisma.TransactionClient | PrismaClient, data: Omit<Prisma.FamilyCreateInput, "familyCode">) {
  return inIdentifierTransaction(client, async tx => {
    const id = data.id ?? randomUUID();
    const familyCode = await generateFamilyCode(tx, id);
    return tx.family.create({ data: { ...data, id, familyCode } });
  });
}

export function familySearchWhere(q: string) {
  const contains = { contains: q, mode: "insensitive" as const };
  return {
    OR: [
      { familyCode: contains }, { name: contains }, { email: contains }, { phone: contains },
      { fatherFirstName: contains }, { fatherLastName: contains }, { fatherPhone: contains }, { fatherEmail: contains },
      { motherFirstName: contains }, { motherLastName: contains }, { motherPhone: contains }, { motherEmail: contains },
      { students: { some: { OR: [{ studentCode: contains }, { firstName: contains }, { lastName: contains }, { email: contains }, { phone: contains }] } } },
    ],
  };
}
