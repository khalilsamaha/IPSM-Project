"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeExpenseCategory } from "@/actions/expense-categories";

function CategoryRow({ category, onChange }: { category: { id: string; name: string; archived: boolean }; onChange: (input: unknown) => void }) {
  const [name, setName] = useState(category.name);
  const other = category.name.toLowerCase() === "other";
  return <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
    <label className="grid gap-1 text-sm">{category.archived ? "Archived category" : "Available category"}<input className="input" aria-label={`Category name: ${category.name}`} value={name} maxLength={80} disabled={other} onChange={event => setName(event.target.value)} /></label>
    <button type="button" className="btn-secondary self-end" disabled={other || !name.trim() || name === category.name} onClick={() => onChange({ action: "rename", id: category.id, name })}>Rename</button>
    <button type="button" className="btn-secondary self-end" disabled={other && !category.archived} onClick={() => onChange({ action: category.archived ? "restore" : "archive", id: category.id })}>{category.archived ? "Restore" : "Archive"}</button>
    {other ? <p className="text-xs text-muted-foreground sm:col-span-3">Other is the permanent fallback; a descriptive expense note is required.</p> : null}
  </div>;
}
export function ExpenseCategoryManager({ categories }: { categories: { id: string; name: string; archived: boolean }[] }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function change(input: unknown) { startTransition(async () => {
    try { const result = await changeExpenseCategory(input);
      setMessage(result.error ?? "Category saved. Existing expense labels are unchanged.");
      if (result.category) { setName(""); router.refresh(); }
    } catch { setMessage("Unable to save the category. Try again."); }
  }); }
  return <div className="space-y-4"><Link href="/expenses/new" className="text-primary underline">Back to expense entry</Link>
    <fieldset disabled={pending} className="space-y-3">
      <form onSubmit={event => { event.preventDefault(); change({ action: "create", name }); }} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"><label className="grid flex-1 gap-1 text-sm">New category name<input className="input" required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label><button className="btn-primary">+ Create category</button></form>
      {categories.map(row => <CategoryRow key={`${row.id}:${row.name}:${row.archived}`} category={row} onChange={change} />)}
    </fieldset>
    <p role="status" className="text-sm">{pending ? "Saving…" : message}</p>
  </div>;
}
