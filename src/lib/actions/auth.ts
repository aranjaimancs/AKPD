"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

/** Sign the current user out and redirect to /login. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ── Email + password sign-in ──────────────────────────────────────────────────

export async function signInWithEmail(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const email = ((formData.get("email") as string) ?? "").toLowerCase().trim();
  const password = (formData.get("password") as string) ?? "";

  if (!email || !password) return { error: "missing_fields" };

  const admin = createAdminClient();

  // Allowlist check before attempting auth
  const { data: member } = await admin
    .from("members")
    .select("id, role, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!member) return { error: "not_authorized" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("password")) {
      return { error: "invalid_credentials" };
    }
    if (msg.includes("email not confirmed")) {
      return { error: "email_not_confirmed" };
    }
    return { error: "auth_failed" };
  }

  const userId = data.user.id;

  // Link auth_user_id in members on first sign-in
  if (!member.auth_user_id) {
    await admin.from("members").update({ auth_user_id: userId }).eq("id", member.id);
  }

  // Ensure a profile row exists
  await admin
    .from("profiles")
    .upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true });

  // Check if they've completed onboarding (full_name set = done)
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const isNewUser = !profile?.full_name;

  // Stamp role + onboarding flag into JWT metadata
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      role: member.role,
      ...(isNewUser ? {} : { onboarding_complete: true }),
    },
  });

  redirect(isNewUser ? "/onboarding" : "/people");
}

// ── Password reset / first-time account setup ─────────────────────────────────

export async function sendPasswordReset(
  _prev: { error?: string; sent?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; sent?: boolean }> {
  const email = ((formData.get("email") as string) ?? "").toLowerCase().trim();

  if (!email) return { error: "missing_fields" };

  // Only send reset links to people in the allowlist
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!member) return { error: "not_authorized" };

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const redirectTo = `${siteUrl}/auth/reset-password`;

  // auth_user_id is linked on first sign-in (Google or email).
  // If it's null the member has never authenticated → no auth.users row yet →
  // use inviteUserByEmail which creates the account AND sends the email.
  // resetPasswordForEmail silently does nothing for non-existent accounts.
  if (member.auth_user_id) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } else {
    await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  }

  // Always return sent:true — don't leak account existence
  return { sent: true };
}
