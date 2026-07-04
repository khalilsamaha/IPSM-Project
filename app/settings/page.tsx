import Link from "next/link";
import type { ComponentType } from "react";
import { BookOpen, CalendarDays, Landmark, School, UsersRound } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";

type ConfigCard = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  links: { label: string; href?: string; note?: string }[];
};

const cards: ConfigCard[] = [
  {
    title: "Academic Setup",
    description: "Maintain terms, course catalog structure, levels, and the course pricing matrix used by registration.",
    icon: BookOpen,
    links: [
      { label: "Seasons", href: "/seasons" },
      { label: "Courses", href: "/admin/courses" },
      { label: "Course Levels", href: "/admin/course-levels" },
      { label: "Course Pricing Matrix", href: "/admin/course-pricing" },
    ],
  },
  {
    title: "Scheduling Setup",
    description: "Configure rooms and teacher availability rules before Reception books lessons on the calendar.",
    icon: CalendarDays,
    links: [
      { label: "Rooms", href: "/rooms" },
      { label: "Teacher Availability", href: "/teacher-availability" },
    ],
  },
  {
    title: "Finance Setup",
    description: "Central place for finance reference data. Payment transaction logic remains unchanged.",
    icon: Landmark,
    links: [
      { label: "Payment methods", note: "Uses current payment entry options" },
      { label: "Expense categories", note: "Uses current expense categories" },
      { label: "Discount types", note: "Available when discount-type metadata is implemented" },
    ],
  },
  {
    title: "School Profile",
    description: "School identity and receipt configuration for operational documents.",
    icon: School,
    links: [
      { label: "School profile", note: "Profile fields are not implemented yet" },
      { label: "Receipt settings", note: "Receipt numbering and rendering stay on existing services" },
    ],
  },
  {
    title: "Users & Roles",
    description: "Invite users and assign ADMIN or RECEPTION access without exposing admin tools to front-desk staff.",
    icon: UsersRound,
    links: [
      { label: "User management", href: "/users" },
      { label: "Roles", href: "/users" },
    ],
  },
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
        title="School Configuration"
        description="Admin-only configuration for academic setup, scheduling setup, finance reference data, school profile settings, and user access. Daily Reception workflows remain available from the main navigation."
      />
      <section className="grid gap-5 lg:grid-cols-2">
        {cards.map((card) => (
          <ConfigSectionCard key={card.title} card={card} />
        ))}
      </section>
    </AppShell>
  );
}

function ConfigSectionCard({ card }: { card: ConfigCard }) {
  const Icon = card.icon;
  return (
    <article className="rounded-[1.5rem] border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon className="size-5" />
        </span>
        <div>
          <h3 className="text-lg font-black">{card.title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.description}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {card.links.map((item) =>
          item.href ? (
            <Link key={item.label} className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-bold transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" href={item.href}>
              {item.label}
            </Link>
          ) : (
            <div key={item.label} className="rounded-2xl border border-dashed bg-slate-50 px-4 py-3">
              <p className="text-sm font-bold text-slate-700">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
            </div>
          ),
        )}
      </div>
    </article>
  );
}
