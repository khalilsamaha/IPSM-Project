import { archiveFamily, saveFamily } from "@/actions/records";
import { AppShell, Pager, SearchBox } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { buildPageHref, getPagination } from "@/lib/records/pagination";

export default async function FamiliesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await requireSession();
  const { q, page, skip, take } = getPagination(await searchParams);
  const where = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q, mode: "insensitive" as const } }] } : {};
  const [rows, total] = await Promise.all([prisma.family.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take, include: { _count: { select: { students: true } } } }), prisma.family.count({ where })]);
  return <AppShell session={session}><h2 className="mb-4 text-2xl font-bold">Families</h2><SearchBox q={q} placeholder="Search families" />
    <form action={saveFamily} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3"><input name="name" required placeholder="Family name" className="rounded border p-2"/><input name="email" type="email" placeholder="Email" className="rounded border p-2"/><input name="phone" placeholder="Phone" className="rounded border p-2"/><select name="status" className="rounded border p-2"><option>ACTIVE</option><option>INACTIVE</option></select><input name="notes" placeholder="Notes" className="rounded border p-2 md:col-span-2"/><button className="rounded bg-primary px-4 py-2 text-white">Add family</button></form>
    <Table rows={rows}/><Pager page={page} total={total} hrefFor={(p)=>buildPageHref('/families',p,q)} /></AppShell>;
}
function Table({ rows }: { rows: Awaited<ReturnType<typeof prisma.family.findMany>> }) {return <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-3">Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Students</th><th>Actions</th></tr></thead><tbody>{rows.map((r:any)=><tr className="border-t" key={r.id}><td className="p-3 font-medium">{r.name}</td><td>{r.email ?? '—'}</td><td>{r.phone ?? '—'}</td><td>{r.status}</td><td>{r._count.students}</td><td><form action={archiveFamily}><input type="hidden" name="id" value={r.id}/><button className="text-primary">Archive</button></form></td></tr>)}</tbody></table></div>}
