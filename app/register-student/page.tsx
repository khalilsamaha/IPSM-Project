import Link from "next/link";
import { AppShell, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { RegisterStudentWorkflowForm } from "./register-student-workflow-form";
import { ShareReceiptButton } from "@/components/share-receipt-button";
import { formatCurrency } from "@/lib/records/format";

export default async function RegisterStudentPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    enrollmentId?: string;
    paymentId?: string;
    sessionId?: string;
    students?: string;
    familyId?: string;
    scheduleError?: string;
    identitySaved?: string;
    attemptId?: string;
  }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const [
    students,
    families,
    seasons,
    teachers,
    courses,
    levels,
    pricings,
    teacherCourses,
    availability,
  ] = await Promise.all([
    prisma.student.findMany({
      where: { status: "ACTIVE" },
      include: { family: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.family.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.season.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE"] } },
      orderBy: { startDate: "desc" },
    }),
    prisma.teacher.findMany({
      where: { status: "ACTIVE" },
      orderBy: { fullName: "asc" },
    }),
    prisma.course.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.courseLevel.findMany({
      where: { status: "ACTIVE" },
      orderBy: { order: "asc" },
    }),
    prisma.coursePricing.findMany({
      where: { status: "ACTIVE" },
      select: {
        courseId: true,
        levelId: true,
        seasonId: true,
        priceCents: true,
      },
    }),
    prisma.teacherCourse.findMany({
      where: { status: "ACTIVE", teacher: { status: "ACTIVE" } },
      select: { teacherId: true, courseId: true, levelId: true },
    }),
    prisma.teacherAvailability.findMany({
      where: { status: "ACTIVE", archivedAt: null },
      select: { teacherId: true, dayOfWeek: true, startTime: true, endTime: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
  ]);
  const successPayment = params.paymentId ? await prisma.payment.findUnique({ where: { id: params.paymentId }, include: { family: true } }) : null;

  return (
    <AppShell session={session}>
      <PageHeader
        title="Register Student"
        description="A step-by-step registration wizard for Admin and Reception users. Use it to create a student or family/group when needed, enroll the primary student, optionally record an initial payment, and optionally create an availability-driven weekly lesson schedule."
      />
      {params.error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {params.error}
        </div>
      ) : null}
      {params.success ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-black">Registration completed successfully.</p>
          <p>Students created: {params.students ?? "0"}</p>
          <p>Enrollment: {params.enrollmentId}</p>
          {successPayment?.receiptNumber ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="rounded border px-4 py-2 font-bold" href={`/payments/${successPayment.id}`}>Open receipt</Link>
              <a className="rounded border px-4 py-2 font-bold" href={`/api/receipts/${successPayment.id}?layout=a5`} download>Download A5 PDF</a>
              <ShareReceiptButton paymentId={successPayment.id} receiptNumber={successPayment.receiptNumber} familyName={successPayment.family.name} amount={formatCurrency(successPayment.totalAmountCents)}/>
              <Link className="rounded border px-4 py-2 font-bold" href={`/payments/new?familyId=${successPayment.familyId}`}>Record another payment</Link>
            </div>
          ) : null}
          {params.sessionId ? (
            <p>First lesson confirmation: {params.sessionId}</p>
          ) : null}
          {params.scheduleError ? (
            <p className="mt-2 rounded-xl bg-amber-100 p-2 font-bold text-amber-900">
              Lessons were not scheduled: {params.scheduleError}
            </p>
          ) : null}
          <Link
            className="mt-3 inline-flex rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white"
            href={`/register-student${params.familyId ? `?familyId=${params.familyId}` : ""}`}
          >
            Enroll another child from this family
          </Link>
        </div>
      ) : null}
      {params.identitySaved ? <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><p className="font-black">Family and student saved.</p><p>No enrollment or payment was created.</p>{params.scheduleError ? <><p className="mt-3 font-bold">Enrollment was not created:</p><p>{params.scheduleError}</p><p className="mt-2">No payment was recorded.</p></> : null}<Link className="mt-3 inline-flex rounded bg-primary px-4 py-2 font-bold text-white" href={`/register-student?familyId=${params.familyId ?? ""}&attemptId=${params.attemptId ?? ""}`}>Complete enrollment</Link></div> : null}
      <RegisterStudentWorkflowForm
        students={students.map((student) => ({
          id: student.id,
          familyId: student.familyId,
          label: `${student.studentCode} — ${student.firstName} ${student.lastName}`,
        }))}
        initialFamilyId={params.familyId ?? ""}
        families={families.map((family) => ({
          id: family.id,
          familyCode: family.familyCode,
          name: family.name,
        }))}
        seasons={seasons.map((season) => ({
          id: season.id,
          name: season.name,
          startDate: season.startDate.toISOString().slice(0, 10),
          endDate: season.endDate.toISOString().slice(0, 10),
        }))}
        teachers={teachers.map((teacher) => ({
          id: teacher.id,
          fullName: teacher.fullName,
        }))}
        courses={courses.map((course) => ({
          id: course.id,
          name: course.name,
        }))}
        levels={levels.map((level) => ({ id: level.id, name: level.name }))}
        pricings={pricings.map((pricing) => ({
          courseId: pricing.courseId,
          levelId: pricing.levelId,
          seasonId: pricing.seasonId,
          price: (pricing.priceCents / 100).toFixed(2),
        }))}
        teacherCourses={teacherCourses}
        availability={availability}
        isAdmin={session.role === "ADMIN" || session.role === "SUPER_ADMIN"}
      />
    </AppShell>
  );
}
