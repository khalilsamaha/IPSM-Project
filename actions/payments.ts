"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/dashboard/data";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { PaymentValidationError, validatePaymentAllocations } from "@/lib/payments/validation";

function paymentErrorRedirect(familyId: string | null, message: string): never {
  const params = new URLSearchParams();
  if (familyId) params.set("familyId", familyId);
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
  const familyId = String(formData.get("familyId") ?? "");
  const paymentMethod = String(formData.get("paymentMethod") ?? "cash");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!familyId) paymentErrorRedirect(null, "Select a family before creating a payment.");

  const allocations = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("allocation:"))
    .map(([key, amount]) => ({ enrollmentId: key.replace("allocation:", ""), amount: String(amount) }));

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { id: { in: allocations.map((allocation) => allocation.enrollmentId) } },
      select: { id: true, remainingCents: true, student: { select: { familyId: true } } },
    });
    const validated = validatePaymentAllocations({ familyId, allocations, enrollments });
    const totalAmountCents = validated.reduce((sum, allocation) => sum + allocation.amountCents, 0);

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          familyId,
          paymentMethod,
          totalAmountCents,
          notes,
          createdById,
          items: {
            create: validated.map((allocation) => ({
              enrollmentId: allocation.enrollmentId,
              amountCents: allocation.amountCents,
            })),
          },
        },
      });

      for (const allocation of validated) {
        await tx.enrollment.update({
          where: { id: allocation.enrollmentId },
          data: {
            paidCents: { increment: allocation.amountCents },
            remainingCents: { decrement: allocation.amountCents },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "create",
          entity: "Payment",
          entityId: created.id,
          createdById,
          actorId: session.userId,
          metadata: { familyId, totalAmountCents, allocations: validated },
        },
      });

      return created;
    });

    redirect(`/payments/${payment.id}?success=created`);
  } catch (error) {
    if (error instanceof PaymentValidationError) paymentErrorRedirect(familyId, error.message);
    throw error;
  }
}
