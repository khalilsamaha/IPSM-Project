"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { isNewPaymentMethod } from "@/lib/payment-methods";
import { createPaymentWithAllocations } from "@/lib/payments/payment-service";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/records/format";
import { logServerError } from "@/lib/server-log";
import { requireCurrentOpenShift } from "@/lib/shifts/service";

function paymentFormUrl(familyId: string, method: string, notes: string, message: string) {
  const query = new URLSearchParams({ familyId, paymentMethod: method, notes, error: message });
  return `/payments/new?${query.toString()}`;
}

export async function createPayment(formData: FormData) {
  const session = await requireSession();
  if (!hasPermission(session.role, "records:write")) throw new Error("Not authorized");

  const familyId = String(formData.get("familyId") ?? "");
  if (!familyId) redirect("/payments/new?error=Select%20a%20family.");

  const method = String(formData.get("paymentMethod") ?? "cash");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!isNewPaymentMethod(method)) {
    redirect(paymentFormUrl(familyId, "cash", notes, "Choose Cash or Whish."));
  }

  const user = await prisma.userProfile.findUnique({
    where: { authId: session.userId },
    select: { id: true },
  });
  if (!user) throw new Error("User profile not found.");

  let shift;
  try {
    shift = await requireCurrentOpenShift(prisma, user.id);
  } catch (error) {
    logServerError("create-payment-shift", error, { familyId, userProfileId: user.id });
    redirect(paymentFormUrl(familyId, method, notes, "Open your cashier shift before recording a payment."));
  }

  const allocations = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("allocation:"))
    .map(([key, value]) => ({
      enrollmentId: key.slice("allocation:".length),
      amountCents: dollarsToCents(String(value)),
    }))
    .filter((allocation) => allocation.amountCents > 0);

  let paymentId: string;
  try {
    const payment = await createPaymentWithAllocations(prisma, {
      familyId,
      paymentDate: new Date(),
      paymentMethod: method,
      notes: notes || null,
      createdById: user.id,
      actorId: session.userId,
      shiftId: shift.id,
      allocations,
    });
    paymentId = payment.id;
  } catch (error) {
    logServerError("create-payment", error, { familyId, userProfileId: user.id });
    const message = error instanceof Error ? error.message : "Unable to create payment.";
    redirect(paymentFormUrl(familyId, method, notes, message));
  }

  // Keep the successful redirect out of the error handler: Next.js implements it by throwing.
  redirect(`/payments/${paymentId}?success=created`);
}
