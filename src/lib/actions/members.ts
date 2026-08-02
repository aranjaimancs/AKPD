"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type MemberFormState = { error?: string; success?: boolean };

export async function addMember(
  _prev: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  await requireAdmin();

  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const full_name = (formData.get("full_name") as string)?.trim() || null;
  const position = (formData.get("position") as string)?.trim() || null;
  const role = formData.get("role") as string;

  if (!email) return { error: "Email is required." };
  if (!["admin", "member", "alumni"].includes(role)) return { error: "Invalid role." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .insert({ email, full_name, position, role });

  if (error) {
    if (error.code === "23505") return { error: "That email is already a member." };
    console.error("addMember error:", error.message);
    return { error: "Failed to add member. Please try again." };
  }

  revalidatePath("/admin/members");
  return { success: true };
}

export async function updateMemberRole(
  memberId: string,
  newRole: "admin" | "member"
): Promise<{ error?: string }> {
  await requireAdmin();

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ role: newRole })
    .eq("id", memberId);

  if (error) {
    console.error("updateMemberRole error:", error.message);
    return { error: "Failed to update role." };
  }

  revalidatePath("/admin/members");
  return {};
}

export async function updateMember(
  memberId: string,
  data: { full_name: string | null; position: string | null; role: "admin" | "member" | "alumni" }
): Promise<{ error?: string }> {
  await requireAdmin();

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ full_name: data.full_name, position: data.position, role: data.role })
    .eq("id", memberId);

  if (error) {
    console.error("updateMember error:", error.message);
    return { error: "Failed to update member." };
  }

  revalidatePath("/admin/members");
  return {};
}

export async function removeMember(
  memberId: string
): Promise<{ error?: string }> {
  await requireAdmin();

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .delete()
    .eq("id", memberId);

  if (error) {
    console.error("removeMember error:", error.message);
    return { error: "Failed to remove member." };
  }

  revalidatePath("/admin/members");
  return {};
}

/**
 * Directly set a password for a member without sending any email.
 * If the member has never signed in, creates their auth account first.
 */
export async function setMemberPassword(
  memberId: string,
  password: string
): Promise<{ error?: string }> {
  await requireAdmin();

  if (!password || password.length < 6) return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("members")
    .select("id, email, auth_user_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) return { error: "Member not found." };

  if (member.auth_user_id) {
    // Auth account already exists — just update the password
    const { error } = await admin.auth.admin.updateUserById(member.auth_user_id, { password });
    if (error) {
      console.error("setMemberPassword update error:", error.message);
      return { error: "Failed to update password." };
    }
  } else {
    // No auth_user_id linked yet. Try to create a fresh account; if one already
    // exists (e.g. from a previous invite email) find it and update instead.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: member.email,
      password,
      email_confirm: true,
    });

    let userId: string;

    if (createError) {
      // Auth account already exists — find it by email and update the password.
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = usersData?.users?.find(
        (u) => u.email?.toLowerCase().trim() === member.email.toLowerCase().trim()
      );
      if (!existing) {
        console.error("setMemberPassword: createUser failed and no existing account found:", createError.message);
        return { error: "Failed to set password. Please try again." };
      }
      userId = existing.id;
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (updateError) {
        console.error("setMemberPassword update existing error:", updateError.message);
        return { error: "Failed to update password." };
      }
    } else {
      userId = created.user.id;
    }

    await Promise.all([
      admin.from("members").update({ auth_user_id: userId }).eq("id", memberId),
      admin.from("profiles").upsert({ id: userId, email: member.email }, { onConflict: "id", ignoreDuplicates: true }),
      admin.auth.admin.updateUserById(userId, { user_metadata: { role: member.role } }),
    ]);
  }

  revalidatePath("/admin/members");
  return {};
}

export type BulkMemberRow = {
  email: string;
  full_name: string | null;
  position: string | null;
};

export async function bulkAddMembers(
  rows: BulkMemberRow[]
): Promise<{ added: number; skipped: number; error?: string }> {
  await requireAdmin();

  if (!rows.length) return { added: 0, skipped: 0 };

  // Normalise + validate
  const clean = rows
    .map((r) => ({
      email: r.email.toLowerCase().trim(),
      full_name: r.full_name?.trim() || null,
      position: r.position?.trim() || null,
      role: "member" as const,
    }))
    .filter((r) => r.email.length > 0);

  if (!clean.length) return { added: 0, skipped: rows.length };

  const admin = createAdminClient();

  // upsert with ignoreDuplicates: existing emails are silently skipped,
  // returned data contains only the rows that were actually inserted.
  const { data, error } = await admin
    .from("members")
    .upsert(clean, { onConflict: "email", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("bulkAddMembers error:", error.message);
    return { added: 0, skipped: rows.length, error: "Import failed. Please try again." };
  }

  const added = data?.length ?? 0;
  const skipped = clean.length - added;

  revalidatePath("/admin/members");
  return { added, skipped };
}
