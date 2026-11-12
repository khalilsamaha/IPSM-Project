"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { changeExpenseCategory } from "@/actions/expense-categories";
import { historicalCategorySelection } from "@/lib/expense-category-options";
export type CategoryOption = { id: string; name: string };

export function ExpenseCategorySelector({ categories, canManage, historicalCategory }: {
  categories: CategoryOption[]; canManage: boolean; historicalCategory?: string;
}) {
  const [added, setAdded] = useState<CategoryOption[]>([]);
  const [selection, setSelection] = useState(historicalCategory ? historicalCategorySelection : "");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const options = [...categories, ...added.filter(row => !categories.some(existing => existing.id === row.id))].sort((a,b) => a.name.localeCompare(b.name));
  const selectedName = selection === historicalCategorySelection ? historicalCategory : options.find(row => row.id === selection)?.name;
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="expense-category" className="text-sm font-medium">Category *</label>
      {canManage ? <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="new-expense-category" className="rounded-lg border border-blue-200 px-3 py-1 text-sm font-semibold text-blue-800">+ New category</button> : null}
    </div>
    {open && canManage ? <div id="new-expense-category" className="space-y-2 rounded-xl border bg-blue-50 p-3">
      <label className="grid gap-1 text-sm">New category name<input autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={80} className="input" /></label>
      <div className="flex gap-2"><button type="button" disabled={pending || !name.trim()} className="btn-secondary" onClick={() => startTransition(async () => {
        setError("");
        try { const result = await changeExpenseCategory({ action: "create", name });
          if (result.error) setError(result.error);
          else if (result.category) { setAdded(previous => [...previous, result.category!]); setSelection(result.category.id); setOpen(false); setName(""); }
        } catch { setError("Unable to create category. Try again."); }
      })}>{pending ? "Creating…" : "Create category"}</button><button type="button" onClick={() => { setOpen(false); setError(""); }}>Cancel</button></div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div> : null}
    <select id="expense-category" className="input" name="categorySelection" required value={selection} onChange={event => setSelection(event.target.value)}>
      <option value="">Select a category</option>
      {historicalCategory ? <option value={historicalCategorySelection}>{historicalCategory} (keep recorded category)</option> : null}
      {options.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
    </select>
    {selectedName?.trim().toLowerCase() === "other" ? <p className="text-sm text-amber-800">Other requires a descriptive note of at least 8 characters below.</p> : null}
    <p className="text-xs text-muted-foreground">Renaming a category does not change previously recorded expenses.</p>
    {canManage ? <Link className="inline-block text-sm text-primary underline" href="/expenses/categories">Manage categories</Link> : null}
  </div>;
}
