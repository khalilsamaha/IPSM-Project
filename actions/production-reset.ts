"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/roles";
import {
  executeProductionReset,
  hasProductionResetSelection,
  parseProductionResetSelection,
} from "@/lib/production-reset";
import { logServerError } from "@/lib/server-log";

export async function runProductionReset(formData: FormData) {
  const session = await requireSession();
  if (!isSuperAdmin(session.role)) {
    redirect("/settings/production-reset?error=not-authorized");
  }

  if (formData.get("confirmation") !== "RESET") {
    redirect("/settings/production-reset?error=confirmation");
  }
  const selection = parseProductionResetSelection(formData);
  if (!hasProductionResetSelection(selection)) {
    redirect("/settings/production-reset?error=selection");
  }

  const profile = await prisma.userProfile.findUnique({
    where: { authId: session.userId },
    select: { id: true },
  });

  try {
    await executeProductionReset(prisma, {
      actorId: session.userId,
      createdById: profile?.id ?? null,
      selection,
    });
  } catch (error) {
    logServerError("production-reset.execute", error, {
      actorId: session.userId,
      selection,
    });
    redirect("/settings/production-reset?error=failed");
  }

  revalidatePath("/settings/production-reset");
  revalidatePath("/dashboard");
  revalidatePath("/enrollments");
  revalidatePath("/schedule");
  revalidatePath("/payments");
  revalidatePath("/teachers");
  redirect("/settings/production-reset?success=1");
}
