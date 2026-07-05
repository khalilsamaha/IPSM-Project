import Link from "next/link";
import { archiveCourse, archiveCourseLevel, archiveCoursePricing, deleteCourse, deleteCourseLevel, deleteCoursePricing, restoreCourse, restoreCourseLevel, restoreCoursePricing, saveCourse, saveCourseLevel, saveCoursePricing } from "@/actions/records";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, DataTable, StatusBadge } from "@/components/records/shell";
import { NotAuthorized } from "@/lib/auth/not-authorized";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/records/format";

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function stringParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

export default async function AcademicPricingPage({ searchParams }: Props) {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) return <NotAuthorized session={session} />;

  const params = (await searchParams) ?? {};
  const editPriceId = stringParam(params, "editPriceId");
  const editCourseId = stringParam(params, "editCourseId");
  const editLevelId = stringParam(params, "editLevelId");
  const error = stringParam(params, "error");
  const success = stringParam(params, "success");

  const [courses, levels, seasons, pricings] = await Promise.all([
    prisma.course.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.courseLevel.findMany({ orderBy: [{ status: "asc" }, { order: "asc" }, { name: "asc" }] }),
    prisma.season.findMany({ where: { OR: [{ status: { in: ["PLANNED", "ACTIVE"] } }, ...(editPriceId ? [{ coursePricings: { some: { id: editPriceId } } }] : [])] }, orderBy: { startDate: "desc" } }),
    prisma.coursePricing.findMany({ include: { course: true, level: true, season: true }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] }),
  ]);

  const activeCourses = courses.filter((course) => course.status === "ACTIVE");
  const activeLevels = levels.filter((level) => level.status === "ACTIVE");
  const editPrice = pricings.find((pricing) => pricing.id === editPriceId);
  const editCourse = courses.find((course) => course.id === editCourseId);
  const editLevel = levels.find((level) => level.id === editLevelId);

  return (
    <AppShell session={session}>
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">Admin configuration</p>
          <h2 className="text-3xl font-bold">Academic Pricing</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Manage the course catalog, teaching levels, and price matrix from one place so registration and enrollment dropdowns stay consistent.</p>
        </div>
        <Link className="btn-secondary" href="/register-student">Preview registration flow</Link>
      </div>

      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
      {success ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{success}</div> : null}

      <section className="card mb-6">
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between"><div><h3 className="text-xl font-bold">Course Pricing Matrix</h3><p className="text-sm text-muted-foreground">Set a default course/level price, or choose a season for season-specific pricing.</p></div>{editPrice ? <Link className="text-sm font-bold text-primary" href="/admin/academic-pricing">Cancel price edit</Link> : null}</div>
        <form action={saveCoursePricing} className="mb-5 grid gap-3 md:grid-cols-6">
          {editPrice ? <input type="hidden" name="id" value={editPrice.id} /> : null}
          <select name="courseId" required className="input" defaultValue={editPrice?.courseId ?? ""}><option value="">Course</option>{(editPrice && editPrice.course.status !== "ACTIVE" ? [editPrice.course, ...activeCourses.filter((course) => course.id !== editPrice.courseId)] : activeCourses).map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
          <select name="levelId" required className="input" defaultValue={editPrice?.levelId ?? ""}><option value="">Level</option>{(editPrice && editPrice.level.status !== "ACTIVE" ? [editPrice.level, ...activeLevels.filter((level) => level.id !== editPrice.levelId)] : activeLevels).map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select>
          <select name="seasonId" className="input" defaultValue={editPrice?.seasonId ?? ""}><option value="">All seasons</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select>
          <input name="price" required type="number" min="0" step="0.01" placeholder="Price" className="input" defaultValue={editPrice ? money(editPrice.priceCents) : ""} />
          <select name="status" className="input" defaultValue={editPrice?.status ?? "ACTIVE"}><option>ACTIVE</option><option>ARCHIVED</option></select>
          <button className="btn-primary">{editPrice ? "Update price" : "Add price"}</button>
        </form>
        <DataTable><thead><tr><th className="p-3">Course</th><th>Level</th><th>Season</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{pricings.map((pricing) => <tr className="border-t" key={pricing.id}><td className="p-3 font-bold">{pricing.course.name}</td><td>{pricing.level.name}</td><td>{pricing.season?.name ?? "All seasons"}</td><td>{formatCurrency(pricing.priceCents)}</td><td><StatusBadge status={pricing.status}/></td><td className="flex flex-wrap gap-3"><Link className="text-primary" href={`/admin/academic-pricing?editPriceId=${pricing.id}`}>Edit</Link>{pricing.status !== "ARCHIVED" ? <form action={archiveCoursePricing}><input type="hidden" name="id" value={pricing.id}/><ConfirmSubmitButton className="text-red-700" message="Archive this price?">Archive</ConfirmSubmitButton></form> : <><form action={restoreCoursePricing}><input type="hidden" name="id" value={pricing.id}/><ConfirmSubmitButton className="text-primary" message="Restore this archived price?">Restore</ConfirmSubmitButton></form><form action={deleteCoursePricing}><input type="hidden" name="id" value={pricing.id}/><ConfirmSubmitButton className="text-red-700" message="Permanently delete this archived price? Prefer Archive for historical configuration.">Delete</ConfirmSubmitButton></form></>}</td></tr>)}</tbody></DataTable>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-bold">Manage Courses</h3><p className="text-sm text-muted-foreground">Add, edit, or archive courses used by enrollment forms.</p></div>{editCourse ? <Link className="text-sm font-bold text-primary" href="/admin/academic-pricing">Cancel</Link> : null}</div>
          <form action={saveCourse} className="mb-5 grid gap-3 md:grid-cols-2">{editCourse ? <input type="hidden" name="id" value={editCourse.id} /> : null}<input name="name" required placeholder="Course name" className="input" defaultValue={editCourse?.name ?? ""}/><input name="category" placeholder="Category optional" className="input" defaultValue={editCourse?.category ?? ""}/><input name="description" placeholder="Description optional" className="input md:col-span-2" defaultValue={editCourse?.description ?? ""}/><select name="status" className="input" defaultValue={editCourse?.status ?? "ACTIVE"}><option>ACTIVE</option><option>ARCHIVED</option></select><button className="btn-primary">{editCourse ? "Update course" : "Add course"}</button></form>
          <DataTable><thead><tr><th className="p-3">Name</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>{courses.map((course) => <tr className="border-t" key={course.id}><td className="p-3 font-bold">{course.name}</td><td>{course.category ?? "—"}</td><td><StatusBadge status={course.status}/></td><td className="flex flex-wrap gap-3"><Link className="text-primary" href={`/admin/academic-pricing?editCourseId=${course.id}`}>Edit</Link>{course.status !== "ARCHIVED" ? <form action={archiveCourse}><input type="hidden" name="id" value={course.id}/><ConfirmSubmitButton className="text-red-700" message="Archive this course?">Archive</ConfirmSubmitButton></form> : <><form action={restoreCourse}><input type="hidden" name="id" value={course.id}/><ConfirmSubmitButton className="text-primary" message="Restore this archived course?">Restore</ConfirmSubmitButton></form><form action={deleteCourse}><input type="hidden" name="id" value={course.id}/><ConfirmSubmitButton className="text-red-700" message="Permanently delete this unused course? This cannot be undone.">Delete</ConfirmSubmitButton></form></>}</td></tr>)}</tbody></DataTable>
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-bold">Manage Levels</h3><p className="text-sm text-muted-foreground">Maintain level labels and sorting for registration dropdowns.</p></div>{editLevel ? <Link className="text-sm font-bold text-primary" href="/admin/academic-pricing">Cancel</Link> : null}</div>
          <form action={saveCourseLevel} className="mb-5 grid gap-3 md:grid-cols-2">{editLevel ? <input type="hidden" name="id" value={editLevel.id} /> : null}<input name="name" required placeholder="Level name" className="input" defaultValue={editLevel?.name ?? ""}/><input name="order" type="number" placeholder="Order" className="input" defaultValue={editLevel?.order ?? 0}/><select name="status" className="input" defaultValue={editLevel?.status ?? "ACTIVE"}><option>ACTIVE</option><option>ARCHIVED</option></select><button className="btn-primary">{editLevel ? "Update level" : "Add level"}</button></form>
          <DataTable><thead><tr><th className="p-3">Name</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead><tbody>{levels.map((level) => <tr className="border-t" key={level.id}><td className="p-3 font-bold">{level.name}</td><td>{level.order}</td><td><StatusBadge status={level.status}/></td><td className="flex flex-wrap gap-3"><Link className="text-primary" href={`/admin/academic-pricing?editLevelId=${level.id}`}>Edit</Link>{level.status !== "ARCHIVED" ? <form action={archiveCourseLevel}><input type="hidden" name="id" value={level.id}/><ConfirmSubmitButton className="text-red-700" message="Archive this level?">Archive</ConfirmSubmitButton></form> : <><form action={restoreCourseLevel}><input type="hidden" name="id" value={level.id}/><ConfirmSubmitButton className="text-primary" message="Restore this archived level?">Restore</ConfirmSubmitButton></form><form action={deleteCourseLevel}><input type="hidden" name="id" value={level.id}/><ConfirmSubmitButton className="text-red-700" message="Permanently delete this unused level? This cannot be undone.">Delete</ConfirmSubmitButton></form></>}</td></tr>)}</tbody></DataTable>
        </section>
      </div>
    </AppShell>
  );
}
