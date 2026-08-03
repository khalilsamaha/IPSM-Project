import Link from "next/link";
import { bulkAttendance } from "@/actions/attendance";
import { AppShell, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateInput } from "@/lib/records/format";
import { AttendanceControls } from "./attendance-controls";

type Params = {
  from?: string;
  to?: string;
  teacherId?: string;
  studentId?: string;
  activity?: string;
  status?: string;
  source?: string;
  payroll?: string;
  page?: string;
  result?: string;
  error?: string;
};

const PAGE_SIZE = 50;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireSession();
  const p = await searchParams;
  if (!isAdminOrHigher(session.role)) throw new Error("Only administrators can manage attendance.");

  const today = formatDateInput(new Date());
  const from = p.from || today;
  const to = p.to || from;
  const page = Math.max(1, Number(p.page) || 1);
  const payrollFilter = p.payroll === "none"
    ? { none: {} }
    : p.payroll
      ? { some: { payroll: { status: p.payroll.toUpperCase() as "DRAFT" | "APPROVED" | "PAID" } } }
      : undefined;
  const where = {
    archivedAt: null,
    sessionDate: { gte: new Date(from), lte: new Date(to) },
    ...(p.teacherId ? { teacherId: p.teacherId } : {}),
    ...(p.studentId ? { studentId: p.studentId } : {}),
    ...(p.status ? { status: p.status as "SCHEDULED" } : {}),
    ...(p.source === "generated"
      ? { schedulePatternId: { not: null } }
      : p.source === "manual"
        ? { schedulePatternId: null }
        : {}),
    ...(payrollFilter ? { payrollItems: payrollFilter } : {}),
    ...(p.activity
      ? {
          OR: [
            { title: { contains: p.activity, mode: "insensitive" as const } },
            { enrollment: { course: { name: { contains: p.activity, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [rows, total, teachers, students] = await Promise.all([
    prisma.scheduleSession.findMany({
      where,
      include: {
        teacher: true,
        student: true,
        room: true,
        enrollment: { include: { course: true } },
        payrollItems: { include: { payroll: true } },
      },
      orderBy: [
        { sessionDate: "asc" },
        { startTime: "asc" },
        { teacher: { fullName: "asc" } },
      ],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.scheduleSession.count({ where }),
    prisma.teacher.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.student.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const locked = rows.filter((row) => row.payrollItems.some((item) => ["DRAFT", "APPROVED", "PAID"].includes(item.payroll.status))).length;
  const scheduled = rows.filter((row) => row.status === "SCHEDULED" && !row.payrollItems.length).length;
  const returnQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(p)) {
    if (value && key !== "result" && key !== "error") returnQuery.set(key, value);
  }
  returnQuery.set("from", from);
  returnQuery.set("to", to);
  const returnTo = `/attendance?${returnQuery.toString()}`;

  return (
    <AppShell session={session}>
      <PageHeader
        title="Attendance Operations"
        description="Finalize lesson statuses in bulk. Administrators can also correct an unlocked cancelled lesson to completed with a required reason. Attendance status is the payroll source of truth."
      />

      {p.error ? (
        <div
          className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 font-bold text-red-900"
          role="alert"
          aria-live="assertive"
        >
          {p.error}
        </div>
      ) : null}
      {p.result ? (
        <div
          className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 font-bold text-emerald-900"
          role="status"
          aria-live="polite"
        >
          {p.result}
        </div>
      ) : null}

      <form className="mb-5 grid gap-3 rounded-3xl border bg-white p-4 md:grid-cols-4">
        <label>From<input className="input mt-1" type="date" name="from" defaultValue={from}/></label>
        <label>To<input className="input mt-1" type="date" name="to" defaultValue={to}/></label>
        <label>Teacher<select className="input mt-1" name="teacherId" defaultValue={p.teacherId ?? ""}><option value="">All</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
        <label>Student<select className="input mt-1" name="studentId" defaultValue={p.studentId ?? ""}><option value="">All</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select></label>
        <label>Activity<input className="input mt-1" name="activity" defaultValue={p.activity}/></label>
        <label>Status<select className="input mt-1" name="status" defaultValue={p.status ?? ""}><option value="">All</option>{["SCHEDULED", "COMPLETED", "MISSED", "CANCELLED"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Source<select className="input mt-1" name="source" defaultValue={p.source ?? ""}><option value="">All</option><option value="manual">Manual</option><option value="generated">Generated</option></select></label>
        <label>Payroll<select className="input mt-1" name="payroll" defaultValue={p.payroll ?? ""}><option value="">All</option><option value="none">Not payroll-linked</option><option value="draft">Draft payroll</option><option value="approved">Approved payroll</option><option value="paid">Paid payroll</option></select></label>
        <button className="rounded-xl bg-slate-950 px-4 py-2 font-bold text-white">Apply filters</button>
      </form>

      <form action={bulkAttendance} className="space-y-4">
        <input type="hidden" name="returnTo" value={returnTo}/>
        <AttendanceControls scheduled={scheduled} finalized={rows.length - scheduled - locked} locked={locked}/>

        {rows.length ? (
          <DataTable>
            <thead><tr><th>Select</th><th>Date</th><th>Time</th><th>Teacher</th><th>Student</th><th>Activity</th><th>Room</th><th>Status</th><th>Payroll</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const payroll = row.payrollItems[0]?.payroll;
                const isLocked = Boolean(payroll && payroll.status !== "CANCELLED");
                return (
                  <tr key={row.id}>
                    <td><input name="sessionIds" value={row.id} type="checkbox" disabled={isLocked} title={isLocked ? `Locked by ${payroll?.status.toLowerCase()} payroll` : undefined}/></td>
                    <td>{formatDate(row.sessionDate)}</td>
                    <td>{row.startTime}–{row.endTime}</td>
                    <td>{row.teacher.fullName}</td>
                    <td>{row.student.firstName} {row.student.lastName}</td>
                    <td>{row.title || row.enrollment?.course?.name || "Lesson"}</td>
                    <td>{row.room?.name ?? "—"}</td>
                    <td><StatusBadge status={row.status}/></td>
                    <td>{payroll ? <span title="Attendance cannot change until the payroll permits it">🔒 <StatusBadge status={payroll.status}/></span> : "Not linked"}</td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <EmptyState title="No lessons found" description="Try another date range or filter."/>
        )}

        <div className="grid gap-3 rounded-3xl border bg-white p-4 md:grid-cols-5">
          <select required name="attendanceAction" className="input">
            <option value="complete">Mark completed / correct cancelled</option>
            <option value="missed">Mark missed</option>
            <option value="cancel">Mark cancelled</option>
            <option value="revert">Revert to scheduled</option>
          </select>
          <input
            className="input"
            name="reason"
            placeholder="Reason for exception or correction"
            aria-label="Reason for attendance exception or correction"
          />
          <input className="input" name="notes" placeholder="Internal notes"/>
          <label className="text-xs"><input type="checkbox" name="missedPayNotice"/> I understand missed lessons are unpaid unless separately approved in payroll.</label>
          <button className="rounded-xl bg-primary px-4 py-2 font-bold text-white">Confirm selected action</button>
          <p className="text-xs text-slate-600 md:col-span-5">
            A reason is required for missed, cancelled and reverted lessons, and whenever an administrator corrects a cancelled lesson to completed. Draft, approved and paid payroll links continue to lock attendance changes.
          </p>
        </div>
      </form>

      <div className="mt-4 flex justify-between text-sm">
        <span>{total} lessons · page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
        <div className="flex gap-3">
          {page > 1 ? <Link href={`/attendance?from=${from}&to=${to}&page=${page - 1}`}>Previous</Link> : null}
          {page * PAGE_SIZE < total ? <Link href={`/attendance?from=${from}&to=${to}&page=${page + 1}`}>Next</Link> : null}
        </div>
      </div>
    </AppShell>
  );
}
