"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { registerStudentWorkflow } from "@/actions/records";
import { getRegistrationSlotPlan } from "@/actions/scheduling";
import { LocalizedDateInput } from "@/components/localized-date-input";
import { findApplicableCoursePrice } from "@/lib/registration/pricing";

type StudentOption = { id: string; familyId: string; label: string };
type FamilyOption = { id: string; familyCode: string; name: string };
type SeasonOption = { id: string; name: string; startDate: string; endDate: string };
type TeacherOption = { id: string; fullName: string };
type CourseOption = { id: string; name: string };
type LevelOption = { id: string; name: string };
type PricingOption = { courseId: string; levelId: string; seasonId: string | null; price: string };
type TeacherCourseOption = { teacherId: string; courseId: string; levelId: string | null };
type StudentRow = { firstName: string; lastName: string; dateOfBirth: string; email: string; phone: string };
type WeeklySlot = { dayOfWeek: number; startTime: string; endTime: string; roomId: null };
type SlotPlan = Awaited<ReturnType<typeof getRegistrationSlotPlan>>;

type Props = {
  students: StudentOption[];
  families: FamilyOption[];
  seasons: SeasonOption[];
  teachers: TeacherOption[];
  courses: CourseOption[];
  levels: LevelOption[];
  pricings: PricingOption[];
  teacherCourses: TeacherCourseOption[];
  isAdmin: boolean;
  initialFamilyId: string;
};

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const stepTitles = [
  "Registration type",
  "Family details",
  "Student details",
  "Enrollment and teacher",
  "Payment",
  "Weekly schedule and review",
];
const blankStudent: StudentRow = { firstName: "", lastName: "", dateOfBirth: "", email: "", phone: "" };

function displayDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export function RegisterStudentWorkflowFormV2(props: Props) {
  const [step, setStep] = useState(0);
  const [registrationType, setRegistrationType] = useState<"new_family" | "existing_family">(
    props.initialFamilyId ? "existing_family" : "new_family",
  );
  const [existingStudentMode, setExistingStudentMode] = useState<"existing" | "new">("new");
  const [submissionId] = useState(() => crypto.randomUUID());
  const [family, setFamily] = useState({
    familyId: props.initialFamilyId,
    familyName: "",
    familyEmail: "",
    familyPhone: "",
    familyNotes: "",
    fatherFirstName: "",
    fatherLastName: "",
    fatherJob: "",
    fatherPhone: "",
    fatherEmail: "",
    motherFirstName: "",
    motherLastName: "",
    motherJob: "",
    motherPhone: "",
    motherEmail: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });
  const [students, setStudents] = useState<StudentRow[]>([{ ...blankStudent }]);
  const [primaryStudentIndex, setPrimaryStudentIndex] = useState("0");
  const [studentId, setStudentId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [enrollmentStartDate, setEnrollmentStartDate] = useState("");
  const [enrollmentEndDate, setEnrollmentEndDate] = useState("");
  const [fee, setFee] = useState("");
  const [discount, setDiscount] = useState("0");
  const [pricingOverrideReason, setPricingOverrideReason] = useState("");
  const [initialPayment, setInitialPayment] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [scheduleNow, setScheduleNow] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState<WeeklySlot[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [plan, setPlan] = useState<SlotPlan | null>(null);
  const [planError, setPlanError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, startSubmitting] = useTransition();
  const [isLoadingPlan, startLoadingPlan] = useTransition();
  const requestSequence = useRef(0);

  const selectedSeason = props.seasons.find((season) => season.id === seasonId);
  const selectedCourse = props.courses.find((course) => course.id === courseId);
  const selectedLevel = props.levels.find((level) => level.id === levelId);
  const selectedTeacher = props.teachers.find((teacher) => teacher.id === teacherId);
  const selectedExistingStudent = props.students.find((student) => student.id === studentId);
  const selectedNewStudent = students[Number(primaryStudentIndex)];
  const reviewStudentLabel = selectedExistingStudent?.label ??
    ([selectedNewStudent?.firstName, selectedNewStudent?.lastName].filter(Boolean).join(" ") || "New student");
  const eligibleTeachers = useMemo(
    () =>
      props.teachers.filter((teacher) =>
        props.teacherCourses.some(
          (assignment) =>
            assignment.teacherId === teacher.id &&
            assignment.courseId === courseId &&
            (!assignment.levelId || assignment.levelId === levelId),
        ),
      ),
    [props.teachers, props.teacherCourses, courseId, levelId],
  );
  const suggestedPrice = useMemo(
    () => findApplicableCoursePrice(props.pricings, courseId, levelId, seasonId)?.price ?? "",
    [props.pricings, courseId, levelId, seasonId],
  );
  const finalFee = Math.max(0, Number(fee || 0) - Number(discount || 0));
  const balanceAfterInitialPayment = Math.max(0, finalFee - Number(initialPayment || 0));
  const isNewStudent = registrationType === "new_family" || existingStudentMode === "new";
  const activeStart = enrollmentStartDate || plan?.availableFrom || selectedSeason?.startDate || "";
  const activeEnd = enrollmentEndDate || plan?.availableTo || selectedSeason?.endDate || "";

  useEffect(() => {
    if (suggestedPrice) setFee(suggestedPrice);
    setPricingOverrideReason("");
  }, [suggestedPrice]);

  useEffect(() => {
    if (!teacherId || !courseId || !levelId || !seasonId || !selectedSeason) {
      setPlan(null);
      setPlanError("");
      setSelectedSlots([]);
      return;
    }
    const sequence = ++requestSequence.current;
    const requestedStart = enrollmentStartDate || selectedSeason.startDate;
    const requestedEnd = enrollmentEndDate || selectedSeason.endDate;
    startLoadingPlan(async () => {
      try {
        const next = await getRegistrationSlotPlan({
          teacherId,
          courseId,
          levelId,
          seasonId,
          studentId: registrationType === "existing_family" && existingStudentMode === "existing" && studentId ? studentId : null,
          requestedStart,
          requestedEnd,
        });
        if (sequence !== requestSequence.current) return;
        setPlan(next);
        setPlanError("");
        if (!enrollmentStartDate && next.availableFrom) setEnrollmentStartDate(next.availableFrom);
        if (!enrollmentEndDate && next.availableTo) setEnrollmentEndDate(next.availableTo);
        const availableKeys = new Set(next.slots.filter((slot) => slot.status === "AVAILABLE").map((slot) => slot.key));
        setSelectedSlots((current) =>
          current.filter((slot) => availableKeys.has(`${slot.dayOfWeek}:${slot.startTime}:${slot.endTime}`)),
        );
        setSelectedDay((current) =>
          current !== null && next.weekdays.some((day) => day.dayOfWeek === current)
            ? current
            : next.weekdays[0]?.dayOfWeek ?? null,
        );
      } catch (error) {
        if (sequence !== requestSequence.current) return;
        setPlan(null);
        setSelectedSlots([]);
        setPlanError(error instanceof Error ? error.message : "Unable to load teacher availability.");
      }
    });
  }, [
    teacherId,
    courseId,
    levelId,
    seasonId,
    studentId,
    registrationType,
    existingStudentMode,
    enrollmentStartDate,
    enrollmentEndDate,
    selectedSeason,
  ]);

  function resetEnrollment() {
    setSeasonId("");
    setCourseId("");
    setLevelId("");
    setTeacherId("");
    setEnrollmentStartDate("");
    setEnrollmentEndDate("");
    setFee("");
    setDiscount("0");
    setInitialPayment("0");
    setPricingOverrideReason("");
    setPlan(null);
    setPlanError("");
    setSelectedSlots([]);
  }

  function changeFamily(value: string) {
    setFamily((current) => ({ ...current, familyId: value }));
    setStudentId("");
    setStudents([{ ...blankStudent }]);
    setPrimaryStudentIndex("0");
    resetEnrollment();
  }

  function changeAcademicSelection(next: { seasonId?: string; courseId?: string; levelId?: string }) {
    if (next.seasonId !== undefined) setSeasonId(next.seasonId);
    if (next.courseId !== undefined) setCourseId(next.courseId);
    if (next.levelId !== undefined) setLevelId(next.levelId);
    setTeacherId("");
    setEnrollmentStartDate("");
    setEnrollmentEndDate("");
    setSelectedSlots([]);
    setPlan(null);
  }

  function toggleSlot(dayOfWeek: number, startTime: string, endTime: string) {
    const key = `${dayOfWeek}:${startTime}:${endTime}`;
    setSelectedSlots((current) => {
      const exists = current.some((slot) => `${slot.dayOfWeek}:${slot.startTime}:${slot.endTime}` === key);
      if (exists) return current.filter((slot) => `${slot.dayOfWeek}:${slot.startTime}:${slot.endTime}` !== key);
      return [...current, { dayOfWeek, startTime, endTime, roomId: null }];
    });
  }

  function validationErrors() {
    if (step === 1) {
      if (registrationType === "new_family" && !family.familyName.trim()) return ["Enter the family name."];
      if (registrationType === "existing_family" && !family.familyId) return ["Choose an existing family."];
    }
    if (step === 2) {
      if (registrationType === "existing_family" && existingStudentMode === "existing" && !studentId) {
        return ["Choose the student to enroll."];
      }
      if (isNewStudent && !students.some((student) => student.firstName.trim() && student.lastName.trim())) {
        return ["Add at least one student with a first and last name."];
      }
    }
    if (step === 3) {
      if (!seasonId || !courseId || !levelId || !teacherId) {
        return ["Choose the season, course, level, and teacher."];
      }
      if (!activeStart || !activeEnd) return ["Choose enrollment dates inside the teacher availability period."];
      if (!plan || plan.message) return [planError || plan?.message || "This teacher has no usable availability."];
      if (!fee || Number(fee) < 0) return ["A valid enrollment fee is required."];
      if (activeStart > activeEnd) return ["Enrollment end date cannot precede the start date."];
    }
    if (step === 4) {
      if (Number(initialPayment || 0) < 0) return ["Initial payment cannot be negative."];
      if (Number(initialPayment || 0) > finalFee) return ["Initial payment cannot exceed the enrollment fee."];
    }
    if (step === 5 && scheduleNow && selectedSlots.length === 0) {
      return ["Select at least one green 30-minute recurring slot."];
    }
    return [];
  }

  const errors = validationErrors();
  function next() {
    setAttempted(true);
    if (errors.length) return;
    setAttempted(false);
    setStep((current) => Math.min(current + 1, stepTitles.length - 1));
  }
  function submit() {
    setAttempted(true);
    if (errors.length) return;
    const form = document.getElementById("registration-wizard-v2") as HTMLFormElement;
    startSubmitting(() => form.requestSubmit());
  }

  const visibleSlots = plan?.slots.filter((slot) => selectedDay === null || slot.dayOfWeek === selectedDay) ?? [];

  return (
    <form id="registration-wizard-v2" action={registerStudentWorkflow} className="grid gap-5">
      <input type="hidden" name="registrationSubmissionId" value={submissionId} />
      <input type="hidden" name="registrationType" value={registrationType} />
      <input type="hidden" name="studentId" value={studentId || "new"} />
      <input type="hidden" name="primaryStudentIndex" value={primaryStudentIndex} />
      {Object.entries(family).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {students.map((student, index) => (
        <span key={index} className="hidden">
          <input name="studentFirstName" value={student.firstName} readOnly />
          <input name="studentLastName" value={student.lastName} readOnly />
          <input name="studentDateOfBirth" value={student.dateOfBirth} readOnly />
          <input name="studentEmail" value={student.email} readOnly />
          <input name="studentPhone" value={student.phone} readOnly />
        </span>
      ))}
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="levelId" value={levelId} />
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="enrollmentStartDate" value={activeStart} />
      <input type="hidden" name="enrollmentEndDate" value={activeEnd} />
      <input type="hidden" name="fee" value={fee} />
      <input type="hidden" name="discount" value={discount} />
      <input type="hidden" name="pricingOverrideReason" value={pricingOverrideReason} />
      <input type="hidden" name="initialPayment" value={initialPayment} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      <input type="hidden" name="scheduleNow" value={scheduleNow ? "1" : ""} />
      <input type="hidden" name="weeklySlots" value={JSON.stringify(selectedSlots)} />

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Step {step + 1} of {stepTitles.length}</p>
            <h2 className="text-xl font-black">{stepTitles[step]}</h2>
          </div>
          <div className="hidden gap-1 sm:flex">
            {stepTitles.map((_, index) => (
              <span key={index} className={`h-2 w-8 rounded-full ${index <= step ? "bg-primary" : "bg-slate-200"}`} />
            ))}
          </div>
        </div>
      </div>

      {attempted && errors.map((error) => (
        <p key={error} role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ))}

      {step === 0 ? (
        <section className="card">
          <SectionTitle title="Choose the registration path" description="Create a new household or enroll a member of an existing family." />
          <div className="grid gap-4 md:grid-cols-2">
            <ChoiceCard active={registrationType === "new_family"} title="New family" description="Create the family and one or more students." onClick={() => { setRegistrationType("new_family"); changeFamily(""); }} />
            <ChoiceCard active={registrationType === "existing_family"} title="Existing family" description="Enroll an existing student or add a new family member." onClick={() => { setRegistrationType("existing_family"); changeFamily(props.initialFamilyId); }} />
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="card">
          <SectionTitle title="Family and guardian details" description="Family ownership is required for all students and payments." />
          {registrationType === "existing_family" ? (
            <Field label="Existing family" required>
              <select className="input" value={family.familyId} onChange={(event) => changeFamily(event.target.value)}>
                <option value="">Select family</option>
                {props.families.map((row) => <option key={row.id} value={row.id}>{row.familyCode} — {row.name}</option>)}
              </select>
            </Field>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Family name" value={family.familyName} set={(value) => setFamily({ ...family, familyName: value })} required />
              <TextField label="Primary phone" value={family.familyPhone} set={(value) => setFamily({ ...family, familyPhone: value })} />
              <TextField label="Primary email" type="email" value={family.familyEmail} set={(value) => setFamily({ ...family, familyEmail: value })} />
              <TextField label="Address" value={family.address} set={(value) => setFamily({ ...family, address: value })} />
              <TextField label="Father first name" value={family.fatherFirstName} set={(value) => setFamily({ ...family, fatherFirstName: value })} />
              <TextField label="Father last name" value={family.fatherLastName} set={(value) => setFamily({ ...family, fatherLastName: value })} />
              <TextField label="Father phone" value={family.fatherPhone} set={(value) => setFamily({ ...family, fatherPhone: value })} />
              <TextField label="Father email" type="email" value={family.fatherEmail} set={(value) => setFamily({ ...family, fatherEmail: value })} />
              <TextField label="Mother first name" value={family.motherFirstName} set={(value) => setFamily({ ...family, motherFirstName: value })} />
              <TextField label="Mother last name" value={family.motherLastName} set={(value) => setFamily({ ...family, motherLastName: value })} />
              <TextField label="Mother phone" value={family.motherPhone} set={(value) => setFamily({ ...family, motherPhone: value })} />
              <TextField label="Mother email" type="email" value={family.motherEmail} set={(value) => setFamily({ ...family, motherEmail: value })} />
              <TextField label="Emergency contact" value={family.emergencyContactName} set={(value) => setFamily({ ...family, emergencyContactName: value })} />
              <TextField label="Emergency phone" value={family.emergencyContactPhone} set={(value) => setFamily({ ...family, emergencyContactPhone: value })} />
              <Field label="Family notes"><textarea className="input min-h-24" value={family.familyNotes} onChange={(event) => setFamily({ ...family, familyNotes: event.target.value })} /></Field>
            </div>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="card">
          <SectionTitle title="Student details" description="Choose an existing family member or add one or more new students." />
          {registrationType === "existing_family" ? (
            <div className="mb-5 flex flex-wrap gap-3">
              <ChoiceButton active={existingStudentMode === "existing"} onClick={() => setExistingStudentMode("existing")}>Existing student</ChoiceButton>
              <ChoiceButton active={existingStudentMode === "new"} onClick={() => setExistingStudentMode("new")}>Add new student</ChoiceButton>
            </div>
          ) : null}
          {!isNewStudent ? (
            <Field label="Student" required>
              <select className="input" value={studentId} onChange={(event) => { setStudentId(event.target.value); resetEnrollment(); }}>
                <option value="">Select student</option>
                {props.students.filter((student) => student.familyId === family.familyId).map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}
              </select>
            </Field>
          ) : (
            <div className="space-y-4">
              {students.map((student, index) => (
                <article key={index} className="rounded-2xl border bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="font-bold"><input type="radio" className="mr-2" checked={primaryStudentIndex === String(index)} onChange={() => setPrimaryStudentIndex(String(index))} />Primary enrollment student</label>
                    {students.length > 1 ? <button type="button" className="text-sm font-bold text-red-700" onClick={() => { setStudents((rows) => rows.filter((_, rowIndex) => rowIndex !== index)); setPrimaryStudentIndex("0"); }}>Remove</button> : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextField label="First name" value={student.firstName} set={(value) => setStudents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, firstName: value } : row))} required />
                    <TextField label="Last name" value={student.lastName} set={(value) => setStudents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, lastName: value } : row))} required />
                    <LocalizedDateInput name={`visibleDob${index}`} label="Date of birth" value={student.dateOfBirth} onChange={(value) => setStudents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, dateOfBirth: value } : row))} />
                    <TextField label="Phone" value={student.phone} set={(value) => setStudents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, phone: value } : row))} />
                    <TextField label="Email" type="email" value={student.email} set={(value) => setStudents((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, email: value } : row))} />
                  </div>
                </article>
              ))}
              <button type="button" className="btn-secondary" onClick={() => setStudents((rows) => [...rows, { ...blankStudent }])}>Add another student</button>
            </div>
          )}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="card">
          <SectionTitle title="Enrollment and teacher availability" description="The teacher is selected before dates. Enrollment dates are then restricted to the teacher's course and season availability." />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Season" required><select className="input" value={seasonId} onChange={(event) => changeAcademicSelection({ seasonId: event.target.value })}><option value="">Select season</option>{props.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></Field>
            <Field label="Course / instrument" required><select className="input" value={courseId} onChange={(event) => changeAcademicSelection({ courseId: event.target.value })}><option value="">Select course</option>{props.courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></Field>
            <Field label="Level" required><select className="input" value={levelId} onChange={(event) => changeAcademicSelection({ levelId: event.target.value })}><option value="">Select level</option>{props.levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></Field>
            <Field label="Teacher" required><select className="input" value={teacherId} disabled={!courseId || !levelId} onChange={(event) => { setTeacherId(event.target.value); setEnrollmentStartDate(""); setEnrollmentEndDate(""); setSelectedSlots([]); }}><option value="">Select assigned teacher</option>{eligibleTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select></Field>
          </div>

          {teacherId ? (
            <div className={`mt-5 rounded-2xl border p-4 ${planError || plan?.message ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
              <p className="font-black">{isLoadingPlan ? "Checking teacher availability…" : planError || plan?.message || `${selectedTeacher?.fullName} is available for ${selectedCourse?.name}.`}</p>
              {plan && !plan.message ? (
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                  <p><b>Available period:</b><br />{displayDate(plan.availableFrom)}–{displayDate(plan.availableTo)}</p>
                  <p><b>Teaching days:</b><br />{plan.weekdays.map((day) => days[day.dayOfWeek]).join(", ")}</p>
                  <p><b>30-minute choices:</b><br />{plan.slots.filter((slot) => slot.status === "AVAILABLE").length} available, {plan.slots.filter((slot) => slot.status === "BOOKED").length} blocked</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <LocalizedDateInput name="visibleEnrollmentStart" label="Enrollment start" displayFormat="dd/mm/yyyy" value={enrollmentStartDate} onChange={(value) => { setEnrollmentStartDate(value); setSelectedSlots([]); }} min={plan?.availableFrom ?? selectedSeason?.startDate} max={plan?.availableTo ?? selectedSeason?.endDate} disabled={!plan?.availableFrom} required helpText="Limited to the selected teacher's effective availability." />
            <LocalizedDateInput name="visibleEnrollmentEnd" label="Enrollment end" displayFormat="dd/mm/yyyy" value={enrollmentEndDate} onChange={(value) => { setEnrollmentEndDate(value); setSelectedSlots([]); }} min={enrollmentStartDate || (plan?.availableFrom ?? selectedSeason?.startDate)} max={plan?.availableTo ?? selectedSeason?.endDate} disabled={!plan?.availableTo} required helpText="The recurring schedule stops on or before this date." />
            <TextField label="Calculated fee" type="number" value={fee} set={setFee} readOnly={!props.isAdmin} required />
            <TextField label="Discount" type="number" value={discount} set={setDiscount} />
            {props.isAdmin && suggestedPrice && fee !== suggestedPrice ? <TextField label="Pricing override reason" value={pricingOverrideReason} set={setPricingOverrideReason} required /> : null}
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="card">
          <SectionTitle title="Initial payment" description="Record an optional initial payment. A cashier shift must be open when the amount is greater than zero." />
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Enrollment fee" value={`$${finalFee.toFixed(2)}`} />
            <Metric label="Initial payment" value={`$${Number(initialPayment || 0).toFixed(2)}`} />
            <Metric label="Remaining afterward" value={`$${balanceAfterInitialPayment.toFixed(2)}`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Initial payment" type="number" value={initialPayment} set={setInitialPayment} />
            <Field label="Payment method"><select className="input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Cash</option><option value="whish">Whish</option></select></Field>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="card">
          <SectionTitle title="Choose the recurring weekly session" description="Select one or more weekdays, then choose a green 30-minute card. The same weekday and time repeat until the enrollment end date." />
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            <ChoiceCard active={scheduleNow} title="Create schedule now" description="Select recurring 30-minute sessions from real teacher availability." onClick={() => setScheduleNow(true)} />
            <ChoiceCard active={!scheduleNow} title="Schedule later" description="Save the family and student identity now without creating the enrollment or payment." onClick={() => setScheduleNow(false)} />
          </div>

          {scheduleNow ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {plan?.weekdays.map((day) => (
                  <button key={day.dayOfWeek} type="button" onClick={() => setSelectedDay(day.dayOfWeek)} className={`rounded-xl border px-4 py-2 text-sm font-bold ${selectedDay === day.dayOfWeek ? "border-primary bg-primary text-white" : "bg-white"}`}>
                    {days[day.dayOfWeek]} · {day.availableSlots} free / {day.bookedSlots} blocked
                  </button>
                ))}
              </div>
              {isLoadingPlan ? <p className="rounded-xl bg-slate-100 p-4">Refreshing availability…</p> : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleSlots.map((slot) => {
                  const selected = selectedSlots.some((item) => item.dayOfWeek === slot.dayOfWeek && item.startTime === slot.startTime && item.endTime === slot.endTime);
                  const available = slot.status === "AVAILABLE";
                  const firstConflict = slot.conflicts[0];
                  return (
                    <button key={slot.key} type="button" disabled={!available} onClick={() => toggleSlot(slot.dayOfWeek, slot.startTime, slot.endTime)} className={`rounded-2xl border p-4 text-left transition ${available ? selected ? "border-emerald-700 bg-emerald-600 text-white ring-4 ring-emerald-100" : "border-emerald-300 bg-emerald-50 text-emerald-950 hover:border-emerald-600" : "cursor-not-allowed border-red-300 bg-red-50 text-red-900"}`}>
                      <p className="text-xs font-black uppercase tracking-wide">{available ? selected ? "Selected" : "Available" : "Booked / conflict"}</p>
                      <p className="mt-1 text-xl font-black">{slot.startTime}–{slot.endTime}</p>
                      <p className="mt-2 text-xs">{slot.occurrenceCount} weekly occurrence{slot.occurrenceCount === 1 ? "" : "s"}{slot.closureCount ? ` · ${slot.closureCount} closure skipped` : ""}</p>
                      {!available && firstConflict ? <p className="mt-2 text-xs font-semibold">{displayDate(firstConflict.date)} · {firstConflict.studentName}<br />{firstConflict.courseName ?? "Lesson"}{firstConflict.roomName ? ` · ${firstConflict.roomName}` : ""}</p> : null}
                    </button>
                  );
                })}
              </div>
              {!visibleSlots.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">{planError || plan?.message || "No 30-minute slot is available for this weekday and enrollment period."}</p> : null}
            </>
          ) : null}

          <div className="mt-6 rounded-2xl border bg-slate-50 p-4">
            <h3 className="font-black">Registration review</h3>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <p><b>Family:</b> {registrationType === "existing_family" ? props.families.find((row) => row.id === family.familyId)?.name : family.familyName}</p>
              <p><b>Student:</b> {reviewStudentLabel}</p>
              <p><b>Course:</b> {selectedCourse?.name} / {selectedLevel?.name}</p>
              <p><b>Teacher:</b> {selectedTeacher?.fullName}</p>
              <p><b>Enrollment:</b> {displayDate(activeStart)}–{displayDate(activeEnd)}</p>
              <p><b>Fee / remaining:</b> ${finalFee.toFixed(2)} / ${balanceAfterInitialPayment.toFixed(2)}</p>
              <p className="md:col-span-2"><b>Recurring sessions:</b> {scheduleNow ? selectedSlots.map((slot) => `${days[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime}`).join(", ") || "Not selected" : "Schedule later"}</p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 0 ? <button type="button" className="btn-secondary" onClick={() => { setAttempted(false); setStep((current) => current - 1); }}>Back</button> : null}
        {step < stepTitles.length - 1 ? <button type="button" className="btn-primary" onClick={next}>Continue</button> : <button type="button" className="btn-primary" disabled={isSubmitting || isLoadingPlan} onClick={submit}>{isSubmitting ? "Saving registration…" : "Confirm registration"}</button>}
      </div>
    </form>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div className="mb-5"><h3 className="text-lg font-black">{title}</h3><p className="mt-1 text-sm text-slate-600">{description}</p></div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block text-sm font-bold">{label}{required ? " *" : ""}<span className="mt-1 block">{children}</span></label>;
}
function TextField({ label, value, set, type = "text", required = false, readOnly = false }: { label: string; value: string; set: (value: string) => void; type?: string; required?: boolean; readOnly?: boolean }) {
  return <Field label={label} required={required}><input className="input" type={type} value={value} readOnly={readOnly} min={type === "number" ? "0" : undefined} step={type === "number" ? ".01" : undefined} onChange={(event) => set(event.target.value)} /></Field>;
}
function ChoiceCard({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-5 text-left ${active ? "border-primary bg-violet-50 ring-4 ring-violet-100" : "bg-white"}`}><p className="font-black">{title}</p><p className="mt-2 text-sm text-slate-600">{description}</p></button>;
}
function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-2 text-sm font-bold ${active ? "border-primary bg-primary text-white" : "bg-white"}`}>{children}</button>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <article className="rounded-2xl border bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></article>;
}
