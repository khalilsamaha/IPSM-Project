import { describe, expect, it } from "vitest";
import { defaultAvailabilityRange, firstWeekdayOnOrAfter, lastWeekdayOnOrBefore, validateAvailabilityRange } from "@/lib/teachers/availability-dates";
import { calculateCompensationAmountCents } from "@/lib/payroll/calculations";
import { teacherOnboardingSchema } from "@/lib/teachers/onboarding";

const iso=(d:Date)=>d.toISOString().slice(0,10);
describe("teacher availability date-only rules",()=>{
  it("finds the first and last weekday across month boundaries",()=>{expect(iso(firstWeekdayOnOrAfter("2026-09-07",3))).toBe("2026-09-09");expect(iso(lastWeekdayOnOrBefore("2026-11-30",3))).toBe("2026-11-25")});
  it("starts on the next weekday when created mid-season",()=>{expect(iso(defaultAvailabilityRange("2026-09-07","2026-11-30",4,new Date("2026-10-02T15:00:00Z")).effectiveFrom)).toBe("2026-10-08")});
  it("handles leap years",()=>expect(iso(firstWeekdayOnOrAfter("2024-02-28",4))).toBe("2024-02-29"));
  it("rejects ended seasons and mismatched weekdays",()=>{expect(()=>defaultAvailabilityRange("2025-01-01","2025-02-01",1,new Date("2026-01-01"))).toThrow(/ended/);expect(()=>validateAvailabilityRange({seasonStart:new Date("2026-09-01"),seasonEnd:new Date("2026-11-30"),weekday:3,effectiveFrom:new Date("2026-09-10"),effectiveTo:new Date("2026-11-25")})).toThrow(/weekday/)});
});
describe("session payroll",()=>{
  it("preserves hourly and supports 30-minute units",()=>{expect(calculateCompensationAmountCents(30,3000,"HOURLY",60)).toBe(1500);expect(calculateCompensationAmountCents(30,1500,"SESSION_UNIT",30)).toBe(1500);expect(calculateCompensationAmountCents(60,1500,"SESSION_UNIT",30)).toBe(3000)});
  it("pays the required four-week example from 48 completed sessions",()=>expect(Array.from({length:48},()=>calculateCompensationAmountCents(30,1500,"SESSION_UNIT",30)).reduce((a,b)=>a+b,0)).toBe(72000));
  it("uses actual five-occurrence sessions",()=>expect(Array.from({length:60},()=>calculateCompensationAmountCents(30,1500,"SESSION_UNIT",30)).reduce((a,b)=>a+b,0)).toBe(90000));
});
describe("teacher configuration",()=>{it("rejects duplicate assignments",()=>{const id="00000000-0000-4000-8000-000000000001";const result=teacherOnboardingSchema.safeParse({fullName:"A",email:null,phone:null,notes:null,status:"ACTIVE",compensationBasis:"SESSION_UNIT",rateCents:1500,sessionUnitMinutes:30,assignments:[{courseId:id,levelId:null},{courseId:id,levelId:null}],availability:[]});expect(result.success).toBe(false)});});
