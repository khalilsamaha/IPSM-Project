import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveTeacher,
  archiveTeacherAvailability,
  archiveTeacherCourse,
  deleteTeacherPermanently,
  restoreTeacher,
  restoreTeacherCourse,
  saveTeacherAvailability,
  saveTeacherCourse,
} from "@/actions/records";
import { LocalizedDateInput } from "@/components/localized-date-input";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, StatusBadge } from "@/components/records/shell";
import { TeacherProfileForm } from "@/components/teachers/teacher-profile-form";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatCurrencyInput, formatDate } from "@/lib/records/format";
import { hoursForWindow } from "@/lib/schedule/validation";
import { getTeacherDeletionPreview } from "@/lib/deletion/entity-deletion";
import { DeletionPanel } from "@/components/deletion/deletion-panel";
import { isAdminOrHigher } from "@/lib/auth/roles";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Params = { id: string };
type SearchParams = { error?: string; success?: string };

export default async function TeacherEditPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, requireSession()]);
  const [teacher, courses, levels, seasons, bookings, unpaidCompleted, payrollHistory, deletionPreview] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id },
      include: {
        courses: {
          include: { course: true, level: true },
          orderBy: { createdAt: "desc" },
        },
        availability: {
          include: { season: true },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
      },
    }),
    prisma.course.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.courseLevel.findMany({ where: { status: "ACTIVE" }, orderBy: { order: "asc" } }),
    prisma.season.findMany({ orderBy: { startDate: "desc" } }),
    prisma.scheduleSession.findMany({
      where: { teacherId: id, archivedAt: null, status: { in: ["SCHEDULED", "COMPLETED", "MISSED"] } },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
      take: 20,
      include: { student: true },
    }),
    prisma.scheduleSession.findMany({
      where: { teacherId: id, status: "COMPLETED", archivedAt: null, payrollItems: { none: {} } },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
      include: { student: true },
    }),
    prisma.teacherPayroll.findMany({ where: { teacherId: id }, orderBy: { periodEnd: "desc" }, take: 10 }),
    getTeacherDeletionPreview(id),
  ]);

  if (!teacher) notFound();

  const activeAvailability = teacher.availability.filter((row) => row.status === "ACTIVE" && !row.archivedAt);
  const availableHours = activeAvailability.reduce((sum, row) => sum + hoursForWindow(row), 0);
  const bookedHours = bookings.reduce((sum, row) => sum + hoursForWindow(row), 0);
  const lastPayroll = payrollHistory[0];
  const totalPaidCents = payrollHistory
    .filter((row) => row.status === "PAID")
    .reduce((sum, row) => sum + row.grossAmountCents, 0);
  const activeRateCents = teacher.compensationBasis === "SESSION_UNIT"
    ? teacher.sessionRateCents ?? 0
    : teacher.hourlyRateCents;
  const activeRateLabel = teacher.compensationBasis === "SESSION_UNIT"
    ? "per 30-minute lesson"
    : "per hour";

  return (
    <AppShell session={session}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Teacher Profile</h2>
          <p className="text-sm text-muted-foreground">
            Personal information, compensation, courses, availability and payroll history in one place.
          </p>
        </div>
        <Link href="/teachers" className="rounded border px-4 py-2">Back to teachers</Link>
      </div>

      {query.error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
          {query.error}
        </div>
      ) : null}
      {query.success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800" role="status">
          {query.success}
        </div>
      ) : null}

      <section className="mb-6 rounded-xl border bg-white p-5">
        <div className="mb-4">
          <h3 className="font-black">Personal information and payroll rate</h3>
          <p className="text-sm text-muted-foreground">
            Every field is labeled below. Session-based compensation always means one saved rate for one 30-minute lesson.
          </p>
        </div>
        <TeacherProfileForm
          teacher={{
            id: teacher.id,
            fullName: teacher.fullName,
            email: teacher.email,
            phone: teacher.phone,
            compensationBasis: teacher.compensationBasis,
            hourlyRate: formatCurrencyInput(teacher.hourlyRateCents),
            sessionRate: formatCurrencyInput(teacher.sessionRateCents ?? 0),
            status: teacher.status,
            notes: teacher.notes,
          }}
        />
      </section>

      <section className="mb-6 rounded-xl border bg-white p-5">
        <h3 className="mb-3 font-black">Payroll summary</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded bg-slate-50 p-3">
            <b>{formatCurrency(activeRateCents)}</b>
            <p className="text-xs">current rate {activeRateLabel}</p>
          </div>
          <div className="rounded bg-slate-50 p-3">
            <b>{unpaidCompleted.length}</b>
            <p className="text-xs">completed unpaid lessons</p>
          </div>
          <div className="rounded bg-slate-50 p-3">
            <b>{lastPayroll ? formatDate(lastPayroll.periodEnd) : "—"}</b>
            <p className="text-xs">last payroll</p>
          </div>
          <div className="rounded bg-slate-50 p-3">
            <b>{formatCurrency(totalPaidCents)}</b>
            <p className="text-xs">total paid in shown history</p>
          </div>
          <Link className="rounded bg-slate-950 p-3 text-sm font-bold text-white" href={`/payroll/new?teacherId=${teacher.id}`}>
            Create payroll
          </Link>
        </div>
        <h4 className="mt-4 font-bold">Payroll history</h4>
        <ul className="mt-2 space-y-1 text-sm">
          {payrollHistory.map((row) => (
            <li key={row.id}>
              <Link className="text-primary" href={`/payroll/${row.id}`}>
                {formatDate(row.periodStart)}–{formatDate(row.periodEnd)} · {row.status} · {formatCurrency(row.grossAmountCents)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 rounded-xl border bg-white p-5">
        <h3 className="mb-3 font-black">Courses / instruments taught</h3>
        <form action={saveTeacherCourse} className="mb-4 grid gap-3 md:grid-cols-4">
          <input type="hidden" name="teacherId" value={teacher.id} />
          <select name="courseId" required className="rounded border p-2">
            <option value="">Course</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
          <select name="levelId" className="rounded border p-2">
            <option value="">Any level</option>
            {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
          </select>
          <select name="status" className="rounded border p-2">
            <option>ACTIVE</option><option>ARCHIVED</option>
          </select>
          <button className="rounded bg-primary px-4 py-2 text-white">Add course</button>
        </form>
        <div className="grid gap-2">
          {teacher.courses.map((course) => (
            <div key={course.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
              <span>{course.course.name} — {course.level?.name ?? "Any level"} <StatusBadge status={course.status} /></span>
              {course.status === "ACTIVE" ? (
                <form action={archiveTeacherCourse}>
                  <input type="hidden" name="id" value={course.id} />
                  <ConfirmSubmitButton className="text-primary" message="Archive this teacher course?">Archive</ConfirmSubmitButton>
                </form>
              ) : (
                <form action={restoreTeacherCourse}>
                  <input type="hidden" name="id" value={course.id} />
                  <ConfirmSubmitButton className="text-primary" message="Restore this teacher course?">Restore</ConfirmSubmitButton>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-xl border bg-white p-5">
        <h3 className="mb-3 font-black">Availability</h3>
        <form action={saveTeacherAvailability} className="mb-4 grid gap-3 md:grid-cols-4 lg:grid-cols-7">
          <input type="hidden" name="teacherId" value={teacher.id} />
          <select name="dayOfWeek" className="rounded border p-2">
            {days.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
          <input name="startTime" type="time" required className="rounded border p-2" />
          <input name="endTime" type="time" required className="rounded border p-2" />
          <select name="seasonId" className="rounded border p-2">
            <option value="">Any season</option>
            {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
          </select>
          <LocalizedDateInput name="effectiveFrom" label="Effective from" displayFormat="dd/mm/yyyy" className="rounded border p-2" />
          <LocalizedDateInput name="effectiveTo" label="Effective to" displayFormat="dd/mm/yyyy" className="rounded border p-2" />
          <select name="status" className="rounded border p-2"><option>ACTIVE</option><option>ARCHIVED</option></select>
          <input name="notes" placeholder="Notes" className="rounded border p-2 md:col-span-3" />
          <button className="rounded bg-primary px-4 py-2 text-white">Add availability</button>
        </form>
        <div className="grid gap-2">
          {teacher.availability.map((availability) => (
            <div key={availability.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
              <span>{days[availability.dayOfWeek]} {availability.startTime}-{availability.endTime} · {availability.season?.name ?? "Any season"} <StatusBadge status={availability.status} /></span>
              {availability.status === "ACTIVE" ? (
                <form action={archiveTeacherAvailability}>
                  <input type="hidden" name="id" value={availability.id} />
                  <ConfirmSubmitButton className="text-primary" message="Archive this availability?">Archive</ConfirmSubmitButton>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="mb-6 flex gap-3">
        {teacher.status === "ARCHIVED" ? (
          <form action={restoreTeacher}>
            <input type="hidden" name="id" value={teacher.id} />
            <ConfirmSubmitButton className="text-primary" message="Restore this teacher?">Restore</ConfirmSubmitButton>
          </form>
        ) : (
          <form action={archiveTeacher}>
            <input type="hidden" name="id" value={teacher.id} />
            <ConfirmSubmitButton className="text-primary" message="Archive this teacher? Teaching and payroll history will be preserved.">Archive</ConfirmSubmitButton>
          </form>
        )}
      </div>

      {deletionPreview && isAdminOrHigher(session.role) ? (
        <div className="mb-6"><DeletionPanel preview={deletionPreview} action={deleteTeacherPermanently} /></div>
      ) : null}

      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-3 font-black">Availability summary</h3>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded bg-slate-50 p-3"><b>{availableHours.toFixed(1)}</b><p className="text-xs">available hours in rules</p></div>
          <div className="rounded bg-slate-50 p-3"><b>{bookedHours.toFixed(1)}</b><p className="text-xs">booked hours shown</p></div>
          <div className="rounded bg-slate-50 p-3"><b>{Math.max(0, availableHours - bookedHours).toFixed(1)}</b><p className="text-xs">remaining hours estimate</p></div>
        </div>
        <h4 className="font-bold">Upcoming/booked sessions</h4>
        <ul className="mt-2 space-y-1 text-sm">
          {bookings.map((booking) => (
            <li key={booking.id}>{formatDate(booking.sessionDate)} {booking.startTime}-{booking.endTime} · {booking.student.firstName} {booking.student.lastName}</li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
