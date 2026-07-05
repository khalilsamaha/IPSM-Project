import Link from "next/link";
import { notFound } from "next/navigation";
import { saveEnrollment } from "@/actions/records";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrencyInput } from "@/lib/records/format";
import { formatDateInputValue } from "@/lib/enrollments/proration";

type Params = { id: string };
type SearchParams = { error?: string; success?: string };

export default async function EditEnrollmentPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, requireSession()]);
  const [enrollment, seasons, teachers, courses, levels] = await Promise.all([
    prisma.enrollment.findUnique({ where: { id }, include: { student: true, season: true, teacher: true, course: true, level: true, paymentItems: true, scheduleSessions: { where: { archivedAt: null }, orderBy: { sessionDate: "asc" } } } }),
    prisma.season.findMany({ orderBy: { startDate: "desc" } }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" } }),
    prisma.course.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.courseLevel.findMany({ where: { status: "ACTIVE" }, orderBy: { order: "asc" } }),
  ]);
  if (!enrollment) notFound();
  const hasPayments = enrollment.paymentItems.length > 0;
  const firstSession = enrollment.scheduleSessions[0]?.sessionDate;
  const lastSession = enrollment.scheduleSessions.at(-1)?.sessionDate;
  return <AppShell session={session}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">Edit Enrollment</h2><p className="text-sm text-muted-foreground">{enrollment.student.studentCode} — {enrollment.student.firstName} {enrollment.student.lastName}</p></div><Link className="rounded border px-4 py-2" href="/enrollments">Back to enrollments</Link></div>
    {query.error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{query.error}</div> : null}
    {query.success ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{query.success}</div> : null}
    {hasPayments ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Payment-safe edit:</strong> paid history is preserved. If fee/discount changes, remaining balance is recalculated from final fee minus already paid.</div> : null}
    {firstSession && lastSession ? <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Existing scheduled lessons run from {formatDateInputValue(firstSession)} to {formatDateInputValue(lastSession)}. New enrollment dates must include every scheduled lesson.</div> : null}
    <form action={saveEnrollment} className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="id" value={enrollment.id} />
      <input type="hidden" name="studentId" value={enrollment.studentId} />
      <label className="text-sm font-bold">Season<select name="seasonId" defaultValue={enrollment.seasonId} className="mt-1 w-full rounded border p-2">{seasons.map((s) => <option key={s.id} value={s.id}>{s.name} ({formatDateInputValue(s.startDate)} to {formatDateInputValue(s.endDate)})</option>)}</select></label>
      <label className="text-sm font-bold">Course<select name="courseId" defaultValue={enrollment.courseId ?? ""} className="mt-1 w-full rounded border p-2"><option value="">Legacy/manual course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm font-bold">Course name<input name="courseName" required defaultValue={enrollment.course?.name ?? enrollment.courseName} className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm font-bold">Level<select name="levelId" defaultValue={enrollment.levelId ?? ""} className="mt-1 w-full rounded border p-2"><option value="">No level</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label className="text-sm font-bold">Teacher<select name="teacherId" defaultValue={enrollment.teacherId ?? ""} className="mt-1 w-full rounded border p-2"><option value="">Assign later</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></label>
      <label className="text-sm font-bold">Start<input name="enrollmentStartDate" type="date" required defaultValue={formatDateInputValue(enrollment.enrollmentStartDate)} className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm font-bold">End<input name="enrollmentEndDate" type="date" required defaultValue={formatDateInputValue(enrollment.enrollmentEndDate)} className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm font-bold">Status<select name="status" defaultValue={enrollment.status} className="mt-1 w-full rounded border p-2">{["ACTIVE", "PAUSED", "ENDED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="text-sm font-bold">Fee<input name="fee" type="number" min="0" step="0.01" defaultValue={formatCurrencyInput(enrollment.feeCents)} className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm font-bold">Discount<input name="discount" type="number" min="0" step="0.01" defaultValue={formatCurrencyInput(enrollment.discountCents)} className="mt-1 w-full rounded border p-2" /></label>
      <div className="flex items-end gap-2 lg:col-span-2"><button className="rounded bg-primary px-4 py-2 text-white">Save enrollment</button><Link className="rounded border px-4 py-2" href="/enrollments">Cancel</Link></div>
    </form>
  </AppShell>;
}
