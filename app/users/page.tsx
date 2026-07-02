import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AppShell, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/records/shell";
import { createUser, changeUserRole, deactivateUser, resetUserPassword, setUserStatus } from "@/actions/users";
import { hasPermission } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/records/format";

const inputClass = "rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession();
  const { error } = await searchParams;
  if (!hasPermission(session.role, "users:manage")) {
    return (
      <AppShell session={session}>
        <PageHeader title="Not authorized" description="You do not have permission to access this admin-only page." />
        <EmptyState title="Admin access required" description="Please return to the dashboard or contact an administrator if you need access." />
      </AppShell>
    );
  }
  const isSupabaseAdminConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const users = await prisma.userProfile.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }] });

  return <AppShell session={session}>
    <PageHeader title="User Management" description="Create staff logins, assign roles, reset passwords, and deactivate access without using the Supabase dashboard." />
    {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div> : null}

    {!isSupabaseAdminConfigured ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">User management actions are unavailable because SUPABASE_SERVICE_ROLE_KEY is not configured on the server.</div> : null}

    <section className="mb-6 rounded-[1.5rem] border border-border bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold">Create User</h3>
      <p className="mt-1 text-sm text-muted-foreground">Creates a Supabase Auth user and matching application profile linked by auth_id.</p>
      <form action={createUser} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <input className={inputClass} name="name" placeholder="Full name" required />
        <input className={inputClass} name="email" type="email" placeholder="Email" required />
        <input className={inputClass} name="password" type="password" minLength={8} placeholder="Temporary password" required />
        <select className={inputClass} name="role" defaultValue="RECEPTION"><option value="RECEPTION">RECEPTION</option><option value="ADMIN">ADMIN</option></select>
        <button className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Create User</button>
      </form>
    </section>

    {users.length ? <DataTable><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Last updated</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}>
      <td className="font-semibold">{user.name}</td>
      <td>{user.email}</td>
      <td><RoleBadge role={user.role} /></td>
      <td><StatusBadge status={user.status} /></td>
      <td>{formatDate(user.createdAt)}</td>
      <td>{formatDate(user.updatedAt)}</td>
      <td className="min-w-[28rem]">
        <div className="flex flex-wrap gap-2">
          <form action={changeUserRole} className="flex items-center gap-2">
            <input type="hidden" name="id" value={user.id} />
            <select className="rounded-xl border border-border px-2 py-1 text-xs font-semibold" name="role" defaultValue={user.role}><option value="RECEPTION">RECEPTION</option><option value="ADMIN">ADMIN</option></select>
            {user.authId === session.userId ? <label className="text-xs"><input type="checkbox" name="confirmSelfRoleChange" value="yes" /> Confirm self-change</label> : null}<button className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Edit Role</button>
          </form>
          <form action={user.status === "ACTIVE" ? deactivateUser : setUserStatus}>
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="status" value="ACTIVE" />
            <ConfirmSubmitButton className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800" message={`${user.status === "ACTIVE" ? "Disable" : "Reactivate"} ${user.email}?`}>
              {user.status === "ACTIVE" ? "Disable" : "Reactivate"}
            </ConfirmSubmitButton>
          </form>
          <form action={resetUserPassword} className="flex items-center gap-2">
            <input type="hidden" name="id" value={user.id} />
            <input className="w-40 rounded-xl border border-border px-2 py-1 text-xs" name="password" type="password" minLength={8} placeholder="Temp password" required />
            <ConfirmSubmitButton className="rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700" message={`Set a temporary password for ${user.email}?`}>Reset Password</ConfirmSubmitButton>
          </form>
        </div>
      </td>
    </tr>)}</tbody></DataTable> : <EmptyState title="No users found" description="Create the first staff user from the form above." />}
  </AppShell>;
}

function RoleBadge({ role }: { role: string }) {
  const tone = role === "ADMIN" ? "bg-violet-50 text-violet-700 ring-violet-200" : "bg-blue-50 text-blue-700 ring-blue-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone}`}>{role}</span>;
}
