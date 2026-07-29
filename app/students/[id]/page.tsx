import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveStudent, deleteStudentPermanently, restoreStudent, saveStudent } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, StatusBadge } from "@/components/records/shell";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { formatDateInputValue } from "@/lib/enrollments/proration";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/records/format";
import { getStudentDeletionPreview } from "@/lib/deletion/entity-deletion";
import { DeletionPanel } from "@/components/deletion/deletion-panel";
import { LocalizedDateInput } from "@/components/localized-date-input";

export default async function StudentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const [student, families, deletionPreview] = await Promise.all([
    prisma.student.findUnique({ where: { id }, include: { family: true, enrollments: { include: { season: true, course: true, level: true }, orderBy: { createdAt: "desc" } }, scheduleSessions: { select: { id: true } } } }),
    prisma.family.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    getStudentDeletionPreview(id),
  ]);
  if (!student) notFound();
  const archived = student.status === "INACTIVE" || Boolean(student.archivedAt);
  return <AppShell session={session}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-2xl font-bold">{student.studentCode} — {student.firstName} {student.lastName}</h2><StatusBadge status={student.status} /></div><Link className="rounded border px-4 py-2" href="/students">Back to students</Link></div>{error ? <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}<form action={saveStudent} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2"><input type="hidden" name="id" value={student.id}/><label>First name<input className="mt-1 w-full rounded border p-2" name="firstName" required defaultValue={student.firstName}/></label><label>Last name<input className="mt-1 w-full rounded border p-2" name="lastName" required defaultValue={student.lastName}/></label><LocalizedDateInput label="Date of birth" className="mt-1 w-full rounded border p-2" name="dateOfBirth" defaultValue={student.dateOfBirth ? formatDateInputValue(student.dateOfBirth) : ""}/><label>Email<input className="mt-1 w-full rounded border p-2" type="email" name="email" defaultValue={student.email ?? ""}/></label><label>Phone<input className="mt-1 w-full rounded border p-2" name="phone" defaultValue={student.phone ?? ""}/></label><label>Family / Group<select required className="mt-1 w-full rounded border p-2" name="familyId" defaultValue={student.familyId}><option value="" disabled>Select a family</option>{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select></label><label>Status<select className="mt-1 w-full rounded border p-2" name="status" defaultValue={student.status}><option>ACTIVE</option><option>INACTIVE</option></select></label><button className="rounded bg-primary px-4 py-2 text-white md:col-span-2">Save student</button></form><div className="mb-6 flex gap-3">{archived ? <form action={restoreStudent}><input type="hidden" name="id" value={student.id}/><ConfirmSubmitButton className="text-primary" message="Restore this student?">Restore</ConfirmSubmitButton></form> : <form action={archiveStudent}><input type="hidden" name="id" value={student.id}/><ConfirmSubmitButton className="text-primary" message="Archive this student? History will be preserved.">Archive</ConfirmSubmitButton></form>}</div>{deletionPreview && isAdminOrHigher(session.role) ? <div className="mb-6"><DeletionPanel preview={deletionPreview} action={deleteStudentPermanently}/></div> : null}<h3 className="mb-2 font-semibold">Enrollments</h3><div className="rounded-xl border bg-white p-4">{student.enrollments.map((e) => <div className="border-b py-2" key={e.id}>{e.season.name} — {e.course?.name ?? e.courseName} / {e.level?.name ?? "—"} — Remaining {formatCurrency(e.remainingCents)}</div>)}</div></AppShell>;
}
