import { z } from "zod";
import { validateAvailabilityRange } from "./availability-dates";

const uuid = z.string().uuid();
export const teacherOnboardingSchema = z.object({
  fullName: z.string().trim().min(1), email: z.string().trim().email().nullable(), phone: z.string().trim().nullable(), notes: z.string().trim().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]), compensationBasis: z.enum(["HOURLY", "SESSION_UNIT"]), rateCents: z.number().int().nonnegative(), sessionUnitMinutes: z.number().int().positive(),
  assignments: z.array(z.object({ courseId: uuid, levelId: uuid.nullable() })),
  availability: z.array(z.object({ courseId: uuid.nullable(), seasonId: uuid, dayOfWeek: z.number().int().min(0).max(6), startTime: z.string().regex(/^\d\d:\d\d$/), endTime: z.string().regex(/^\d\d:\d\d$/), effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date(), notes: z.string().nullable() })),
}).superRefine((value, ctx) => {
  if (value.status === "ACTIVE" && !value.assignments.length) ctx.addIssue({ code: "custom", path: ["assignments"], message: "An active teacher needs at least one course assignment." });
  const keys = new Set<string>(); value.assignments.forEach((a, index) => { const key = `${a.courseId}:${a.levelId ?? "all"}`; if (keys.has(key)) ctx.addIssue({ code: "custom", path: ["assignments", index], message: "Duplicate course and level assignment." }); keys.add(key); });
  value.availability.forEach((a, index) => { if (a.startTime >= a.endTime) ctx.addIssue({ code: "custom", path: ["availability", index], message: "End time must be after start time." }); if (a.courseId && !value.assignments.some(x => x.courseId === a.courseId)) ctx.addIssue({ code: "custom", path: ["availability", index], message: "Availability course must be assigned to the teacher." }); });
});

export async function validateTeacherConfiguration(data: z.infer<typeof teacherOnboardingSchema>, lookupSeason: (id: string) => Promise<{ startDate: Date; endDate: Date } | null>) {
  const parsed = teacherOnboardingSchema.parse(data);
  for (const row of parsed.availability) { const season = await lookupSeason(row.seasonId); if (!season) throw new Error("Season is unavailable."); validateAvailabilityRange({ seasonStart: season.startDate, seasonEnd: season.endDate, weekday: row.dayOfWeek, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo }); }
  return parsed;
}
