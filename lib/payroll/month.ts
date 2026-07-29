import { parseIsoDateOnly } from "@/lib/date-time";
export type PayrollMonthBounds = { month: string; payrollMonth: Date; periodStart: Date; periodEnd: Date };
export function payrollMonthBounds(value: string): PayrollMonthBounds {
  const m=/^(\d{4})-(\d{2})$/.exec(value);
  if(!m || +m[2]<1 || +m[2]>12) throw new Error("Choose a valid payroll month.");
  const year=+m[1], month=+m[2];
  if(year<2000 || year>2099) throw new Error("Choose a valid payroll month.");
  const periodStart=parseIsoDateOnly(`${year}-${m[2]}-01`);
  const periodEnd=new Date(Date.UTC(year,month,0));
  return {month:value,payrollMonth:periodStart,periodStart,periodEnd};
}
export function previousPayrollMonth(now=new Date()) { const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`; }
export function isCompletePayrollMonth(value:string, now=new Date()){ return payrollMonthBounds(value).periodEnd < new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)); }
