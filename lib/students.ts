import { allocateBusinessIdentifier, type IdentifierStore } from "@/lib/business-identifiers";
import type { Prisma, PrismaClient } from "@prisma/client";

export type StudentCreateWithoutCode = Omit<Prisma.StudentCreateInput, "studentCode">;

export function formatStudentLabel(student: { studentCode: string; firstName: string; lastName: string }) {
  return `${student.studentCode} — ${student.firstName} ${student.lastName}`;
}

export async function generateStudentCode(client: IdentifierStore, createdAt = new Date()) {
  return allocateBusinessIdentifier(client, "STU", createdAt);
}

export async function createStudentWithCode(client: Prisma.TransactionClient | PrismaClient, data: StudentCreateWithoutCode) {
  const studentCode = await generateStudentCode(client);
  const createData: Prisma.StudentCreateInput = { ...data, studentCode };
  return client.student.create({ data: createData });
}
