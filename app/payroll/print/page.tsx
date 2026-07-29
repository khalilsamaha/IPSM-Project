import { redirect } from "next/navigation";
export default async function PrintPayroll({searchParams}:{searchParams:Promise<Record<string,string>>}){const p=await searchParams;redirect(`/payroll?${new URLSearchParams(p)}#monthly-report`)}
