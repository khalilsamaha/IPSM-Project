import Link from "next/link";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { FamilyForm } from "../family-form";
export default async function NewFamilyPage() { const session = await requireSession(); return <AppShell session={session}><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-bold">Add Family</h2><Link className="rounded border px-4 py-2" href="/families">Back</Link></div><FamilyForm /></AppShell>; }
