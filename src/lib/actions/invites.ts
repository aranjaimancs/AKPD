"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type InviteLink = {
  id: string;
  token: string;
  created_by: string | null;
  expires_at: string;
  is_active: boolean;
  created_at: string;
};

export type InviteRequest = {
  id: string;
  link_id: string;
  full_name: string;
  email: string;
  role: "member" | "alumni";
  position: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type InviteFormState = { error?: string; success?: boolean };

// ── generateInviteLink ────────────────────────────────────────────────────────

export async function generateInviteLink(): Promise<{
  token?: string;
  error?: string;
}> {
  await requireAdmin();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const db = createAdminClient();

  // Deactivate all existing links
  await db.from("invite_links").update({ is_active: false }).eq("is_active", true);

  // Insert new link expiring in 24 hours
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("invite_links")
    .insert({ created_by: user?.id ?? null, expires_at: expiresAt })
    .select("token")
    .single();

  if (error || !data) {
    console.error("generateInviteLink error:", error?.message);
    return { error: "Failed to generate link. Please try again." };
  }

  revalidatePath("/admin/members");
  return { token: data.token as string };
}

// ── submitInviteRequest ───────────────────────────────────────────────────────

export async function submitInviteRequest(
  token: string,
  _prev: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  const db = createAdminClient();

  // Re-validate the token is still active and not expired
  const { data: link } = await db
    .from("invite_links")
    .select("id")
    .eq("token", token)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!link) {
    return { error: "This invite link has expired. Ask your chapter admin for a new one." };
  }

  const full_name = (formData.get("full_name") as string)?.trim();
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const role = formData.get("role") as string;
  const position = (formData.get("position") as string)?.trim() || null;

  if (!full_name) return { error: "Full name is required." };
  if (!email || !email.includes("@")) return { error: "A valid email is required." };
  if (!["member", "alumni"].includes(role)) return { error: "Please select a role." };

  const { error } = await db.from("invite_requests").insert({
    link_id: link.id,
    full_name,
    email,
    role,
    position,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You've already submitted a request with that email." };
    }
    console.error("submitInviteRequest error:", error.message);
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

// ── approveInviteRequest ──────────────────────────────────────────────────────

export async function approveInviteRequest(
  requestId: string
): Promise<{ error?: string }> {
  await requireAdmin();

  const db = createAdminClient();

  const { data: req } = await db
    .from("invite_requests")
    .select("id, full_name, email, role, position")
    .eq("id", requestId)
    .maybeSingle();

  if (!req) return { error: "Request not found." };

  // Insert into members allowlist
  const { error: memberError } = await db.from("members").insert({
    email: req.email,
    full_name: req.full_name,
    position: req.position,
    role: req.role,
  });

  if (memberError) {
    if (memberError.code === "23505") {
      // Already a member — still mark as approved so it clears the queue
      await db
        .from("invite_requests")
        .update({ status: "approved" })
        .eq("id", requestId);
      revalidatePath("/admin/members");
      return { error: `${req.email} is already a member. Request cleared.` };
    }
    console.error("approveInviteRequest insert member error:", memberError.message);
    return { error: "Failed to add member. Please try again." };
  }

  // Send Supabase invite email
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const { error: inviteError } = await db.auth.admin.inviteUserByEmail(req.email, {
    redirectTo: `${siteUrl}/auth/callback`,
  });
  if (inviteError) {
    // Non-fatal — member was added. Surface a warning but don't block.
    console.error("approveInviteRequest inviteUserByEmail error:", inviteError.message);
    await db.from("invite_requests").update({ status: "approved" }).eq("id", requestId);
    revalidatePath("/admin/members");
    return {
      error: `${req.email} added as member, but invite email failed: ${inviteError.message}. You may need to set their password manually.`,
    };
  }

  await db.from("invite_requests").update({ status: "approved" }).eq("id", requestId);
  revalidatePath("/admin/members");
  return {};
}

// ── rejectInviteRequest ───────────────────────────────────────────────────────

export async function rejectInviteRequest(
  requestId: string
): Promise<{ error?: string }> {
  await requireAdmin();

  const db = createAdminClient();
  const { error } = await db
    .from("invite_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  if (error) {
    console.error("rejectInviteRequest error:", error.message);
    return { error: "Failed to reject request." };
  }

  revalidatePath("/admin/members");
  return {};
}
