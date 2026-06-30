import Link from "next/link";
import { signOut } from "@/actions/auth";
import type { AppSession } from "@/lib/auth/session";

const nav = [
  ["Dashboard", "/dashboard"],
  ["Families", "/families"],
  ["Students", "/students"],
  ["Teachers", "/teachers"],
  ["Seasons", "/seasons"],
  ["Enrollments", "/enrollments"],
  ["Payments", "/payments"],
] as const;

export function AppShell({ session, children }: { session: AppSession; children: React.ReactNode }) {
  return <main className="min-h-screen p-8">
    <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Phase 3</p>
        <h1 className="text-3xl font-bold">IPSM Admin</h1>
        <p className="text-muted-foreground">Signed in as {session.email} ({session.role})</p>
      </div>
      <form action={signOut}><button className="rounded-md border border-border bg-white px-4 py-2 text-sm shadow-sm" type="submit">Sign out</button></form>
    </header>
    <nav className="mb-8 flex flex-wrap gap-2">{nav.map(([label, href]) => <Link className="rounded-full border border-border bg-white px-4 py-2 text-sm shadow-sm hover:bg-muted" href={href} key={href}>{label}</Link>)}</nav>
    {children}
  </main>;
}

export function SearchBox({ q, placeholder = "Search" }: { q: string; placeholder?: string }) {
  return <form className="mb-4 flex gap-2"><input className="h-10 w-full max-w-md rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm" name="q" placeholder={placeholder} defaultValue={q} /><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Search</button></form>;
}

export function Pager({ page, total, hrefFor }: { page: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / 10));
  return <div className="mt-4 flex items-center gap-3 text-sm"><Link className="rounded border px-3 py-1 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={page <= 1} href={hrefFor(page - 1)}>Previous</Link><span>Page {page} of {pages}</span><Link className="rounded border px-3 py-1 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={page >= pages} href={hrefFor(page + 1)}>Next</Link></div>;
}
