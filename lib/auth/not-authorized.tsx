import Link from "next/link";
import { AppShell, EmptyState, PageHeader } from "@/components/records/shell";
import type { AppSession } from "@/lib/auth/session";

export function NotAuthorized({ session, title = "Not authorized", description = "This page is restricted to Admin users." }: { session: AppSession; title?: string; description?: string }) {
  return (
    <AppShell session={session}>
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Admin access required"
        description="Your account is signed in, but it does not have permission for this area. Return to the dashboard or ask an administrator for help."
        action={<Link className="btn-secondary" href="/dashboard">Back to dashboard</Link>}
      />
    </AppShell>
  );
}
