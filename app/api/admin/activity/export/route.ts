import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/records/format";
import { auditOutcome, describeAudit } from "@/lib/activity/describe";

const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
export async function GET(request: Request) {
  const session = await requireSession();
  if (!isSuperAdmin(session.role)) return new NextResponse("Not authorized", { status: 403 });
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const where = { AND: [params.dateFrom ? { createdAt: { gte: new Date(params.dateFrom) } } : {}, params.dateTo ? { createdAt: { lte: new Date(params.dateTo) } } : {}, params.user ? { OR: [{ createdById: params.user }, { actorId: params.user }] } : {}, params.role ? { createdBy: { role: params.role as any } } : {}, params.action ? { action: params.action } : {}, params.module ? { entity: params.module } : {}, params.outcome ? { metadata: { path: ["outcome"], equals: params.outcome } } : {}, params.entity ? { OR: [{ entityId: params.entity }, { entity: { contains: params.entity, mode: "insensitive" as const } }] } : {}, params.search ? { OR: [{ action: { contains: params.search, mode: "insensitive" as const } }, { entity: { contains: params.search, mode: "insensitive" as const } }, { entityId: { contains: params.search, mode: "insensitive" as const } }] } : {}] };
  const logs = await prisma.auditLog.findMany({ where, select: { action: true, entity: true, entityId: true, actorId: true, createdAt: true, metadata: true, createdBy: { select: { name: true, role: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 5000 });
  const body = [["Timestamp", "Actor", "Role", "Action", "Module", "Description", "Affected record", "Outcome"].map(csv).join(","), ...logs.map((log) => [formatDateTime(log.createdAt), log.createdBy?.name ?? log.createdBy?.email ?? log.actorId ?? "System", log.createdBy?.role ?? "—", log.action, log.entity, describeAudit(log), log.entityId ?? "—", auditOutcome(log.metadata)].map(csv).join(","))].join("\n");
  return new NextResponse(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="activity.csv"' } });
}
