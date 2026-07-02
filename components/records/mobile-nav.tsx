"use client";

import { useState } from "react";
import { Menu, Search, Sparkles, X } from "lucide-react";
import { signOut } from "@/actions/auth";
import { SidebarNav } from "@/components/records/sidebar-nav";
import type { AppSession } from "@/lib/auth/session";

export function MobileTopBar({ session }: { session: AppSession }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-lg backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg"><Sparkles className="size-5" /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">IPSM Admin</p>
            <p className="truncate text-xs text-blue-100">{session.role}</p>
          </div>
        </div>
        <button aria-expanded={open} aria-controls="mobile-navigation" aria-label="Open navigation menu" className="rounded-2xl bg-white/10 p-2.5 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={() => setOpen(true)} type="button"><Menu className="size-5" /></button>
      </header>

      {open ? <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} type="button" /> : null}
      <aside id="mobile-navigation" className={`fixed inset-y-0 left-0 z-50 flex w-[min(22rem,88vw)] flex-col overflow-hidden bg-slate-950 text-white shadow-2xl transition-transform duration-200 lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="shrink-0 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 shadow-lg"><Sparkles className="size-5" /></span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Music School</p><h1 className="truncate text-xl font-bold">IPSM Admin</h1></div></div>
            <button aria-label="Close navigation menu" className="rounded-2xl bg-white/10 p-2.5 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={() => setOpen(false)} type="button"><X className="size-5" /></button>
          </div>
          <form className="relative mt-4" action="/families" onSubmit={() => setOpen(false)}><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className="input bg-white pl-10 text-slate-950" name="q" placeholder="Search records" /></form>
        </div>
        <div onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }} className="min-h-0 flex-1"><SidebarNav role={session.role} /></div>
        <div className="shrink-0 border-t border-white/10 p-4"><form action={signOut}><button className="w-full rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-blue-50" type="submit">Sign out</button></form></div>
      </aside>
    </>
  );
}
