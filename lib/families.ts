import { allocateBusinessIdentifier, type IdentifierStore } from "@/lib/business-identifiers";
import type { Prisma, PrismaClient } from "@prisma/client";

export function formatFamilyLabel(family: { familyCode: string; name: string }) {
  return `${family.familyCode} — ${family.name}`;
}

export async function generateFamilyCode(client: IdentifierStore, createdAt = new Date()) {
  return allocateBusinessIdentifier(client, "FAM", createdAt);
}

export async function createFamilyWithCode(client: Prisma.TransactionClient | PrismaClient, data: Omit<Prisma.FamilyCreateInput, "familyCode">) {
  const familyCode = await generateFamilyCode(client);
  return client.family.create({ data: { ...data, familyCode } });
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
