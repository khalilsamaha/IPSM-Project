import Link from "next/link";
import { archiveTeacherAvailability, saveTeacherAvailability } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { LocalizedDateInput } from "@/components/localized-date-input";
import { AppShell, DataTable, PageHeader, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { formatDateForInput, formatDateShort } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import {
  buildTeacherSeasonCapacity,
  buildTeacherWeekCapacity,
  mondayOfIsoWeek,
  type SlotBooking,
  type SlotRule,
} from "@/lib/schedule/slot-planner";

type Params = {
  editId?: string;
  teacherId?: string;
  seasonId?: string;
  courseId?: string;
  weekStart?: string;
  status?: string;
};

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 86_400_000;

function addDays(value: string, daysToAdd: number) {
  return new Date(new Date(`${value}T00:00:00Z`).getTime() + daysToAdd * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function TeacherAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const [teachers, seasons, courses, assignments] = await Promise.all([
    prisma.teacher.findMany({
      where: { status: "ACTIVE" },
      orderBy: { fullName: "asc" },
    }),
    prisma.season.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE", "CLOSED"] } },
      orderBy: { startDate: "desc" },
    }),
    prisma.course.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.teacherCourse.findMany({
      where: { status: "ACTIVE", archivedAt: null },
      include: { course: true, level: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const teacherId = params.teacherId ?? teachers[0]?.id ?? "";
  const seasonId = params.seasonId ?? seasons[0]?.id ?? "";
  const selectedTeacher = teachers.find((teacher) => teacher.id === teacherId);
  const selectedSeason = seasons.find((season) => season.id === seasonId);
  const seasonStart = selectedSeason?.startDate.toISOString().slice(0, 10) ?? "";
  const seasonEnd = selectedSeason?.endDate.toISOString().slice(0, 10) ?? "";
  const requestedWeek = params.weekStart ?? (seasonStart || new Date().toISOString().slice(0, 10));
  const weekStart = mondayOfIsoWeek(requestedWeek);
  const status = params.status === "archived" ? "ARCHIVED" : "ACTIVE";

  const [rows, editRow, sessions, closures] = await Promise.all([
    teacherId
      ? prisma.teacherAvailability.findMany({
          where: {
            teacherId,
            status,
            AND: [
              ...(params.courseId
                ? [{ OR: [{ courseId: null }, { courseId: params.courseId }] }]
                : []),
              ...(seasonId
                ? [{ OR: [{ seasonId: null }, { seasonId }] }]
                : []),
            ],
          },
          include: { teacher: true, season: true, course: true },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
    params.editId
      ? prisma.teacherAvailability.findUnique({ where: { id: params.editId } })
      : Promise.resolve(null),
    teacherId && selectedSeason
      ? prisma.scheduleSession.findMany({
          where: {
            teacherId,
            archivedAt: null,
            sessionDate: { gte: selectedSeason.startDate, lte: selectedSeason.endDate },
            status: { in: ["SCHEDULED", "COMPLETED", "MISSED"] },
          },
          include: {
            student: { include: { family: true } },
            enrollment: { include: { course: true, level: true } },
            room: true,
          },
          orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
    selectedSeason
      ? prisma.schoolClosure.findMany({
          where: {
            archivedAt: null,
            startDate: { lte: selectedSeason.endDate },
            endDate: { gte: selectedSeason.startDate },
          },
          orderBy: { startDate: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const rules: SlotRule[] = rows
    .filter((row) => row.status === "ACTIVE" && !row.archivedAt)
    .map((row) => ({
      id: row.id,
      teacherId: row.teacherId,
      courseId: row.courseId,
      courseName: row.course?.name ?? null,
      seasonId: row.seasonId,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      effectiveFrom: row.effectiveFrom?.toISOString().slice(0, 10) ?? null,
      effectiveTo: row.effectiveTo?.toISOString().slice(0, 10) ?? null,
    }));
  const bookings: SlotBooking[] = sessions.map((lesson) => ({
    id: lesson.id,
    teacherId: lesson.teacherId,
    studentId: lesson.studentId,
    date: lesson.sessionDate.toISOString().slice(0, 10),
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    status: lesson.status,
    studentName: `${lesson.student.firstName} ${lesson.student.lastName}`,
    familyName: lesson.student.family.name,
    courseName: lesson.enrollment?.course?.name ?? lesson.enrollment?.courseName ?? lesson.title,
    levelName: lesson.enrollment?.level?.name ?? null,
    roomName: lesson.room?.name ?? null,
  }));
  const closureRows = closures.map((closure) => ({
    startDate: closure.startDate.toISOString().slice(0, 10),
    endDate: closure.endDate.toISOString().slice(0, 10),
    name: closure.name,
  }));
  const week = teacherId && selectedSeason
    ? buildTeacherWeekCapacity({
        teacherId,
        weekStart,
        seasonStart,
        seasonEnd,
        rules,
        bookings,
        closures: closureRows,
      })
    : [];
  const capacity = teacherId && selectedSeason
    ? buildTeacherSeasonCapacity({
        teacherId,
        seasonStart,
        seasonEnd,
        rules,
        bookings,
        closures: closureRows,
      })
    : { totalSlots: 0, bookedSlots: 0, availableSlots: 0, utilizationPercent: 0 };
  const assignedCourses = assignments.filter((assignment) => assignment.teacherId === teacherId);
  const editSeason = seasons.find((season) => season.id === editRow?.seasonId);

  return (
    <AppShell session={session}>
      <PageHeader
        title="Teacher Availability & Capacity"
        description="Review every 30-minute teaching slot, see booked students and courses, and manage seasonal availability from one operational calendar."
        action={
          <Link className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white" href="/register-student">
            Register and book student
          </Link>
        }
      />

      <form className="mb-5 grid gap-3 rounded-[1.5rem] border bg-white p-4 shadow-sm md:grid-cols-6">
        <label className="text-sm font-bold">Teacher<select name="teacherId" defaultValue={teacherId} className="input mt-1"><option value="">Choose teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
        <label className="text-sm font-bold">Season<select name="seasonId" defaultValue={seasonId} className="input mt-1"><option value="">Choose season</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
        <label className="text-sm font-bold">Course<select name="courseId" defaultValue={params.courseId ?? ""} className="input mt-1"><option value="">All assigned courses</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
        <LocalizedDateInput name="weekStart" label="Week containing" displayFormat="dd/mm/yyyy" defaultValue={weekStart} min={seasonStart || undefined} max={seasonEnd || undefined} className="input" />
        <label className="text-sm font-bold">Rules<select name="status" defaultValue={params.status ?? "active"} className="input mt-1"><option value="active">Active</option><option value="archived">Archived</option></select></label>
        <button className="btn-primary self-end">Load calendar</button>
      </form>

      {selectedTeacher && selectedSeason ? (
        <>
          <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Season capacity" value={`${capacity.totalSlots} sessions`} detail={`${selectedSeason.name} · 30-minute units`} />
            <Metric label="Booked" value={`${capacity.bookedSlots} sessions`} detail={`${capacity.utilizationPercent.toFixed(1)}% utilized`} />
            <Metric label="Available" value={`${capacity.availableSlots} sessions`} detail="Unbooked season capacity" />
            <Metric label="Weekly rules" value={`${rules.length}`} detail={`${selectedTeacher.fullName}`} />
          </section>

          <section className="mb-6 rounded-[1.5rem] border bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-black">30-minute weekly calendar</h2><p className="text-sm text-slate-600">Green is available. Red identifies the booked student. Closed dates are gray.</p></div>
              <div className="flex gap-2">
                <Link className="btn-secondary" href={`/teacher-availability?teacherId=${teacherId}&seasonId=${seasonId}&courseId=${params.courseId ?? ""}&weekStart=${addDays(weekStart, -7)}`}>Previous week</Link>
                <Link className="btn-secondary" href={`/teacher-availability?teacherId=${teacherId}&seasonId=${seasonId}&courseId=${params.courseId ?? ""}&weekStart=${addDays(weekStart, 7)}`}>Next week</Link>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              {week.map((day) => (
                <article key={day.date} className="rounded-2xl border bg-slate-50 p-3">
                  <div className="mb-3"><p className="font-black">{days[day.dayOfWeek]}</p><p className="text-xs text-slate-500">{displayDate(day.date)}</p></div>
                  <div className="space-y-2">
                    {day.slots.map((slot) => (
                      <div key={slot.key} className={`rounded-xl border p-3 text-xs ${slot.status === "AVAILABLE" ? "border-emerald-300 bg-emerald-50 text-emerald-950" : slot.status === "BOOKED" ? "border-red-300 bg-red-50 text-red-950" : "border-slate-300 bg-slate-200 text-slate-700"}`}>
                        <p className="font-black">{slot.startTime}–{slot.endTime}</p>
                        <p className="mt-1 font-bold">{slot.status === "AVAILABLE" ? "Available" : slot.status === "CLOSED" ? slot.closureName ?? "School closed" : "Booked"}</p>
                        {slot.status === "AVAILABLE" ? <p className="mt-1">{slot.courseLabels.join(", ")}</p> : null}
                        {slot.bookings.map((booking) => <div key={booking.id} className="mt-2 border-t border-red-200 pt-2"><b>{booking.studentName}</b><br />{booking.familyName}<br />{booking.courseName}{booking.levelName ? ` / ${booking.levelName}` : ""}{booking.roomName ? <><br />{booking.roomName}</> : null}</div>)}
                      </div>
                    ))}
                    {!day.slots.length ? <p className="rounded-xl border border-dashed p-3 text-xs text-slate-500">No availability rule.</p> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">Choose a teacher and season to view capacity and bookings.</p>
      )}

      {isAdminOrHigher(session.role) ? (
        <form action={saveTeacherAvailability} className="mb-6 rounded-[1.5rem] border bg-white p-5 shadow-sm">
          <div className="mb-4"><h2 className="text-lg font-black">{editRow ? "Edit availability rule" : "Add availability rule"}</h2><p className="text-sm text-slate-600">Course is limited to the teacher's active assignments. Seasonal dates must remain inside the selected season and match the chosen weekday.</p></div>
          {editRow ? <input type="hidden" name="id" value={editRow.id} /> : null}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-bold">Teacher *<select name="teacherId" required defaultValue={editRow?.teacherId ?? teacherId} className="input mt-1"><option value="" disabled>Choose teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></label>
            <label className="text-sm font-bold">Assigned course<select name="courseId" defaultValue={editRow?.courseId ?? params.courseId ?? ""} className="input mt-1"><option value="">All assigned courses</option>{assignedCourses.map((assignment) => <option key={assignment.id} value={assignment.courseId}>{assignment.course.name}{assignment.level ? ` / ${assignment.level.name}` : " / All levels"}</option>)}</select></label>
            <label className="text-sm font-bold">Season *<select name="seasonId" required defaultValue={editRow?.seasonId ?? seasonId} className="input mt-1"><option value="" disabled>Choose season</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
            <label className="text-sm font-bold">Teaching day *<select name="dayOfWeek" defaultValue={editRow?.dayOfWeek ?? 3} className="input mt-1">{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <label className="text-sm font-bold">Available from *<input name="startTime" type="time" step="1800" required defaultValue={editRow?.startTime ?? "09:00"} className="input mt-1" /></label>
            <label className="text-sm font-bold">Available until *<input name="endTime" type="time" step="1800" required defaultValue={editRow?.endTime ?? "10:00"} className="input mt-1" /></label>
            <LocalizedDateInput name="effectiveFrom" label="Effective first occurrence" displayFormat="dd/mm/yyyy" defaultValue={editRow?.effectiveFrom ? formatDateForInput(editRow.effectiveFrom) : seasonStart} min={editSeason?.startDate.toISOString().slice(0, 10) ?? seasonStart} max={editSeason?.endDate.toISOString().slice(0, 10) ?? seasonEnd} required className="input" />
            <LocalizedDateInput name="effectiveTo" label="Effective final occurrence" displayFormat="dd/mm/yyyy" defaultValue={editRow?.effectiveTo ? formatDateForInput(editRow.effectiveTo) : seasonEnd} min={editSeason?.startDate.toISOString().slice(0, 10) ?? seasonStart} max={editSeason?.endDate.toISOString().slice(0, 10) ?? seasonEnd} required className="input" />
            <label className="text-sm font-bold">Status<select name="status" defaultValue={editRow?.status ?? "ACTIVE"} className="input mt-1"><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></select></label>
            <label className="text-sm font-bold lg:col-span-2">Notes<input name="notes" defaultValue={editRow?.notes ?? ""} className="input mt-1" placeholder="Optional operational note" /></label>
            <button className="btn-primary self-end">{editRow ? "Update rule" : "Add rule"}</button>
          </div>
        </form>
      ) : null}

      <section className="mb-6 rounded-[1.5rem] border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-black">Season bookings</h2>
        <DataTable>
          <thead><tr><th>Date</th><th>Time</th><th>Student</th><th>Family</th><th>Course</th><th>Room</th><th>Status</th></tr></thead>
          <tbody>
            {sessions.map((lesson) => (
              <tr key={lesson.id}>
                <td>{formatDateShort(lesson.sessionDate)}</td>
                <td>{lesson.startTime}–{lesson.endTime}</td>
                <td className="font-bold">{lesson.student.firstName} {lesson.student.lastName}</td>
                <td>{lesson.student.family.name}</td>
                <td>{lesson.enrollment?.course?.name ?? lesson.enrollment?.courseName ?? lesson.title}{lesson.enrollment?.level?.name ? ` / ${lesson.enrollment.level.name}` : ""}</td>
                <td>{lesson.room?.name ?? "—"}</td>
                <td><StatusBadge status={lesson.status} /></td>
              </tr>
            ))}
            {!sessions.length ? <tr><td colSpan={7}>No booked sessions in this season.</td></tr> : null}
          </tbody>
        </DataTable>
      </section>

      <section className="rounded-[1.5rem] border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-black">Availability rules</h2>
        <DataTable>
          <thead><tr><th>Course</th><th>Day</th><th>Time</th><th>Season</th><th>Effective period</th><th>30-min slots</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const [startHour, startMinute] = row.startTime.split(":").map(Number);
              const [endHour, endMinute] = row.endTime.split(":").map(Number);
              const slots = Math.max(0, Math.floor(((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 30));
              return (
                <tr key={row.id}>
                  <td>{row.course?.name ?? "All assigned courses"}</td>
                  <td>{days[row.dayOfWeek]}</td>
                  <td>{row.startTime}–{row.endTime}</td>
                  <td>{row.season?.name ?? "All seasons"}</td>
                  <td>{row.effectiveFrom ? formatDateShort(row.effectiveFrom) : "—"} to {row.effectiveTo ? formatDateShort(row.effectiveTo) : "—"}</td>
                  <td>{slots}</td>
                  <td><StatusBadge status={row.status} /></td>
                  <td className="flex gap-3">{isAdminOrHigher(session.role) ? <><Link className="text-primary" href={`/teacher-availability?teacherId=${teacherId}&seasonId=${seasonId}&editId=${row.id}`}>Edit</Link><form action={archiveTeacherAvailability}><input type="hidden" name="id" value={row.id} /><ConfirmSubmitButton className="text-primary" message="Archive this availability rule?">Archive</ConfirmSubmitButton></form></> : <span>Read only</span>}</td>
                </tr>
              );
            })}
            {!rows.length ? <tr><td colSpan={8}>No availability rules match the filters.</td></tr> : null}
          </tbody>
        </DataTable>
      </section>
    </AppShell>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-[1.25rem] border bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>;
}
