import { archiveScheduleSession, cancelScheduleSession, saveScheduleSession } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, DataTable, Pager, PageHeader, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { buildPageHref, getPagination } from "@/lib/records/pagination";
import { formatDate } from "@/lib/records/format";
import { getAvailableGaps } from "@/lib/schedule/validation";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ page?: string; teacherId?: string; studentId?: string; date?: string; seasonId?: string; course?: string; editId?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  const { page, skip, take } = getPagination(params);
  const where: any = { archivedAt: null };
  if (params.teacherId) where.teacherId = params.teacherId;
  if (params.studentId) where.studentId = params.studentId;
  if (params.seasonId) where.seasonId = params.seasonId;
  if (params.date) where.sessionDate = new Date(params.date);
  if (params.course) where.enrollment = { courseName: { contains: params.course, mode: "insensitive" } };
  const [rows, total, students, teachers, seasons, enrollments, editSession] = await Promise.all([
    prisma.scheduleSession.findMany({ where, include: { student: { include: { family: true } }, teacher: true, enrollment: true, season: true }, orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }], skip, take }),
    prisma.scheduleSession.count({ where }),
    prisma.student.findMany({ where: { status: "ACTIVE" }, include: { family: true, enrollments: { include: { season: true, teacher: true }, where: { status: "ACTIVE" } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.teacher.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.season.findMany({ where: { status: { in: ["PLANNED", "ACTIVE"] } }, orderBy: { startDate: "desc" } }),
    prisma.enrollment.findMany({ where: { status: "ACTIVE" }, include: { student: true, season: true, teacher: true }, orderBy: { courseName: "asc" } }),
    params.editId ? prisma.scheduleSession.findUnique({ where: { id: params.editId } }) : Promise.resolve(null),
  ]);
  const availabilityBookings = params.teacherId && params.date ? await prisma.scheduleSession.findMany({ where: { teacherId: params.teacherId, sessionDate: new Date(params.date), archivedAt: null, status: { not: "CANCELLED" } }, include: { student: true, enrollment: true }, orderBy: { startTime: "asc" } }) : [];
  const gaps = getAvailableGaps(availabilityBookings);
  const studentUpcoming = params.studentId ? await prisma.scheduleSession.findMany({ where: { studentId: params.studentId, archivedAt: null, status: "SCHEDULED", sessionDate: { gte: new Date() } }, include: { teacher: true, enrollment: true }, orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }], take: 25 }) : [];
  const filterHref = (p: number) => buildPageHref("/schedule", p, "");
  return <AppShell session={session}>
    <PageHeader title="Schedule" description="Manage student and teacher sessions, availability, and student schedules." />
    <form className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-6">
      <select name="teacherId" className="rounded border p-2"><option value="">All teachers</option>{teachers.map(t => <option selected={params.teacherId === t.id} value={t.id} key={t.id}>{t.fullName}</option>)}</select>
      <select name="studentId" className="rounded border p-2"><option value="">All students</option>{students.map(s => <option selected={params.studentId === s.id} value={s.id} key={s.id}>{s.firstName} {s.lastName}</option>)}</select>
      <select name="seasonId" className="rounded border p-2"><option value="">All seasons</option>{seasons.map(s => <option selected={params.seasonId === s.id} value={s.id} key={s.id}>{s.name}</option>)}</select>
      <input name="date" type="date" defaultValue={params.date} className="rounded border p-2" />
      <input name="course" placeholder="Course" defaultValue={params.course} className="rounded border p-2" />
      <button className="rounded bg-primary px-4 py-2 text-white">Filter</button>
    </form>
    <form action={saveScheduleSession} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4">
      {editSession ? <input type="hidden" name="id" value={editSession.id} /> : null}<input name="title" placeholder="Title" defaultValue={editSession?.title ?? ""} className="rounded border p-2" />
      <select name="studentId" required className="rounded border p-2">{students.map(s => <option selected={editSession?.studentId === s.id} value={s.id} key={s.id}>{s.firstName} {s.lastName} ({s.family.name})</option>)}</select>
      <select name="enrollmentId" className="rounded border p-2"><option value="">No enrollment</option>{enrollments.map(e => <option selected={editSession?.enrollmentId === e.id} value={e.id} key={e.id}>{e.student.firstName} {e.student.lastName} — {e.courseName}</option>)}</select>
      <select name="teacherId" required className="rounded border p-2">{teachers.map(t => <option selected={editSession?.teacherId === t.id} value={t.id} key={t.id}>{t.fullName}</option>)}</select>
      <select name="seasonId" className="rounded border p-2"><option value="">No season</option>{seasons.map(s => <option selected={editSession?.seasonId === s.id} value={s.id} key={s.id}>{s.name}</option>)}</select>
      <input name="sessionDate" required type="date" defaultValue={editSession?.sessionDate.toISOString().slice(0, 10)} className="rounded border p-2" />
      <input name="startTime" required type="time" defaultValue={editSession?.startTime} className="rounded border p-2" />
      <input name="endTime" required type="time" defaultValue={editSession?.endTime} className="rounded border p-2" />
      <select name="status" className="rounded border p-2">{["SCHEDULED", "COMPLETED", "CANCELLED", "MISSED"].map(status => <option selected={editSession?.status === status} key={status}>{status}</option>)}</select>
      <textarea name="notes" placeholder="Notes" defaultValue={editSession?.notes ?? ""} className="rounded border p-2 md:col-span-2" />
      <button className="rounded bg-primary px-4 py-2 text-white">{editSession ? "Update session" : "Add session"}</button>
    </form>
    <DataTable><thead><tr><th>Date</th><th>Time</th><th>Student</th><th>Family</th><th>Teacher</th><th>Course</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{formatDate(r.sessionDate)}</td><td>{r.startTime}–{r.endTime}</td><td>{r.student.firstName} {r.student.lastName}</td><td>{r.student.family.name}</td><td>{r.teacher.fullName}</td><td>{r.enrollment?.courseName ?? r.title ?? "—"}</td><td><StatusBadge status={r.status} /></td><td className="flex gap-2"><a className="text-primary" href={`/schedule?editId=${r.id}`}>Edit</a><form action={cancelScheduleSession}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-primary" message="Cancel this session?">Cancel</ConfirmSubmitButton></form><form action={archiveScheduleSession}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-primary" message="Archive this session?">Archive</ConfirmSubmitButton></form></td></tr>)}</tbody></DataTable>
    <Pager page={page} total={total} hrefFor={filterHref}/>
    <section className="mt-8 grid gap-6 lg:grid-cols-2"><div className="rounded-xl border bg-white p-4"><h3 className="font-semibold">Teacher availability</h3><p className="text-sm text-muted-foreground">Choose a teacher and date in filters.</p>{availabilityBookings.map(b => <p className="mt-2 text-sm" key={b.id}>{b.startTime}–{b.endTime}: {b.student.firstName} {b.student.lastName} ({b.enrollment?.courseName ?? "Session"})</p>)}{gaps.map(g => <p className="mt-2 text-sm text-emerald-700" key={`${g.startTime}-${g.endTime}`}>Available: {g.startTime}–{g.endTime}</p>)}</div><div className="rounded-xl border bg-white p-4"><h3 className="font-semibold">Student upcoming schedule</h3><p className="text-sm text-muted-foreground">Choose a student in filters.</p>{studentUpcoming.map(s => <p className="mt-2 text-sm" key={s.id}>{formatDate(s.sessionDate)} {s.startTime}–{s.endTime} with {s.teacher.fullName} ({s.enrollment?.courseName ?? "Session"})</p>)}</div></section>
  </AppShell>;
}
