import Link from "next/link";
import { CalendarDays, Clock, Printer, Search, Sparkles, Users } from "lucide-react";
import { archiveScheduleSession, cancelScheduleSession, saveScheduleSession } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, DataTable, Pager, PageHeader, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { getPagination } from "@/lib/records/pagination";
import { formatDate } from "@/lib/records/format";
import { getAvailableGaps, minutesFromTime, timeWindowsOverlap } from "@/lib/schedule/validation";

const dayMs = 24 * 60 * 60 * 1000;
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const timeSlots = Array.from({ length: 15 }, (_, index) => 7 + index);
const palette = [
  "border-blue-200 bg-blue-50 text-blue-950",
  "border-violet-200 bg-violet-50 text-violet-950",
  "border-cyan-200 bg-cyan-50 text-cyan-950",
  "border-emerald-200 bg-emerald-50 text-emerald-950",
  "border-amber-200 bg-amber-50 text-amber-950",
  "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950",
];

type SearchParams = { page?: string; teacherId?: string; studentId?: string; date?: string; seasonId?: string; course?: string; editId?: string; view?: string };
type ScheduleRow = Awaited<ReturnType<typeof getScheduleRows>>[number];

async function getScheduleRows(where: Record<string, unknown>, skip?: number, take?: number) {
  return prisma.scheduleSession.findMany({
    where,
    include: { student: { include: { family: true } }, teacher: true, enrollment: true, season: true },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    skip,
    take,
  });
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(value?: string) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date();
  const day = base.getDay() || 7;
  const monday = new Date(base);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(base.getDate() - day + 1);
  return monday;
}

function hrefWith(params: SearchParams, updates: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries({ ...params, ...updates }).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const qs = query.toString();
  return qs ? `/schedule?${qs}` : "/schedule";
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function hoursBetween(startTime: string, endTime: string) {
  return Math.max(0, (minutesFromTime(endTime) - minutesFromTime(startTime)) / 60);
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();
  const params = await searchParams;
  const view = params.view ?? "calendar";
  const { page, skip, take } = getPagination(params);
  const weekStart = getWeekStart(params.date);
  const weekDates = Array.from({ length: 7 }, (_, index) => new Date(weekStart.getTime() + index * dayMs));
  const weekEnd = new Date(weekStart.getTime() + 6 * dayMs);
  const selectedDate = params.date ?? dateKey(new Date());

  const where: any = { archivedAt: null };
  if (params.teacherId) where.teacherId = params.teacherId;
  if (params.studentId) where.studentId = params.studentId;
  if (params.seasonId) where.seasonId = params.seasonId;
  if (params.date && view === "list") where.sessionDate = new Date(params.date);
  if (params.course) where.enrollment = { courseName: { contains: params.course, mode: "insensitive" } };

  const calendarWhere = { ...where, ...(view === "list" ? {} : { sessionDate: { gte: weekStart, lte: weekEnd } }) };
  if (view !== "list") delete calendarWhere.sessionDate;
  if (view !== "list") calendarWhere.sessionDate = { gte: weekStart, lte: weekEnd };

  const [rows, total, weekRows, students, teachers, seasons, enrollments, editSession] = await Promise.all([
    getScheduleRows(where, skip, take),
    prisma.scheduleSession.count({ where }),
    getScheduleRows(calendarWhere),
    prisma.student.findMany({ where: { status: "ACTIVE" }, include: { family: true, enrollments: { include: { season: true, teacher: true }, where: { status: "ACTIVE" } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.teacher.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.season.findMany({ where: { status: { in: ["PLANNED", "ACTIVE"] } }, orderBy: { startDate: "desc" } }),
    prisma.enrollment.findMany({ where: { status: "ACTIVE" }, include: { student: true, season: true, teacher: true }, orderBy: { courseName: "asc" } }),
    params.editId ? prisma.scheduleSession.findUnique({ where: { id: params.editId } }) : Promise.resolve(null),
  ]);

  const selectedDayRows = weekRows.filter((row) => dateKey(row.sessionDate) === selectedDate);
  const teacherRows = params.teacherId ? weekRows.filter((row) => row.teacherId === params.teacherId) : weekRows;
  const teacherGaps = params.teacherId ? getAvailableGaps(teacherRows.filter((row) => dateKey(row.sessionDate) === selectedDate && row.status !== "CANCELLED").map((row) => ({ startTime: row.startTime, endTime: row.endTime })), "07:00", "21:00") : [];
  const studentUpcoming = params.studentId ? await getScheduleRows({ studentId: params.studentId, archivedAt: null, status: "SCHEDULED", sessionDate: { gte: new Date() } }, 0, 25) : [];
  const totalHours = weekRows.filter((row) => row.status !== "CANCELLED").reduce((sum, row) => sum + hoursBetween(row.startTime, row.endTime), 0);

  return <AppShell session={session}>
    <PageHeader title="Schedule" description="Calendar-first scheduling for lessons, teacher availability, student timetables, and front-desk changes." action={<Link className="rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm" href="#session-form">Add Session</Link>} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-5">
        <ScheduleTabs params={params} view={view} />
        <ScheduleFilters params={params} teachers={teachers} students={students} seasons={seasons} weekStart={weekStart} />
        <section className="grid gap-4 sm:grid-cols-3">
          <Metric label="Sessions this week" value={String(weekRows.length)} />
          <Metric label="Teaching hours" value={totalHours.toFixed(1)} />
          <Metric label="Selected day" value={formatDate(new Date(selectedDate))} />
        </section>
        {view === "calendar" ? <CalendarGrid rows={weekRows} weekDates={weekDates} params={params} /> : null}
        {view === "teacher" ? <TeacherView rows={teacherRows} teacherSelected={Boolean(params.teacherId)} selectedDate={selectedDate} gaps={teacherGaps} /> : null}
        {view === "student" ? <StudentView rows={studentUpcoming} studentSelected={Boolean(params.studentId)} /> : null}
        {view === "list" ? <ListView rows={rows} total={total} page={page} params={params} /> : null}
        <SessionForm editSession={editSession} students={students} teachers={teachers} seasons={seasons} enrollments={enrollments} params={params} />
      </div>
      <DaySummaryPanel params={params} weekDates={weekDates} selectedDate={selectedDate} rows={selectedDayRows} />
    </div>
  </AppShell>;
}

function ScheduleTabs({ params, view }: { params: SearchParams; view: string }) {
  const tabs = [["calendar", "Calendar"], ["teacher", "Teacher View"], ["student", "Student View"], ["list", "List View"]];
  return <nav className="flex flex-wrap gap-2 rounded-[1.5rem] border bg-white p-2 shadow-sm">{tabs.map(([id, label]) => <Link key={id} className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${view === id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`} href={hrefWith(params, { view: id, page: undefined })}>{label}</Link>)}</nav>;
}

function ScheduleFilters({ params, teachers, students, seasons, weekStart }: { params: SearchParams; teachers: any[]; students: any[]; seasons: any[]; weekStart: Date }) {
  return <form className="grid gap-3 rounded-[1.5rem] border bg-white p-4 shadow-sm md:grid-cols-6">
    <input type="hidden" name="view" value={params.view ?? "calendar"} />
    <label className="text-xs font-bold uppercase text-slate-500">Teacher<select name="teacherId" defaultValue={params.teacherId ?? ""} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-medium normal-case"><option value="">All teachers</option>{teachers.map((t) => <option value={t.id} key={t.id}>{t.fullName}</option>)}</select></label>
    <label className="text-xs font-bold uppercase text-slate-500">Student<select name="studentId" defaultValue={params.studentId ?? ""} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-medium normal-case"><option value="">All students</option>{students.map((s) => <option value={s.id} key={s.id}>{s.firstName} {s.lastName}</option>)}</select></label>
    <label className="text-xs font-bold uppercase text-slate-500">Season<select name="seasonId" defaultValue={params.seasonId ?? ""} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-medium normal-case"><option value="">All seasons</option>{seasons.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
    <label className="text-xs font-bold uppercase text-slate-500">Week / date<input name="date" type="date" defaultValue={params.date ?? dateKey(weekStart)} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-medium normal-case" /></label>
    <label className="text-xs font-bold uppercase text-slate-500">Course<input name="course" placeholder="Course" defaultValue={params.course} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-medium normal-case" /></label>
    <button className="self-end rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"><Search className="mr-2 inline size-4" />Filter</button>
  </form>;
}

function Metric({ label, value }: { label: string; value: string }) { return <article className="rounded-[1.25rem] border bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></article>; }

function CalendarGrid({ rows, weekDates, params }: { rows: ScheduleRow[]; weekDates: Date[]; params: SearchParams }) {
  return <section className="overflow-hidden rounded-[1.5rem] border bg-white shadow-sm"><div className="grid grid-cols-[4.5rem_repeat(7,minmax(9rem,1fr))] border-b bg-slate-50"><div className="p-3 text-xs font-bold uppercase text-slate-500">Time</div>{weekDates.map((date, index) => <Link href={hrefWith(params, { date: dateKey(date) })} key={dateKey(date)} className="border-l p-3 text-sm font-black hover:bg-blue-50"><span className="text-slate-500">{weekDays[index]}</span><br />{date.getDate()}</Link>)}</div><div className="grid grid-cols-[4.5rem_repeat(7,minmax(9rem,1fr))]">{timeSlots.map((hour) => <TimeRow key={hour} hour={hour} weekDates={weekDates} rows={rows} />)}</div></section>;
}

function TimeRow({ hour, weekDates, rows }: { hour: number; weekDates: Date[]; rows: ScheduleRow[] }) {
  return <>{<div className="border-b p-2 text-xs font-bold text-slate-500">{formatTime(`${String(hour).padStart(2, "0")}:00`)}</div>}{weekDates.map((date) => <div key={`${dateKey(date)}-${hour}`} className="min-h-24 border-b border-l bg-white/70 p-1.5">{rows.filter((row) => dateKey(row.sessionDate) === dateKey(date) && minutesFromTime(row.startTime) >= hour * 60 && minutesFromTime(row.startTime) < (hour + 1) * 60).map((row) => <CalendarEventCard key={row.id} row={row} compact />)}</div>)}</>;
}

function CalendarEventCard({ row, compact = false }: { row: ScheduleRow; compact?: boolean }) {
  const color = palette[Math.abs(row.teacherId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palette.length];
  return <article className={`mb-1 rounded-xl border p-2 text-xs shadow-sm ${color} ${row.status === "CANCELLED" ? "opacity-60 line-through" : ""}`}><div className="flex items-start justify-between gap-2"><p className="font-black">{row.enrollment?.courseName ?? row.title ?? "Session"}</p><Link className="font-bold text-blue-700" href={`/schedule?editId=${row.id}`}>Edit</Link></div><p className="mt-1 font-semibold">{formatTime(row.startTime)}–{formatTime(row.endTime)}</p>{!compact ? null : <><p>{row.student.firstName} {row.student.lastName}</p><p>{row.teacher.fullName}</p><StatusBadge status={row.status} /></>}</article>;
}

function TeacherView({ rows, teacherSelected, selectedDate, gaps }: { rows: ScheduleRow[]; teacherSelected: boolean; selectedDate: string; gaps: { startTime: string; endTime: string }[] }) {
  const conflicts = rows.filter((row, _, all) => all.some((other) => other.id !== row.id && dateKey(other.sessionDate) === dateKey(row.sessionDate) && row.status !== "CANCELLED" && other.status !== "CANCELLED" && timeWindowsOverlap(row, other)));
  if (!teacherSelected) return <EmptyCard title="Select a teacher" description="Choose a teacher to review their week, available gaps, and any double-booked blocks." />;
  if (!rows.length) return <EmptyCard title="No sessions found for this teacher" description="This teacher has no matching sessions for the selected filters." />;
  return <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-[1.5rem] border bg-white p-5 shadow-sm"><h3 className="text-lg font-black">Teacher week</h3>{rows.map((row) => <CalendarEventCard key={row.id} row={row} />)}</div><div className="rounded-[1.5rem] border bg-white p-5 shadow-sm"><h3 className="text-lg font-black">Availability on {formatDate(new Date(selectedDate))}</h3>{gaps.map((gap) => <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700" key={`${gap.startTime}-${gap.endTime}`}>Available: {formatTime(gap.startTime)}–{formatTime(gap.endTime)}</p>)}{conflicts.map((row) => <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700" key={row.id}>Double-booked: {formatDate(row.sessionDate)} {formatTime(row.startTime)}–{formatTime(row.endTime)}</p>)}</div></section>;
}

function StudentView({ rows, studentSelected }: { rows: ScheduleRow[]; studentSelected: boolean }) {
  if (!studentSelected) return <EmptyCard title="Select a student" description="Choose a student to see their upcoming schedule." />;
  if (!rows.length) return <EmptyCard title="No sessions found for this student" description="No upcoming scheduled lessons match this student." />;
  return <div className="rounded-[1.5rem] border bg-white p-5 shadow-sm"><h3 className="mb-3 text-lg font-black">Upcoming student schedule</h3>{rows.map((row) => <div className="mb-3 rounded-2xl border p-4" key={row.id}><p className="font-black">{row.enrollment?.courseName ?? row.title ?? "Session"}</p><p className="text-sm text-slate-600">{formatDate(row.sessionDate)} · {formatTime(row.startTime)}–{formatTime(row.endTime)} · {row.teacher.fullName}</p><StatusBadge status={row.status} /></div>)}</div>;
}

function ListView({ rows, total, page, params }: { rows: ScheduleRow[]; total: number; page: number; params: SearchParams }) {
  const filterHref = (p: number) => hrefWith(params, { page: p > 1 ? String(p) : undefined });
  return <><DataTable><thead><tr><th>Date</th><th>Time</th><th>Student</th><th>Family</th><th>Teacher</th><th>Course</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{formatDate(r.sessionDate)}</td><td>{r.startTime}–{r.endTime}</td><td>{r.student.firstName} {r.student.lastName}</td><td>{r.student.family.name}</td><td>{r.teacher.fullName}</td><td>{r.enrollment?.courseName ?? r.title ?? "—"}</td><td><StatusBadge status={r.status} /></td><td className="flex gap-2"><Link className="text-primary" href={`/schedule?editId=${r.id}`}>Edit</Link><form action={cancelScheduleSession}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-primary" message="Cancel this session?">Cancel</ConfirmSubmitButton></form><form action={archiveScheduleSession}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-primary" message="Archive this session?">Archive</ConfirmSubmitButton></form></td></tr>)}</tbody></DataTable><Pager page={page} total={total} hrefFor={filterHref}/></>;
}

function SessionForm({ editSession, students, teachers, seasons, enrollments, params }: { editSession: any; students: any[]; teachers: any[]; seasons: any[]; enrollments: any[]; params: SearchParams }) {
  return <form id="session-form" action={saveScheduleSession} className="grid gap-4 rounded-[1.5rem] border bg-white p-5 shadow-sm md:grid-cols-4"><div className="md:col-span-4"><h3 className="text-lg font-black">{editSession ? "Edit session" : "Add session"}</h3><p className="text-sm text-slate-500">Validation still prevents teacher/student double-booking and end times before start times.</p></div>{editSession ? <input type="hidden" name="id" value={editSession.id} /> : null}<input name="title" placeholder="Optional title" defaultValue={editSession?.title ?? ""} className="rounded-xl border p-2.5" /><select name="studentId" required defaultValue={editSession?.studentId ?? ""} className="rounded-xl border p-2.5"><option value="" disabled>Student</option>{students.map((s) => <option value={s.id} key={s.id}>{s.firstName} {s.lastName} ({s.family.name})</option>)}</select><select name="enrollmentId" defaultValue={editSession?.enrollmentId ?? ""} className="rounded-xl border p-2.5"><option value="">Enrollment</option>{enrollments.map((e) => <option value={e.id} key={e.id}>{e.student.firstName} {e.student.lastName} — {e.courseName}</option>)}</select><select name="teacherId" required defaultValue={editSession?.teacherId ?? ""} className="rounded-xl border p-2.5"><option value="" disabled>Teacher</option>{teachers.map((t) => <option value={t.id} key={t.id}>{t.fullName}</option>)}</select><select name="seasonId" defaultValue={editSession?.seasonId ?? ""} className="rounded-xl border p-2.5"><option value="">Season</option>{seasons.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select><input name="sessionDate" required type="date" defaultValue={editSession?.sessionDate.toISOString().slice(0, 10) ?? params.date} className="rounded-xl border p-2.5" /><input name="startTime" required type="time" defaultValue={editSession?.startTime} className="rounded-xl border p-2.5" /><input name="endTime" required type="time" defaultValue={editSession?.endTime} className="rounded-xl border p-2.5" /><select name="status" defaultValue={editSession?.status ?? "SCHEDULED"} className="rounded-xl border p-2.5">{["SCHEDULED", "COMPLETED", "CANCELLED", "MISSED"].map((status) => <option key={status}>{status}</option>)}</select><textarea name="notes" placeholder="Notes" defaultValue={editSession?.notes ?? ""} className="rounded-xl border p-2.5 md:col-span-3" /><div className="flex gap-2"><button className="rounded-xl bg-primary px-4 py-2.5 font-bold text-white">{editSession ? "Update" : "Add"}</button><Link className="rounded-xl border px-4 py-2.5 font-bold" href={hrefWith(params, { editId: undefined })}>Cancel</Link></div></form>;
}

function DaySummaryPanel({ params, weekDates, selectedDate, rows }: { params: SearchParams; weekDates: Date[]; selectedDate: string; rows: ScheduleRow[] }) {
  return <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start"><section className="rounded-[1.5rem] border bg-white p-5 shadow-sm"><h3 className="mb-3 flex items-center gap-2 font-black"><CalendarDays className="size-4 text-blue-600" />Selected week</h3><div className="grid grid-cols-7 gap-1">{weekDates.map((date) => <Link href={hrefWith(params, { date: dateKey(date) })} key={dateKey(date)} className={`rounded-xl p-2 text-center text-xs font-black ${dateKey(date) === selectedDate ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{date.getDate()}</Link>)}</div></section><section className="rounded-[1.5rem] border bg-white p-5 shadow-sm"><h3 className="font-black">{formatDate(new Date(selectedDate))}</h3>{rows.length ? rows.map((row) => <CalendarEventCard key={row.id} row={row} />) : <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No sessions scheduled for this day</p>}</section><section className="rounded-[1.5rem] border bg-white p-5 shadow-sm"><h3 className="mb-3 font-black">Quick actions</h3><div className="grid gap-2"><Link className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white" href="#session-form"><Sparkles className="mr-2 inline size-4" />Add Session</Link><Link className="rounded-xl border px-3 py-2 text-sm font-bold" href={hrefWith(params, { view: "teacher" })}><Clock className="mr-2 inline size-4" />Check Availability</Link><button className="rounded-xl border px-3 py-2 text-left text-sm font-bold" type="button"><Printer className="mr-2 inline size-4" />Print Schedule</button></div></section></aside>;
}

function EmptyCard({ title, description }: { title: string; description: string }) { return <div className="rounded-[1.5rem] border border-dashed bg-white p-10 text-center shadow-sm"><Users className="mx-auto mb-3 size-8 text-blue-500" /><p className="font-black">{title}</p><p className="mt-1 text-sm text-slate-500">{description}</p></div>; }
