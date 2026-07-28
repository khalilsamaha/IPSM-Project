import Link from "next/link";
import { AppShell, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { RegisterStudentWorkflowForm } from "./register-student-workflow-form";

export default async function RegisterStudentPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; enrollmentId?: string; paymentId?: string; sessionId?: string; students?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  const [students, families, seasons, teachers, courses, levels, pricings, teacherCourses] = await Promise.all([
    prisma.student.findMany({ where: { status: "ACTIVE" }, include: { family: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.family.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.season.findMany({ where: { status: { in: ["PLANNED", "ACTIVE"] } }, orderBy: { startDate: "desc" } }),
    prisma.teacher.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.course.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.courseLevel.findMany({ where: { status: "ACTIVE" }, orderBy: { order: "asc" } }),
    prisma.coursePricing.findMany({ where: { status: "ACTIVE" }, select: { courseId: true, levelId: true, seasonId: true, priceCents: true } }),
    prisma.teacherCourse.findMany({ where: { status: "ACTIVE", teacher: { status: "ACTIVE" } }, select: { teacherId: true, courseId: true, levelId: true } }),
  ]);

  return <AppShell session={session}>
    <PageHeader title="Register Student" description="A step-by-step registration wizard for Admin and Reception users. Use it to create a student or family/group when needed, enroll the primary student, optionally record an initial payment, and optionally book the first lesson." />
    {params.error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{params.error}</div> : null}
    {params.success ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><p className="font-black">Registration complete.</p><p>Students created: {params.students ?? "0"}</p><p>Enrollment: {params.enrollmentId}</p>{params.paymentId ? <p>Initial Payment receipt: <Link className="font-bold underline" href={`/payments/${params.paymentId}`}>open receipt</Link></p> : null}{params.sessionId ? <p>First lesson confirmation: {params.sessionId}</p> : null}<Link className="mt-3 inline-flex rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white" href="/register-student">Enroll another child from this family</Link></div> : null}
    <RegisterStudentWorkflowForm
      students={students.map((student) => ({ id: student.id, label: `${student.studentCode} — ${student.firstName} ${student.lastName} (${student.family.name})` }))}
      families={families.map((family) => ({ id: family.id, familyCode: family.familyCode, name: family.name }))}
      seasons={seasons.map((season) => ({ id: season.id, name: season.name, startDate: season.startDate.toISOString().slice(0, 10), endDate: season.endDate.toISOString().slice(0, 10) }))}
      teachers={teachers.map((teacher) => ({ id: teacher.id, fullName: teacher.fullName }))}
      courses={courses.map((course) => ({ id: course.id, name: course.name }))}
      levels={levels.map((level) => ({ id: level.id, name: level.name }))}
      pricings={pricings.map((pricing) => ({ courseId: pricing.courseId, levelId: pricing.levelId, seasonId: pricing.seasonId, price: (pricing.priceCents / 100).toFixed(2) }))}
      teacherCourses={teacherCourses}
      isAdmin={session.role === "ADMIN" || session.role === "SUPER_ADMIN"}
    />
  </AppShell>;
}
