import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/dashboard/data";
import { isRole, type Role } from "@/lib/auth/roles";

export type AppSession = {
  userId: string;
  email: string | null;
  role: Role;
};

type AuthUser = {
  id: string;
  email?: string | null;
};

type SessionProfile = {
  email: string | null;
  role: string | null;
} | null;

export function resolveProfileRole(profile: SessionProfile): Role {
  return isRole(profile?.role) ? profile.role : "RECEPTION";
}

export async function getSession(): Promise<AppSession | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user as AuthUser | null;
  if (!user) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { authId: user.id },
    select: { email: true, role: true },
  });

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    role: resolveProfileRole(profile),
  };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
