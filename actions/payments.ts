"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { createPaymentWithAllocations } from "@/lib/payments/payment-service";
import { dollarsToCents } from "@/lib/records/format";
import { isNewPaymentMethod } from "@/lib/payment-methods";
import { requireCurrentOpenShift } from "@/lib/shifts/service";
export async function createPayment(formData: FormData) {
 const session=await requireSession(); if(!hasPermission(session.role,"records:write")) throw new Error("Not authorized");
 const familyId=String(formData.get("familyId")??""); if(!familyId) redirect("/payments/new?error=Select%20a%20family.");
 const method=String(formData.get("paymentMethod")??"cash"); if(!isNewPaymentMethod(method)) throw new Error("Choose Cash or Whish.");
 const user=await prisma.userProfile.findUnique({where:{authId:session.userId},select:{id:true}}); if(!user) throw new Error("User profile not found.");
 const shift=await requireCurrentOpenShift(prisma,user.id);
 const allocations=Array.from(formData.entries()).filter(([k])=>k.startsWith("allocation:")).map(([k,v])=>({enrollmentId:k.slice(11),amountCents:dollarsToCents(String(v))})).filter(x=>x.amountCents>0);
 let paymentId: string;
 try { const payment=await createPaymentWithAllocations(prisma,{familyId,paymentDate:new Date(),paymentMethod:method,notes:String(formData.get("notes")??"").trim()||null,createdById:user.id,actorId:session.userId,shiftId:shift.id,allocations}); paymentId=payment.id; } catch (error) { redirect(`/payments/new?familyId=${familyId}&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create payment.")}`); }
 redirect(`/payments/${paymentId}?success=created`);
}
