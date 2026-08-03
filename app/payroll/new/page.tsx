import { generateTeacherPayroll } from "@/actions/payroll";
import { AppShell, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { NotAuthorized } from "@/lib/auth/not-authorized";
import { prisma } from "@/lib/prisma";
import { payrollMonthBounds, previousPayrollMonth } from "@/lib/payroll/month";
import { finalizeElapsedScheduledLessons } from "@/lib/attendance/auto-finalize";
import { formatDateShort } from "@/lib/date-time";
import { formatCurrency } from "@/lib/records/format";
import {
  calculateCompensationAmountCents,
  compensationRateLabel,
  minutesBetween,
  resolveCompensation,
} from "@/lib/payroll/calculations";

export default async function NewPayroll({
  searchParams,
}: {
  searchParams: Promise<{
    teacherId?: string;
    payrollMonth?: string;
    error?: string;
    success?: string;
  }>;
}) {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) return <NotAuthorized session={session} />;

  const params = await searchParams;
  const month = params.payrollMonth ?? previousPayrollMonth();
  const bounds = payrollMonthBounds(month);

  if (params.teacherId) {
    await finalizeElapsedScheduledLessons({
      teacherId: params.teacherId,
      dateFrom: bounds.periodStart,
      dateTo: bounds.periodEnd,
      source: "payroll_preview",
      actorId: session.userId,
    });
  }

  const [teachers, teacher, lessons] = await Promise.all([
    prisma.teacher.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    params.teacherId
      ? prisma.teacher.findUnique({ where: { id: params.teacherId } })
      : null,
    params.teacherId
      ? prisma.scheduleSession.findMany({
          where: {
            teacherId: params.teacherId,
            sessionDate: { gte: bounds.periodStart, lte: bounds.periodEnd },
            archivedAt: null,
          },
          include: { student: true, payrollItems: true },
          orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
        })
      : [],
  ]);

  const available = lessons.filter((lesson) => !lesson.payrollItems.length);
  const completed = available.filter((lesson) => lesson.status === "COMPLETED");
  const automatic = completed.filter((lesson) => lesson.attendanceSource === "AUTOMATIC");
  const completedMinutes = completed.reduce(
    (sum, lesson) => sum + minutesBetween(lesson.startTime, lesson.endTime),
    0,
  );
  const compensation = teacher ? resolveCompensation(teacher) : null;
  const previewAmountCents = compensation
    ? calculateCompensationAmountCents(
        completedMinutes,
        compensation.rateCents,
        compensation.basis,
        compensation.unitMinutes,
      )
    : 0;
  const completedUnits = compensation?.basis === "SESSION_UNIT"
    ? completedMinutes / compensation.unitMinutes
    : null;

  return (
    <AppShell session={session}>
      <PageHeader
        title="Generate monthly payroll"
        description="The preview and generated draft use the same saved compensation basis and exact calendar-month boundaries."
      />

      {params.error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800" role="alert">
          Payroll could not be generated: {params.error}
        </div>
      ) : null}
      {params.success ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {params.success}
        </div>
      ) : null}

      <form method="get" className="mb-5 grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-3">
        <label className="text-sm font-bold">
          Teacher
          <select name="teacherId" defaultValue={params.teacherId ?? ""} required className="input mt-1">
            <option value="">Choose teacher</option>
            {teachers.map((row) => <option key={row.id} value={row.id}>{row.fullName}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">
          Payroll month
          <input
            className="input mt-1"
            type="month"
            name="payrollMonth"
            max={new Date().toISOString().slice(0, 7)}
            defaultValue={month}
          />
        </label>
        <button className="rounded-xl bg-slate-950 text-white self-end py-3">Preview</button>
      </form>

      {teacher && compensation ? (
        <>
          <section className="mb-5 rounded-2xl border bg-white p-5">
            <h2 className="font-black">{teacher.fullName} — {month}</h2>
            <p>
              {completed.length} completed ({automatic.length} automatic, {completed.length - automatic.length} manual)
              {" · "}{available.filter((row) => row.status === "CANCELLED").length} cancelled
              {" · "}{available.filter((row) => row.status === "MISSED").length} missed
              {" · "}{available.filter((row) => row.status === "SCHEDULED").length} unresolved
            </p>
            <p className="mt-2 font-semibold">
              {(completedMinutes / 60).toFixed(2)} hours
              {completedUnits != null ? ` · ${completedUnits.toFixed(0)} × ${compensation.unitMinutes}-minute lessons` : ""}
              {" · "}{formatCurrency(compensation.rateCents)} {compensationRateLabel(compensation)}
              {" = "}<span className="text-emerald-700">{formatCurrency(previewAmountCents)}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This is the same compensation formula that will be snapshotted into the draft payroll.
            </p>
          </section>

          <form action={generateTeacherPayroll}>
            <input type="hidden" name="teacherId" value={teacher.id} />
            <input type="hidden" name="payrollMonth" value={month} />
            {completed.map((lesson) => (
              <input key={lesson.id} type="hidden" name="sessionIds" value={lesson.id} />
            ))}
            <div className="overflow-auto rounded-2xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Date</th><th>Time</th><th>Student</th><th>Status</th><th>Finalized by</th><th>Payable</th><th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {available.map((lesson) => {
                    const payable = lesson.status === "COMPLETED";
                    const lessonMinutes = minutesBetween(lesson.startTime, lesson.endTime);
                    return (
                      <tr key={lesson.id}>
                        <td>{formatDateShort(lesson.sessionDate)}</td>
                        <td>{lesson.startTime}–{lesson.endTime}</td>
                        <td>{lesson.student.firstName} {lesson.student.lastName}</td>
                        <td>{lesson.status}</td>
                        <td>{lesson.attendanceSource ?? "—"}</td>
                        <td>{payable ? "Yes" : "No"}</td>
                        <td>{payable ? formatCurrency(calculateCompensationAmountCents(
                          lessonMinutes,
                          compensation.rateCents,
                          compensation.basis,
                          compensation.unitMinutes,
                        )) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label className="mt-4 block text-sm font-bold">
              Adjustment
              <input name="adjustment" defaultValue="0" className="input mt-1" />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Use a negative value for a deduction and a positive value for an addition.</span>
            </label>
            <label className="mt-3 block text-sm font-bold">
              Notes
              <textarea name="notes" className="input mt-1" placeholder="Optional payroll notes" />
            </label>
            <button className="mt-3 rounded-xl bg-primary px-5 py-3 font-bold text-white">
              Generate draft for {month}
            </button>
          </form>
        </>
      ) : null}
    </AppShell>
  );
}
