import { AppShell, DataTable, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/records/format";

type SearchParams = { dateFrom?: string; dateTo?: string; user?: string; role?: string; module?: string; action?: string; outcome?: string; entity?: string; search?: string };

function sanitizeMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return metadata;
  const blocked = /password|token|secret|pdf|digest/i;
  return Object.fromEntries(Object.entries(metadata as Record<string, unknown>).filter(([key]) => !blocked.test(key)));
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();
  const params = await searchParams;
  if (!isSuperAdmin(session.role)) return <AppShell session={session}><PageHeader title="Not authorized" description="Activity Monitoring is restricted to SUPER_ADMIN users." /></AppShell>;
  const where = { AND: [params.dateFrom ? { createdAt: { gte: new Date(params.dateFrom) } } : {}, params.dateTo ? { createdAt: { lte: new Date(params.dateTo) } } : {}, params.action ? { action: { contains: params.action, mode: "insensitive" as const } } : {}, params.module ? { entity: { contains: params.module, mode: "insensitive" as const } } : {}, params.entity ? { OR: [{ entityId: params.entity }, { entity: { contains: params.entity, mode: "insensitive" as const } }] } : {}, params.search ? { OR: [{ action: { contains: params.search, mode: "insensitive" as const } }, { entity: { contains: params.search, mode: "insensitive" as const } }] } : {}] };
  const logs = await prisma.auditLog.findMany({ where, include: { createdBy: { select: { name: true, role: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <AppShell session={session}>
    <PageHeader title="Activity Monitoring" description="SUPER_ADMIN view of meaningful business and security audit events. Passwords, tokens, secrets, receipt PDFs, and internal digests are sanitized." />
    <form className="mb-4 grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4">
      <input className="rounded border p-2" type="date" name="dateFrom" defaultValue={params.dateFrom} /><input className="rounded border p-2" type="date" name="dateTo" defaultValue={params.dateTo} />
      <input className="rounded border p-2" name="module" placeholder="Module/entity" defaultValue={params.module} /><input className="rounded border p-2" name="action" placeholder="Action" defaultValue={params.action} />
      <input className="rounded border p-2" name="entity" placeholder="Entity ID/code" defaultValue={params.entity} /><input className="rounded border p-2" name="search" placeholder="Search" defaultValue={params.search} />
      <select className="rounded border p-2" name="outcome" defaultValue={params.outcome ?? ""}><option value="">All outcomes</option><option>success</option><option>blocked</option><option>failure</option></select><button className="rounded bg-primary px-4 py-2 text-white">Filter</button>
    </form>
    <DataTable><thead><tr><th className="p-3">Timestamp</th><th>Actor</th><th>Role</th><th>Action</th><th>Module/entity</th><th>Description</th><th>Affected record</th><th>Outcome</th><th>Metadata</th></tr></thead><tbody>{logs.map((log) => { const metadata = sanitizeMetadata(log.metadata) as any; return <tr className="border-t" key={log.id}><td className="p-3">{formatDateTime(log.createdAt)}</td><td>{log.createdBy?.name ?? log.createdBy?.email ?? log.actorId ?? "System"}</td><td>{log.createdBy?.role ?? "—"}</td><td>{log.action}</td><td>{log.entity}</td><td>{metadata?.description ?? `${log.action} ${log.entity}`}</td><td>{metadata?.code ?? metadata?.name ?? log.entityId ?? "—"}</td><td>{metadata?.outcome ?? "success"}</td><td><pre className="max-w-xs whitespace-pre-wrap text-xs">{JSON.stringify(metadata ?? {}, null, 2)}</pre></td></tr>; })}</tbody></DataTable>
  </AppShell>;
}
