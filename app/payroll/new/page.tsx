import { generateTeacherPayroll } from "@/actions/payroll";
import { AppShell, DataTable, PageHeader, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatDateInput } from "@/lib/records/format";
import { minutesBetween } from "@/lib/payroll/calculations";
import { defaultPayableLessonPolicy, isPayableLesson } from "@/lib/payroll/policy";

type Params = { teacherId?: string; periodStart?: string; periodEnd?: string; payMissed?: string };
export default async function NewPayrollPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams; const session = await requireSession();
  const teachers = await prisma.teacher.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } });
  const teacher = params.teacherId ? await prisma.teacher.findUnique({ where: { id: params.teacherId } }) : null;
  const periodStart = params.periodStart ? new Date(params.periodStart) : null; const periodEnd = params.periodEnd ? new Date(params.periodEnd) : null;
  const policy = { ...defaultPayableLessonPolicy, payMissed: params.payMissed === "1" };
  const allLessons = teacher && periodStart && periodEnd ? await prisma.scheduleSession.findMany({ where: { teacherId: teacher.id, sessionDate: { gte: periodStart, lte: periodEnd }, archivedAt: null }, include: { student: true, payrollItems: true }, orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }] }) : [];
  const lessons = allLessons.filter((lesson) => !lesson.payrollItems.length);
  const scheduledCount = lessons.filter((lesson) => lesson.status === "SCHEDULED").length;
  const linkedCount = allLessons.length - lessons.length;
  const completedMinutes = lessons.filter((lesson) => lesson.status === "COMPLETED").reduce((sum, lesson) => sum + minutesBetween(lesson.startTime, lesson.endTime), 0);
  return <AppShell session={session}><PageHeader title="Generate Teacher Payroll" description="Select a teacher and period, review eligible payable lessons, optionally approve MISSED lessons, then generate a draft with a rate snapshot." />
    <form className="mb-5 grid gap-3 rounded-[1.5rem] border bg-white p-4 md:grid-cols-5"><select name="teacherId" required defaultValue={params.teacherId ?? ""} className="rounded-xl border p-2.5"><option value="">Teacher</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select><input className="rounded-xl border p-2.5" type="date" name="periodStart" defaultValue={params.periodStart ?? ""} required/><input className="rounded-xl border p-2.5" type="date" name="periodEnd" defaultValue={params.periodEnd ?? ""} required/><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="payMissed" value="1" defaultChecked={params.payMissed === "1"}/> Pay missed by policy</label><button className="rounded-xl bg-primary px-4 py-2.5 font-bold text-white">Load lessons</button></form>
    {teacher ? <div className={`mb-4 rounded-xl border p-4 ${scheduledCount ? "border-amber-300 bg-amber-50" : "bg-white"}`}><b>Attendance summary</b><p>{lessons.filter(l=>l.status==="COMPLETED").length} completed · {lessons.filter(l=>l.status==="MISSED").length} missed · {lessons.filter(l=>l.status==="CANCELLED").length} cancelled · {scheduledCount} scheduled · {linkedCount} already payroll-linked</p>{scheduledCount ? <p className="mt-2 font-bold text-amber-900">{scheduledCount} lessons in this period are still Scheduled. Finalize attendance before generating payroll.</p> : null}<p className="mt-2">Completed hours: {(completedMinutes/60).toFixed(2)} · Hourly rate: {formatCurrency(teacher.hourlyRateCents)} · Base pay: {formatCurrency(Math.round(completedMinutes*teacher.hourlyRateCents/60))}</p></div> : null}
    <form action={generateTeacherPayroll} className="space-y-4"><input type="hidden" name="teacherId" value={teacher?.id ?? ""}/><input type="hidden" name="periodStart" value={periodStart ? formatDateInput(periodStart) : ""}/><input type="hidden" name="periodEnd" value={periodEnd ? formatDateInput(periodEnd) : ""}/>
      <DataTable><thead><tr><th>Include</th><th>Date</th><th>Time</th><th>Student</th><th>Status</th><th>Minutes</th><th>Missed approval</th></tr></thead><tbody>{lessons.map((l) => { const eligible = isPayableLesson(l.status, l.id, policy); return <tr key={l.id}><td><input type="checkbox" name="sessionIds" value={l.id} defaultChecked={eligible} disabled={!eligible && l.status !== "MISSED"}/></td><td>{formatDate(l.sessionDate)}</td><td>{l.startTime}–{l.endTime}</td><td>{l.student.studentCode} — {l.student.firstName} {l.student.lastName}</td><td><StatusBadge status={l.status}/></td><td>{minutesBetween(l.startTime, l.endTime)}</td><td>{l.status === "MISSED" ? <label className="text-xs font-bold"><input type="checkbox" name="missedApprovedSessionIds" value={l.id} defaultChecked={params.payMissed === "1"}/> approve missed pay</label> : "—"}</td></tr>; })}</tbody></DataTable>
      <div className="grid gap-3 rounded-[1.5rem] border bg-white p-4 md:grid-cols-3"><input className="rounded-xl border p-2.5" name="adjustment" type="number" step="0.01" placeholder="Adjustment (+/-)"/><input className="rounded-xl border p-2.5" name="notes" placeholder="Notes"/><button disabled={!teacher || !lessons.length || scheduledCount > 0} className="rounded-xl bg-slate-950 px-4 py-2.5 font-bold text-white disabled:opacity-50">Generate Draft</button></div>
    </form></AppShell>;
}
