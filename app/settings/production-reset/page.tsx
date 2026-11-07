import { AppShell, EmptyState, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resetOptions, resetProtected, RESET_CONFIRMATION, isProductionResetEnvironmentAllowed, type ResetPreview } from "@/lib/production-reset";
import { previewReset, runProductionReset } from "@/actions/production-reset";

export const dynamic = "force-dynamic";
const messages: Record<string, string> = {
  selection: "Invalid selection. Choose supported categories only.",
  "not-authorized": "Authorization denied. Active SUPER_ADMIN access is required.",
  confirmation: `Review the preview and type ${RESET_CONFIRMATION} exactly.`,
  acknowledgement: "Explicit financial-history deletion acknowledgement is required.",
  blocked: "Blocked by dependencies. Review a new preview and resolve its blockers.",
  stale: "Data changed since preview, or the preview expired or was already used. Preview again.",
  failed: "The database operation failed and was rolled back. No partial reset was saved. Review the server error log and preview again.",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductionResetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [session, params] = await Promise.all([requireSession(), searchParams]);
  if (session.role !== "SUPER_ADMIN") return <AppShell session={session}><EmptyState title="SUPER_ADMIN access required" description="Authorization denied. Production Reset is restricted to an active SUPER_ADMIN." /></AppShell>;
  if (!isProductionResetEnvironmentAllowed()) return <AppShell session={session}><EmptyState title="Production Reset unavailable" description="Reset previews and execution are disabled in Vercel Preview and development deployments. These environments may share production data." /></AppShell>;
  let request = null;
  let loadFailed = false;
  const requestId = params.preview ?? params.result;
  if (requestId && uuid.test(requestId)) {
    try { request = await prisma.productionResetRequest.findFirst({ where: { id: requestId, actorId: session.userId } }); }
    catch { loadFailed = true; }
  }
  const preview = request?.preview as ResetPreview | undefined;
  const result = request?.result as { deleted: Record<string, number>; updated: Record<string, number>; totals: { deleted: number; updated: number } } | undefined;
  const expired = request && request.expiresAt.getTime() <= Date.now();
  const canExecute = preview && !preview.blocked.length && !expired && !request?.consumedAt;
  return <AppShell session={session}>
    <PageHeader title="Production Reset" description="Preview the exact scope before deleting data. Every date and status is included. Users, authentication and audit history are protected." />
    {(params.error || loadFailed || (requestId && !request)) && <p role="alert" className="my-4 rounded border border-red-300 bg-red-50 p-4">{loadFailed ? messages.failed : messages[params.error ?? "stale"] ?? messages.failed}</p>}
    {request?.consumedAt && result && <section role="status" className="my-4 rounded border border-green-300 bg-green-50 p-4">
      <h2 className="font-bold">Completed successfully</h2><p>{result.totals.deleted} records deleted; {result.totals.updated} records updated. Changes and the audit entry committed together.</p>
      <ul>{Object.entries(result.deleted).map(([key,count]) => <li key={key}>{key}: {count} deleted</li>)}{Object.entries(result.updated).map(([key,count]) => <li key={key}>{key}: {count} updated</li>)}</ul>
    </section>}
    <form action={previewReset} className="my-6 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">Select categories</h2>
      <div className="my-4 grid gap-3 md:grid-cols-2">{resetOptions.map(option => <label key={option.key} className="flex gap-3 rounded border p-4">
        <input type="checkbox" name={option.key} defaultChecked={preview?.selection[option.key]} className="mt-1" />
        <span><strong className="block">{option.label}</strong><span className="text-sm">{option.description}</span></span>
      </label>)}</div>
      <button className="rounded bg-primary px-4 py-2 text-white">Generate deletion preview</button>
    </form>
    {preview && !request?.consumedAt && <section className="my-6 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">Review the complete plan</h2>
      <p>Selected: {resetOptions.filter(option => preview.selection[option.key]).map(option => option.label).join(", ")}</p>
      <p>{preview.totals.deleted} deletions + {preview.totals.updated} updates = {preview.totals.affected} affected records.</p>
      <div className="overflow-x-auto"><table className="my-4 w-full text-left"><thead><tr><th>Record / change</th><th>Count</th><th>Effect</th><th>Reason</th></tr></thead><tbody>
        {preview.operations.map(row => <tr key={row.operation} className="border-t"><td className="p-2">{row.operation}</td><td>{row.count}</td><td>{row.effect} deletion</td><td>{row.reason}</td></tr>)}
        {preview.updates.map(row => <tr key={row.operation} className="border-t"><td className="p-2">{row.operation}</td><td>{row.count}</td><td>update</td><td>{row.reason}</td></tr>)}
      </tbody></table></div>
      <h3 className="font-bold">Consequences</h3><ul className="list-disc pl-5">{preview.consequences.map(text => <li key={text}>{text}</li>)}</ul>
      {preview.selection.financialData && <div className="my-4 rounded bg-amber-50 p-3"><h3 className="font-bold">Financial history being removed (amounts in cents)</h3><ul>{Object.entries(preview.financial).map(([key,value]) => <li key={key}>{key}: {value}</li>)}</ul><p>Cash, Whish and other methods are reported separately. Payment totals exclude voids; expense totals exclude archived expenses. All those records are still included in deletion counts.</p></div>}
      {preview.blocked.length > 0 && <div role="alert" className="my-4 rounded bg-red-50 p-4"><h3 className="font-bold">Blocked by dependencies</h3><ul className="list-disc pl-5">{preview.blocked.map(text => <li key={text}>{text}</li>)}</ul></div>}
      {expired && <p role="alert">This preview has expired. Generate a new preview.</p>}
      {canExecute && <form action={runProductionReset} className="mt-5 space-y-4 border-t pt-4">
        <input type="hidden" name="requestId" value={request!.id} />
        <label className="block"><input type="checkbox" name="reviewed" required /> I reviewed all deletions, updates, dependencies and preserved records.</label>
        {preview.selection.financialData && <label className="block"><input type="checkbox" name="financialAcknowledged" required /> I explicitly authorize deleting financial history, including paid payroll, closed shifts and reconciliation snapshots.</label>}
        <label className="block">Type <strong>{RESET_CONFIRMATION}</strong><input name="confirmation" required autoComplete="off" className="mt-2 block w-full rounded border p-2" /></label>
        <p className="text-sm">The server checks this preview again before execution. It expires after ten minutes.</p>
        <button className="rounded bg-red-700 px-4 py-2 font-bold text-white">Execute reviewed reset</button>
      </form>}
    </section>}
    <section className="rounded border bg-amber-50 p-4"><h2 className="font-bold">Always protected</h2><ul className="list-disc pl-5">{resetProtected.map(text => <li key={text}>{text}</li>)}</ul></section>
  </AppShell>;
}
