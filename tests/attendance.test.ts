import { describe, expect, it } from "vitest";
import { attendanceBlockReason, attendanceTarget } from "@/lib/attendance/policy";
describe("attendance transition safeguards",()=>{
 it("allows scheduled completion and finalized reversion",()=>{expect(attendanceBlockReason("SCHEDULED",null,"complete")).toBeNull();expect(attendanceTarget("complete")).toBe("COMPLETED");expect(attendanceBlockReason("MISSED",null,"revert")).toBeNull()});
 it.each(["DRAFT","APPROVED","PAID"] as const)("protects %s payroll-linked sessions",status=>expect(attendanceBlockReason("COMPLETED",status,"revert")).toMatch(/payroll|Paid/));
 it("skips invalid and duplicate transitions",()=>{expect(attendanceBlockReason("MISSED",null,"complete")).toMatch(/Only scheduled/);expect(attendanceBlockReason("CANCELLED",null,"cancel")).toMatch(/already/)});
});
