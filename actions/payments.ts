"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { createPaymentWithAllocations } from "@/lib/payments/payment-service";
import { dollarsToCents } from "@/lib/records/format";
import { logServerError } from "@/lib/server-log";

function paymentErrorRedirect(payerType: string, payerId: string | null, message: string): never {
  const params = new URLSearchParams();
  params.set("payerType", payerType);
  if (payerType === "student" && payerId) params.set("studentId", payerId);
  if (payerType !== "student" && payerId) params.set("familyId", payerId);
  params.set("error", message);
  redirect(`/payments/new?${params.toString()}`);
}

async function getPaymentActor() {
  const session = await requireSession();
  if (!hasPermission(session.role, "records:write")) throw new Error("Not authorized");
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  return { session, createdById: user?.id };
}

export async function createPayment(formData: FormData) {
  const { session, createdById } = await getPaymentActor();
  const payerType = String(formData.get("payerType") ?? "family") === "student" ? "student" : "family";
  const familyId = payerType === "family" ? String(formData.get("familyId") ?? "") : "";
  const studentId = payerType === "student" ? String(formData.get("studentId") ?? "") : "";
  const payerId = payerType === "student" ? studentId : familyId;
  const paymentMethod = String(formData.get("paymentMethod") ?? "cash");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!payerId) paymentErrorRedirect(payerType, null, payerType === "student" ? "Select an independent student before creating a payment." : "Select a family before creating a payment.");

  const allocations = Array.from(formData.entries()).filter(([key]) => key.startsWith("allocation:")).map(([key, amount]) => ({ enrollmentId: key.replace("allocation:", ""), amountCents: dollarsToCents(String(amount)) })).filter((a) => a.amountCents > 0);
  try {
    const payment = await createPaymentWithAllocations(prisma, { familyId: familyId || null, studentId: studentId || null, paymentDate: new Date(), paymentMethod, notes, createdById, actorId: session.userId, allocations });
    redirect(`/payments/${payment.id}?success=created`);
  } catch (error) {
    logServerError("payment.create", error, { familyId, studentId });
    paymentErrorRedirect(payerType, payerId, error instanceof Error ? error.message : "Unable to create payment. Please try again.");
  }
}
