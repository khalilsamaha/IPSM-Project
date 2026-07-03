import Link from "next/link";
import { AppShell, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { RegisterStudentWorkflowForm } from "./register-student-workflow-form";

export default async function RegisterStudentPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; enrollmentId?: string; paymentId?: string; sessionId?: string; students?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  const [students, families, seasons, teachers] = await Promise.all([
    prisma.student.findMany({ where: { status: "ACTIVE" }, include: { family: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.family.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.season.findMany({ where: { status: { in: ["PLANNED", "ACTIVE"] } }, orderBy: { startDate: "desc" } }),
    prisma.teacher.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
  ]);

  return <AppShell session={session}>
    <PageHeader title="Register Student" description="A guided registration workflow for Admin and Reception users. Use it to create a student or family/group when needed, enroll the primary student, optionally record an initial payment, and optionally book the first lesson." />
    {params.error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{params.error}</div> : null}
    {params.success ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><p className="font-black">Registration complete.</p><p>Students created: {params.students ?? "0"}</p><p>Enrollment: {params.enrollmentId}</p>{params.paymentId ? <p>Initial Payment receipt: <Link className="font-bold underline" href={`/payments/${params.paymentId}`}>open receipt</Link></p> : null}{params.sessionId ? <p>First lesson confirmation: {params.sessionId}</p> : null}</div> : null}
    <RegisterStudentWorkflowForm
      students={students.map((student) => ({ id: student.id, label: `${student.firstName} ${student.lastName} (${student.family?.name ?? "Independent"})` }))}
      families={families.map((family) => ({ id: family.id, name: family.name }))}
      seasons={seasons.map((season) => ({ id: season.id, name: season.name }))}
      teachers={teachers.map((teacher) => ({ id: teacher.id, fullName: teacher.fullName }))}
    />
  </AppShell>;
}
