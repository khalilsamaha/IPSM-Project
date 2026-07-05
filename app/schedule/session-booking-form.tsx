"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { saveScheduleSession } from "@/actions/records";

type Params = Record<string, string | undefined>;
const dateValue = (value: string | Date | null | undefined) => value ? new Date(value).toISOString().slice(0, 10) : "";
const maxDate = (a: string, b: string) => !a ? b : !b ? a : a > b ? a : b;
const minDate = (a: string, b: string) => !a ? b : !b ? a : a < b ? a : b;

export function SessionBookingForm({ editSession, students, teachers, seasons, enrollments, rooms, params }: { editSession: any; students: any[]; teachers: any[]; seasons: any[]; enrollments: any[]; rooms: any[]; params: Params }) {
  const [selectedStudentId, setSelectedStudentId] = useState(editSession?.studentId ?? params.form_studentId ?? "");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(editSession?.enrollmentId ?? params.form_enrollmentId ?? "");
  const [selectedSeasonId, setSelectedSeasonId] = useState(editSession?.seasonId ?? params.form_seasonId ?? "");
  const [selectedDate, setSelectedDate] = useState(dateValue(editSession?.sessionDate) || params.date || "");
  const selectedEnrollment = useMemo(() => enrollments.find((e) => e.id === selectedEnrollmentId), [enrollments, selectedEnrollmentId]);
  const filteredEnrollments = useMemo(() => enrollments.filter((e) => e.studentId === selectedStudentId || Boolean(editSession?.enrollmentId && e.id === editSession.enrollmentId)), [enrollments, selectedStudentId, editSession?.enrollmentId]);
  const selectedSeason = useMemo(() => seasons.find((s) => s.id === selectedSeasonId) ?? selectedEnrollment?.season, [seasons, selectedSeasonId, selectedEnrollment]);
  const allowedStartDate = selectedEnrollment && selectedSeason ? maxDate(dateValue(selectedSeason.startDate), dateValue(selectedEnrollment.enrollmentStartDate)) : selectedSeason ? dateValue(selectedSeason.startDate) : "";
  const allowedEndDate = selectedEnrollment && selectedSeason ? minDate(dateValue(selectedSeason.endDate), dateValue(selectedEnrollment.enrollmentEndDate)) : selectedSeason ? dateValue(selectedSeason.endDate) : "";
  const dateOutOfRange = Boolean(selectedDate && ((allowedStartDate && selectedDate < allowedStartDate) || (allowedEndDate && selectedDate > allowedEndDate)));
  useEffect(() => { if (selectedEnrollment?.seasonId) setSelectedSeasonId(selectedEnrollment.seasonId); }, [selectedEnrollment?.seasonId]);
  useEffect(() => { if (selectedEnrollmentId && !filteredEnrollments.some((e) => e.id === selectedEnrollmentId)) setSelectedEnrollmentId(""); }, [filteredEnrollments, selectedEnrollmentId]);
  return <form id="session-form" action={saveScheduleSession} className="grid gap-4 rounded-[1.5rem] border bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    <div className="md:col-span-4"><h3 className="text-lg font-black">{editSession ? "Edit lesson" : "Book lesson"}</h3><p className="text-sm text-slate-500">Flow: select student, select that student’s active enrollment, review the derived season/teacher, pick date/time, select a room, then confirm. Validation prevents teacher, student, and room conflicts.</p></div>
    {editSession ? <input type="hidden" name="id" value={editSession.id} /> : null}
    <input name="title" placeholder="Optional title" defaultValue={editSession?.title ?? params.form_title ?? ""} className="rounded-xl border p-2.5" />
    <select name="studentId" required value={selectedStudentId} onChange={(e) => { setSelectedStudentId(e.target.value); setSelectedEnrollmentId(""); }} className="rounded-xl border p-2.5"><option value="" disabled>Student</option>{students.map((s) => <option value={s.id} key={s.id}>{s.studentCode} — {s.firstName} {s.lastName} ({s.family?.name ?? "Independent"})</option>)}</select>
    <select name="enrollmentId" value={selectedEnrollmentId} onChange={(e) => setSelectedEnrollmentId(e.target.value)} className="rounded-xl border p-2.5"><option value="">Enrollment</option>{filteredEnrollments.map((e) => <option value={e.id} key={e.id}>{e.course?.name ?? e.courseName} — {e.level?.name ?? "No level"} — {e.season?.name ?? "No season"} — {dateValue(e.enrollmentStartDate)} to {dateValue(e.enrollmentEndDate)} — {e.teacher?.fullName ?? "No teacher assigned"}</option>)}</select>
    {selectedStudentId && !filteredEnrollments.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-sm font-bold text-amber-800">No active enrollments found for this student. Register/enroll the student first.</p> : null}
    <input type="hidden" name="teacherId" value={selectedEnrollment?.teacherId ?? ""} />
    <input type="hidden" name="seasonId" value={selectedEnrollment?.seasonId ?? ""} />
    <div className="rounded-xl border bg-slate-50 p-2.5 text-sm"><span className="block text-xs font-bold uppercase text-slate-500">Season</span>{selectedEnrollment?.season?.name ?? "Select enrollment"}</div>
    <div className="rounded-xl border bg-slate-50 p-2.5 text-sm"><span className="block text-xs font-bold uppercase text-slate-500">Teacher</span>{selectedEnrollment?.teacher?.fullName ?? "No teacher assigned"}</div>
    {selectedEnrollment && !selectedEnrollment.teacherId ? <p className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-sm font-bold text-red-700">This enrollment has no teacher assigned. Please edit the enrollment and assign a teacher before booking a lesson.</p> : null}
    <select name="roomId" defaultValue={editSession?.roomId ?? params.form_roomId ?? ""} className="rounded-xl border p-2.5"><option value="">No room</option>{rooms.map((r) => <option value={r.id} key={r.id}>{r.name}{r.capacity ? ` · cap ${r.capacity}` : ""}</option>)}</select>
    <label className="text-sm font-medium"><input name="sessionDate" required type="date" value={selectedDate} min={allowedStartDate || undefined} max={allowedEndDate || undefined} onChange={(e) => setSelectedDate(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5" />{allowedStartDate && allowedEndDate ? <span className="mt-1 block text-xs text-slate-500">Allowed booking dates: {allowedStartDate} to {allowedEndDate}</span> : null}{dateOutOfRange ? <span className="mt-1 block text-xs font-bold text-red-700">Selected date is outside the allowed booking range.</span> : null}</label>
    <input name="startTime" required type="time" defaultValue={editSession?.startTime ?? params.form_startTime} className="rounded-xl border p-2.5" />
    <input name="endTime" required type="time" defaultValue={editSession?.endTime ?? params.form_endTime} className="rounded-xl border p-2.5" />
    <select name="status" defaultValue={editSession?.status ?? params.form_status ?? "SCHEDULED"} className="rounded-xl border p-2.5">{["SCHEDULED", "COMPLETED", "CANCELLED", "MISSED"].map((status) => <option key={status}>{status}</option>)}</select>
    <textarea name="notes" placeholder="Notes" defaultValue={editSession?.notes ?? params.form_notes ?? ""} className="rounded-xl border p-2.5 md:col-span-3" />
    <div className="flex flex-wrap gap-2"><button disabled={dateOutOfRange || Boolean(selectedEnrollment && !selectedEnrollment.teacherId)} className="rounded-xl bg-primary px-4 py-2.5 font-bold text-white disabled:opacity-50">{editSession ? "Update" : "Add"}</button><Link className="rounded-xl border px-4 py-2.5 font-bold" href="/schedule">Cancel</Link></div>
  </form>;
}
