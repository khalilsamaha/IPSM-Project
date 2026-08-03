"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { saveTeacherProfile } from "@/actions/teacher-profile";

type TeacherProfileFormProps = {
  teacher: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    compensationBasis: "HOURLY" | "SESSION_UNIT";
    hourlyRate: string;
    sessionRate: string;
    status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
    notes: string | null;
  };
};

function Field({
  label,
  help,
  children,
  className = "",
}: {
  label: string;
  help?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-bold ${className}`}>
      {label}
      <span className="mt-1 block">{children}</span>
      {help ? <span className="mt-1 block text-xs font-normal text-muted-foreground">{help}</span> : null}
    </label>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Saving teacher profile…" : "Save teacher profile"}
    </button>
  );
}

export function TeacherProfileForm({ teacher }: TeacherProfileFormProps) {
  const [basis, setBasis] = useState(teacher.compensationBasis);

  return (
    <form action={saveTeacherProfile} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="id" value={teacher.id} />

      <Field label="Teacher full name" help="The name displayed on schedules, payrolls and reports.">
        <input name="fullName" required defaultValue={teacher.fullName} className="input" />
      </Field>
      <Field label="Email address" help="Optional contact address for the teacher.">
        <input name="email" type="email" defaultValue={teacher.email ?? ""} className="input" />
      </Field>
      <Field label="Phone number" help="Optional contact phone number.">
        <input name="phone" defaultValue={teacher.phone ?? ""} className="input" />
      </Field>
      <Field label="Profile status" help="Inactive and archived teachers cannot be selected for new scheduling.">
        <select name="status" defaultValue={teacher.status} className="input">
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </Field>

      <Field
        label="Payroll compensation method"
        help="Choose whether the saved rate applies to every 30-minute lesson or to each full hour."
        className="lg:col-span-2"
      >
        <select
          name="compensationBasis"
          value={basis}
          onChange={(event) => setBasis(event.target.value as typeof basis)}
          className="input"
        >
          <option value="SESSION_UNIT">Per 30-minute lesson</option>
          <option value="HOURLY">Per hour</option>
        </select>
      </Field>

      {basis === "SESSION_UNIT" ? (
        <>
          <Field
            label="Rate for one 30-minute lesson"
            help="Example: $15 means every completed 30-minute lesson adds $15 to payroll. Ten lessons equal $150."
            className="lg:col-span-2"
          >
            <input
              name="sessionRate"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={teacher.sessionRate}
              className="input"
            />
          </Field>
          <input type="hidden" name="hourlyRate" value={teacher.hourlyRate} />
        </>
      ) : (
        <>
          <Field
            label="Hourly rate"
            help="Example: $15 means 30 minutes adds $7.50 and a full hour adds $15."
            className="lg:col-span-2"
          >
            <input
              name="hourlyRate"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={teacher.hourlyRate}
              className="input"
            />
          </Field>
          <input type="hidden" name="sessionRate" value={teacher.sessionRate} />
        </>
      )}

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 md:col-span-2 lg:col-span-4">
        <p className="font-black">Lesson duration used by payroll: 30 minutes</p>
        <p className="mt-1">
          The scheduling system creates 30-minute slots. Session-based payroll therefore multiplies the saved lesson rate by the number of payable 30-minute lessons, not by the number of hours.
        </p>
      </div>

      <Field label="Internal notes" help="Optional notes for administrators." className="md:col-span-2 lg:col-span-4">
        <textarea name="notes" defaultValue={teacher.notes ?? ""} className="input min-h-24" />
      </Field>

      <div className="md:col-span-2 lg:col-span-4">
        <SaveButton />
        <p className="mt-2 text-xs text-muted-foreground">A confirmation message will appear after the update is saved.</p>
      </div>
    </form>
  );
}
