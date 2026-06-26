"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type OpportunityFormState = {
  error?: string;
  success?: boolean;
  pending?: boolean; // true when submitted for review (non-admin poster)
};

export async function postOpportunity(
  _prev: OpportunityFormState,
  formData: FormData
): Promise<OpportunityFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const title = (formData.get("title") as string)?.trim();
  const organization = (formData.get("organization") as string)?.trim();
  const type = formData.get("type") as string;
  const audience = formData.get("audience") as string || "all";
  const description = (formData.get("description") as string)?.trim() || null;
  const deadline = (formData.get("deadline") as string) || null;
  const link = (formData.get("link") as string)?.trim() || null;

  if (!title) return { error: "Title is required." };
  if (!organization) return { error: "Organization is required." };
  if (!["internship", "full-time", "club", "research", "other"].includes(type)) {
    return { error: "Invalid type." };
  }
  if (!["all", "students", "alumni"].includes(audience)) {
    return { error: "Invalid audience." };
  }

  const admin = createAdminClient();

  // Check if poster is an admin — admins get auto-approved
  const { data: member } = await admin
    .from("members")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isAdmin = member?.role === "admin";

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const posted_by_name = profile?.full_name || profile?.email || "Member";

  const { error } = await admin.from("opportunities").insert({
    title,
    organization,
    type,
    audience,
    description,
    deadline: deadline || null,
    link: link || null,
    posted_by: user.id,
    posted_by_name,
    is_active: true,
    status: isAdmin ? "approved" : "pending",
  });

  if (error) {
    console.error("postOpportunity error:", error.message);
    return { error: "Failed to post opportunity. Please try again." };
  }

  revalidatePath("/opportunities");
  if (isAdmin) revalidatePath("/admin/opportunities");
  return { success: true, pending: !isAdmin };
}

export async function approveOpportunity(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("members")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (member?.role !== "admin") return { error: "Unauthorized." };

  const { error } = await admin
    .from("opportunities")
    .update({ status: "approved" })
    .eq("id", id);

  if (error) return { error: "Could not approve opportunity." };

  revalidatePath("/admin/opportunities");
  revalidatePath("/opportunities");
  return {};
}

export async function rejectOpportunity(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("members")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (member?.role !== "admin") return { error: "Unauthorized." };

  const { error } = await admin
    .from("opportunities")
    .update({ status: "rejected", is_active: false })
    .eq("id", id);

  if (error) return { error: "Could not reject opportunity." };

  revalidatePath("/admin/opportunities");
  return {};
}

export async function deleteOpportunity(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Admins can remove any post; members can only remove their own.
  const { data: member } = await admin
    .from("members")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isAdmin = member?.role === "admin";

  const query = admin
    .from("opportunities")
    .update({ is_active: false })
    .eq("id", id);

  const { error } = isAdmin ? await query : await query.eq("posted_by", user.id);

  if (error) return { error: "Could not remove opportunity." };
  revalidatePath("/opportunities");
  revalidatePath("/admin/opportunities");
  return {};
}
