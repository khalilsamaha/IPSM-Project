import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const safe = (value: unknown) => String(value ?? "—").replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "-");
function simplePdf(lines: string[]) {
  const content = lines.slice(0, 55).map((line, i) => `BT /F1 8 Tf 30 ${810-i*14} Td (${safe(line)}) Tj ET`).join("\n");
  const objects = ["1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj", "2 0 obj << /Type /Pages /Kids [4 0 R] /Count 1 >> endobj", "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj", `4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >> endobj`, `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`];
  let out="%PDF-1.4\n"; const offsets=[0]; for(const o of objects){offsets.push(Buffer.byteLength(out));out+=o+"\n";} const x=Buffer.byteLength(out); out+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,"0")+" 00000 n ").join("\n")}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`; return Buffer.from(out);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.role, "records:write")) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { id } = await params;
  const shift = await prisma.cashierShift.findUnique({ where: { id }, include: { user: true, closedBy: true, payments: { include: { family: true }, orderBy: { createdAt: "asc" } }, expenses: { orderBy: { createdAt: "asc" } } } });
  if (!shift || !["CLOSED", "AUTO_CLOSED"].includes(shift.status)) return NextResponse.json({ error: "Closed shift not found" }, { status: 404 });
  const audits = await prisma.auditLog.findMany({ where: { entity: "CashierShift", entityId: id }, orderBy: { createdAt: "asc" } });
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "pdf";
  await prisma.auditLog.create({ data: { action: `export_${format}`, entity: "CashierShift", entityId: id, actorId: session.userId, createdById: user?.id, metadata: { snapshotVersion: 1 } } });
  const snapshot = shift.closingSnapshot && typeof shift.closingSnapshot === "object" ? shift.closingSnapshot as Record<string, unknown> : {};
  const summary: [string, unknown][] = [["Shift ID",shift.id],["Business date",shift.businessDate.toISOString().slice(0,10)],["Receptionist",shift.user.name],["Opened",shift.openedAt.toISOString()],["Closed",shift.closedAt?.toISOString()],["Closing mode",shift.status === "AUTO_CLOSED" ? "automatic" : "manual/reconciled"],["Opening cash cents",shift.openingCashCents],["Expected cash cents",shift.expectedCashCents],["Declared cash cents",shift.declaredCashCents],["Difference cents",shift.differenceCents],["Variance reason",shift.varianceReason],["Closing snapshot version",1],["Closing snapshot",JSON.stringify(snapshot)]];
  if (format === "csv") {
    const rows=["\uFEFFSummary","Field,Value",...summary.map(r=>r.map(csv).join(",")),"","Payments","Receipt,Payer,Method,Amount cents,Status",...shift.payments.map(p=>[p.receiptNumber,p.family.name,p.paymentMethod,p.totalAmountCents,p.voidedAt?"voided":"posted"].map(csv).join(",")),"","Expenses","Date,Category,Description,Method,Amount cents,Status",...shift.expenses.map(e=>[e.expenseDate.toISOString().slice(0,10),e.category,e.description,e.paymentMethod,e.amountCents,e.archivedAt?"archived":"active"].map(csv).join(",")),"","Audit history","Time,Action,Metadata",...audits.map(a=>[a.createdAt.toISOString(),a.action,JSON.stringify(a.metadata)].map(csv).join(","))];
    return new NextResponse(rows.join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="shift-${id}.csv"` } });
  }
  const lines=["IPSM Shift Closing Report",...summary.map(([k,v])=>`${k}: ${v ?? "-"}`),"Payments",...shift.payments.map(p=>`${p.receiptNumber ?? "-"} | ${p.family.name} | ${p.paymentMethod} | ${p.totalAmountCents} | ${p.voidedAt?"voided":"posted"}`),"Expenses",...shift.expenses.map(e=>`${e.category} | ${e.description} | ${e.paymentMethod} | ${e.amountCents} | ${e.archivedAt?"archived":"active"}`),"Closing and reopening history",...audits.map(a=>`${a.createdAt.toISOString()} | ${a.action}`)];
  return new NextResponse(simplePdf(lines), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="shift-${id}.pdf"` } });
}
