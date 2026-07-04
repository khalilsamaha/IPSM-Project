import { archiveCourseLevel, saveCourseLevel } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, DataTable, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { NotAuthorized } from "@/lib/auth/not-authorized";
import { prisma } from "@/lib/prisma";

export default async function CourseLevelsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") return <NotAuthorized session={session} />;
  const levels = await prisma.courseLevel.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  return <AppShell session={session}><h2 className="mb-4 text-2xl font-bold">Course Levels</h2><form action={saveCourseLevel} className="card mb-6 grid gap-3 md:grid-cols-4"><input name="name" required placeholder="Level name" className="input"/><input name="order" type="number" placeholder="Order" className="input"/><select name="status" className="input"><option>ACTIVE</option><option>ARCHIVED</option></select><button className="btn-primary">Save level</button></form><DataTable><thead><tr><th className="p-3">Name</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead><tbody>{levels.map((l)=><tr className="border-t" key={l.id}><td className="p-3 font-bold">{l.name}</td><td>{l.order}</td><td><StatusBadge status={l.status}/></td><td><form action={archiveCourseLevel}><input type="hidden" name="id" value={l.id}/><ConfirmSubmitButton className="text-primary" message="Archive this level?">Archive</ConfirmSubmitButton></form></td></tr>)}</tbody></DataTable></AppShell>;
}
