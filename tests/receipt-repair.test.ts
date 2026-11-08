import { describe, expect, it } from "vitest";
import { parseReceiptNumber } from "@/lib/payments/receipt-number";
import { ensurePaymentReceipt } from "@/lib/payments/receipt-repair";
import { vi } from "vitest";
describe("receipt repair ownership",()=>{
  it.each(["RCPT-2026-000010","RCPT-IPSM-2026-000010"])("repairs %s without allocating or renumbering",async receiptNumber=>{
    const create=vi.fn();const query=vi.fn();
    const tx={payment:{findUnique:async()=>({receiptNumber,receipt:null})},receipt:{create},$queryRaw:query} as any;
    expect(await ensurePaymentReceipt(tx,"payment-id")).toBe(receiptNumber);
    expect(create).toHaveBeenCalledWith({data:expect.objectContaining({paymentId:"payment-id",receiptNumber})});expect(query).not.toHaveBeenCalled();
  });
  it("retains unknown historical text for display, without treating it as allocatable",()=>{
    expect(parseReceiptNumber("external-legacy-document")).toBeNull();
  });
});
