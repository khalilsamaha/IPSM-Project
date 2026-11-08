import { randomUUID } from "node:crypto";
import { allocateBusinessIdentifier, inIdentifierTransaction, type IdentifierStore } from "@/lib/business-identifiers";
import type { Prisma, PrismaClient } from "@prisma/client";

export type StudentCreateWithoutCode = Omit<Prisma.StudentCreateInput, "studentCode">;

export function formatStudentLabel(student: { studentCode: string; firstName: string; lastName: string }) {
  return `${student.studentCode} — ${student.firstName} ${student.lastName}`;
}

export async function generateStudentCode(client: IdentifierStore, ownerId: string, createdAt = new Date()) {
  return allocateBusinessIdentifier(client, "STU", ownerId, createdAt);
}

export async function createStudentWithCode(client: Prisma.TransactionClient | PrismaClient, data: StudentCreateWithoutCode) {
  return inIdentifierTransaction(client, async tx => {
    const id = data.id ?? randomUUID();
    const studentCode = await generateStudentCode(tx, id);
    const createData: Prisma.StudentCreateInput = { ...data, id, studentCode };
    return tx.student.create({ data: createData });
  });
}
