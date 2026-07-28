import type { Prisma, PrismaClient } from "@prisma/client";

type StudentDelegate = Prisma.TransactionClient["student"] | PrismaClient["student"];
export type StudentCreateWithoutCode = Omit<Prisma.StudentCreateInput, "studentCode">;

export function formatStudentLabel(student: { studentCode: string; firstName: string; lastName: string }) {
  return `${student.studentCode} — ${student.firstName} ${student.lastName}`;
}

export async function generateStudentCode(student: StudentDelegate, createdAt = new Date()) {
  const year = createdAt.getFullYear();
  const prefix = `STU-${year}-`;
  const latest = await student.findFirst({
    where: { studentCode: { startsWith: prefix } },
    orderBy: { studentCode: "desc" },
    select: { studentCode: true },
  });
  const next = latest ? Number.parseInt(latest.studentCode.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(6, "0")}`;
}

export async function createStudentWithCode(student: StudentDelegate, data: StudentCreateWithoutCode) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const studentCode = await generateStudentCode(student);
    try {
      const createData: Prisma.StudentCreateInput = { ...data, studentCode };
      return await student.create({ data: createData });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("student_code")) throw error;
    }
  }
  throw new Error("Unable to generate a unique student ID. Please try again.");
}
