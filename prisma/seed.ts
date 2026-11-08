import { Role } from "@prisma/client";
import { ensurePaymentReceipt } from "../lib/payments/receipt-repair";
import { allocateBusinessIdentifier } from "../lib/business-identifiers";
import { prisma as seedClient } from "../lib/prisma";

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


const courseNames = ["Piano", "Guitar", "Saxophone", "Violin", "Dance", "Chess", "Solfège", "Music Theory", "Voice", "Drums"] as const;
const levelNames = ["Beginner", "Level 1", "Level 2", "Advanced"] as const;

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
  // Certification is never created by seeding. All identifiers and rows commit together.
  await seedClient.$transaction(async prisma => {
  await prisma.userProfile.upsert({
    where: { email: "admin@ipsm.local" },
    update: { role: Role.SUPER_ADMIN, status: "ACTIVE" },
    create: {
      authId: "00000000-0000-0000-0000-000000000001",
      name: "System Administrator",
      email: "admin@ipsm.local",
      role: Role.SUPER_ADMIN,
    },
  });

  // Known rows are updated explicitly: INSERT/UPSERT must not become a restoration bypass.
  for (const [id, name, email, phone] of families) {
    const existing = await prisma.family.findUnique({where:{id}});
    const data = {name,email,phone};
    if (existing) await prisma.family.update({where:{id},data:{...data,status:"ACTIVE"}});
    else await prisma.family.create({data:{...data,id,familyCode:await allocateBusinessIdentifier(prisma,"FAM",id)}});
  }
  for (const [id, familyId, firstName, lastName, dateOfBirth] of students) {
    const existing = await prisma.student.findUnique({where:{id}});
    const data = {familyId,firstName,lastName,dateOfBirth:new Date(dateOfBirth)};
    if (existing) await prisma.student.update({where:{id},data:{...data,status:"ACTIVE"}});
    else await prisma.student.create({data:{...data,id,studentCode:await allocateBusinessIdentifier(prisma,"STU",id)}});
  }

  await prisma.season.upsert({
    where: { id: season.id },
    update: season,
    create: season,
  });

  for (const [index, name] of courseNames.entries()) {
    await prisma.course.upsert({
      where: { name },
      update: { status: "ACTIVE" },
      create: { id: `a1000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`, name },
    });
  }

  for (const [index, name] of levelNames.entries()) {
    await prisma.courseLevel.upsert({
      where: { name },
      update: { order: index + 1, status: "ACTIVE" },
      create: { id: `a2000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`, name, order: index + 1 },
    });
  }

  const seededCourses = await prisma.course.findMany({ where: { name: { in: [...courseNames] } } });
  const seededLevels = await prisma.courseLevel.findMany({ where: { name: { in: [...levelNames] } } });
  for (const course of seededCourses) {
    for (const level of seededLevels) {
      await prisma.coursePricing.upsert({
        where: { courseId_levelId_seasonId: { courseId: course.id, levelId: level.id, seasonId: season.id } },
        update: { priceCents: level.order >= 4 ? 60000 : 45000, status: "ACTIVE" },
        create: { courseId: course.id, levelId: level.id, seasonId: season.id, priceCents: level.order >= 4 ? 60000 : 45000 },
      });
    }
  }


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
    enrollmentStartDate: season.startDate,
    enrollmentEndDate: season.endDate,
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
    enrollmentStartDate: season.startDate,
    enrollmentEndDate: season.endDate,
  });

  for (const enrollment of enrollmentSeeds) {
    // Synthetic seed data must satisfy the preserved production teacher guards.
    const course = seededCourses.find(row => row.name === (enrollment.courseName === "Advanced Piano" ? "Piano" : enrollment.courseName))!;
    const level = seededLevels.find(row => row.name === (enrollment.feeCents === 60000 ? "Advanced" : "Beginner"))!;
    if (!await prisma.teacherCourse.findFirst({where:{teacherId:enrollment.teacherId,courseId:course.id,levelId:null}})) {
      await prisma.teacherCourse.create({data:{teacherId:enrollment.teacherId,courseId:course.id}});
    }
    for (let dayOfWeek=0;dayOfWeek<7;dayOfWeek++) {
      if (!await prisma.teacherAvailability.findFirst({where:{teacherId:enrollment.teacherId,seasonId:season.id,dayOfWeek,courseId:null}})) {
        await prisma.teacherAvailability.create({data:{teacherId:enrollment.teacherId,seasonId:season.id,dayOfWeek,startTime:"09:00",endTime:"18:00",effectiveFrom:season.startDate,effectiveTo:season.endDate}});
      }
    }
    const data = {...enrollment,courseId:course.id,levelId:level.id};
    await prisma.enrollment.upsert({where:{id:enrollment.id},update:data,create:data});
  }


  const scheduleSessions = enrollmentSeeds.slice(0, 6).map((enrollment, index) => ({
    id: `90000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    studentId: enrollment.studentId,
    teacherId: enrollment.teacherId ?? teachers[0][0],
    enrollmentId: enrollment.id,
    seasonId: season.id,
    title: `${enrollment.courseName} lesson`,
    sessionDate: new Date(`2026-06-${String(15 + index).padStart(2, "0")}`),
    startTime: `${String(10 + (index % 4)).padStart(2, "0")}:00`,
    endTime: `${String(11 + (index % 4)).padStart(2, "0")}:00`,
    status: "SCHEDULED" as const,
    notes: "Seeded sample scheduled session",
  }));

  for (const scheduleSession of scheduleSessions) {
    await prisma.scheduleSession.upsert({
      where: { id: scheduleSession.id },
      update: scheduleSession,
      create: scheduleSession,
    });
  }

  const payments = [
    ["60000000-0000-0000-0000-000000000001", families[0][0], 20000, "card", "2026-06-03"],
    ["60000000-0000-0000-0000-000000000002", families[0][0], 10000, "cash", "2026-06-15"],
    ["60000000-0000-0000-0000-000000000003", families[1][0], 36000, "ach", "2026-06-04"],
    ["60000000-0000-0000-0000-000000000004", families[3][0], 15000, "card", "2026-06-05"],
    ["60000000-0000-0000-0000-000000000005", families[3][0], 15000, "card", "2026-06-20"],
    ["60000000-0000-0000-0000-000000000006", families[4][0], 36000, "check", "2026-06-02"],
  ] as const;

  for (const [id, familyId, totalAmountCents, paymentMethod, paymentDate] of payments) {
    const existing = await prisma.payment.findUnique({where:{id}});
    const receiptNumber = existing?.receiptNumber ?? await allocateBusinessIdentifier(prisma,"RCPT",id);
    const data = {familyId,totalAmountCents,paymentMethod,paymentDate:new Date(paymentDate),receiptNumber};
    if (existing) await prisma.payment.update({where:{id},data});
    else await prisma.payment.create({data:{...data,id}});
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

  for (const [id] of payments) {
    await ensurePaymentReceipt(prisma, id);
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
  }, {timeout:60000});
}

main()
  .finally(async () => {
    await seedClient.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await seedClient.$disconnect();
    process.exit(1);
  });
