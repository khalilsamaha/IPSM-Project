import Link from "next/link";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { archiveStudent, restoreStudent } from "@/actions/records";
import { AppShell, DataTable, Pager, SearchBox, StatusBadge, StatusTabs, getStatusFilter, type RecordStatusFilter } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/records/format";
import { getPagination } from "@/lib/records/pagination";

type Params = { q?: string; page?: string; status?: string };
const hrefFor = (p: number, q?: string, status?: string) => { const next = new URLSearchParams(); if (q) next.set("q", q); if (status && status !== "active") next.set("status", status); if (p > 1) next.set("page", String(p)); return next.toString() ? `/students?${next}` : "/students"; };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = await requireSession();
  const { q, page, skip, take } = getPagination(params);
  const status = getStatusFilter(params.status);
  const where = { AND: [status === "archived" ? { status: "INACTIVE" as const } : status === "active" ? { status: "ACTIVE" as const } : {}, q ? { OR: [{ studentCode: { contains: q, mode: "insensitive" as const } }, { firstName: { contains: q, mode: "insensitive" as const } }, { lastName: { contains: q, mode: "insensitive" as const } }, { family: { name: { contains: q, mode: "insensitive" as const } } }] } : {}] };
  const [rows, total] = await Promise.all([
    prisma.student.findMany({ where, include: { family: true, enrollments: { include: { season: true }, orderBy: { season: { startDate: "desc" } } } }, orderBy: { updatedAt: "desc" }, skip, take }),
    prisma.student.count({ where }),
  ]);

  return <AppShell session={session}>
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 className="text-2xl font-bold">Students</h2>
        <p className="mt-2 text-sm text-muted-foreground">Search, filter, archive, and restore student records. Use Register Student for new independent students or Family / Group registrations.</p>
      </div>
      <Link className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm" href="/register-student">Register Student</Link>
    </div>
    <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]"><SearchBox q={q} placeholder="Search students or Student ID" /><StatusTabs value={status} hrefFor={(nextStatus: RecordStatusFilter) => hrefFor(1, q, nextStatus)} /></div>
    <DataTable><thead className="bg-muted"><tr><th className="p-3">Student ID</th><th>Student</th><th>Family</th><th>DOB</th><th>Balances</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(r => { const active = r.enrollments.filter(e => e.season.status === "ACTIVE").reduce((sum,e)=>sum+e.remainingCents,0); const previous = r.enrollments.filter(e => e.season.status !== "ACTIVE").reduce((sum,e)=>sum+e.remainingCents,0); const total = active + previous; return <tr className="border-t" key={r.id}><td className="p-3 font-mono text-xs font-bold">{r.studentCode}</td><td className="font-medium">{r.firstName} {r.lastName}</td><td>{r.family?.name ?? "Independent student"}</td><td>{formatDate(r.dateOfBirth)}</td><td className="text-xs"><div>Current: {formatCurrency(active)}</div><div>Previous unpaid: {formatCurrency(previous)}</div><div className="font-bold">Total: {formatCurrency(total)}</div></td><td><StatusBadge status={r.status} /></td><td>{r.status === "INACTIVE" ? <form action={restoreStudent}><input type="hidden" name="id" value={r.id} /><ConfirmSubmitButton className="text-primary" message="Restore this student?">Restore</ConfirmSubmitButton></form> : <form action={archiveStudent}><input type="hidden" name="id" value={r.id} /><ConfirmSubmitButton className="text-primary" message="Archive this record? This will hide it from active workflows.">Archive</ConfirmSubmitButton></form>}</td></tr>})}</tbody></DataTable>
    <Pager page={page} total={total} hrefFor={(p) => hrefFor(p, q, status)} />
  </AppShell>;
}
