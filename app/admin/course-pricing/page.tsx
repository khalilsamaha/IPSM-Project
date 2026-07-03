import { redirect } from "next/navigation";
import { archiveCoursePricing, saveCoursePricing } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, DataTable, StatusBadge } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/records/format";

export default async function CoursePricingPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/dashboard");
  const [courses, levels, seasons, pricings] = await Promise.all([prisma.course.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }), prisma.courseLevel.findMany({ where: { status: "ACTIVE" }, orderBy: { order: "asc" } }), prisma.season.findMany({ orderBy: { startDate: "desc" } }), prisma.coursePricing.findMany({ include: { course: true, level: true, season: true }, orderBy: { updatedAt: "desc" } })]);
  return <AppShell session={session}><h2 className="mb-4 text-2xl font-bold">Course Pricing Matrix</h2><form action={saveCoursePricing} className="card mb-6 grid gap-3 md:grid-cols-6"><select name="courseId" required className="input"><option value="">Course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select name="levelId" required className="input"><option value="">Level</option>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select><select name="seasonId" className="input"><option value="">All seasons</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input name="price" required type="number" min="0" step="0.01" placeholder="Price" className="input"/><select name="status" className="input"><option>ACTIVE</option><option>ARCHIVED</option></select><button className="btn-primary">Save price</button></form><DataTable><thead><tr><th className="p-3">Course</th><th>Level</th><th>Season</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{pricings.map((p)=><tr className="border-t" key={p.id}><td className="p-3 font-bold">{p.course.name}</td><td>{p.level.name}</td><td>{p.season?.name ?? "All seasons"}</td><td>{formatCurrency(p.priceCents)}</td><td><StatusBadge status={p.status}/></td><td><form action={archiveCoursePricing}><input type="hidden" name="id" value={p.id}/><ConfirmSubmitButton className="text-primary" message="Archive this price?">Archive</ConfirmSubmitButton></form></td></tr>)}</tbody></DataTable></AppShell>;
}
