import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isRole, type Role } from "@/lib/auth/roles";

export type AppSession = {
  userId: string;
  email: string | null;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
};

type AuthUser = {
  id: string;
  email?: string | null;
};

type SessionProfile = {
  email: string | null;
  role: string | null;
  status?: "ACTIVE" | "INACTIVE" | null;
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
    select: { email: true, role: true, status: true, archivedAt: true },
  });

  if (profile?.status === "INACTIVE" || profile?.archivedAt) return null;

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    role: resolveProfileRole(profile),
    status: profile?.status ?? "ACTIVE",
  };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
