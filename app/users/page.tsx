import { AppShell, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/records/shell";
import { hasPermission } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";

export default async function UsersPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "users:manage")) throw new Error("Not authorized to manage users");
  const users = await prisma.userProfile.findMany({ orderBy: { updatedAt: "desc" } });
  return <AppShell session={session}>
    <PageHeader title="User Management" description="Review staff accounts, roles, and access status. User invitations and role changes remain handled through the configured authentication workflow." />
    {users.length ? <DataTable><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td className="font-medium">{user.name ?? "—"}</td><td>{user.email}</td><td>{user.role}</td><td><StatusBadge status={user.status} /></td></tr>)}</tbody></DataTable> : <EmptyState title="No users found" description="Users will appear here after their profiles are created." />}
  </AppShell>;
}
