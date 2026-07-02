import { AppShell, EmptyState, PageHeader } from "@/components/records/shell";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";

export default async function SettingsPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "settings:manage")) throw new Error("Not authorized to manage settings");

  return (
    <AppShell session={session}>
      <PageHeader
        title="Settings"
        description="System configuration options for administrators. Additional settings can be added here as operational needs expand."
      />
      <EmptyState
        title="No configurable settings yet"
        description="Core school operations are already available from the sidebar. Future system preferences will appear here."
      />
    </AppShell>
  );
}
