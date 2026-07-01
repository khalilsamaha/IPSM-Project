import Link from "next/link";
import { BarChart3, CalendarDays, CreditCard, GraduationCap, Home, Receipt, Search, Settings, Sparkles, Users, WalletCards, UserRoundCog, BookOpen, PlusCircle } from "lucide-react";
import { signOut } from "@/actions/auth";
import type { AppSession } from "@/lib/auth/session";

const navSections = [
  { label: "Main", items: [["Dashboard", "/dashboard", Home], ["Families", "/families", Users], ["Students", "/students", GraduationCap], ["Teachers", "/teachers", UserRoundCog]] },
  { label: "Operations", items: [["Seasons", "/seasons", BookOpen], ["Enrollments", "/enrollments", WalletCards], ["Lessons / Schedule", "/schedule", CalendarDays]] },
  { label: "Finance", items: [["Payments", "/payments", CreditCard], ["Expenses", "/expenses", Receipt], ["Reports", "/reports", BarChart3]] },
  { label: "Admin", items: [["Users", "/users", Settings]] },
] as const;

export function AppShell({ session, children }: { session: AppSession; children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[18rem_1fr]">
    <aside className="border-b border-white/10 bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
      <div className="p-6"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg"><Sparkles className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Music School</p><h1 className="text-xl font-bold">IPSM Admin</h1></div></div><p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-200">Simple tools for daily front-desk operations.</p></div>
      <nav aria-label="Primary navigation" className="flex gap-2 overflow-x-auto px-4 pb-5 lg:block lg:space-y-6 lg:overflow-visible">
        {navSections.map((section) => <div className="min-w-max lg:min-w-0" key={section.label}><p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{section.label}</p><div className="flex gap-2 lg:block lg:space-y-1">{section.items.map(([label, href, Icon]) => <Link className="group flex items-center gap-3 whitespace-nowrap rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-300" href={href} key={href}><Icon className="size-4 text-blue-200 group-hover:text-white" />{label}</Link>)}</div></div>)}
      </nav>
    </aside>
    <main className="min-w-0 px-4 py-5 sm:px-6 lg:p-8">
      <TopHeader session={session} />
      {children}
    </main>
  </div>;
}

export function TopHeader({ session }: { session: AppSession }) {
  return <header className="mb-8 flex flex-col gap-4 rounded-[1.5rem] border border-border bg-white/90 p-4 shadow-sm shadow-slate-200/70 backdrop-blur md:flex-row md:items-center md:justify-between">
    <div><p className="text-sm font-medium text-muted-foreground">Welcome back</p><p className="text-lg font-bold">{session.email} <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{session.role}</span></p></div>
    <form className="relative flex-1 md:max-w-md" action="/families"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="h-11 w-full rounded-2xl border border-border bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" name="q" placeholder="Search a family, student, or receipt" /></form>
    <form action={signOut}><button className="rounded-2xl border border-border bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-slate-50" type="submit">Sign out</button></form>
  </header>;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-violet-600">Workspace</p><h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>{description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}</div>{action ? <div className="shrink-0">{action}</div> : null}</div>;
}

export function SearchBox({ q, placeholder = "Search" }: { q: string; placeholder?: string }) { return <SearchFilterBar><label className="text-sm font-semibold">Search records<input className="input mt-1" name="q" placeholder={placeholder} defaultValue={q} /></label><button className="btn-primary self-end">Search</button></SearchFilterBar>; }
export function SearchFilterBar({ children }: { children: React.ReactNode }) { return <form className="mb-5 grid gap-3 rounded-[1.35rem] border border-border bg-white p-4 shadow-sm md:grid-cols-4">{children}</form>; }
export function Pager({ page, total, hrefFor }: { page: number; total: number; hrefFor: (page: number) => string }) { const pages = Math.max(1, Math.ceil(total / 10)); return <div className="mt-5 flex items-center gap-3 text-sm"><Link className="rounded-xl border bg-white px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={page <= 1} href={hrefFor(page - 1)}>Previous</Link><span className="font-medium text-muted-foreground">Page {page} of {pages}</span><Link className="rounded-xl border bg-white px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={page >= pages} href={hrefFor(page + 1)}>Next</Link></div>; }
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) { return <div className="rounded-[1.5rem] border border-dashed border-blue-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><PlusCircle className="size-5" /></div><p className="font-bold">{title}</p>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}{action ? <div className="mt-4">{action}</div> : null}</div>; }
export function StatusBadge({ status }: { status: string }) { const s = status.toLowerCase(); const tone = s.includes("active") || s.includes("posted") || s.includes("scheduled") || s.includes("completed") ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : s.includes("void") || s.includes("archived") || s.includes("cancel") || s.includes("missed") ? "bg-red-50 text-red-700 ring-red-200" : s.includes("planned") || s.includes("paused") ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-100 text-slate-700 ring-slate-200"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone}`}>{status}</span>; }
export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <section className="rounded-[1.5rem] border border-border bg-white p-5 shadow-sm"><div className="mb-5"><h3 className="text-lg font-bold">{title}</h3>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>{children}</section>; }
export function DataTable({ children }: { children: React.ReactNode }) { return <div className="overflow-x-auto rounded-[1.35rem] border border-border bg-white shadow-sm"><table className="w-full text-left text-sm [&_td]:px-4 [&_td]:py-3.5 [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-500 [&_tbody_tr]:border-t [&_tbody_tr]:border-border [&_tbody_tr:hover]:bg-slate-50 [&_thead]:bg-slate-50/80">{children}</table></div>; }
export function MetricCard({ label, value, help, tone = "blue" }: { label: string; value: string; help?: string; tone?: "blue" | "violet" | "emerald" | "amber" | "red" }) { const colors = { blue: "from-blue-500 to-cyan-500", violet: "from-violet-500 to-fuchsia-500", emerald: "from-emerald-500 to-teal-500", amber: "from-amber-500 to-orange-500", red: "from-rose-500 to-red-500" }; return <article className="rounded-[1.5rem] border border-border bg-white p-5 shadow-sm"><div className={`mb-4 h-1.5 w-16 rounded-full bg-gradient-to-r ${colors[tone]}`} /><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>{help ? <p className="mt-2 text-sm text-muted-foreground">{help}</p> : null}</article>; }
export function QuickActionCard({ href, title, description }: { href: string; title: string; description: string }) { return <Link className="group rounded-[1.35rem] border border-border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md" href={href}><span className="mb-3 grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white"><PlusCircle className="size-5" /></span><p className="font-bold group-hover:text-blue-700">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></Link>; }
