"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BarChart3, BookOpen, CalendarDays, CreditCard, GraduationCap, Home, Receipt, Settings, SlidersHorizontal, UserPlus, UserRoundCog, Users, WalletCards } from "lucide-react";
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

const navSections: NavSection[] = [
  { items: [{ label: "Dashboard", href: "/dashboard", icon: Home }] },
  {
    label: "Administration",
    items: [
      { label: "Families", href: "/families", icon: Users },
      { label: "Students", href: "/students", icon: GraduationCap },
      { label: "Teachers", href: "/teachers", icon: UserRoundCog },
    ],
  },
  {
    label: "Academic",
    items: [
      { label: "Seasons", href: "/seasons", icon: BookOpen },
      { label: "Register Student", href: "/register-student", icon: UserPlus },
      { label: "Enrollments", href: "/enrollments", icon: WalletCards },
      { label: "Lessons / Calendar", href: "/schedule", icon: CalendarDays },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Payments", href: "/payments", icon: CreditCard },
      { label: "Expenses", href: "/expenses", icon: Receipt },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { label: "School Configuration", href: "/settings", icon: SlidersHorizontal },
      { label: "Users", href: "/users", icon: Settings },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ role }: { role?: "ADMIN" | "RECEPTION" }) {
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
                    key={href}
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
