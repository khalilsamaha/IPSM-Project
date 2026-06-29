import { signOut } from "@/actions/auth";
import { requireSession } from "@/lib/auth/session";

const cards = ["Total Students", "Total Families", "Outstanding Balance", "Monthly Revenue", "Monthly Expenses", "Net Profit"];

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <main className="min-h-screen p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Phase 1</p>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Signed in as {session.email} ({session.role})</p>
        </div>
        <form action={signOut}>
          <button className="rounded-md border border-border bg-white px-4 py-2 text-sm shadow-sm" type="submit">Sign out</button>
        </form>
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article className="rounded-xl border border-border bg-white p-6 shadow-sm" key={card}>
            <p className="text-sm text-muted-foreground">{card}</p>
            <p className="mt-3 text-2xl font-bold">—</p>
          </article>
        ))}
      </section>
    </main>
  );
}
