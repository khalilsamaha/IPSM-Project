import { redirect } from "next/navigation";
import { archiveCourse, saveCourse } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, DataTable, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function CoursesPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");
  const courses = await prisma.course.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
  return <AppShell session={session}><h2 className="mb-4 text-2xl font-bold">Course Catalog</h2><form action={saveCourse} className="card mb-6 grid gap-3 md:grid-cols-5"><input name="name" required placeholder="Course name" className="input"/><input name="category" placeholder="Category optional" className="input"/><input name="description" placeholder="Description optional" className="input md:col-span-2"/><select name="status" className="input"><option>ACTIVE</option><option>ARCHIVED</option></select><button className="btn-primary">Save course</button></form><DataTable><thead><tr><th className="p-3">Name</th><th>Category</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead><tbody>{courses.map((c)=><tr className="border-t" key={c.id}><td className="p-3 font-bold">{c.name}</td><td>{c.category ?? "—"}</td><td>{c.description ?? "—"}</td><td><StatusBadge status={c.status}/></td><td><form action={archiveCourse}><input type="hidden" name="id" value={c.id}/><ConfirmSubmitButton className="text-primary" message="Archive this course?">Archive</ConfirmSubmitButton></form></td></tr>)}</tbody></DataTable></AppShell>;
}
