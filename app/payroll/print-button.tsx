"use client";
export function PrintButton(){return <button type="button" onClick={()=>window.print()} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold print:hidden">Print report</button>}
