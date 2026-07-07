import { ShieldAlert } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { getProductionResetCounts } from "@/lib/production-reset";
import { runProductionReset } from "@/actions/production-reset";

const deleteOptions = [
  ["operationalData", "Operational data", "Enrollments plus dependent schedule and financial transaction records."],
  ["financialData", "Financial data", "Payments, payment items, receipts, and expenses."],
  ["scheduleData", "Schedule data", "Schedule sessions only."],
  ["studentsFamilies", "Students / families", "Students and families plus dependent enrollments, schedule sessions, and payments."],
  ["teachers", "Teachers", "Teachers plus availability, teaching links, and schedule sessions."],
  ["seasons", "Seasons", "Seasons plus enrollments, schedule sessions, and teacher availability."],
] as const;

export default async function ProductionResetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  if (!isSuperAdmin(session.role)) {
    return <AppShell session={session}><PageHeader title="Not authorized" description="Production Reset is restricted to SUPER_ADMIN users." /><EmptyState title="SUPER_ADMIN access required" description="This destructive delivery-readiness tool is not available to Admin or Reception users." /></AppShell>;
  }

  const counts = await getProductionResetCounts(prisma);
  return (
    <AppShell session={session}>
      <PageHeader title="Production Reset" description="SUPER_ADMIN-only tool to safely remove demo/test data before delivery without deleting users, roles, academic catalog, rooms, settings, or Supabase Auth users." />
      {params.success ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">Production reset completed and audited.</div> : null}
      {params.error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">Reset blocked: {params.error === "confirmation" ? "type RESET exactly" : params.error === "selection" ? "choose at least one data group" : "not authorized"}.</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Object.entries(counts).map(([label, value]) => <div className="rounded-2xl border bg-white p-4 shadow-sm" key={label}><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label.replace(/([A-Z])/g, " $1")}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}
      </section>

      <form action={runProductionReset} className="mt-6 rounded-[1.5rem] border border-red-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><ShieldAlert className="mt-1 size-5 text-red-600" /><div><h2 className="text-lg font-black">Choose data to delete</h2><p className="mt-1 text-sm text-muted-foreground">Deletes run in dependency-safe order and write an audit log entry. Supabase Auth users are never deleted.</p></div></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {deleteOptions.map(([name, label, help]) => <label className="rounded-2xl border bg-slate-50 p-4" key={name}><span className="flex gap-3"><input className="mt-1" name={name} type="checkbox" /><span><span className="block font-bold">{label}</span><span className="mt-1 block text-sm text-muted-foreground">{help}</span></span></span></label>)}
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Kept by default:</strong> users, roles, courses, course levels, course pricing, rooms, settings, and Supabase Auth users.</div>
        <label className="mt-5 block text-sm font-bold">Type RESET to execute<input className="mt-2 w-full rounded-xl border p-3" name="confirmation" placeholder="RESET" /></label>
        <button className="mt-5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700">Run Production Reset</button>
      </form>
    </AppShell>
  );
}
