"use client";

import { useMemo, useState } from "react";
import { registerStudentWorkflow } from "@/actions/records";
import { findApplicableCoursePrice } from "@/lib/registration/pricing";

type Option = { id: string; title: string; description: string; behavior: string };
type StudentOption = { id: string; label: string };
type FamilyOption = { id: string; name: string };
type SeasonOption = { id: string; name: string; startDate: string; endDate: string };
type TeacherOption = { id: string; fullName: string };
type CourseOption = { id: string; name: string };
type LevelOption = { id: string; name: string };
type PricingOption = { courseId: string; levelId: string; seasonId: string | null; price: string };

type Props = { students: StudentOption[]; families: FamilyOption[]; seasons: SeasonOption[]; teachers: TeacherOption[]; courses: CourseOption[]; levels: LevelOption[]; pricings: PricingOption[] };

const options: Option[] = [
  { id: "independent_student", title: "New independent student", description: "Use this when one student is registering alone and no family/group record is needed.", behavior: "Creates one new student without a family, then continues to enrollment." },
  { id: "new_family_group", title: "New family / group with one or more students", description: "Use this when siblings or multiple students belong to the same family/group.", behavior: "Creates a family/group, adds students under it, and enrolls the selected primary student." },
  { id: "existing_family_group", title: "Existing family / group, add student", description: "Use this when the family/group already exists and you are adding another student.", behavior: "Selects an existing family/group, adds one or more students, and continues to enrollment." },
  { id: "existing_student", title: "Existing student, new enrollment", description: "Use this when the student already exists and is registering for a new season or course.", behavior: "Selects the student and creates a new enrollment. This does not edit the student profile." },
];

const blankStudent = { firstName: "", lastName: "", dateOfBirth: "", email: "", phone: "" };

export function RegisterStudentWorkflowForm({ students, families, seasons, teachers, courses, levels, pricings }: Props) {
  const [registrationType, setRegistrationType] = useState("independent_student");
  const [studentRows, setStudentRows] = useState([{ ...blankStudent }]);
  const [primaryStudentIndex, setPrimaryStudentIndex] = useState("0");
  const [seasonId, setSeasonId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [enrollmentStartDate, setEnrollmentStartDate] = useState("");
  const [enrollmentEndDate, setEnrollmentEndDate] = useState("");
  const [fee, setFee] = useState("");
  const [discount, setDiscount] = useState("");
  const [initialPayment, setInitialPayment] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [bookFirstSession, setBookFirstSession] = useState(false);
  const [sessionDate, setSessionDate] = useState("");
  const selectedOption = options.find((option) => option.id === registrationType) ?? options[0];
  const selectedSeason = seasons.find((season) => season.id === seasonId);
  const suggestedPrice = useMemo(() => findApplicableCoursePrice(pricings, courseId, levelId, seasonId)?.price, [courseId, levelId, seasonId, pricings]);
  const activeStartDate = enrollmentStartDate || selectedSeason?.startDate || "";
  const activeEndDate = enrollmentEndDate || selectedSeason?.endDate || "";
  const firstLessonMin = selectedSeason ? [selectedSeason.startDate, enrollmentStartDate].filter(Boolean).sort().at(-1) ?? selectedSeason.startDate : "";
  const firstLessonMax = selectedSeason ? [selectedSeason.endDate, enrollmentEndDate].filter(Boolean).sort().at(0) ?? selectedSeason.endDate : "";
  const firstLessonOutOfRange = Boolean(sessionDate && ((firstLessonMin && sessionDate < firstLessonMin) || (firstLessonMax && sessionDate > firstLessonMax)));
  const proratedPrice = useMemo(() => {
    if (!suggestedPrice || !selectedSeason || !activeStartDate || !activeEndDate) return null;
    const day = 24 * 60 * 60 * 1000;
    const days = (start: string, end: string) => Math.max(1, Math.floor((Date.parse(end) - Date.parse(start)) / day) + 1);
    const seasonDays = days(selectedSeason.startDate, selectedSeason.endDate);
    const activeDays = days(activeStartDate, activeEndDate);
    return ((Math.round((Number(suggestedPrice) * 100 * activeDays) / seasonDays)) / 100).toFixed(2);
  }, [suggestedPrice, selectedSeason, activeStartDate, activeEndDate]);
  const missingPrice = Boolean(courseId && levelId && seasonId && !suggestedPrice);
  const balance = useMemo(() => Math.max(0, Number(fee || 0) - Number(discount || 0) - Number(initialPayment || 0)), [fee, discount, initialPayment]);
  const showNewStudents = registrationType !== "existing_student";
  const showFamilyFields = registrationType === "new_family_group";
  const showFamilySelector = registrationType === "existing_family_group";
  const showMultipleNote = registrationType === "new_family_group" || registrationType === "existing_family_group";

  return <form action={registerStudentWorkflow} className="grid gap-5">
    <input type="hidden" name="registrationType" value={registrationType} />
    <section className="card">
      <StepTitle step="1" title="Registration type" description="Choose exactly what this registration should create. Editing existing student or family records remains on the Students and Families pages." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => <button key={option.id} type="button" onClick={() => setRegistrationType(option.id)} className={`rounded-2xl border p-4 text-left transition ${registrationType === option.id ? "border-violet-400 bg-violet-50 ring-4 ring-violet-100" : "bg-white hover:border-blue-200 hover:bg-blue-50/40"}`}>
          <span className="text-sm font-black text-slate-950">{option.title}</span>
          <span className="mt-2 block text-xs leading-5 text-slate-600">{option.description}</span>
          <span className="mt-3 block rounded-xl bg-white/80 p-2 text-xs font-semibold text-blue-800">{option.behavior}</span>
        </button>)}
      </div>
    </section>

    {showFamilyFields ? <section className="card"><StepTitle step="2" title="Family / Group details" description="Create the family or group record and optional parent/emergency details before adding students under it." /><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><input name="familyName" required placeholder="Family / Group name" className="input" /><input name="familyEmail" type="email" placeholder="Family email" className="input" /><input name="familyPhone" placeholder="Family phone" className="input" /><input name="address" placeholder="Address" className="input" /><input name="fatherFirstName" placeholder="Father first name" className="input" /><input name="fatherLastName" placeholder="Father last name" className="input" /><input name="fatherJob" placeholder="Father job" className="input" /><input name="fatherPhone" placeholder="Father phone" className="input" /><input name="fatherEmail" type="email" placeholder="Father email" className="input" /><input name="motherFirstName" placeholder="Mother first name" className="input" /><input name="motherLastName" placeholder="Mother last name" className="input" /><input name="motherJob" placeholder="Mother job" className="input" /><input name="motherPhone" placeholder="Mother phone" className="input" /><input name="motherEmail" type="email" placeholder="Mother email" className="input" /><input name="emergencyContactName" placeholder="Emergency contact name" className="input" /><input name="emergencyContactPhone" placeholder="Emergency contact phone" className="input" /><input name="familyNotes" placeholder="Notes optional" className="input lg:col-span-4" /></div></section> : null}

    {showFamilySelector ? <section className="card"><StepTitle step="2" title="Family / Group details" description="Select the existing family/group. No family record will be edited here." /><select name="familyId" required className="input"><option value="">Select existing Family / Group</option>{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select></section> : null}

    {registrationType === "existing_student" ? <section className="card"><StepTitle step="2" title="Student details" description="Select the existing student to receive a new enrollment. This does not edit the student profile." /><select name="studentId" required className="input"><option value="">Select existing student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}</select></section> : null}

    {showNewStudents ? <section className="card"><StepTitle step="3" title="Student details" description="Enter the student records to create. For family/group paths, choose the primary student for this enrollment." />{showMultipleNote ? <p className="mb-4 rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">This registration will create the enrollment for the selected primary student. Other students are created under the family/group and can be enrolled next.</p> : null}<div className="mb-4 max-w-sm"><label className="text-sm font-bold">Primary student<select name="primaryStudentIndex" value={primaryStudentIndex} onChange={(event) => setPrimaryStudentIndex(event.target.value)} className="input mt-1">{studentRows.map((_, index) => <option value={index} key={index}>Student {index + 1}</option>)}</select></label></div><div className="grid gap-3">{studentRows.map((row, index) => <div className="grid gap-3 rounded-2xl border bg-slate-50 p-3 md:grid-cols-5" key={index}><h4 className="font-black md:col-span-5">Student {index + 1}{index === Number(primaryStudentIndex) ? " — primary" : ""}</h4><input name="studentFirstName" required={index === 0} placeholder="First name" className="input" value={row.firstName} onChange={(event) => setStudentRows((rows) => rows.map((r, i) => i === index ? { ...r, firstName: event.target.value } : r))} /><input name="studentLastName" required={index === 0} placeholder="Last name" className="input" value={row.lastName} onChange={(event) => setStudentRows((rows) => rows.map((r, i) => i === index ? { ...r, lastName: event.target.value } : r))} /><input name="studentDateOfBirth" type="date" aria-label="Date of birth" className="input" value={row.dateOfBirth} onChange={(event) => setStudentRows((rows) => rows.map((r, i) => i === index ? { ...r, dateOfBirth: event.target.value } : r))} /><input name="studentEmail" type="email" placeholder="Email optional" className="input" value={row.email} onChange={(event) => setStudentRows((rows) => rows.map((r, i) => i === index ? { ...r, email: event.target.value } : r))} /><input name="studentPhone" placeholder="Phone optional" className="input" value={row.phone} onChange={(event) => setStudentRows((rows) => rows.map((r, i) => i === index ? { ...r, phone: event.target.value } : r))} /></div>)}</div>{showMultipleNote ? <button className="btn-secondary mt-4" type="button" onClick={() => setStudentRows((rows) => [...rows, { ...blankStudent }])}>Add another student</button> : null}</section> : null}

    <section className="card"><StepTitle step="4" title="Enrollment details" description="The enrollment is created for the selected or primary student. Course names are copied onto the legacy courseName field for compatibility." /><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6"><select name="seasonId" required className="input" value={seasonId} onChange={(event) => { const next = seasons.find((season) => season.id === event.target.value); setSeasonId(event.target.value); setEnrollmentStartDate(next?.startDate ?? ""); setEnrollmentEndDate(next?.endDate ?? ""); setSessionDate(""); }}><option value="">Season</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select><select name="courseId" required className="input" value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select><select name="levelId" required className="input" value={levelId} onChange={(event) => setLevelId(event.target.value)}><option value="">Level</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select><select name="teacherId" className="input" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}><option value="">Assign teacher later</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select><input name="enrollmentStartDate" type="date" min={selectedSeason?.startDate} max={selectedSeason?.endDate} className="input" value={activeStartDate} onChange={(event) => { setEnrollmentStartDate(event.target.value); setSessionDate(""); }} /><input name="enrollmentEndDate" type="date" min={selectedSeason?.startDate} max={selectedSeason?.endDate} className="input" value={activeEndDate} onChange={(event) => { setEnrollmentEndDate(event.target.value); setSessionDate(""); }} /><input name="fee" type="number" min="0" step="0.01" placeholder="Amount due" className="input" value={fee} onChange={(event) => setFee(event.target.value)} /><input name="discount" type="number" min="0" step="0.01" placeholder="Discount" className="input" value={discount} onChange={(event) => setDiscount(event.target.value)} /></div>{suggestedPrice ? <div className="mt-3 flex flex-wrap gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900"><span className="font-bold">Full season price: ${Number(suggestedPrice).toFixed(2)}</span>{proratedPrice ? <span className="font-bold">Suggested prorated price: ${Number(proratedPrice).toFixed(2)}</span> : null}<button type="button" className="btn-secondary" onClick={() => setFee(suggestedPrice)}>Use full price</button>{proratedPrice ? <button type="button" className="btn-secondary" onClick={() => setFee(proratedPrice)}>Use prorated suggestion</button> : null}</div> : null}{missingPrice ? <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">No configured price found. Admin should configure pricing.</p> : null}</section>

    <section className="card"><StepTitle step="5" title="Initial payment" description="Optional. Payments reuse the existing allocation and receipt services." /><div className="grid gap-3 md:grid-cols-3"><input name="initialPayment" type="number" min="0" step="0.01" placeholder="Paid now" className="input" value={initialPayment} onChange={(event) => setInitialPayment(event.target.value)} /><select name="paymentMethod" className="input"><option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="ach">ACH</option></select><p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">For an independent student, an initial payment may require a lightweight Family / Group payer record. The workflow creates it only for payment compatibility.</p></div></section>

    <section className="card"><StepTitle step="6" title="First lesson" description="Optional first lesson. Existing schedule validation still prevents double-booking; teacher comes from the enrollment." /><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><label className="flex items-center gap-2 rounded-2xl border bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" name="bookFirstSession" value="1" checked={bookFirstSession} onChange={(event) => setBookFirstSession(event.target.checked)} /> Book First Lesson</label><input name="sessionDate" type="date" className="input" min={firstLessonMin || undefined} max={firstLessonMax || undefined} value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} /><input name="startTime" type="time" className="input" /><input name="endTime" type="time" className="input" /></div>{firstLessonMin && firstLessonMax ? <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">First lesson must be between {firstLessonMin} and {firstLessonMax}.</p> : null}{bookFirstSession && !teacherId ? <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">Select an enrollment teacher before booking the first lesson.</p> : null}{firstLessonOutOfRange ? <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">First lesson date must be inside the enrollment date range.</p> : null}</section>

    <section className="card border-violet-200 bg-violet-50/30"><StepTitle step="7" title="Review and confirm" description="Confirm what this workflow will create before submitting." /><dl className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3"><Review label="Registration type" value={selectedOption.title} /><Review label="Student(s)" value={registrationType === "existing_student" ? "Selected existing student; no profile edits" : `${studentRows.length} new student row(s), primary is Student ${Number(primaryStudentIndex) + 1}`} /><Review label="Family / Group" value={registrationType === "new_family_group" ? "Create new family/group" : registrationType === "existing_family_group" ? "Use selected existing family/group" : "None unless needed for independent student payment"} /><Review label="Enrollment dates" value={activeStartDate && activeEndDate ? `${activeStartDate} to ${activeEndDate}` : "Season dates by default"} /><Review label="Amount due" value={`$${Number(fee || 0).toFixed(2)}`} /><Review label="Initial payment" value={`$${Number(initialPayment || 0).toFixed(2)}`} /><Review label="Remaining balance estimate" value={`$${balance.toFixed(2)}`} /></dl><button disabled={(bookFirstSession && !teacherId) || firstLessonOutOfRange} className="btn-primary mt-5 w-full disabled:opacity-50 md:w-auto">Confirm Registration</button></section>
  </form>;
}

function StepTitle({ step, title, description }: { step: string; title: string; description: string }) { return <div className="mb-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Step {step}</p><h3 className="text-lg font-black">{title}</h3><p className="text-sm text-muted-foreground">{description}</p></div>; }
function Review({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white p-3"><dt className="text-xs font-black uppercase text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>; }
