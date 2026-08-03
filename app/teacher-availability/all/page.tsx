import Link from "next/link";
import { AppShell, PageHeader } from "@/components/records/shell";
import { LocalizedDateInput } from "@/components/localized-date-input";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  buildTeacherSeasonCapacity,
  buildTeacherWeekCapacity,
  mondayOfIsoWeek,
  type SlotBooking,
  type SlotClosure,
  type SlotRule,
} from "@/lib/schedule/slot-planner";

const DAY_MS = 86_400_000;
const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type Params = { seasonId?: string; courseId?: string; weekStart?: string };

function addDays(value: string, amount: number) {
  return new Date(
    new Date(`${value}T00:00:00.000Z`).getTime() + amount * DAY_MS,
  )
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
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function calendarHref(input: {
  seasonId: string;
  courseId?: string;
  weekStart: string;
}) {
  const query = new URLSearchParams({
    seasonId: input.seasonId,
    weekStart: input.weekStart,
  });
  if (input.courseId) query.set("courseId", input.courseId);
  return `/teacher-availability/all?${query}`;
}

export default async function AllTeacherAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  const [teachers, seasons, courses] = await Promise.all([
    prisma.teacher.findMany({
      where: { status: "ACTIVE", archivedAt: null },
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
  ]);

  const selectedSeason =
    seasons.find((season) => season.id === params.seasonId) ?? seasons[0];
  const seasonId = selectedSeason?.id ?? "";
  const seasonStart = selectedSeason?.startDate.toISOString().slice(0, 10) ?? "";
  const seasonEnd = selectedSeason?.endDate.toISOString().slice(0, 10) ?? "";
  const requestedWeek =
    (params.weekStart ?? seasonStart) || new Date().toISOString().slice(0, 10);
  const weekStart = mondayOfIsoWeek(requestedWeek);

  const [availability, sessions, closures] = selectedSeason
    ? await Promise.all([
        prisma.teacherAvailability.findMany({
          where: {
            status: "ACTIVE",
            archivedAt: null,
            teacher: { status: "ACTIVE", archivedAt: null },
            AND: [
              { OR: [{ seasonId: null }, { seasonId }] },
              ...(params.courseId
                ? [{ OR: [{ courseId: null }, { courseId: params.courseId }] }]
                : []),
            ],
          },
          include: { course: { select: { name: true } } },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        }),
        prisma.scheduleSession.findMany({
          where: {
            archivedAt: null,
            teacher: { status: "ACTIVE", archivedAt: null },
            sessionDate: {
              gte: selectedSeason.startDate,
              lte: selectedSeason.endDate,
            },
            status: { in: ["SCHEDULED", "COMPLETED", "MISSED"] },
            ...(params.courseId
              ? { enrollment: { courseId: params.courseId } }
              : {}),
          },
          include: {
            student: { include: { family: true } },
            enrollment: { include: { course: true, level: true } },
            room: true,
          },
          orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
        }),
        prisma.schoolClosure.findMany({
          where: {
            archivedAt: null,
            startDate: { lte: selectedSeason.endDate },
            endDate: { gte: selectedSeason.startDate },
          },
          orderBy: { startDate: "asc" },
        }),
      ])
    : [[], [], []];

  const rules: SlotRule[] = availability.map((rule) => ({
    id: rule.id,
    teacherId: rule.teacherId,
    courseId: rule.courseId,
    courseName: rule.course?.name ?? null,
    seasonId: rule.seasonId,
    dayOfWeek: rule.dayOfWeek,
    startTime: rule.startTime,
    endTime: rule.endTime,
    effectiveFrom: rule.effectiveFrom?.toISOString().slice(0, 10) ?? null,
    effectiveTo: rule.effectiveTo?.toISOString().slice(0, 10) ?? null,
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
    courseName:
      lesson.enrollment?.course?.name ??
      lesson.enrollment?.courseName ??
      lesson.title,
    levelName: lesson.enrollment?.level?.name ?? null,
    roomName: lesson.room?.name ?? null,
  }));
  const closureRows: SlotClosure[] = closures.map((closure) => ({
    startDate: closure.startDate.toISOString().slice(0, 10),
    endDate: closure.endDate.toISOString().slice(0, 10),
    name: closure.name,
  }));

  const teacherRows = selectedSeason
    ? teachers
        .map((teacher) => {
          const teacherRules = rules.filter((rule) => rule.teacherId === teacher.id);
          const teacherBookings = bookings.filter(
            (booking) => booking.teacherId === teacher.id,
          );
          return {
            teacher,
            ruleCount: teacherRules.length,
            week: buildTeacherWeekCapacity({
              teacherId: teacher.id,
              weekStart,
              seasonStart,
              seasonEnd,
              rules: teacherRules,
              bookings: teacherBookings,
              closures: closureRows,
            }),
            capacity: buildTeacherSeasonCapacity({
              teacherId: teacher.id,
              seasonStart,
              seasonEnd,
              rules: teacherRules,
              bookings: teacherBookings,
              closures: closureRows,
            }),
            relevant: teacherRules.length > 0 || teacherBookings.length > 0,
          };
        })
        .filter((row) => row.relevant)
    : [];

  const totals = teacherRows.reduce(
    (sum, row) => ({
      capacity: sum.capacity + row.capacity.totalSlots,
      booked: sum.booked + row.capacity.bookedSlots,
      available: sum.available + row.capacity.availableSlots,
    }),
    { capacity: 0, booked: 0, available: 0 },
  );
  const utilization = totals.capacity
    ? (totals.booked / totals.capacity) * 100
    : 0;

  return (
    <AppShell session={session}>
      <PageHeader
        title="All Teachers — Weekly Availability"
        description="Review every active teacher in one 30-minute weekly calendar. Green is available, red is booked, and gray is a school closure."
        action={
          <Link className="btn-secondary" href="/teacher-availability">
            Single teacher and rule editor
          </Link>
        }
      />

      <form className="mb-5 grid gap-3 rounded-[1.5rem] border bg-white p-4 shadow-sm md:grid-cols-4">
        <label className="text-sm font-bold">
          Season
          <select name="seasonId" defaultValue={seasonId} className="input mt-1">
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>{season.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Course
          <select
            name="courseId"
            defaultValue={params.courseId ?? ""}
            className="input mt-1"
          >
            <option value="">All courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </label>
        <LocalizedDateInput
          name="weekStart"
          label="Week containing"
          displayFormat="dd/mm/yyyy"
          defaultValue={weekStart}
          min={seasonStart || undefined}
          max={seasonEnd || undefined}
          className="input"
        />
        <button className="btn-primary self-end">Load all teachers</button>
      </form>

      {selectedSeason ? (
        <>
          <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Teachers shown" value={String(teacherRows.length)} detail={selectedSeason.name} />
            <Metric label="Season capacity" value={`${totals.capacity} sessions`} detail="30-minute units across all teachers" />
            <Metric label="Booked" value={`${totals.booked} sessions`} detail={`${utilization.toFixed(1)}% utilized`} />
            <Metric label="Available" value={`${totals.available} sessions`} detail="Unbooked season capacity" />
          </section>

          <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm">
            <div>
              <h2 className="font-black">Week of {displayDate(weekStart)}</h2>
              <p className="text-sm text-slate-600">
                Each teacher is shown against the same seven-day calendar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Legend className="border-emerald-300 bg-emerald-50 text-emerald-900">Available</Legend>
              <Legend className="border-red-300 bg-red-50 text-red-900">Booked</Legend>
              <Legend className="border-slate-300 bg-slate-200 text-slate-700">Closed</Legend>
              <Link
                className="btn-secondary"
                href={calendarHref({ seasonId, courseId: params.courseId, weekStart: addDays(weekStart, -7) })}
              >
                Previous week
              </Link>
              <Link
                className="btn-secondary"
                href={calendarHref({ seasonId, courseId: params.courseId, weekStart: addDays(weekStart, 7) })}
              >
                Next week
              </Link>
            </div>
          </section>

          <div className="space-y-6">
            {teacherRows.map((row) => (
              <section key={row.teacher.id} className="rounded-[1.5rem] border bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black">{row.teacher.fullName}</h2>
                    <p className="text-sm text-slate-600">
                      {row.capacity.bookedSlots}/{row.capacity.totalSlots} booked · {row.capacity.availableSlots} available · {row.capacity.utilizationPercent.toFixed(1)}% utilized · {row.ruleCount} rule{row.ruleCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link
                    className="btn-secondary"
                    href={`/teacher-availability?teacherId=${row.teacher.id}&seasonId=${seasonId}&courseId=${params.courseId ?? ""}&weekStart=${weekStart}`}
                  >
                    Open teacher details
                  </Link>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                  {row.week.map((day) => (
                    <article key={`${row.teacher.id}-${day.date}`} className="rounded-2xl border bg-slate-50 p-3">
                      <div className="mb-3">
                        <p className="font-black">{dayNames[day.dayOfWeek]}</p>
                        <p className="text-xs text-slate-500">{displayDate(day.date)}</p>
                      </div>
                      <div className="space-y-2">
                        {day.slots.map((slot) => (
                          <div
                            key={slot.key}
                            className={`rounded-xl border p-3 text-xs ${
                              slot.status === "AVAILABLE"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                : slot.status === "BOOKED"
                                  ? "border-red-300 bg-red-50 text-red-950"
                                  : "border-slate-300 bg-slate-200 text-slate-700"
                            }`}
                          >
                            <p className="font-black">{slot.startTime}–{slot.endTime}</p>
                            <p className="mt-1 font-bold">
                              {slot.status === "AVAILABLE"
                                ? "Available"
                                : slot.status === "CLOSED"
                                  ? slot.closureName ?? "School closed"
                                  : "Booked"}
                            </p>
                            {slot.status === "AVAILABLE" ? (
                              <p className="mt-1">{slot.courseLabels.join(", ")}</p>
                            ) : null}
                            {slot.bookings.map((booking) => (
                              <div key={booking.id} className="mt-2 border-t border-red-200 pt-2">
                                <b>{booking.studentName}</b><br />
                                {booking.familyName}<br />
                                {booking.courseName}{booking.levelName ? ` / ${booking.levelName}` : ""}
                                {booking.roomName ? <><br />{booking.roomName}</> : null}
                              </div>
                            ))}
                          </div>
                        ))}
                        {!day.slots.length ? (
                          <p className="rounded-xl border border-dashed p-3 text-xs text-slate-500">
                            No availability rule.
                          </p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {!teacherRows.length ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              No active teacher availability or bookings match the selected season and course.
            </p>
          ) : null}
        </>
      ) : (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          Create a season before loading the all-teachers calendar.
        </p>
      )}
    </AppShell>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`rounded-xl border px-3 py-2 text-xs font-bold ${className}`}>
      {children}
    </span>
  );
}
