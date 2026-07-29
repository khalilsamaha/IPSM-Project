"use client";
import { useId, useState } from "react";
import { displayDateFromIso, parseDisplayDate } from "@/lib/date-time";

type Props={name:string;defaultValue?:string;label?:string;required?:boolean;className?:string};
export function LocalizedDateInput({name,defaultValue="",label,required,className="input"}:Props){
 const id=useId(),[visible,setVisible]=useState(()=>defaultValue?displayDateFromIso(defaultValue):""),[iso,setIso]=useState(defaultValue),[error,setError]=useState("");
 function validate(){if(!visible.trim()){setIso("");setError(required?"A date is required.":"");return}try{const next=parseDisplayDate(visible);setIso(next);setVisible(displayDateFromIso(next));setError("")}catch(e){setIso("");setError(e instanceof Error?e.message:"Invalid date.")}}
 return <div>{label?<label className="mb-1 block text-sm font-bold" htmlFor={id}>{label}</label>:null}<input id={id} className={className} inputMode="numeric" placeholder="dd/mm/yy" value={visible} onChange={e=>setVisible(e.target.value)} onBlur={validate} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined}/><input type="hidden" name={name} value={iso}/>{error?<p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">{error}</p>:null}</div>
}
