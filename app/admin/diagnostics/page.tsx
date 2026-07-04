import { AppShell, DataTable, PageHeader, StatusBadge } from "@/components/records/shell";
import { NotAuthorized } from "@/lib/auth/not-authorized";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { getDataIntegrityDiagnostics } from "@/lib/diagnostics/data-integrity";

export default async function DiagnosticsPage() {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) return <NotAuthorized session={session} />;
  const checks = await getDataIntegrityDiagnostics();
  return <AppShell session={session}>
    <PageHeader title="Data Integrity Diagnostics" description="Admin-only production readiness checks for records that need repair before closeout, reporting, or audit review." />
    <DataTable><thead><tr><th>Check</th><th>Issue count</th><th>Status</th><th>What to review</th></tr></thead><tbody>{checks.map((check) => <tr key={check.key}><td className="font-bold">{check.label}</td><td>{check.count}</td><td><StatusBadge status={check.status === "pass" ? "Pass" : "Review"} /></td><td>{check.description}</td></tr>)}</tbody></DataTable>
  </AppShell>;
}
