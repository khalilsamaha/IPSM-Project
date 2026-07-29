import type { DeletionPreview } from "@/lib/deletion/entity-deletion";

export function DeletionPanel({ preview, action }: { preview: DeletionPreview; action: (data: FormData) => void | Promise<void> }) {
  const confirmation = `DELETE ${preview.referenceCode ?? preview.displayName}`;
  return <section className="rounded-xl border border-red-200 bg-white p-5" aria-labelledby="deletion-review"><h3 id="deletion-review" className="font-black">Permanent deletion review</h3><p className="mt-2"><b>Record:</b> {preview.referenceCode ? `${preview.referenceCode} — ` : ""}{preview.displayName}</p><p><b>Status:</b> {preview.archived ? "Archived" : "Active"}</p>
    <h4 className="mt-3 font-bold">Protected dependencies</h4>{preview.blockers.some(x => x.count) ? <ul className="list-disc pl-5">{preview.blockers.filter(x => x.count).map(x => <li key={x.key}>{x.count} {x.label.toLowerCase()} — {x.explanation}</li>)}</ul> : <p>No protected history was found.</p>}
    <h4 className="mt-3 font-bold">Configuration records removed</h4>{preview.removableDependencies.some(x => x.count) ? <ul className="list-disc pl-5">{preview.removableDependencies.filter(x => x.count).map(x => <li key={x.key}>{x.count} {x.label.toLowerCase()}</li>)}</ul> : <p>0</p>}
    {!preview.canDelete ? <p className="mt-3 font-semibold text-amber-800">This {preview.entityType} cannot be permanently deleted. Archive preserves history and removes it from active workflows.</p> : <form action={action} className="mt-4"><input type="hidden" name="id" value={preview.entityId}/><label className="block text-sm font-bold">Type <code>{confirmation}</code> exactly<input name="confirm" required aria-label="Permanent deletion confirmation" className="mt-1 block w-full rounded border p-2" autoComplete="off"/></label><button className="mt-3 rounded bg-red-700 px-4 py-2 font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500">Delete permanently</button></form>}
  </section>;
}
