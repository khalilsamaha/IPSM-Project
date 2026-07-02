import { AppShell, EmptyState, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";

const placeholders = [
  ["School profile", "Future home for school name, contact details, logo, and public receipt identity."],
  ["Receipt preferences", "Placeholder for receipt numbering, default footer text, and delivery defaults."],
  ["Payment methods", "Placeholder for enabling or labeling accepted payment methods."],
  ["Expense categories", "Placeholder for maintaining standard expense categories for cleaner reporting."],
  ["Appearance", "Placeholder for theme and display preferences used across the admin workspace."],
];

export default async function SettingsPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "settings:manage")) {
    return (
      <AppShell session={session}>
        <PageHeader title="Not authorized" description="You do not have permission to access this admin-only page." />
        <EmptyState title="Admin access required" description="Please return to the dashboard or contact an administrator if you need access." />
      </AppShell>
    );
  }

  return (
    <AppShell session={session}>
      <PageHeader
        title="Settings"
        description="Admin-only planning area for future school-wide configuration. These cards are intentionally non-functional placeholders so current operations, permissions, and financial behavior remain unchanged."
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Future settings areas">
        {placeholders.map(([title, description]) => (
          <article className="card" key={title}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Coming soon</p>
            <h3 className="mt-2 text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            <button className="btn-secondary mt-4 cursor-not-allowed opacity-70" disabled type="button">Not configured yet</button>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
