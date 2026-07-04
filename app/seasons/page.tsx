import { redirect } from "next/navigation";
import Link from "next/link";
import { activateSeason, archiveSeason, closeSeason, restoreSeason, saveSeason } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, DataTable, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/records/format";
import { prisma } from "@/lib/prisma";

type Params = { q?: string; status?: string };
const statuses = ["all", "PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"];

export default async function SeasonsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");
  const isAdmin = session.role === "ADMIN";
  const where = { AND: [params.status && params.status !== "all" ? { status: params.status as any } : {}, params.q ? { name: { contains: params.q, mode: "insensitive" as const } } : {}] };
  const rows = await prisma.season.findMany({ where, orderBy: { startDate: "desc" } });
  return <AppShell session={session}>
    <div className="mb-4"><h2 className="text-2xl font-bold">Seasons</h2><p className="text-sm text-muted-foreground">Lifecycle statuses are visible to all staff. Only Admin can activate, close, or archive seasons.</p></div>
    <form className="mb-5 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3"><input name="q" defaultValue={params.q ?? ""} placeholder="Search seasons" className="rounded border p-2"/><select name="status" defaultValue={params.status ?? "all"} className="rounded border p-2">{statuses.map((s)=><option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>)}</select><button className="rounded bg-primary px-4 py-2 text-white">Filter</button></form>
    {isAdmin ? <form action={saveSeason} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"><input name="name" required placeholder="Season name" className="rounded border p-2"/><input name="startDate" required type="date" className="rounded border p-2"/><input name="endDate" required type="date" className="rounded border p-2"/><select name="status" className="rounded border p-2"><option>PLANNED</option><option>ACTIVE</option></select><button className="rounded bg-primary px-4 py-2 text-white">Create season</button></form> : null}
    <DataTable><thead className="bg-muted"><tr><th className="p-3">Name</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((r)=><tr className="border-t" key={r.id}><td className="p-3 font-medium">{r.name}</td><td>{formatDate(r.startDate)}</td><td>{formatDate(r.endDate)}</td><td><StatusBadge status={r.status}/></td><td className="flex flex-wrap gap-2"><Link className="text-primary" href={`/seasons/${r.id}/closing-report`}>View closing report</Link>{isAdmin && r.status === "PLANNED" ? <form action={activateSeason}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-primary" message="Activate this season?">Activate</ConfirmSubmitButton></form> : null}{isAdmin && r.status === "ACTIVE" ? <form action={closeSeason}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-amber-700" message="Close this season? New enrollments and lessons will be blocked.">Close</ConfirmSubmitButton></form> : null}{isAdmin && r.status === "CLOSED" ? <form action={activateSeason}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-primary" message="Reopen this season?">Reopen</ConfirmSubmitButton></form> : null}{isAdmin && r.status !== "ARCHIVED" ? <form action={archiveSeason}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-red-700" message="Archive this season? Existing records remain visible in reports.">Archive</ConfirmSubmitButton></form> : null}{isAdmin && r.status === "ARCHIVED" ? <form action={restoreSeason}><input type="hidden" name="id" value={r.id}/><ConfirmSubmitButton className="text-primary" message="Restore this season to active?">Restore</ConfirmSubmitButton></form> : null}</td></tr>)}</tbody></DataTable>
  </AppShell>;
}
