import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const families = [
  [
    "10000000-0000-0000-0000-000000000001",
    "Rivera Family",
    "rivera@example.com",
    "555-0100",
  ],
  [
    "10000000-0000-0000-0000-000000000002",
    "Chen Family",
    "chen@example.com",
    "555-0101",
  ],
  [
    "10000000-0000-0000-0000-000000000003",
    "Patel Family",
    "patel@example.com",
    "555-0102",
  ],
  [
    "10000000-0000-0000-0000-000000000004",
    "Johnson Family",
    "johnson@example.com",
    "555-0103",
  ],
  [
    "10000000-0000-0000-0000-000000000005",
    "Garcia Family",
    "garcia@example.com",
    "555-0104",
  ],
] as const;

const students = [
  [
    "20000000-0000-0000-0000-000000000001",
    families[0][0],
    "Mia",
    "Rivera",
    "2014-03-12",
  ],
  [
    "20000000-0000-0000-0000-000000000002",
    families[0][0],
    "Leo",
    "Rivera",
    "2016-08-22",
  ],
  [
    "20000000-0000-0000-0000-000000000003",
    families[1][0],
    "Ava",
    "Chen",
    "2013-11-05",
  ],
  [
    "20000000-0000-0000-0000-000000000004",
    families[1][0],
    "Ethan",
    "Chen",
    "2015-01-18",
  ],
  [
    "20000000-0000-0000-0000-000000000005",
    families[2][0],
    "Nina",
    "Patel",
    "2012-06-09",
  ],
  [
    "20000000-0000-0000-0000-000000000006",
    families[2][0],
    "Arjun",
    "Patel",
    "2017-02-14",
  ],
  [
    "20000000-0000-0000-0000-000000000007",
    families[3][0],
    "Sophie",
    "Johnson",
    "2011-09-30",
  ],
  [
    "20000000-0000-0000-0000-000000000008",
    families[3][0],
    "Miles",
    "Johnson",
    "2015-12-03",
  ],
  [
    "20000000-0000-0000-0000-000000000009",
    families[4][0],
    "Isabella",
    "Garcia",
    "2014-04-27",
  ],
  [
    "20000000-0000-0000-0000-000000000010",
    families[4][0],
    "Mateo",
    "Garcia",
    "2016-10-16",
  ],
] as const;

const season = {
  id: "70000000-0000-0000-0000-000000000002",
  name: "Summer 2026",
  startDate: new Date("2026-06-08"),
  endDate: new Date("2026-08-28"),
  status: "ACTIVE",
} as const;

const teachers = [
  [
    "80000000-0000-0000-0000-000000000001",
    "Grace Kim",
    "grace.kim@example.com",
    "555-0200",
    6500,
  ],
  [
    "80000000-0000-0000-0000-000000000002",
    "Daniel Brooks",
    "daniel.brooks@example.com",
    "555-0201",
    7000,
  ],
  [
    "80000000-0000-0000-0000-000000000003",
    "Elena Martinez",
    "elena.martinez@example.com",
    "555-0202",
    6800,
  ],
] as const;

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

  for (const [id, name, email, phone] of families) {
    await prisma.family.upsert({
      where: { id },
      update: { name, email, phone, status: "ACTIVE" },
      create: { id, name, email, phone },
    });
  }

  for (const [id, familyId, firstName, lastName, dateOfBirth] of students) {
    await prisma.student.upsert({
      where: { id },
      update: {
        familyId,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        status: "ACTIVE",
      },
      create: {
        id,
        familyId,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
      },
    });
  }

  await prisma.season.upsert({
    where: { id: season.id },
    update: season,
    create: season,
  });

  for (const [id, fullName, email, phone, hourlyRateCents] of teachers) {
    await prisma.teacher.upsert({
      where: { id },
      update: { fullName, email, phone, hourlyRateCents, status: "ACTIVE" },
      create: { id, fullName, email, phone, hourlyRateCents },
    });
  }

  const enrollmentSeeds = students.map(([studentId], index) => ({
    id: `30000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    studentId,
    seasonId: season.id,
    teacherId: teachers[index % teachers.length][0],
    courseName: ["Piano", "Guitar", "Violin", "Voice", "Drums"][index % 5],
    feeCents: index % 3 === 0 ? 60000 : 45000,
    discountCents: 0,
    finalFeeCents: index % 3 === 0 ? 60000 : 45000,
    paidCents: 0,
    remainingCents: index % 3 === 0 ? 60000 : 45000,
  }));

  enrollmentSeeds.push({
    id: "30000000-0000-0000-0000-000000000011",
    studentId: students[0][0],
    seasonId: season.id,
    teacherId: teachers[1][0],
    courseName: "Advanced Piano",
    feeCents: 60000,
    discountCents: 0,
    finalFeeCents: 60000,
    paidCents: 0,
    remainingCents: 60000,
  });

  for (const enrollment of enrollmentSeeds) {
    await prisma.enrollment.upsert({
      where: { id: enrollment.id },
      update: enrollment,
      create: enrollment,
    });
  }

  const payments = [
    ["60000000-0000-0000-0000-000000000001", families[0][0], 20000, "card", "2026-06-03", "RCPT-2026-000001"],
    ["60000000-0000-0000-0000-000000000002", families[0][0], 10000, "cash", "2026-06-15", "RCPT-2026-000002"],
    ["60000000-0000-0000-0000-000000000003", families[1][0], 36000, "ach", "2026-06-04", "RCPT-2026-000003"],
    ["60000000-0000-0000-0000-000000000004", families[3][0], 15000, "card", "2026-06-05", "RCPT-2026-000004"],
    ["60000000-0000-0000-0000-000000000005", families[3][0], 15000, "card", "2026-06-20", "RCPT-2026-000005"],
    ["60000000-0000-0000-0000-000000000006", families[4][0], 36000, "check", "2026-06-02", "RCPT-2026-000006"],
  ] as const;

  for (const [id, familyId, totalAmountCents, paymentMethod, paymentDate, receiptNumber] of payments) {
    await prisma.payment.upsert({
      where: { id },
      update: {
        familyId,
        totalAmountCents,
        paymentMethod,
        paymentDate: new Date(paymentDate),
        receiptNumber,
      },
      create: {
        id,
        familyId,
        totalAmountCents,
        paymentMethod,
        paymentDate: new Date(paymentDate),
        receiptNumber,
      },
    });
  }

  const paymentItems = [
    ["50000000-0000-0000-0000-000000000001", payments[0][0], "30000000-0000-0000-0000-000000000001", 20000],
    ["50000000-0000-0000-0000-000000000002", payments[1][0], "30000000-0000-0000-0000-000000000002", 10000],
    ["50000000-0000-0000-0000-000000000003", payments[2][0], "30000000-0000-0000-0000-000000000003", 36000],
    ["50000000-0000-0000-0000-000000000004", payments[3][0], "30000000-0000-0000-0000-000000000007", 15000],
    ["50000000-0000-0000-0000-000000000005", payments[4][0], "30000000-0000-0000-0000-000000000008", 15000],
    ["50000000-0000-0000-0000-000000000006", payments[5][0], "30000000-0000-0000-0000-000000000009", 36000],
  ] as const;

  for (const [id, paymentId, enrollmentId, amountCents] of paymentItems) {
    await prisma.paymentItem.upsert({
      where: { id },
      update: { paymentId, enrollmentId, amountCents },
      create: { id, paymentId, enrollmentId, amountCents },
    });
  }

  for (const [id, , , , , receiptNumber] of payments) {
    await prisma.receipt.upsert({
      where: { paymentId: id },
      update: { receiptNumber, pdfPath: `/api/receipts/${id}` },
      create: { paymentId: id, receiptNumber, pdfPath: `/api/receipts/${id}` },
    });
  }

  for (const enrollment of enrollmentSeeds) {
    const items = paymentItems.filter(([, , enrollmentId]) => enrollmentId === enrollment.id);
    const paidCents = items.reduce((sum, [, , , amountCents]) => sum + amountCents, 0);
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { paidCents, remainingCents: enrollment.finalFeeCents - paidCents },
    });
  }

  const expenses = [
    [
      "40000000-0000-0000-0000-000000000001",
      "Operations",
      "Studio supplies",
      2500,
      "2026-06-01",
    ],
    [
      "40000000-0000-0000-0000-000000000002",
      "Rent",
      "June studio rent",
      220000,
      "2026-06-01",
    ],
    [
      "40000000-0000-0000-0000-000000000003",
      "Payroll",
      "Guest accompanist",
      7500,
      "2026-06-12",
    ],
    [
      "40000000-0000-0000-0000-000000000004",
      "Marketing",
      "Summer recital flyers",
      1800,
      "2026-06-18",
    ],
  ] as const;

  for (const [id, category, description, amountCents, expenseDate] of expenses) {
    await prisma.expense.upsert({
      where: { id },
      update: {
        category,
        description,
        amountCents,
        incurredAt: new Date(expenseDate),
        expenseDate: new Date(expenseDate),
        paymentMethod: "cash",
      },
      create: {
        id,
        category,
        description,
        amountCents,
        incurredAt: new Date(expenseDate),
        expenseDate: new Date(expenseDate),
        paymentMethod: "cash",
      },
    });
  }
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
