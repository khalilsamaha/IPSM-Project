"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { registerStudentWorkflow } from "@/actions/records";
import { findApplicableCoursePrice } from "@/lib/registration/pricing";
import { LocalizedDateInput } from "@/components/localized-date-input";

type Option = {
  id: string;
  title: string;
  description: string;
  behavior: string;
};
type StudentOption = { id: string; familyId: string; label: string };
type FamilyOption = { id: string; familyCode: string; name: string };
type SeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};
type TeacherOption = { id: string; fullName: string };
type CourseOption = { id: string; name: string };
type LevelOption = { id: string; name: string };
type PricingOption = {
  courseId: string;
  levelId: string;
  seasonId: string | null;
  price: string;
};
type TeacherCourseOption = {
  teacherId: string;
  courseId: string;
  levelId: string | null;
};
type StudentRow = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
};

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

const options: Option[] = [
  {
    id: "new_family",
    title: "New family",
    description:
      "Use for every new household, including a family with one student.",
    behavior: "Creates a family, its students, and one enrollment.",
  },
  {
    id: "existing_family",
    title: "Existing family",
    description: "Enroll an existing family member or add a new student.",
    behavior: "Keeps students scoped to the selected family.",
  },
];
const blankStudent: StudentRow = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  email: "",
  phone: "",
};
const stepTitles = [
  "Registration type",
  "Family / guardian",
  "Student details",
  "Enrollment / activity",
  "Payment",
  "First lesson & review",
];

export function RegisterStudentWorkflowForm(props: Props) {
  const {
    students,
    families,
    seasons,
    teachers,
    courses,
    levels,
    pricings,
    teacherCourses,
    isAdmin,
  } = props;
  const [step, setStep] = useState(0);
  const [registrationType, setRegistrationType] = useState(
    props.initialFamilyId ? "existing_family" : "new_family",
  );
  const [existingFamilyMode, setExistingFamilyMode] = useState<
    "existing" | "new"
  >("new");
  const [submissionId] = useState(() => crypto.randomUUID());
  const [studentRows, setStudentRows] = useState<StudentRow[]>([
    { ...blankStudent },
  ]);
  const [primaryStudentIndex, setPrimaryStudentIndex] = useState("0");
  const [family, setFamily] = useState({
    familyId: props.initialFamilyId,
    familyName: "",
    familyEmail: "",
    familyPhone: "",
    address: "",
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
    familyNotes: "",
    guardianName: "",
    guardianPhone: "",
  });
  const [studentId, setStudentId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [enrollmentStartDate, setEnrollmentStartDate] = useState("");
  const [enrollmentEndDate, setEnrollmentEndDate] = useState("");
  const [fee, setFee] = useState("");
  const [discount, setDiscount] = useState("");
  const [initialPayment, setInitialPayment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bookFirstSession, setBookFirstSession] = useState(false);
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectedSeason = seasons.find((season) => season.id === seasonId);
  const activeStartDate =
    enrollmentStartDate || selectedSeason?.startDate || "";
  const activeEndDate = enrollmentEndDate || selectedSeason?.endDate || "";
  const suggestedPrice = useMemo(
    () =>
      findApplicableCoursePrice(pricings, courseId, levelId, seasonId)?.price,
    [courseId, levelId, seasonId, pricings],
  );
  const eligibleTeachers = useMemo(
    () =>
      teachers.filter((teacher) =>
        teacherCourses.some(
          (tc) =>
            tc.teacherId === teacher.id &&
            tc.courseId === courseId &&
            (!tc.levelId || tc.levelId === levelId),
        ),
      ),
    [teachers, teacherCourses, courseId, levelId],
  );
  const balance = Math.max(
    0,
    Number(fee || 0) - Number(discount || 0) - Number(initialPayment || 0),
  );
  const showNewStudents =
    registrationType === "new_family" || existingFamilyMode === "new";
  const showFamily = registrationType === "new_family";
  const showFamilySelector = registrationType === "existing_family";

  function resetEnrollment() {
    setSeasonId("");
    setCourseId("");
    setLevelId("");
    setTeacherId("");
    setEnrollmentStartDate("");
    setEnrollmentEndDate("");
    setFee("");
    setDiscount("");
    setInitialPayment("");
    setBookFirstSession(false);
    setSessionDate("");
    setStartTime("");
    setEndTime("");
  }
  function changeFamily(value: string) {
    setFamily((current) => ({ ...current, familyId: value }));
    setStudentId("");
    setStudentRows([{ ...blankStudent }]);
    setPrimaryStudentIndex("0");
    resetEnrollment();
  }
  function changeStudent(value: string) {
    setStudentId(value);
    resetEnrollment();
  }

  const errors = validateStep();
  function validateStep() {
    if (step === 1) {
      if (showFamily && !family.familyName.trim())
        return ["Enter the family / group name."];
      if (showFamilySelector && !family.familyId)
        return ["Choose the family / group."];
    }
    if (step === 2) {
      if (
        registrationType === "existing_family" &&
        existingFamilyMode === "existing" &&
        !studentId
      )
        return ["Choose the student."];
      if (
        showNewStudents &&
        !studentRows.some((r) => r.firstName.trim() && r.lastName.trim())
      )
        return ["Enter at least one student first and last name."];
    }
    if (step === 3) {
      if (!seasonId || !courseId || !levelId || !fee)
        return ["Choose season, Instrument / Activity, level, and amount due."];
    }
    if (
      step === 5 &&
      bookFirstSession &&
      (!teacherId || !sessionDate || !startTime || !endTime)
    )
      return [
        "Choose teacher, date, start time, and end time for the first lesson.",
      ];
    return [];
  }
  function next() {
    setAttempted(true);
    if (errors.length) return;
    setAttempted(false);
    setStep((s) => Math.min(s + 1, stepTitles.length - 1));
  }
  function submit() {
    setAttempted(true);
    if (errors.length) return;
    const form = document.getElementById(
      "registration-wizard-form",
    ) as HTMLFormElement;
    startTransition(() => {
      form.requestSubmit();
    });
  }

  return (
    <form
      id="registration-wizard-form"
      action={registerStudentWorkflow}
      className="grid gap-5"
    >
      <input
        type="hidden"
        name="registrationSubmissionId"
        value={submissionId}
      />
      <input type="hidden" name="registrationType" value={registrationType} />
      <input type="hidden" name="studentId" value={studentId || "new"} />
      <input
        type="hidden"
        name="primaryStudentIndex"
        value={primaryStudentIndex}
      />
      {Object.entries(family).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {studentRows.map((row, i) => (
        <span key={i} className="hidden">
          {Object.entries(row).map(([key, value]) => (
            <input
              key={key}
              name={
                key === "firstName"
                  ? "studentFirstName"
                  : key === "lastName"
                    ? "studentLastName"
                    : key === "dateOfBirth"
                      ? "studentDateOfBirth"
                      : key === "email"
                        ? "studentEmail"
                        : "studentPhone"
              }
              value={value}
            />
          ))}
        </span>
      ))}
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="levelId" value={levelId} />
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="enrollmentStartDate" value={activeStartDate} />
      <input type="hidden" name="enrollmentEndDate" value={activeEndDate} />
      <input type="hidden" name="fee" value={fee} />
      <input type="hidden" name="discount" value={discount} />
      <input type="hidden" name="initialPayment" value={initialPayment} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      <Progress step={step} />
      {attempted &&
        errors.map((e) => (
          <p
            key={e}
            className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"
            role="alert"
          >
            {e}
          </p>
        ))}
      {step === 0 && (
        <section className="card">
          <StepTitle
            step="1"
            title="Registration type"
            description="Choose the path that matches the student."
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setRegistrationType(option.id);
                  setStudentRows([{ ...blankStudent }]);
                  setStudentId("");
                  changeFamily("");
                }}
                className={`rounded-2xl border p-4 text-left ${registrationType === option.id ? "border-violet-400 bg-violet-50 ring-4 ring-violet-100" : "bg-white"}`}
              >
                <b>{option.title}</b>
                <span className="mt-2 block text-xs text-slate-600">
                  {option.description}
                </span>
                <span className="mt-3 block rounded-xl bg-white p-2 text-xs font-semibold text-blue-800">
                  {option.behavior}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {step === 1 && (
        <section className="card">
          <StepTitle
            step="2"
            title="Family / guardian details"
            description="Every student belongs to a family. Parent and contact fields are optional unless marked required."
          />
          {showFamilySelector ? (
            <Select
              name="familyId"
              label="Existing Family Code"
              value={family.familyId}
              set={changeFamily}
            >
              <option value="">Select family</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.familyCode} — {f.name}
                </option>
              ))}
            </Select>
          ) : showFamily ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                name="familyName"
                label="Family / group name"
                value={family.familyName}
                set={(v) => setFamily({ ...family, familyName: v })}
                required
              />
              <Input
                name="familyEmail"
                label="Primary email"
                value={family.familyEmail}
                set={(v) => setFamily({ ...family, familyEmail: v })}
              />
              <Input
                name="familyPhone"
                label="Primary phone"
                value={family.familyPhone}
                set={(v) => setFamily({ ...family, familyPhone: v })}
              />
              <Input
                name="address"
                label="Address"
                value={family.address}
                set={(v) => setFamily({ ...family, address: v })}
              />
              <Input
                name="fatherFirstName"
                label="Father first name (optional)"
                value={family.fatherFirstName}
                set={(v) => setFamily({ ...family, fatherFirstName: v })}
              />
              <Input
                name="fatherLastName"
                label="Father last name (optional)"
                value={family.fatherLastName}
                set={(v) => setFamily({ ...family, fatherLastName: v })}
              />
              <Input
                name="fatherJob"
                label="Father job (optional)"
                value={family.fatherJob}
                set={(v) => setFamily({ ...family, fatherJob: v })}
              />
              <Input
                name="fatherPhone"
                label="Father phone"
                value={family.fatherPhone}
                set={(v) => setFamily({ ...family, fatherPhone: v })}
              />
              <Input
                name="motherFirstName"
                label="Mother first name (optional)"
                value={family.motherFirstName}
                set={(v) => setFamily({ ...family, motherFirstName: v })}
              />
              <Input
                name="motherLastName"
                label="Mother last name (optional)"
                value={family.motherLastName}
                set={(v) => setFamily({ ...family, motherLastName: v })}
              />
              <Input
                name="motherJob"
                label="Mother job (optional)"
                value={family.motherJob}
                set={(v) => setFamily({ ...family, motherJob: v })}
              />
              <Input
                name="motherPhone"
                label="Mother phone"
                value={family.motherPhone}
                set={(v) => setFamily({ ...family, motherPhone: v })}
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                name="guardianName"
                label="Optional guardian/contact name"
                value={family.guardianName}
                set={(v) => setFamily({ ...family, guardianName: v })}
              />
              <Input
                name="guardianPhone"
                label="Optional guardian/contact phone"
                value={family.guardianPhone}
                set={(v) => setFamily({ ...family, guardianPhone: v })}
              />
              <p className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-900 md:col-span-2">
                If a family payer should be responsible, go back and choose New
                family / group instead.
              </p>
            </div>
          )}
        </section>
      )}
      {step === 2 && (
        <section className="card">
          <StepTitle
            step="3"
            title="Student details"
            description="For family registrations, only the selected primary student is enrolled now. You can enroll another child after success."
          />
          {registrationType === "existing_family" ? (
            <div className="mb-4 flex gap-3">
              <button
                type="button"
                className={
                  existingFamilyMode === "existing"
                    ? "btn-primary"
                    : "btn-secondary"
                }
                onClick={() => {
                  setExistingFamilyMode("existing");
                  setStudentRows([{ ...blankStudent }]);
                }}
              >
                Enroll an existing family member
              </button>
              <button
                type="button"
                className={
                  existingFamilyMode === "new" ? "btn-primary" : "btn-secondary"
                }
                onClick={() => {
                  setExistingFamilyMode("new");
                  setStudentId("");
                  setStudentRows([{ ...blankStudent }]);
                }}
              >
                Add a new student to this family
              </button>
            </div>
          ) : null}
          {registrationType === "existing_family" &&
          existingFamilyMode === "existing" ? (
            <Select
              name="studentIdSelect"
              label="Student Code"
              value={studentId}
              set={changeStudent}
            >
              <option value="">Select student</option>
              {students
                .filter((student) => student.familyId === family.familyId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
            </Select>
          ) : (
            <>
              <Select
                name="primaryStudentIndexSelect"
                label="Primary student for this enrollment"
                value={primaryStudentIndex}
                set={setPrimaryStudentIndex}
              >
                {studentRows.map((_, i) => (
                  <option key={i} value={String(i)}>
                    Student {i + 1}
                  </option>
                ))}
              </Select>
              <div className="mt-4 grid gap-3">
                {studentRows.map((row, i) => (
                  <div
                    className="grid gap-3 rounded-2xl border bg-slate-50 p-3 md:grid-cols-5"
                    key={i}
                  >
                    <h4 className="font-black md:col-span-5">
                      Student {i + 1}
                      {i === Number(primaryStudentIndex) ? " — primary" : ""}
                    </h4>
                    {(
                      [
                        "firstName",
                        "lastName",
                        "dateOfBirth",
                        "email",
                        "phone",
                      ] as const
                    ).map((key) => {
                      return key === "dateOfBirth" ? (
                        <LocalizedDateInput
                          key={key}
                          name="studentDateOfBirth"
                          label="Date of birth"
                          defaultValue={row.dateOfBirth}
                          onChange={(v) =>
                            setStudentRows((rows) =>
                              rows.map((r, idx) =>
                                idx === i ? { ...r, dateOfBirth: v } : r,
                              ),
                            )
                          }
                        />
                      ) : (
                        <Input
                          key={key}
                          name={
                            key === "firstName"
                              ? "studentFirstName"
                              : key === "lastName"
                                ? "studentLastName"
                                : key === "email"
                                  ? "studentEmail"
                                  : "studentPhone"
                          }
                          label={key.replace(/([A-Z])/g, " $1")}
                          type={key === "email" ? "email" : "text"}
                          value={row[key]}
                          required={key === "firstName" || key === "lastName"}
                          set={(v) =>
                            setStudentRows((rows) =>
                              rows.map((r, idx) =>
                                idx === i ? { ...r, [key]: v } : r,
                              ),
                            )
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              {
                <button
                  className="btn-secondary mt-4"
                  type="button"
                  onClick={() =>
                    setStudentRows((r) => [...r, { ...blankStudent }])
                  }
                >
                  Add another student
                </button>
              }
            </>
          )}
        </section>
      )}
      {step === 3 && (
        <section className="card">
          <StepTitle
            step="4"
            title="Enrollment / activity"
            description="Choose the Instrument / Activity and eligible teacher."
          />
          <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-violet-700">
              Enrollment for
            </p>
            <p className="mt-1 text-lg font-black">
              {registrationType === "existing_family" &&
              existingFamilyMode === "existing"
                ? (students.find((student) => student.id === studentId)
                    ?.label ?? "Select a student")
                : `${studentRows[Number(primaryStudentIndex)]?.firstName || "New student"} ${studentRows[Number(primaryStudentIndex)]?.lastName || ""}`}
            </p>
            <p className="text-sm font-semibold text-slate-600">
              {registrationType === "existing_family"
                ? (families.find((item) => item.id === family.familyId)?.name ??
                  "Select a family")
                : family.familyName || "New family"}
            </p>
          </div>
          <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-950">
            <b>What is an enrollment?</b>
            <p>
              An enrollment registers one student for one instrument or activity
              during one season. It stores the student, season, teacher, level,
              dates, fee, discount, paid amount, and remaining balance. An
              enrollment is not an individual lesson. Individual lessons are
              generated or booked under the enrollment.
            </p>
            <pre className="mt-2 whitespace-pre-wrap">
              Student: Maria · Season: 2026–2027 · Instrument: Piano · Level:
              Beginner · Teacher: John · Dates: 15/09/26–30/06/27
            </pre>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Select
              name="seasonId"
              label="Season"
              value={seasonId}
              set={(v) => {
                const next = seasons.find((s) => s.id === v);
                setSeasonId(v);
                setEnrollmentStartDate(next?.startDate ?? "");
                setEnrollmentEndDate(next?.endDate ?? "");
              }}
            >
              <option value="">Season</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              name="courseId"
              label="Instrument / Activity"
              value={courseId}
              set={(v) => {
                setCourseId(v);
                setTeacherId("");
              }}
            >
              <option value="">Instrument / Activity</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              name="levelId"
              label="Level"
              value={levelId}
              set={(v) => {
                setLevelId(v);
                setTeacherId("");
              }}
            >
              <option value="">Level</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select
              name="teacherId"
              label="Teacher"
              value={teacherId}
              set={setTeacherId}
            >
              <option value="">Assign teacher later</option>
              {eligibleTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
            <LocalizedDateInput
              key={`start-${seasonId}-${activeStartDate}`}
              name="enrollmentStartDateDisplay"
              label="Enrollment start date"
              required
              defaultValue={activeStartDate}
              onChange={setEnrollmentStartDate}
            />
            <LocalizedDateInput
              key={`end-${seasonId}-${activeEndDate}`}
              name="enrollmentEndDateDisplay"
              label="Enrollment end date"
              defaultValue={activeEndDate}
              onChange={setEnrollmentEndDate}
            />
            <Input
              name="fee"
              label="Amount due"
              type="number"
              value={fee}
              set={setFee}
            />
            <Input
              name="discount"
              label="Discount"
              type="number"
              value={discount}
              set={setDiscount}
            />
          </div>
          {courseId && eligibleTeachers.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              No eligible teacher configured.{" "}
              {isAdmin ? (
                <Link className="underline" href="/teachers">
                  Manage teachers
                </Link>
              ) : (
                "Ask Admin to configure teacher activities."
              )}
            </p>
          ) : null}
          {suggestedPrice ? (
            <button
              type="button"
              className="btn-secondary mt-3"
              onClick={() => setFee(suggestedPrice)}
            >
              Use configured price: ${Number(suggestedPrice).toFixed(2)}
            </button>
          ) : null}
        </section>
      )}
      {step === 4 && (
        <section className="card">
          <StepTitle
            step="5"
            title="Payment"
            description="Optional initial payment. Receipt is created after final confirmation."
          />
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              name="initialPayment"
              label="Amount Paid"
              type="number"
              value={initialPayment}
              set={setInitialPayment}
            />
            <Select
              name="paymentMethod"
              label="Payment method"
              value={paymentMethod}
              set={setPaymentMethod}
            >
              <option value="cash">Cash</option>
              <option value="whish">Whish</option>
            </Select>
            <Review
              label="Remaining Balance"
              value={`$${balance.toFixed(2)}`}
            />
          </div>
        </section>
      )}
      {step === 5 && (
        <section className="card border-violet-200 bg-violet-50/30">
          <StepTitle
            step="6"
            title="First lesson and final review"
            description="Review everything before submitting. Nothing is saved until Confirm Registration."
          />
          <label className="flex items-center gap-2 font-bold">
            <input
              type="checkbox"
              name="bookFirstSession"
              value="1"
              checked={bookFirstSession}
              onChange={(e) => setBookFirstSession(e.target.checked)}
            />{" "}
            Book first lesson
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <LocalizedDateInput
              name="sessionDateDisplay"
              label="Lesson date"
              required={bookFirstSession}
              defaultValue={sessionDate}
              onChange={setSessionDate}
            />
            <Input
              name="startTime"
              label="Start time"
              type="time"
              value={startTime}
              set={setStartTime}
            />
            <Input
              name="endTime"
              label="End time"
              type="time"
              value={endTime}
              set={setEndTime}
            />
          </div>
          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3">
            <Review
              label="Registration type"
              value={
                options.find((o) => o.id === registrationType)?.title ?? "—"
              }
            />
            <Review
              label="Student(s)"
              value={
                registrationType === "existing_family" &&
                existingFamilyMode === "existing"
                  ? (students.find((student) => student.id === studentId)
                      ?.label ?? "—")
                  : `${studentRows.length} student row(s)`
              }
            />
            <Review
              label="Instrument / Activity"
              value={courses.find((c) => c.id === courseId)?.name ?? "—"}
            />
            <Review
              label="Amount due"
              value={`$${Number(fee || 0).toFixed(2)}`}
            />
            <Review
              label="Amount Paid"
              value={`$${Number(initialPayment || 0).toFixed(2)}`}
            />
            <Review
              label="Remaining Balance"
              value={`$${balance.toFixed(2)}`}
            />
          </dl>
          <button
            disabled={isPending}
            type="button"
            onClick={submit}
            className="btn-primary mt-5 w-full disabled:opacity-50 md:w-auto"
          >
            {isPending ? "Submitting…" : "Confirm Registration"}
          </button>
        </section>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          className="btn-secondary"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </button>
        {step < stepTitles.length - 1 ? (
          <button type="button" className="btn-primary" onClick={next}>
            Continue
          </button>
        ) : null}
      </div>
    </form>
  );
}
function Progress({ step }: { step: number }) {
  return (
    <ol className="grid gap-2 text-xs font-bold md:grid-cols-6">
      {stepTitles.map((title, i) => (
        <li
          key={title}
          className={`rounded-2xl border p-3 ${i <= step ? "border-violet-300 bg-violet-50 text-violet-900" : "bg-white text-slate-500"}`}
        >
          {i + 1}. {title}
        </li>
      ))}
    </ol>
  );
}
function StepTitle({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
        Step {step}
      </p>
      <h3 className="text-lg font-black">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
function Input({
  name,
  label,
  value,
  set,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  value: string;
  set: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-bold capitalize">
      {label}
      {required ? " *" : ""}
      <span className="ml-2 text-xs font-normal text-slate-500">
        {required ? "Required" : "Optional"}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="input mt-1"
      />
    </label>
  );
}
function Select({
  name,
  label,
  value,
  set,
  children,
}: {
  name: string;
  label: string;
  value: string;
  set: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <select
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="input mt-1"
      >
        {children}
      </select>
    </label>
  );
}
function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <dt className="text-xs font-black uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
