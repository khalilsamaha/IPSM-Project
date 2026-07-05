import Link from "next/link";
import { EnrollmentStatus, Prisma } from "@prisma/client";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { archiveEnrollment, restoreEnrollment } from "@/actions/records";
import { AppShell, Pager, SearchBox, StatusBadge, DataTable, StatusTabs, getStatusFilter, type RecordStatusFilter } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/records/format";
import { formatDateInputValue } from "@/lib/enrollments/proration";
import { getPagination } from "@/lib/records/pagination";

type Params = {
  q?: string;
  page?: string;
  status?: string;
  seasonId?: string;
  teacherId?: string;
  courseId?: string;
  levelId?: string;
  course?: string;
  enrollmentStatus?: string;
  balance?: string;
  showExistingEnrollmentHelp?: string;
};

const enrollmentStatuses = ["ACTIVE", "PAUSED", "ENDED", "CANCELLED"] as const;
const balances = ["with-balance", "fully-paid", "all"] as const;

function hrefFor(p: number, params: Params, status?: RecordStatusFilter) {
  const next = new URLSearchParams();
  const nextStatus = status ?? getStatusFilter(params.status);
  if (params.q) next.set("q", params.q);
  if (nextStatus !== "active") next.set("status", nextStatus);
  for (const key of ["seasonId", "teacherId", "courseId", "levelId", "course", "enrollmentStatus", "balance"] as const) {
    if (params[key]) next.set(key, params[key]!);
  }
  if (p > 1) next.set("page", String(p));
  return next.toString() ? `/enrollments?${next}` : "/enrollments";
}

function withQuery(updates: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(updates)) if (value) query.set(key, value);
  return query.toString();
}

export default async function EnrollmentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = await requireSession();
  const { q, page, skip, take } = getPagination(params);
  const status = getStatusFilter(params.status);
  const enrollmentStatus = enrollmentStatuses.includes(params.enrollmentStatus as any) ? (params.enrollmentStatus as EnrollmentStatus) : undefined;
  const balance = balances.includes(params.balance as any) ? params.balance : "all";

  const where: Prisma.EnrollmentWhereInput = {
    AND: [
      status === "archived" ? { archivedAt: { not: null } } : status === "active" ? { archivedAt: null } : {},
      q ? { OR: [{ courseName: { contains: q, mode: "insensitive" as const } }, { student: { studentCode: { contains: q, mode: "insensitive" as const } } }, { student: { firstName: { contains: q, mode: "insensitive" as const } } }, { student: { lastName: { contains: q, mode: "insensitive" as const } } }, { student: { family: { name: { contains: q, mode: "insensitive" as const } } } }, { season: { name: { contains: q, mode: "insensitive" as const } } }, { teacher: { fullName: { contains: q, mode: "insensitive" as const } } }] } : {},
      params.seasonId ? { seasonId: params.seasonId } : {},
      params.teacherId ? { teacherId: params.teacherId } : {},
      params.courseId ? { courseId: params.courseId } : params.course ? { OR: [{ courseName: { contains: params.course, mode: "insensitive" as const } }, { course: { name: { contains: params.course, mode: "insensitive" as const } } }] } : {},
      params.levelId ? { levelId: params.levelId } : {},
      enrollmentStatus ? { status: enrollmentStatus } : {},
      balance === "with-balance" ? { remainingCents: { gt: 0 } } : balance === "fully-paid" ? { remainingCents: 0 } : {},
    ],
  };

  const [rows, total, seasons, teachers, courses, levels] = await Promise.all([
    prisma.enrollment.findMany({ where, include: { student: { include: { family: true } }, season: true, teacher: true, course: true, level: true }, orderBy: { updatedAt: "desc" }, skip, take }),
    prisma.enrollment.count({ where }),
    prisma.season.findMany({ orderBy: { startDate: "desc" } }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" } }),
    prisma.course.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.courseLevel.findMany({ where: { status: "ACTIVE" }, orderBy: { order: "asc" } }),
  ]);

  return <AppShell session={session}>
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-2xl font-bold">Enrollment Records</h2>
        <p className="mt-2 text-sm text-muted-foreground">Track course assignments, fees, balances, and enrollment status. Use Register Student for the primary student registration workflow.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className="rounded bg-primary px-4 py-2 text-white" href="/register-student">Register Student</Link>
        <Link className="rounded border px-4 py-2" href="/enrollments?showExistingEnrollmentHelp=1">Add enrollment for existing student</Link>
      </div>
    </div>

    {params.showExistingEnrollmentHelp ? <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Existing student enrollment:</strong> this page is for records management. To add an enrollment for a student who already exists, open <Link className="font-bold underline" href="/register-student">Register Student</Link> and choose the existing-family/student path when appropriate.</div> : null}

    <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]"><SearchBox q={q} placeholder="Search Student ID, student, family, season, teacher, or course"/><StatusTabs value={status} hrefFor={(nextStatus: RecordStatusFilter) => hrefFor(1, params, nextStatus)} /></div>

    <form className="mb-6 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      <input type="hidden" name="status" value={status === "active" ? "" : status} />
      <input className="rounded border p-2" name="q" placeholder="Search" defaultValue={q} />
      <select name="seasonId" className="rounded border p-2" defaultValue={params.seasonId ?? ""}><option value="">All seasons</option>{seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select name="teacherId" className="rounded border p-2" defaultValue={params.teacherId ?? ""}><option value="">All teachers</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
      <select name="courseId" className="rounded border p-2" defaultValue={params.courseId ?? ""}><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select name="levelId" className="rounded border p-2" defaultValue={params.levelId ?? ""}><option value="">All levels</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <select name="enrollmentStatus" className="rounded border p-2" defaultValue={enrollmentStatus ?? ""}><option value="">All enrollment statuses</option>{enrollmentStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      <select name="balance" className="rounded border p-2" defaultValue={balance}><option value="all">All balances</option><option value="with-balance">With balance</option><option value="fully-paid">Fully paid</option></select>
      <button className="rounded bg-primary px-4 py-2 text-white lg:col-span-2">Apply filters</button>
      <Link className="rounded border px-4 py-2 text-center" href="/enrollments">Reset</Link>
    </form>

    <DataTable><thead className="bg-muted"><tr><th className="p-3">Student ID</th><th>Student</th><th>Family / Group</th><th>Season</th><th>Course</th><th>Level</th><th>Teacher</th><th>Start Date</th><th>End Date</th><th>Amount Due</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((r) => {
      const studentName = `${r.student.firstName} ${r.student.lastName}`;
      const familyId = r.student.familyId;
      const scheduleQuery = withQuery({ form_studentId: r.studentId, form_enrollmentId: r.id, form_teacherId: r.teacherId ?? undefined, form_seasonId: r.seasonId });
      return <tr className="border-t" key={r.id}><td className="p-3 font-mono text-xs font-bold">{r.student.studentCode}</td><td className="font-medium">{studentName}</td><td>{r.student.family?.name ?? "Independent"}</td><td>{r.season.name}</td><td>{r.course?.name ?? r.courseName}</td><td>{r.level?.name ?? "—"}</td><td>{r.teacher?.fullName ?? "—"}</td><td>{formatDateInputValue(r.enrollmentStartDate)}</td><td>{formatDateInputValue(r.enrollmentEndDate)}</td><td>{formatCurrency(r.finalFeeCents)}</td><td>{formatCurrency(r.paidCents)}</td><td className={r.remainingCents > 0 ? "font-bold text-amber-700" : "text-emerald-700"}>{formatCurrency(r.remainingCents)}</td><td><StatusBadge status={r.status} /></td><td className="flex flex-wrap gap-2"><Link className="text-primary" href={`/students/${r.studentId}`}>View student</Link>{familyId ? <Link className="text-primary" href={r.remainingCents > 0 ? `/payments/new?familyId=${familyId}` : `/payments?familyId=${familyId}`}>{r.remainingCents > 0 ? "Record payment" : "View payment"}</Link> : <Link className="text-primary" href={r.remainingCents > 0 ? `/payments/new?payerType=student&studentId=${r.studentId}` : `/payments?studentCode=${r.student.studentCode}`}>{r.remainingCents > 0 ? "Record payment" : "View payment"}</Link>}<Link className="text-primary" href={`/schedule?${scheduleQuery}`}>Book lesson</Link>{r.archivedAt ? <form className="inline" action={restoreEnrollment}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-primary" message="Restore this enrollment?">Restore</ConfirmSubmitButton></form> : <form className="inline" action={archiveEnrollment}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-primary" message="End this enrollment? This will remove it from active billing workflows.">End enrollment</ConfirmSubmitButton></form>}</td></tr>;
    })}</tbody></DataTable><Pager page={page} total={total} hrefFor={(p) => hrefFor(p, params, status)}/>
  </AppShell>;
}
