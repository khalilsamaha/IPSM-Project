import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, type Role } from "@/lib/auth/roles";

export type AppSession = {
  userId: string;
  email: string | null;
  role: Role;
};

export async function getSession(): Promise<AppSession | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const metadataRole = user.app_metadata.role ?? user.user_metadata.role;
  const role = isRole(metadataRole) ? metadataRole : "RECEPTION";

  return { userId: user.id, email: user.email ?? null, role };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
