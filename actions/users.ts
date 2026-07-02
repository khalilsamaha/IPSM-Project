"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/dashboard/data";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

const roleSchema = z.enum(["ADMIN", "RECEPTION"]);
const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Temporary password must be at least 8 characters."),
  role: roleSchema,
});

const profileIdSchema = z.string().uuid();

async function requireUserManager() {
  const session = await requireSession();
  if (!hasPermission(session.role, "users:manage")) throw new Error("Not authorized to manage users");

  const actor = await prisma.userProfile.findUnique({
    where: { authId: session.userId },
    select: { id: true },
  });

  return { session, actorId: actor?.id ?? null };
}

async function audit(action: string, actorId: string | null, entityId: string | null, metadata?: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      actorId,
      createdById: actorId,
      action,
      entity: "users",
      entityId,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function createUser(formData: FormData) {
  const { actorId } = await requireUserManager();
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid user details.");

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { name: parsed.data.name, role: parsed.data.role },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Unable to create authentication user.");

  try {
    const profile = await prisma.userProfile.create({
      data: {
        authId: data.user.id,
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        status: "ACTIVE",
      },
    });
    await audit("user_created", actorId, profile.id, { email: profile.email, role: profile.role, authId: profile.authId });
  } catch (error) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw error;
  }

  revalidatePath("/users");
}

export async function changeUserRole(formData: FormData) {
  const { actorId } = await requireUserManager();
  const id = profileIdSchema.parse(formData.get("id"));
  const role = roleSchema.parse(formData.get("role"));

  const previous = await prisma.userProfile.findUniqueOrThrow({ where: { id }, select: { role: true, authId: true } });
  const user = await prisma.userProfile.update({ where: { id }, data: { role } });
  const supabase = createAdminClient();
  await supabase.auth.admin.updateUserById(user.authId, { user_metadata: { role } });
  await audit("user_role_changed", actorId, id, { from: previous.role, to: role, email: user.email });
  revalidatePath("/users");
}

export async function setUserStatus(formData: FormData) {
  const { actorId, session } = await requireUserManager();
  const id = profileIdSchema.parse(formData.get("id"));
  const status = statusSchema.parse(formData.get("status"));
  const user = await prisma.userProfile.findUniqueOrThrow({ where: { id }, select: { authId: true, email: true, status: true } });
  if (user.authId === session.userId && status === "INACTIVE") throw new Error("You cannot disable your own account.");

  const updated = await prisma.userProfile.update({ where: { id }, data: { status, archivedAt: status === "INACTIVE" ? new Date() : null } });
  await audit(status === "ACTIVE" ? "user_reactivated" : "user_disabled", actorId, id, { email: updated.email, from: user.status, to: status });
  revalidatePath("/users");
}

export async function resetUserPassword(formData: FormData) {
  const { actorId } = await requireUserManager();
  const id = profileIdSchema.parse(formData.get("id"));
  const password = z.string().min(8, "Temporary password must be at least 8 characters.").parse(formData.get("password"));
  const user = await prisma.userProfile.findUniqueOrThrow({ where: { id }, select: { authId: true, email: true } });

  const { error } = await createAdminClient().auth.admin.updateUserById(user.authId, { password });
  if (error) throw new Error(error.message);

  await audit("password_reset_requested", actorId, id, { email: user.email, method: "temporary_password_set" });
  revalidatePath("/users");
}

export async function deactivateUser(formData: FormData) {
  formData.set("status", "INACTIVE");
  await setUserStatus(formData);
  const id = profileIdSchema.parse(formData.get("id"));
  const { actorId } = await requireUserManager();
  await audit("user_deactivated", actorId, id);
}
