import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { FamilyForm } from "../../family-form";
export default async function EditFamilyPage({ params }: { params: Promise<{ id: string }> }) { const session = await requireSession(); const { id } = await params; const family = await prisma.family.findUnique({ where: { id } }); if (!family) notFound(); return <AppShell session={session}><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-bold">Edit {family.familyCode}</h2><Link className="rounded border px-4 py-2" href={`/families/${family.id}`}>Back</Link></div><FamilyForm family={family} /></AppShell>; }
