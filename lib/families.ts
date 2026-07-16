import type { Prisma, PrismaClient } from "@prisma/client";

type FamilyDelegate = Prisma.TransactionClient["family"] | PrismaClient["family"];
type RawClient = Pick<Prisma.TransactionClient, "$executeRawUnsafe"> | Pick<PrismaClient, "$executeRawUnsafe">;

export function formatFamilyLabel(family: { familyCode: string; name: string }) {
  return `${family.familyCode} — ${family.name}`;
}

export async function generateFamilyCode(family: FamilyDelegate, createdAt = new Date()) {
  const year = createdAt.getFullYear();
  const prefix = `FAM-${year}-`;
  const latest = await family.findFirst({
    where: { familyCode: { startsWith: prefix } },
    orderBy: { familyCode: "desc" },
    select: { familyCode: true },
  });
  const next = latest ? Number.parseInt(latest.familyCode.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(6, "0")}`;
}

export async function createFamilyWithCode(client: Prisma.TransactionClient | PrismaClient, data: Omit<Prisma.FamilyCreateInput, "familyCode">) {
  await (client as RawClient).$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('ipsm-family-code'))");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const familyCode = await generateFamilyCode(client.family);
    try {
      return await client.family.create({ data: { ...data, familyCode } });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("family_code")) throw error;
    }
  }
  throw new Error("Unable to generate a unique family code. Please try again.");
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
