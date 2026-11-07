"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { executeProductionReset, previewProductionReset, parseProductionResetSelection, ProductionResetError, isProductionResetEnvironmentAllowed } from "@/lib/production-reset";
import { logServerError } from "@/lib/server-log";

async function actor() {
  if (!isProductionResetEnvironmentAllowed()) redirect("/settings/production-reset?error=environment");
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN" || session.status !== "ACTIVE") redirect("/settings/production-reset?error=not-authorized");
  return session.userId;
}
function fail(error: unknown): never {
  const code = error instanceof ProductionResetError ? error.code : "failed";
  if (code === "failed") logServerError("production-reset.execute", error);
  redirect(`/settings/production-reset?error=${code}`);
}
export async function previewReset(formData: FormData) {
  const actorId = await actor();
  let requestId: string;
  try {
    const selection = parseProductionResetSelection(formData);
    requestId = (await previewProductionReset(prisma, actorId, selection)).id;
  } catch (error) { fail(error); }
  redirect(`/settings/production-reset?preview=${requestId}`);
}
export async function runProductionReset(formData: FormData) {
  const actorId = await actor();
  const requestId = String(formData.get("requestId") ?? "");
  try {
    const allowed = ["requestId", "confirmation", "reviewed", "financialAcknowledged"];
    for (const [key] of formData) {
      if (!key.startsWith("$ACTION_") && (!allowed.includes(key) || formData.getAll(key).length !== 1)) throw new ProductionResetError("selection", "Unsupported execution input.");
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) throw new ProductionResetError("stale", "Invalid preview reference.");
    await executeProductionReset(prisma, { actorId, requestId, confirmation: String(formData.get("confirmation") ?? ""), reviewed: formData.get("reviewed") === "on", financialAcknowledged: formData.get("financialAcknowledged") === "on" });
  } catch (error) { fail(error); }
  revalidatePath("/", "layout");
  redirect(`/settings/production-reset?result=${requestId}`);
}
