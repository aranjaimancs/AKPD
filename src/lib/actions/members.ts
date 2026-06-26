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
