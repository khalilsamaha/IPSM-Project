"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/roles";
import { executeProductionReset, hasProductionResetSelection, parseProductionResetSelection } from "@/lib/production-reset";

export async function runProductionReset(formData: FormData) {
  const session = await requireSession();
  if (!isSuperAdmin(session.role)) redirect("/settings/production-reset?error=not-authorized");

  if (formData.get("confirmation") !== "RESET") redirect("/settings/production-reset?error=confirmation");
  const selection = parseProductionResetSelection(formData);
  if (!hasProductionResetSelection(selection)) redirect("/settings/production-reset?error=selection");

  const profile = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  await executeProductionReset(prisma, { actorId: session.userId, createdById: profile?.id ?? null, selection });
  revalidatePath("/settings/production-reset");
  redirect("/settings/production-reset?success=1");
}
