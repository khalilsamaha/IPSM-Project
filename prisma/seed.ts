import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.userProfile.upsert({
    where: { email: "admin@ipsm.local" },
    update: { role: Role.ADMIN, status: "ACTIVE" },
    create: {
      authId: "00000000-0000-0000-0000-000000000001",
      name: "System Administrator",
      email: "admin@ipsm.local",
      role: Role.ADMIN,
    },
  });

  const family = await prisma.family.upsert({
    where: { id: "10000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "10000000-0000-0000-0000-000000000001",
      name: "Rivera Family",
      email: "rivera@example.com",
      phone: "555-0100",
    },
  });

  const student = await prisma.student.upsert({
    where: { id: "20000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "20000000-0000-0000-0000-000000000001",
      familyId: family.id,
      firstName: "Mia",
      lastName: "Rivera",
    },
  });

  await prisma.enrollment.upsert({
    where: { id: "30000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "30000000-0000-0000-0000-000000000001",
      studentId: student.id,
      instrument: "Piano",
      instructorName: "IPSM Faculty",
      monthlyRateCents: 18000,
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: "INV-2026-0001" },
    update: {},
    create: {
      familyId: family.id,
      invoiceNumber: "INV-2026-0001",
      status: "SENT",
      totalCents: 18000,
      balanceCents: 9000,
    },
  });

  await prisma.expense.upsert({
    where: { id: "40000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "40000000-0000-0000-0000-000000000001",
      category: "Operations",
      description: "Phase 2 sample studio expense",
      amountCents: 2500,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
