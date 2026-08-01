export const TEACHING_SLOT_MINUTES = 30;

export type SlotRule = {
  id: string;
  teacherId: string;
  courseId: string | null;
  courseName?: string | null;
  seasonId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type SlotBooking = {
  id: string;
  teacherId: string;
  studentId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  studentName: string;
  familyName?: string | null;
  courseName?: string | null;
  levelName?: string | null;
  roomName?: string | null;
};

export type SlotClosure = { startDate: string; endDate: string; name?: string | null };

export type SlotConflict = {
  bookingId: string;
  kind: "teacher" | "student" | "teacher_and_student";
  date: string;
  startTime: string;
  endTime: string;
  studentName: string;
  familyName?: string | null;
  courseName?: string | null;
  levelName?: string | null;
  roomName?: string | null;
  status: string;
};

export type RecurringSlotCard = {
  key: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED";
  occurrenceCount: number;
  closureCount: number;
  conflictCount: number;
  conflicts: SlotConflict[];
  courseLabels: string[];
};

export type RecurringSlotPlan = {
  availableFrom: string | null;
  availableTo: string | null;
  firstOccurrence: string | null;
  lastOccurrence: string | null;
  weekdays: Array<{ dayOfWeek: number; availableSlots: number; bookedSlots: number }>;
  slots: RecurringSlotCard[];
  message: string | null;
};

export type TeacherWeekSlot = {
  key: string;
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "CLOSED";
  courseLabels: string[];
  bookings: SlotBooking[];
  closureName?: string | null;
};

export type TeacherWeekDay = {
  date: string;
  dayOfWeek: number;
  slots: TeacherWeekSlot[];
};

const DAY_MS = 86_400_000;
const mondayOrder = (day: number) => (day === 0 ? 6 : day - 1);

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ISO date: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function maxDate(...values: string[]) {
  return values.reduce((latest, value) => (value > latest ? value : latest));
}

function minDate(...values: string[]) {
  return values.reduce((earliest, value) => (value < earliest ? value : earliest));
}

function addDays(value: string, days: number) {
  return isoDate(new Date(parseDate(value).getTime() + days * DAY_MS));
}

function minutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeFromMinutes(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function splitTeachingWindow(startTime: string, endTime: string, slotMinutes = TEACHING_SLOT_MINUTES) {
  const start = minutes(startTime);
  const end = minutes(endTime);
  if (end <= start || slotMinutes <= 0) return [];
  const slots: Array<{ startTime: string; endTime: string }> = [];
  for (let cursor = start; cursor + slotMinutes <= end; cursor += slotMinutes) {
    slots.push({ startTime: timeFromMinutes(cursor), endTime: timeFromMinutes(cursor + slotMinutes) });
  }
  return slots;
}

function weeklyDates(dayOfWeek: number, from: string, to: string) {
  if (from > to) return [];
  const first = parseDate(from);
  first.setUTCDate(first.getUTCDate() + ((dayOfWeek - first.getUTCDay() + 7) % 7));
  const dates: string[] = [];
  for (let cursor = first; isoDate(cursor) <= to; cursor = new Date(cursor.getTime() + 7 * DAY_MS)) {
    dates.push(isoDate(cursor));
  }
  return dates;
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return minutes(startA) < minutes(endB) && minutes(startB) < minutes(endA);
}

function closureForDate(date: string, closures: SlotClosure[]) {
  return closures.find((closure) => closure.startDate <= date && date <= closure.endDate);
}

function matchingRules(input: {
  rules: SlotRule[];
  teacherId: string;
  courseId?: string | null;
  seasonId?: string | null;
}) {
  return input.rules.filter(
    (rule) =>
      rule.teacherId === input.teacherId &&
      (!rule.courseId || !input.courseId || rule.courseId === input.courseId) &&
      (!rule.seasonId || !input.seasonId || rule.seasonId === input.seasonId),
  );
}

export function buildRecurringSlotPlan(input: {
  teacherId: string;
  courseId: string;
  seasonId: string;
  studentId?: string | null;
  seasonStart: string;
  seasonEnd: string;
  requestedStart: string;
  requestedEnd: string;
  rules: SlotRule[];
  bookings: SlotBooking[];
  closures?: SlotClosure[];
}): RecurringSlotPlan {
  const closures = input.closures ?? [];
  const rules = matchingRules(input);
  const requestedStart = maxDate(input.requestedStart, input.seasonStart);
  const requestedEnd = minDate(input.requestedEnd, input.seasonEnd);
  if (requestedStart > requestedEnd) {
    return {
      availableFrom: null,
      availableTo: null,
      firstOccurrence: null,
      lastOccurrence: null,
      weekdays: [],
      slots: [],
      message: "The selected enrollment dates do not overlap the season.",
    };
  }

  type MutableSlot = {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    dates: Set<string>;
    closureDates: Set<string>;
    courseLabels: Set<string>;
  };
  const slots = new Map<string, MutableSlot>();
  let availableFrom: string | null = null;
  let availableTo: string | null = null;

  for (const rule of rules) {
    const ruleStart = maxDate(requestedStart, rule.effectiveFrom ?? input.seasonStart);
    const ruleEnd = minDate(requestedEnd, rule.effectiveTo ?? input.seasonEnd);
    if (ruleStart > ruleEnd) continue;
    availableFrom = availableFrom ? minDate(availableFrom, ruleStart) : ruleStart;
    availableTo = availableTo ? maxDate(availableTo, ruleEnd) : ruleEnd;
    const dates = weeklyDates(rule.dayOfWeek, ruleStart, ruleEnd);
    for (const window of splitTeachingWindow(rule.startTime, rule.endTime)) {
      const key = `${rule.dayOfWeek}:${window.startTime}:${window.endTime}`;
      const current = slots.get(key) ?? {
        dayOfWeek: rule.dayOfWeek,
        startTime: window.startTime,
        endTime: window.endTime,
        dates: new Set<string>(),
        closureDates: new Set<string>(),
        courseLabels: new Set<string>(),
      };
      if (rule.courseName) current.courseLabels.add(rule.courseName);
      for (const date of dates) {
        if (closureForDate(date, closures)) current.closureDates.add(date);
        else current.dates.add(date);
      }
      slots.set(key, current);
    }
  }

  const cards: RecurringSlotCard[] = [...slots.entries()]
    .filter(([, slot]) => slot.dates.size > 0)
    .map(([key, slot]) => {
      const conflicts = new Map<string, SlotConflict>();
      for (const date of slot.dates) {
        for (const booking of input.bookings) {
          if (booking.date !== date || !overlaps(slot.startTime, slot.endTime, booking.startTime, booking.endTime)) continue;
          const teacherConflict = booking.teacherId === input.teacherId;
          const studentConflict = Boolean(input.studentId && booking.studentId === input.studentId);
          if (!teacherConflict && !studentConflict) continue;
          const kind: SlotConflict["kind"] = teacherConflict && studentConflict
            ? "teacher_and_student"
            : teacherConflict
              ? "teacher"
              : "student";
          const conflictKey = `${booking.id}:${kind}`;
          conflicts.set(conflictKey, {
            bookingId: booking.id,
            kind,
            date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            studentName: booking.studentName,
            familyName: booking.familyName,
            courseName: booking.courseName,
            levelName: booking.levelName,
            roomName: booking.roomName,
            status: booking.status,
          });
        }
      }
      const conflictRows = [...conflicts.values()].sort((a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
      );
      return {
        key,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: conflictRows.length ? "BOOKED" : "AVAILABLE",
        occurrenceCount: slot.dates.size,
        closureCount: slot.closureDates.size,
        conflictCount: conflictRows.length,
        conflicts: conflictRows.slice(0, 8),
        courseLabels: [...slot.courseLabels].sort(),
      };
    })
    .sort((a, b) => mondayOrder(a.dayOfWeek) - mondayOrder(b.dayOfWeek) || a.startTime.localeCompare(b.startTime));

  const weekdays = [...new Set(cards.map((slot) => slot.dayOfWeek))].map((dayOfWeek) => ({
    dayOfWeek,
    availableSlots: cards.filter((slot) => slot.dayOfWeek === dayOfWeek && slot.status === "AVAILABLE").length,
    bookedSlots: cards.filter((slot) => slot.dayOfWeek === dayOfWeek && slot.status === "BOOKED").length,
  }));
  const occurrenceDates = rules.flatMap((rule) => {
    const from = maxDate(requestedStart, rule.effectiveFrom ?? input.seasonStart);
    const to = minDate(requestedEnd, rule.effectiveTo ?? input.seasonEnd);
    return from <= to ? weeklyDates(rule.dayOfWeek, from, to).filter((date) => !closureForDate(date, closures)) : [];
  }).sort();

  return {
    availableFrom,
    availableTo,
    firstOccurrence: occurrenceDates[0] ?? null,
    lastOccurrence: occurrenceDates.at(-1) ?? null,
    weekdays,
    slots: cards,
    message: cards.length
      ? null
      : rules.length
        ? "No 30-minute teaching slot remains inside the selected date range."
        : "This teacher has no matching availability for the selected course and season.",
  };
}

export function mondayOfIsoWeek(value: string) {
  const date = parseDate(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return isoDate(date);
}

export function buildTeacherWeekCapacity(input: {
  teacherId: string;
  weekStart: string;
  seasonStart: string;
  seasonEnd: string;
  rules: SlotRule[];
  bookings: SlotBooking[];
  closures?: SlotClosure[];
}): TeacherWeekDay[] {
  const monday = mondayOfIsoWeek(input.weekStart);
  const closures = input.closures ?? [];
  const days: TeacherWeekDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(monday, offset);
    const dayOfWeek = parseDate(date).getUTCDay();
    const dayRules = input.rules.filter((rule) => {
      if (rule.teacherId !== input.teacherId || rule.dayOfWeek !== dayOfWeek) return false;
      if (date < input.seasonStart || date > input.seasonEnd) return false;
      if (rule.effectiveFrom && date < rule.effectiveFrom) return false;
      if (rule.effectiveTo && date > rule.effectiveTo) return false;
      return true;
    });
    const closure = closureForDate(date, closures);
    const slotMap = new Map<string, { startTime: string; endTime: string; courseLabels: Set<string> }>();
    for (const rule of dayRules) {
      for (const window of splitTeachingWindow(rule.startTime, rule.endTime)) {
        const key = `${window.startTime}:${window.endTime}`;
        const slot = slotMap.get(key) ?? { ...window, courseLabels: new Set<string>() };
        slot.courseLabels.add(rule.courseName ?? "All assigned courses");
        slotMap.set(key, slot);
      }
    }
    const dayBookings = input.bookings.filter((booking) => booking.teacherId === input.teacherId && booking.date === date);
    const slots = [...slotMap.entries()].map(([key, slot]): TeacherWeekSlot => {
      const bookings = dayBookings.filter((booking) => overlaps(slot.startTime, slot.endTime, booking.startTime, booking.endTime));
      return {
        key: `${date}:${key}`,
        date,
        dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: closure ? "CLOSED" : bookings.length ? "BOOKED" : "AVAILABLE",
        courseLabels: [...slot.courseLabels].sort(),
        bookings,
        closureName: closure?.name,
      };
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));
    days.push({ date, dayOfWeek, slots });
  }
  return days;
}

export function buildTeacherSeasonCapacity(input: {
  teacherId: string;
  seasonStart: string;
  seasonEnd: string;
  rules: SlotRule[];
  bookings: SlotBooking[];
  closures?: SlotClosure[];
}) {
  const closures = input.closures ?? [];
  const capacity = new Map<string, { date: string; startTime: string; endTime: string }>();
  for (const rule of input.rules.filter((row) => row.teacherId === input.teacherId)) {
    const from = maxDate(input.seasonStart, rule.effectiveFrom ?? input.seasonStart);
    const to = minDate(input.seasonEnd, rule.effectiveTo ?? input.seasonEnd);
    if (from > to) continue;
    for (const date of weeklyDates(rule.dayOfWeek, from, to)) {
      if (closureForDate(date, closures)) continue;
      for (const window of splitTeachingWindow(rule.startTime, rule.endTime)) {
        capacity.set(`${date}:${window.startTime}:${window.endTime}`, { date, ...window });
      }
    }
  }
  let bookedSlots = 0;
  for (const slot of capacity.values()) {
    if (input.bookings.some((booking) =>
      booking.teacherId === input.teacherId &&
      booking.date === slot.date &&
      overlaps(slot.startTime, slot.endTime, booking.startTime, booking.endTime),
    )) bookedSlots += 1;
  }
  const totalSlots = capacity.size;
  return {
    totalSlots,
    bookedSlots,
    availableSlots: Math.max(0, totalSlots - bookedSlots),
    utilizationPercent: totalSlots ? (bookedSlots / totalSlots) * 100 : 0,
  };
}
