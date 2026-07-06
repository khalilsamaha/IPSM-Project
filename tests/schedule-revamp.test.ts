import { describe, expect, it } from "vitest";
import { assertNoLessonConflict, bookingDateRange, deriveBookingFromEnrollment, filterEnrollmentsForStudent, filterLessonsForInstrument, filterLessonsForStudent, groupLessonsByTeacher, groupSeasonLessons } from "@/lib/schedule/presentation";

const base = { sessionDate: new Date("2026-07-07T00:00:00Z"), startTime: "09:00", endTime: "10:00", status: "SCHEDULED", roomId: "room-1", seasonId: "season-1", enrollmentId: "enroll-1" };
const lessons: any[] = [
  { ...base, id: "l1", studentId: "student-1", teacherId: "teacher-1", student: { id: "student-1", studentCode: "S001", firstName: "Ana", lastName: "Lee" }, teacher: { id: "teacher-1", fullName: "Ms Piano" }, room: { id: "room-1", name: "Room 1" }, enrollment: { id: "enroll-1", studentId: "student-1", courseName: "Piano", course: { id: "course-1", name: "Piano" } } },
  { ...base, id: "l2", startTime: "10:00", endTime: "11:00", studentId: "student-2", teacherId: "teacher-2", roomId: "room-2", student: { id: "student-2", studentCode: "S002", firstName: "Ben", lastName: "Fox" }, teacher: { id: "teacher-2", fullName: "Mr Keys" }, room: { id: "room-2", name: "Room 2" }, enrollment: { id: "enroll-2", studentId: "student-2", courseName: "Piano", course: { id: "course-1", name: "Piano" } } },
  { ...base, id: "l3", startTime: "11:00", endTime: "12:00", studentId: "student-1", teacherId: "teacher-3", roomId: "room-3", student: { id: "student-1", studentCode: "S001", firstName: "Ana", lastName: "Lee" }, teacher: { id: "teacher-3", fullName: "Ms Strings" }, room: { id: "room-3", name: "Room 3" }, enrollment: { id: "enroll-3", studentId: "student-1", courseName: "Violin", course: { id: "course-2", name: "Violin" } } },
];

describe("schedule revamp presentation helpers", () => {
  it("groups Instrument View lessons by teacher for the selected instrument", () => {
    const pianoLessons = filterLessonsForInstrument(lessons, "Piano");
    const groups = groupLessonsByTeacher(pianoLessons);
    expect(pianoLessons).toHaveLength(2);
    expect(groups.map((group) => group.teacherName)).toEqual(["Mr Keys", "Ms Piano"]);
  });

  it("shows all Student Lessons for a selected student", () => {
    expect(filterLessonsForStudent(lessons, "student-1").map((lesson) => lesson.id)).toEqual(["l1", "l3"]);
  });

  it("shows a Season Schedule grouped by date without additional filters", () => {
    expect(Object.keys(groupSeasonLessons(lessons, "date"))).toEqual(["2026-07-07"]);
  });

  it("filters booking enrollments by selected student", () => {
    expect(filterEnrollmentsForStudent([{ id: "e1", studentId: "student-1" }, { id: "e2", studentId: "student-2" }] as any, "student-1")).toEqual([{ id: "e1", studentId: "student-1" }]);
  });

  it("derives booking season and teacher from enrollment", () => {
    expect(deriveBookingFromEnrollment({ id: "e1", studentId: "student-1", teacherId: "teacher-1", seasonId: "season-1" } as any)).toMatchObject({ studentId: "student-1", teacherId: "teacher-1", seasonId: "season-1" });
  });

  it("blocks booking when enrollment has no teacher", () => {
    expect(() => deriveBookingFromEnrollment({ id: "e1", studentId: "student-1", seasonId: "season-1" } as any)).toThrow("no teacher assigned");
  });

  it("limits booking dates by the overlap of season and enrollment", () => {
    const range = bookingDateRange({ id: "e1", studentId: "student-1", enrollmentStartDate: new Date("2026-07-01"), enrollmentEndDate: new Date("2026-08-31"), season: { id: "season-1", name: "Summer", startDate: new Date("2026-07-15"), endDate: new Date("2026-08-15") } } as any);
    expect(range.min.toISOString().slice(0, 10)).toBe("2026-07-15");
    expect(range.max.toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("blocks teacher, student, and room conflicts while allowing non-overlapping edits", () => {
    expect(() => assertNoLessonConflict(lessons, { ...lessons[0], id: "new", startTime: "09:30", endTime: "10:30" }, "teacher")).toThrow("Teacher is already booked.");
    expect(() => assertNoLessonConflict(lessons, { ...lessons[0], id: "new", teacherId: "other", startTime: "09:30", endTime: "10:30" }, "student")).toThrow("Student is already booked.");
    expect(() => assertNoLessonConflict(lessons, { ...lessons[0], id: "new", teacherId: "other", studentId: "other", startTime: "09:30", endTime: "10:30" }, "room")).toThrow("Room is already booked.");
    expect(() => assertNoLessonConflict(lessons, { ...lessons[0], startTime: "09:30", endTime: "10:30" }, "teacher")).not.toThrow();
  });
});
