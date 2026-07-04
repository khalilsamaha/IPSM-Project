"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission, isProtectedUser, isSuperAdmin, type Role } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/server-log";

const roleSchema = z.enum(["ADMIN", "RECEPTION"]);
const editableRoleSchema = z.enum(["ADMIN", "RECEPTION"]);
const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Temporary password must be at least 8 characters."),
  role: roleSchema,
});

const profileIdSchema = z.string().uuid();

function userErrorRedirect(message: string): never {
  redirect(`/users?error=${encodeURIComponent(message)}`);
}

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

async function blockProtectedUserMutation(session: { role: Role }, actorId: string | null, target: { id: string; role: string; email: string }) {
  if (!isProtectedUser(target) || isSuperAdmin(session.role)) return;
  await audit("protected_user_modification_blocked", actorId, target.id, { email: target.email, role: target.role });
  userErrorRedirect("Not authorized to modify the protected system owner account.");
}

export async function createUser(formData: FormData) {
  const { actorId } = await requireUserManager();
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) userErrorRedirect(parsed.error.issues[0]?.message ?? "Invalid user details.");

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    logServerError("users.create.config", error);
    userErrorRedirect("User management is not configured. Ask an administrator to set SUPABASE_SERVICE_ROLE_KEY on the server.");
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { name: parsed.data.name, role: parsed.data.role },
  });
  if (error || !data.user) userErrorRedirect(error?.message ?? "Unable to create authentication user.");

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
  const { actorId, session } = await requireUserManager();
  const id = profileIdSchema.parse(formData.get("id"));
  const role = editableRoleSchema.parse(formData.get("role"));

  const previous = await prisma.userProfile.findUniqueOrThrow({ where: { id }, select: { id: true, role: true, authId: true, email: true } });
  await blockProtectedUserMutation(session, actorId, previous);
  if (previous.authId === session.userId && previous.role === "ADMIN" && role !== "ADMIN" && formData.get("confirmSelfRoleChange") !== "yes") userErrorRedirect("Confirm before removing your own Admin access.");
  const user = await prisma.userProfile.update({ where: { id }, data: { role } });
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(user.authId, { user_metadata: { role } });
    if (error) logServerError("users.role.auth_metadata", error, { profileId: id });
  } catch (error) {
    logServerError("users.role.config", error, { profileId: id });
  }
  await audit("user_role_changed", actorId, id, { from: previous.role, to: role, email: user.email });
  revalidatePath("/users");
}

export async function setUserStatus(formData: FormData) {
  const { actorId, session } = await requireUserManager();
  const id = profileIdSchema.parse(formData.get("id"));
  const status = statusSchema.parse(formData.get("status"));
  const user = await prisma.userProfile.findUniqueOrThrow({ where: { id }, select: { id: true, authId: true, email: true, role: true, status: true } });
  await blockProtectedUserMutation(session, actorId, user);
  if (user.authId === session.userId && status === "INACTIVE") userErrorRedirect("You cannot disable your own account.");

  const updated = await prisma.userProfile.update({ where: { id }, data: { status, archivedAt: status === "INACTIVE" ? new Date() : null } });
  await audit(status === "ACTIVE" ? "user_reactivated" : "user_disabled", actorId, id, { email: updated.email, from: user.status, to: status });
  revalidatePath("/users");
}

export async function resetUserPassword(formData: FormData) {
  const { actorId, session } = await requireUserManager();
  const id = profileIdSchema.parse(formData.get("id"));
  const password = z.string().min(8, "Temporary password must be at least 8 characters.").parse(formData.get("password"));
  const user = await prisma.userProfile.findUniqueOrThrow({ where: { id }, select: { id: true, authId: true, email: true, role: true } });
  await blockProtectedUserMutation(session, actorId, user);

  try {
    const { error } = await createAdminClient().auth.admin.updateUserById(user.authId, { password });
    if (error) userErrorRedirect(error.message);
  } catch (error) {
    logServerError("users.password_reset", error, { profileId: id });
    userErrorRedirect("User management is not configured. Ask an administrator to set SUPABASE_SERVICE_ROLE_KEY on the server.");
  }

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
