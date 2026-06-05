"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type OpportunityFormState = {
  error?: string;
  success?: boolean;
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
  const description = (formData.get("description") as string)?.trim() || null;
  const deadline = (formData.get("deadline") as string) || null;
  const link = (formData.get("link") as string)?.trim() || null;

  if (!title) return { error: "Title is required." };
  if (!organization) return { error: "Organization is required." };
  if (!["internship", "full-time", "club", "research", "other"].includes(type)) {
    return { error: "Invalid type." };
  }

  // Get poster's name from profiles
  const admin = createAdminClient();
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
    description,
    deadline: deadline || null,
    link: link || null,
    posted_by: user.id,
    posted_by_name,
    is_active: true,
  });

  if (error) {
    console.error("postOpportunity error:", error.message);
    return { error: "Failed to post opportunity. Please try again." };
  }

  revalidatePath("/opportunities");
  return { success: true };
}

export async function deleteOpportunity(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("opportunities")
    .update({ is_active: false })
    .eq("id", id)
    .eq("posted_by", user.id);

  if (error) return { error: "Could not remove opportunity." };
  revalidatePath("/opportunities");
  return {};
}
