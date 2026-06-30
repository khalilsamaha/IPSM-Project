import Link from "next/link";
import { signOut } from "@/actions/auth";
import type { AppSession } from "@/lib/auth/session";

const nav = [
  ["Dashboard", "/dashboard"], ["Families", "/families"], ["Students", "/students"], ["Teachers", "/teachers"], ["Seasons", "/seasons"], ["Enrollments", "/enrollments"], ["Payments", "/payments"], ["Expenses", "/expenses"], ["Reports", "/reports"], ["User Management", "/users"],
] as const;

export function AppShell({ session, children }: { session: AppSession; children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[17rem_1fr]">
    <aside className="border-b border-border bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
      <div className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Production MVP</p><h1 className="mt-2 text-2xl font-bold">IPSM Admin</h1><p className="mt-1 text-sm text-slate-300">School operations</p></div>
      <nav aria-label="Primary navigation" className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-1 lg:overflow-visible">
        {nav.map(([label, href]) => <Link className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-300" href={href} key={href}>{label}</Link>)}
      </nav>
    </aside>
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:p-8">
      <header className="mb-8 flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div><p className="text-sm text-muted-foreground">Signed in as</p><p className="font-semibold">{session.email} <span className="text-muted-foreground">({session.role})</span></p></div>
        <form action={signOut}><button className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted" type="submit">Sign out</button></form>
      </header>
      {children}
    </main>
  </div>;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h2 className="text-3xl font-bold tracking-tight">{title}</h2>{description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}</div>{action ? <div className="shrink-0">{action}</div> : null}</div>;
}

export function SearchBox({ q, placeholder = "Search" }: { q: string; placeholder?: string }) {
  return <form className="mb-4 rounded-xl border border-border bg-white p-4 shadow-sm"><label className="text-sm font-medium">Search records<input className="mt-1 h-10 w-full max-w-lg rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm" name="q" placeholder={placeholder} defaultValue={q} /></label><button className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Search</button></form>;
}

export function Pager({ page, total, hrefFor }: { page: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / 10));
  return <div className="mt-4 flex items-center gap-3 text-sm"><Link className="rounded border bg-white px-3 py-1 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={page <= 1} href={hrefFor(page - 1)}>Previous</Link><span>Page {page} of {pages}</span><Link className="rounded border bg-white px-3 py-1 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={page >= pages} href={hrefFor(page + 1)}>Next</Link></div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center"><p className="font-semibold">{title}</p>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}{action ? <div className="mt-4">{action}</div> : null}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone = s.includes("active") || s.includes("posted") ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : s.includes("void") || s.includes("archived") || s.includes("cancel") ? "bg-red-50 text-red-700 ring-red-200" : s.includes("planned") || s.includes("paused") ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-100 text-slate-700 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>{status}</span>;
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-white p-4 shadow-sm"><div className="mb-4"><h3 className="font-semibold">{title}</h3>{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}</div>{children}</section>;
}

export function DataTable({ children }: { children: React.ReactNode }) { return <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm"><table className="w-full text-left text-sm [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:py-3 [&_tbody_tr]:border-t [&_tbody_tr:hover]:bg-slate-50 [&_thead]:bg-muted">{children}</table></div>; }
