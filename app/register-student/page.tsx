import Link from "next/link";
import { registerStudentWorkflow } from "@/actions/records";
import { AppShell, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function RegisterStudentPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; enrollmentId?: string; paymentId?: string; sessionId?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  const [students, families, seasons, teachers] = await Promise.all([
    prisma.student.findMany({ where: { status: "ACTIVE" }, include: { family: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.family.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.season.findMany({ where: { status: { in: ["PLANNED", "ACTIVE"] } }, orderBy: { startDate: "desc" } }),
    prisma.teacher.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
  ]);

  return <AppShell session={session}>
    <PageHeader title="Register Student" description="Guided registration for student, optional Family / Group, enrollment, initial payment, and first lesson booking." />
    {params.error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{params.error}</div> : null}
    {params.success ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><p className="font-black">Registration complete.</p><p>Enrollment: {params.enrollmentId}</p>{params.paymentId ? <p>Payment/receipt: <Link className="font-bold underline" href={`/payments/${params.paymentId}`}>open receipt</Link></p> : null}{params.sessionId ? <p>First lesson booked: {params.sessionId}</p> : null}</div> : null}
    <form action={registerStudentWorkflow} className="grid gap-5 rounded-[1.5rem] border bg-white p-5 shadow-sm">
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><h3 className="md:col-span-3 text-lg font-black">1. Student and Family / Group</h3><select name="studentId" className="rounded-xl border p-2.5"><option value="new">Create new student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} ({student.family?.name ?? "Independent"})</option>)}</select><input name="firstName" placeholder="First name for new student" className="rounded-xl border p-2.5" /><input name="lastName" placeholder="Last name for new student" className="rounded-xl border p-2.5" /><input name="email" type="email" placeholder="Email" className="rounded-xl border p-2.5" /><input name="phone" placeholder="Phone" className="rounded-xl border p-2.5" /><select name="familyId" className="rounded-xl border p-2.5"><option value="">No family / independent student</option>{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select><label className="flex items-center gap-2 rounded-xl border p-2.5 text-sm font-semibold"><input type="checkbox" name="createFamilyFromStudent" value="1" /> Create Family / Group from student</label></section>
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><h3 className="md:col-span-3 text-lg font-black">2. Enrollment and amount due</h3><select name="seasonId" required className="rounded-xl border p-2.5"><option value="">Season</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select><input name="courseName" required placeholder="Course" className="rounded-xl border p-2.5" /><select name="teacherId" className="rounded-xl border p-2.5"><option value="">Assign teacher later</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select><input name="fee" type="number" min="0" step="0.01" placeholder="Amount Due" className="rounded-xl border p-2.5" /><input name="discount" type="number" min="0" step="0.01" placeholder="Discount" className="rounded-xl border p-2.5" /></section>
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><h3 className="md:col-span-3 text-lg font-black">3. Optional initial payment</h3><input name="initialPayment" type="number" min="0" step="0.01" placeholder="Paid now" className="rounded-xl border p-2.5" /><select name="paymentMethod" className="rounded-xl border p-2.5"><option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="ach">ACH</option></select><p className="text-sm text-muted-foreground">Existing payment allocation and receipt generation are reused.</p></section>
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><h3 className="md:col-span-4 text-lg font-black">4. Optional first lesson</h3><label className="flex items-center gap-2 rounded-xl border p-2.5 text-sm font-semibold"><input type="checkbox" name="bookFirstSession" value="1" /> Book first lesson</label><input name="sessionDate" type="date" className="rounded-xl border p-2.5" /><input name="startTime" type="time" className="rounded-xl border p-2.5" /><input name="endTime" type="time" className="rounded-xl border p-2.5" /><p className="md:col-span-4 text-sm text-muted-foreground">Availability is validated before confirmation; teacher and student double-booking rules are unchanged.</p></section>
      <button className="rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-3 font-black text-white">Confirm registration</button>
    </form>
  </AppShell>;
}
