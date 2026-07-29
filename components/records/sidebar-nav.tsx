"use client";

import type { Role } from "@/lib/auth/roles";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BarChart3, BookOpen, Building2, CalendarDays, CreditCard, GraduationCap, Home, Receipt, RotateCcw, Activity, Clock, Settings, Tags, UserCog, UserPlus, UserRoundCog, Users, WalletCards, HandCoins } from "lucide-react";
import { canViewNavigationItem } from "@/lib/auth/navigation";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  { items: [{ label: "Dashboard", href: "/dashboard", icon: Home }] },
  {
    label: "Daily Operations",
    items: [
      { label: "Register Student", href: "/register-student", icon: UserPlus },
      { label: "Lessons / Schedule", href: "/schedule", icon: CalendarDays },
      { label: "Payments", href: "/payments", icon: CreditCard },
      { label: "Expenses", href: "/expenses", icon: Receipt },
      { label: "Shift", href: "/shifts", icon: Clock },
    ],
  },
  { label: "People", items: [
    { label: "Families", href: "/families", icon: Users },
    { label: "Students", href: "/students", icon: GraduationCap },
    { label: "Teachers", href: "/teachers", icon: UserRoundCog },
  ] },
  { label: "Academic Setup", items: [
    { label: "Enrollments", href: "/enrollments", icon: WalletCards },
    { label: "Seasons", href: "/seasons", icon: BookOpen },
    { label: "Instruments & Pricing", href: "/admin/academic-pricing", icon: Tags },
    { label: "Rooms", href: "/rooms", icon: Building2 },
    { label: "Teacher Availability", href: "/teacher-availability", icon: UserCog },
    { label: "School Closures", href: "/admin/school-closures", icon: CalendarDays },
  ] },
  { label: "Management", items: [
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Payroll", href: "/payroll", icon: HandCoins },
  ] },
  { label: "Administration", items: [
    { label: "Users", href: "/users", icon: Settings },
    { label: "School Settings", href: "/settings", icon: Settings },
    { label: "Activity Monitoring", href: "/admin/activity", icon: Activity },
    { label: "Production Reset", href: "/settings/production-reset", icon: RotateCcw },
  ] },
];

function isActivePath(pathname: string, href: string) {
  const [path] = href.split("#");
  if (path === "/dashboard") return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function SidebarNav({ role }: { role?: Role }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-4 pb-5 [scrollbar-gutter:stable]">
      {navSections.map((section, sectionIndex) => {
        const visibleItems = section.items.filter((item) => canViewNavigationItem(role, item.href));
        if (!visibleItems.length) return null;

        return (
          <div key={section.label ?? `primary-${sectionIndex}`}>
            {section.label ? <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{section.label}</p> : null}
            <div className="space-y-1">
              {visibleItems.map(({ label, href, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                      active
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-200 hover:bg-white/10 hover:text-white"
                    }`}
                    href={href}
                    key={`${section.label ?? "primary"}-${label}-${href}`}
                  >
                    <Icon className={`size-4 shrink-0 ${active ? "text-blue-600" : "text-blue-200 group-hover:text-white"}`} />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
