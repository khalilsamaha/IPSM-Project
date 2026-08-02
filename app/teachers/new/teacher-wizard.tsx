"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createTeacherConfiguration,
  type TeacherConfigurationActionState,
} from "@/actions/teachers";
import { LocalizedDateInput } from "@/components/localized-date-input";

type Option = { id: string; name: string };
type Season = Option & { start: string; end: string };
type Assignment = { courseId: string; levelId: string };
type Availability = {
  key: string;
  courseId: string;
  seasonId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
};

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const initialActionState: TeacherConfigurationActionState = { status: "idle", message: "" };
const iso = (date: Date) => date.toISOString().slice(0, 10);

function firstWeekday(value: string, weekday: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + ((weekday - date.getUTCDay() + 7) % 7));
  return iso(date);
}

function lastWeekday(value: string, weekday: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() - weekday + 7) % 7));
  return iso(date);
}

function rangeFor(season: Season | undefined, weekday: number) {
  if (!season) return { from: "", to: "" };
  return {
    from: firstWeekday(season.start, weekday),
    to: lastWeekday(season.end, weekday),
  };
}

function durationSlots(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return Math.max(
    0,
    Math.floor(((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 30),
  );
}

function displayDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function TeacherWizard({
  courses,
  levels,
  seasons,
}: {
  courses: Option[];
  levels: Option[];
  seasons: Season[];
}) {
  const [step, setStep] = useState(1);
  const [basis, setBasis] = useState<"SESSION_UNIT" | "HOURLY">("SESSION_UNIT");
  const [assignments, setAssignments] = useState<Assignment[]>([
    { courseId: courses[0]?.id ?? "", levelId: "" },
  ]);
  const [activeAssignment, setActiveAssignment] = useState(0);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [actionState, formAction, isPending] = useActionState(
    createTeacherConfiguration,
    initialActionState,
  );

  const assignmentLabels = useMemo(
    () =>
      assignments.map((assignment) => ({
        course: courses.find((course) => course.id === assignment.courseId),
        level: levels.find((level) => level.id === assignment.levelId),
      })),
    [assignments, courses, levels],
  );
  const weeklyCapacity = useMemo(
    () => availability.reduce(
      (sum, rule) => sum + durationSlots(rule.startTime, rule.endTime),
      0,
    ),
    [availability],
  );

  function addAvailability(assignmentIndex = activeAssignment) {
    const assignment = assignments[assignmentIndex];
    const season = seasons[0];
    if (!assignment || !season) return;
    const dayOfWeek = 3;
    const range = rangeFor(season, dayOfWeek);
    setAvailability((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        courseId: assignment.courseId,
        seasonId: season.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "10:00",
        effectiveFrom: range.from,
        effectiveTo: range.to,
        notes: "",
      },
    ]);
  }

  function updateAvailability(key: string, patch: Partial<Availability>) {
    setAvailability((current) =>
      current.map((rule) => (rule.key === key ? { ...rule, ...patch } : rule)),
    );
  }

  function changeAvailabilitySeason(rule: Availability, seasonId: string) {
    const season = seasons.find((row) => row.id === seasonId);
    const range = rangeFor(season, rule.dayOfWeek);
    updateAvailability(rule.key, {
      seasonId,
      effectiveFrom: range.from,
      effectiveTo: range.to,
    });
  }

  function changeAvailabilityDay(rule: Availability, dayOfWeek: number) {
    const season = seasons.find((row) => row.id === rule.seasonId);
    const range = rangeFor(season, dayOfWeek);
    updateAvailability(rule.key, {
      dayOfWeek,
      effectiveFrom: range.from,
      effectiveTo: range.to,
    });
  }

  function removeAssignment(index: number) {
    const removed = assignments[index];
    setAssignments((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setAvailability((current) =>
      current.filter((rule) => rule.courseId !== removed.courseId),
    );
    setActiveAssignment(0);
  }

  const active = assignments[activeAssignment];
  const activeRules = active
    ? availability.filter((rule) => rule.courseId === active.courseId)
    : [];

  return (
    <div>
      <h2 className="text-2xl font-black">Add Teacher</h2>
      <p className="mb-5 text-sm text-slate-600">
        Step {step} of 4 — Personal information, assignments, seasonal availability, review
      </p>
      <form
        action={formAction}
        onSubmit={(event) => {
          const form = event.currentTarget;
          const formData = new FormData(form);
          const payload = {
            fullName: formData.get("fullName"),
            email: formData.get("email") || null,
            phone: formData.get("phone") || null,
            notes: formData.get("notes") || null,
            status: formData.get("status"),
            compensationBasis: basis,
            rateCents: Math.round(Number(formData.get("rate")) * 100),
            sessionUnitMinutes: Number(formData.get("unit")),
            assignments: assignments.map((assignment) => ({
              ...assignment,
              levelId: assignment.levelId || null,
            })),
            availability: availability.map(({ key: _, ...rule }) => ({
              ...rule,
              notes: rule.notes || null,
            })),
          };
          const configuration = form.elements.namedItem("configuration");
          if (configuration instanceof HTMLInputElement) {
            configuration.value = JSON.stringify(payload);
          }
        }}
        className="rounded-2xl border bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="configuration" />

        {actionState.status === "error" ? (
          <div
            className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"
            role="alert"
            aria-live="assertive"
          >
            {actionState.message}
          </div>
        ) : null}

        <section className={step === 1 ? "grid gap-4 md:grid-cols-2" : "hidden"}>
          <Labeled label="Full name" required>
            <input name="fullName" required className="input" />
          </Labeled>
          <Labeled label="Email">
            <input name="email" type="email" className="input" />
          </Labeled>
          <Labeled label="Phone">
            <input name="phone" className="input" />
          </Labeled>
          <Labeled label="Pay basis">
            <select
              value={basis}
              onChange={(event) => setBasis(event.target.value as typeof basis)}
              className="input"
            >
              <option value="SESSION_UNIT">Per 30-minute session</option>
              <option value="HOURLY">Hourly</option>
            </select>
          </Labeled>
          <Labeled
            label={basis === "SESSION_UNIT" ? "Rate per 30-minute session" : "Hourly rate"}
            required
          >
            <input
              name="rate"
              type="number"
              min="0"
              step=".01"
              defaultValue="15.00"
              required
              className="input"
            />
          </Labeled>
          <input type="hidden" name="unit" value="30" />
          <Labeled label="Status">
            <select name="status" className="input">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Labeled>
          <Labeled label="Notes">
            <textarea name="notes" className="input min-h-24" />
          </Labeled>
        </section>

        <section className={step === 2 ? "space-y-4" : "hidden"}>
          <div>
            <h3 className="font-black">Course assignments</h3>
            <p className="text-sm text-slate-600">
              Availability in the next step is created inside these assignments, so the course will not need to be selected again.
            </p>
          </div>
          {assignments.map((assignment, index) => (
            <article
              key={index}
              className="grid gap-3 rounded-2xl border bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]"
            >
              <Labeled label="Course / instrument" required>
                <select
                  value={assignment.courseId}
                  onChange={(event) => {
                    const courseId = event.target.value;
                    setAssignments((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, courseId } : row,
                      ),
                    );
                    setAvailability((current) =>
                      current.filter((rule) => rule.courseId !== assignment.courseId),
                    );
                  }}
                  className="input"
                >
                  {courses.map((course) => (
                    <option value={course.id} key={course.id}>{course.name}</option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Level">
                <select
                  value={assignment.levelId}
                  onChange={(event) =>
                    setAssignments((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, levelId: event.target.value } : row,
                      ),
                    )
                  }
                  className="input"
                >
                  <option value="">All levels</option>
                  {levels.map((level) => (
                    <option value={level.id} key={level.id}>{level.name}</option>
                  ))}
                </select>
              </Labeled>
              <button
                type="button"
                className="self-end rounded-xl border border-red-200 px-4 py-2 font-bold text-red-700 disabled:opacity-40"
                disabled={assignments.length === 1 || isPending}
                onClick={() => removeAssignment(index)}
              >
                Remove
              </button>
            </article>
          ))}
          <button
            type="button"
            className="btn-secondary"
            disabled={isPending}
            onClick={() =>
              setAssignments((current) => [
                ...current,
                { courseId: courses[0]?.id ?? "", levelId: "" },
              ])
            }
          >
            Add assignment
          </button>
        </section>

        <section className={step === 3 ? "space-y-5" : "hidden"}>
          <div>
            <h3 className="font-black">Seasonal availability</h3>
            <p className="text-sm text-slate-600">
              Choose the assignment once, then add one or more weekdays. Each time range is converted into 30-minute bookable sessions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {assignments.map((assignment, index) => {
              const label = assignmentLabels[index];
              const count = availability.filter(
                (rule) => rule.courseId === assignment.courseId,
              ).length;
              return (
                <button
                  key={`${assignment.courseId}-${index}`}
                  type="button"
                  disabled={isPending}
                  onClick={() => setActiveAssignment(index)}
                  className={`rounded-xl border px-4 py-3 text-left ${
                    activeAssignment === index
                      ? "border-primary bg-primary text-white"
                      : "bg-white"
                  }`}
                >
                  <b>{label.course?.name ?? "Course"}</b>
                  <span className="ml-2 text-xs">
                    {label.level?.name ?? "All levels"} · {count} rule{count === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
          </div>

          {active ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
                Creating availability for
              </p>
              <p className="text-lg font-black">
                {assignmentLabels[activeAssignment]?.course?.name} · {assignmentLabels[activeAssignment]?.level?.name ?? "All levels"}
              </p>
              <p className="mt-1 text-sm text-violet-900">
                The assignment is already selected. Add only the season, weekday, hours, and effective period.
              </p>
            </div>
          ) : null}

          <div className="space-y-4">
            {activeRules.map((rule) => {
              const season = seasons.find((row) => row.id === rule.seasonId);
              const slots = durationSlots(rule.startTime, rule.endTime);
              return (
                <article key={rule.key} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">
                        {assignmentLabels[activeAssignment]?.course?.name}
                      </p>
                      <h4 className="font-black">Availability rule</h4>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      className="font-bold text-red-700"
                      onClick={() =>
                        setAvailability((current) =>
                          current.filter((row) => row.key !== rule.key),
                        )
                      }
                    >
                      Remove rule
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Labeled label="Season" required>
                      <select
                        className="input"
                        value={rule.seasonId}
                        onChange={(event) => changeAvailabilitySeason(rule, event.target.value)}
                      >
                        {seasons.map((row) => (
                          <option key={row.id} value={row.id}>{row.name}</option>
                        ))}
                      </select>
                    </Labeled>
                    <Labeled label="Teaching day" required>
                      <select
                        className="input"
                        value={rule.dayOfWeek}
                        onChange={(event) => changeAvailabilityDay(rule, Number(event.target.value))}
                      >
                        {days.map((day, dayOfWeek) => (
                          <option key={day} value={dayOfWeek}>{day}</option>
                        ))}
                      </select>
                    </Labeled>
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <p className="text-xs font-bold uppercase text-emerald-700">Weekly capacity</p>
                      <p className="text-xl font-black text-emerald-950">{slots} × 30 min</p>
                    </div>
                    <Labeled label="Available from time" required>
                      <input
                        className="input"
                        type="time"
                        step="1800"
                        value={rule.startTime}
                        onChange={(event) => updateAvailability(rule.key, { startTime: event.target.value })}
                      />
                    </Labeled>
                    <Labeled label="Available until time" required>
                      <input
                        className="input"
                        type="time"
                        step="1800"
                        value={rule.endTime}
                        onChange={(event) => updateAvailability(rule.key, { endTime: event.target.value })}
                      />
                    </Labeled>
                    <div className="rounded-xl bg-slate-50 p-3 text-sm">
                      <b>Generated slots</b><br />
                      {slots > 0
                        ? Array.from({ length: slots }, (_, index) => {
                            const [hour, minute] = rule.startTime.split(":").map(Number);
                            const start = hour * 60 + minute + index * 30;
                            const end = start + 30;
                            const time = (value: number) =>
                              `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
                            return `${time(start)}–${time(end)}`;
                          }).join(", ")
                        : "End time must be after start time."}
                    </div>
                    <LocalizedDateInput
                      name={`effectiveFrom-${rule.key}`}
                      label="Effective first occurrence"
                      displayFormat="dd/mm/yyyy"
                      value={rule.effectiveFrom}
                      onChange={(value) => updateAvailability(rule.key, { effectiveFrom: value })}
                      min={season?.start}
                      max={season?.end}
                      required
                      helpText={`Must fall on a ${days[rule.dayOfWeek]} inside the season.`}
                    />
                    <LocalizedDateInput
                      name={`effectiveTo-${rule.key}`}
                      label="Effective final occurrence"
                      displayFormat="dd/mm/yyyy"
                      value={rule.effectiveTo}
                      onChange={(value) => updateAvailability(rule.key, { effectiveTo: value })}
                      min={season?.start}
                      max={season?.end}
                      required
                      helpText={`Must fall on a ${days[rule.dayOfWeek]} inside the season.`}
                    />
                    <div className="rounded-xl border p-3 text-sm">
                      <b>Period preview</b><br />
                      {displayDate(rule.effectiveFrom)}–{displayDate(rule.effectiveTo)}
                    </div>
                    <Labeled label="Notes">
                      <input
                        className="input"
                        value={rule.notes}
                        onChange={(event) => updateAvailability(rule.key, { notes: event.target.value })}
                        placeholder="Optional note"
                      />
                    </Labeled>
                  </div>
                </article>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={isPending}
            onClick={() => addAvailability()}
          >
            Add weekday availability
          </button>
          {!activeRules.length ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No availability has been added for this assignment. Active teachers must have at least one valid rule before creation.
            </p>
          ) : null}
        </section>

        <section className={step === 4 ? "space-y-4" : "hidden"}>
          <h3 className="font-black">Review teacher configuration</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Summary label="Assignments" value={String(assignments.length)} />
            <Summary label="Availability rules" value={String(availability.length)} />
            <Summary label="Weekly 30-minute capacity" value={String(weeklyCapacity)} />
          </div>
          <div className="space-y-3">
            {assignments.map((assignment, index) => (
              <article key={index} className="rounded-xl border p-4">
                <p className="font-black">
                  {assignmentLabels[index]?.course?.name} · {assignmentLabels[index]?.level?.name ?? "All levels"}
                </p>
                {availability
                  .filter((rule) => rule.courseId === assignment.courseId)
                  .map((rule) => (
                    <p key={rule.key} className="mt-1 text-sm text-slate-600">
                      {days[rule.dayOfWeek]} {rule.startTime}–{rule.endTime} · {seasons.find((season) => season.id === rule.seasonId)?.name} · {displayDate(rule.effectiveFrom)}–{displayDate(rule.effectiveTo)}
                    </p>
                  ))}
              </article>
            ))}
          </div>
          <button
            type="submit"
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || !assignments.length || !availability.length}
          >
            {isPending ? "Creating teacher configuration…" : "Create teacher configuration"}
          </button>
          {isPending ? (
            <p className="text-sm font-medium text-slate-600" aria-live="polite">
              Saving the teacher, assignments, and availability in one transaction…
            </p>
          ) : null}
        </section>

        <div className="mt-6 flex gap-2">
          {step > 1 ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={isPending}
              onClick={() => setStep((current) => current - 1)}
            >
              Back
            </button>
          ) : null}
          {step < 4 ? (
            <button
              type="button"
              className="btn-primary"
              disabled={isPending}
              onClick={() => {
                if (step === 2 && !availability.length) addAvailability(0);
                setStep((current) => current + 1);
              }}
            >
              Continue
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Labeled({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold">
      {label}{required ? " *" : ""}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </article>
  );
}
