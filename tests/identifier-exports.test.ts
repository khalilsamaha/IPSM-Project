import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const numbers=["RCPT-2026-0001","RCPT-IPSM-2026-9223372036854775807"];
vi.mock("@/lib/auth/session",()=>({requireSession:async()=>({role:"SUPER_ADMIN",userId:"fixture"})}));
vi.mock("@/lib/reports/data",()=>({
  getRevenueReport:async()=>({rows:numbers.map(receiptNumber=>({paymentDate:new Date("2026-01-01"),family:{familyCode:"FAM-IPSM-2026-000001",name:"Synthetic"},paymentMethod:"cash",receiptNumber,items:[],reportAmountCents:100}))}),
  getOutstandingReport:async()=>({rows:[{student:{family:{familyCode:"FAM-2020-0001",name:"Legacy"},studentCode:"STU-IPSM-2026-9223372036854775807",firstName:"Synthetic",lastName:"Student"},remainingCents:100}]}),
}));
vi.mock("@/lib/reports/shift-closures",()=>({getShiftClosureReport:vi.fn()}));
import { GET } from "@/app/api/reports/[report]/route";
describe("identifier export compatibility",()=>{
  it("exports complete legacy and maximum IPSM receipt/family identifiers",async()=>{
    const response=await GET(new NextRequest("http://localhost/api/reports/revenue"),{params:Promise.resolve({report:"revenue"})});
    expect(response.status).toBe(200);const csv=await response.text();
    for(const value of numbers)expect(csv).toContain(value);
    expect(csv).toContain("FAM-IPSM-2026-000001");
  });
  it("exports student identifiers verbatim alongside legacy family codes",async()=>{
    const response=await GET(new NextRequest("http://localhost/api/reports/outstanding"),{params:Promise.resolve({report:"outstanding"})});
    const csv=await response.text();expect(csv).toContain("STU-IPSM-2026-9223372036854775807");expect(csv).toContain("FAM-2020-0001");
  });
});
