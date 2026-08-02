import { ShieldAlert } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { getProductionResetCounts } from "@/lib/production-reset";
import { runProductionReset } from "@/actions/production-reset";

const deleteOptions = [
  [
    "operationalData",
    "Operational data",
    "Enrollments, registration attempts, schedules, payroll, payments, expenses, and cashier shifts.",
  ],
  [
    "financialData",
    "Financial data",
    "Payments, allocations, receipts, expenses, cashier shifts, and generated teacher payroll records.",
  ],
  [
    "scheduleData",
    "Schedule data",
    "Lesson sessions, recurring patterns, and payroll records derived from those sessions.",
  ],
  [
    "studentsFamilies",
    "Students / families",
    "Students and families plus dependent registration attempts, enrollments, schedules, payroll items, and payments.",
  ],
  [
    "teachers",
    "Teachers",
    "Teachers plus assignments, availability, recurring patterns, lessons, and payroll records.",
  ],
  [
    "seasons",
    "Seasons",
    "Seasons plus dependent enrollments, schedules, payroll records, payments, and season-scoped pricing and availability.",
  ],
] as const;

export default async function ProductionResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  if (!isSuperAdmin(session.role)) {
    return (
      <AppShell session={session}>
        <PageHeader
          title="Not authorized"
          description="Production Reset is restricted to SUPER_ADMIN users."
        />
        <EmptyState
          title="SUPER_ADMIN access required"
          description="This destructive delivery-readiness tool is not available to Admin or Reception users."
        />
      </AppShell>
    );
  }

  const counts = await getProductionResetCounts(prisma);
  const errorMessage =
    params.error === "confirmation"
      ? "Type RESET exactly."
      : params.error === "selection"
        ? "Choose at least one data group."
        : params.error === "not-authorized"
          ? "You are not authorized to run this operation."
          : params.error === "failed"
            ? "The reset failed and was rolled back. No partial deletion was kept. Check the server log for the recorded failure."
            : null;

  return (
    <AppShell session={session}>
      <PageHeader
        title="Production Reset"
        description="SUPER_ADMIN-only tool to remove demo or test data before delivery without deleting users, roles, the academic catalogue, rooms, settings, or Supabase Auth users."
      />
      {params.success ? (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
          Production reset completed and audited.
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          Reset blocked: {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Object.entries(counts).map(([label, value]) => (
          <div className="rounded-2xl border bg-white p-4 shadow-sm" key={label}>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {label.replace(/([A-Z])/g, " $1")}
            </p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>

      <form
        action={runProductionReset}
        className="mt-6 rounded-[1.5rem] border border-red-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 size-5 text-red-600" />
          <div>
            <h2 className="text-lg font-black">Choose data to delete</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Deletions run inside one transaction in foreign-key-safe order. Any failure rolls the complete reset back and writes a server error log.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {deleteOptions.map(([name, label, help]) => (
            <label className="rounded-2xl border bg-slate-50 p-4" key={name}>
              <span className="flex gap-3">
                <input className="mt-1" name={name} type="checkbox" />
                <span>
                  <span className="block font-bold">{label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{help}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Kept by default:</strong> users, roles, courses, course levels, global course pricing, rooms, school closures, operational settings, and Supabase Auth users.
        </div>
        <label className="mt-5 block text-sm font-bold">
          Type RESET to execute
          <input
            className="mt-2 w-full rounded-xl border p-3"
            name="confirmation"
            placeholder="RESET"
          />
        </label>
        <button className="mt-5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700">
          Run Production Reset
        </button>
      </form>
    </AppShell>
  );
}
