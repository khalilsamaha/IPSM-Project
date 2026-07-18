"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Family = { id: string; familyCode: string; name: string; email?: string | null; phone?: string | null; students: { firstName: string; lastName: string; studentCode: string }[] };
type Student = { id: string; studentCode: string; firstName: string; lastName: string; email?: string | null; phone?: string | null };
type Option = { id: string; label: string; detail?: string; search: string };

function SearchCombobox({ name, label, placeholder, options, value, onChange }: { name: string; label: string; placeholder: string; options: Option[]; value: string; onChange: (id: string) => void }) {
  const selected = options.find((option) => option.id === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const matches = options.filter((option) => option.search.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  const listId = `${name}-options`;
  const activeId = open && matches[activeIndex] ? `${name}-option-${matches[activeIndex].id}` : undefined;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function choose(option: Option) { onChange(option.id); setQuery(option.label); setOpen(false); }
  function clear() { setQuery(""); onChange(""); setOpen(false); setActiveIndex(0); }

  return <div ref={rootRef}>
    <label className="mb-2 block text-sm font-medium" htmlFor={`${name}-combobox`}>{label}</label>
    <input type="hidden" name={name} value={value} />
    <div className="relative"><input aria-activedescendant={activeId} aria-autocomplete="list" aria-controls={listId} aria-expanded={open} className="h-10 w-full rounded-md border border-border bg-white px-3 pr-20 text-sm" id={`${name}-combobox`} role="combobox" value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); onChange(""); setOpen(true); setActiveIndex(0); }} onKeyDown={(event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, Math.max(matches.length - 1, 0))); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
      if (event.key === "Enter" && open && matches[activeIndex]) { event.preventDefault(); choose(matches[activeIndex]); }
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    }} placeholder={placeholder}/>{query ? <button aria-label={`Clear ${label}`} className="absolute right-2 top-1/2 -translate-y-1/2 rounded border px-2 py-1 text-xs" type="button" onClick={clear}>Clear</button> : null}</div>
    {open && query ? <ul className="mt-2 max-h-72 overflow-auto rounded-md border bg-white shadow" id={listId} role="listbox">{matches.length ? matches.map((option, index) => <li aria-selected={option.id === value} id={`${name}-option-${option.id}`} key={option.id} role="option"><button className={`block w-full px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-muted" : "hover:bg-muted focus:bg-muted"}`} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}><span className="block font-medium">{option.label}</span>{option.detail ? <span className="block text-xs text-muted-foreground">{option.detail}</span> : null}</button></li>) : <li className="px-3 py-2 text-sm text-muted-foreground" role="option" aria-disabled="true">No results found</li>}</ul> : null}
    {selected ? <p className="mt-2 text-xs text-muted-foreground">Selected: {selected.label}{selected.detail ? ` · ${selected.detail}` : ""}</p> : null}
  </div>;
}

export function PaymentPayerSelector({ families, students, initialPayerType, initialFamilyId, initialStudentId }: { families: Family[]; students: Student[]; initialPayerType: string; initialFamilyId: string; initialStudentId: string }) {
  const [payerType, setPayerType] = useState(initialPayerType === "student" ? "student" : "family");
  const [familyId, setFamilyId] = useState(initialPayerType === "student" ? "" : initialFamilyId);
  const [studentId, setStudentId] = useState(initialPayerType === "student" ? initialStudentId : "");
  const familyOptions = useMemo(() => families.map((family) => ({ id: family.id, label: `${family.familyCode} — ${family.name}`, detail: family.students[0] ? `${family.students[0].firstName} ${family.students[0].lastName}, Student ${family.students[0].studentCode}` : undefined, search: [family.familyCode, family.name, family.email, family.phone, ...family.students.flatMap((s) => [s.firstName, s.lastName, s.studentCode])].filter(Boolean).join(" ") })), [families]);
  const studentOptions = useMemo(() => students.map((student) => ({ id: student.id, label: `${student.studentCode} — ${student.firstName} ${student.lastName}`, search: [student.studentCode, student.firstName, student.lastName, student.email, student.phone].filter(Boolean).join(" ") })), [students]);
  return <form className="mb-6 rounded-xl border bg-white p-4" method="get">
    <div className="mb-3 flex gap-4"><label><input type="radio" checked={payerType === "family"} onChange={() => { setPayerType("family"); setStudentId(""); }} /> Family / Group</label><label><input type="radio" checked={payerType === "student"} onChange={() => { setPayerType("student"); setFamilyId(""); }} /> Independent Student</label></div>
    <input type="hidden" name="payerType" value={payerType} />
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">{payerType === "student" ? <SearchCombobox name="studentId" label="Search Independent Student" placeholder="Search by student name, Student ID, phone, or email" options={studentOptions} value={studentId} onChange={setStudentId} /> : <SearchCombobox name="familyId" label="Search Family / Group" placeholder="Search by family code, family, parent, phone, student name, or Student ID" options={familyOptions} value={familyId} onChange={setFamilyId} />}<button className="h-10 self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" type="submit" disabled={payerType === "student" ? !studentId : !familyId}>Show outstanding balances</button></div>
  </form>;
}
