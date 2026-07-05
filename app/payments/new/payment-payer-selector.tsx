"use client";

import { useMemo, useState } from "react";

type Family = { id: string; name: string; email?: string | null; phone?: string | null; students: { firstName: string; lastName: string; studentCode: string }[] };
type Student = { id: string; studentCode: string; firstName: string; lastName: string; email?: string | null; phone?: string | null };

export function PaymentPayerSelector({ families, students, initialPayerType, initialFamilyId, initialStudentId }: { families: Family[]; students: Student[]; initialPayerType: string; initialFamilyId: string; initialStudentId: string }) {
  const [payerType, setPayerType] = useState(initialPayerType === "student" ? "student" : "family");
  const [familyId, setFamilyId] = useState(initialPayerType === "student" ? "" : initialFamilyId);
  const [studentId, setStudentId] = useState(initialPayerType === "student" ? initialStudentId : "");
  const selectedFamily = useMemo(() => families.find((family) => family.id === familyId), [families, familyId]);
  const selectedStudent = useMemo(() => students.find((student) => student.id === studentId), [students, studentId]);
  return <form className="mb-6 rounded-xl border bg-white p-4" method="get">
    <div className="mb-3 flex gap-4">
      <label><input type="radio" checked={payerType === "family"} onChange={() => { setPayerType("family"); setStudentId(""); }} /> Family / Group</label>
      <label><input type="radio" checked={payerType === "student"} onChange={() => { setPayerType("student"); setFamilyId(""); }} /> Independent Student</label>
    </div>
    {payerType === "student" ? <>
      <label className="mb-2 block text-sm font-medium" htmlFor="studentSearch">Search Independent Student</label>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]"><input className="h-10 rounded-md border border-border bg-white px-3 text-sm" id="studentSearch" list="student-options" name="studentId" required value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Search by student name or Student ID"/><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" type="submit">Show outstanding balances</button></div>
      <input type="hidden" name="payerType" value="student" />
      <p className="mt-2 text-xs text-muted-foreground">Select a suggestion to fill the internal student value. Selected: {selectedStudent ? `${selectedStudent.studentCode} — ${selectedStudent.firstName} ${selectedStudent.lastName}` : "none"}</p>
      <datalist id="student-options">{students.map((student) => <option key={student.id} value={student.id} label={`${student.studentCode} — ${student.firstName} ${student.lastName} ${student.email ?? ""} ${student.phone ?? ""}`}/>)}</datalist>
    </> : <>
      <label className="mb-2 block text-sm font-medium" htmlFor="familySearch">Search Family / Group</label>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]"><input className="h-10 rounded-md border border-border bg-white px-3 text-sm" id="familySearch" list="family-options" name="familyId" required value={familyId} onChange={(event) => setFamilyId(event.target.value)} placeholder="Search by family, parent, phone/email, student name, or Student ID"/><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" type="submit">Show outstanding balances</button></div>
      <input type="hidden" name="payerType" value="family" />
      <p className="mt-2 text-xs text-muted-foreground">Select a suggestion to fill the internal family value. Selected: {selectedFamily?.name ?? "none"}</p>
      <datalist id="family-options">{families.map((family) => <option key={family.id} value={family.id} label={[family.name, family.email, family.phone, family.students.map((student) => `${student.firstName} ${student.lastName} (${student.studentCode})`).join(", ")].filter(Boolean).join(" — ")}/>)}</datalist>
    </>}
  </form>;
}
