"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

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

  // Derive the canonical site URL from the actual request host so the
  // redirectTo always matches what the user is accessing, even on preview
  // deployments where VERCEL_URL is a per-deploy hash URL.
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  // Route through /auth/callback — that URL is already in Supabase's allowlist
  // (used by Google OAuth), so no extra allowlist configuration is needed.
  // After exchanging the code the callback redirects to /auth/reset-password.
  const redirectTo = `${siteUrl}/auth/callback?next=/auth/reset-password`;

  if (member.auth_user_id) {
    // Has signed in before → confirmed auth account exists → send recovery email.
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } else {
    // No auth account yet → try to invite (creates account + sends email in one step).
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

    if (inviteErr) {
      // inviteUserByEmail fails when an auth account already exists (e.g. a previous
      // invite whose link expired before the user clicked it). In that case:
      //  1. Find the existing auth account.
      //  2. Confirm their email if it wasn't confirmed yet — resetPasswordForEmail
      //     silently does nothing for unconfirmed addresses in some Supabase configs.
      //  3. Link auth_user_id on our members row so future sign-ins resolve correctly.
      //  4. Send the recovery (set-password) email.
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingAuthUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase().trim() === email
      );

      if (existingAuthUser) {
        const needsConfirm = !existingAuthUser.email_confirmed_at;
        await Promise.all([
          needsConfirm
            ? admin.auth.admin.updateUserById(existingAuthUser.id, { email_confirm: true })
            : Promise.resolve(),
          !member.auth_user_id
            ? admin.from("members").update({ auth_user_id: existingAuthUser.id }).eq("id", member.id)
            : Promise.resolve(),
        ]);
      }

      const supabase = await createClient();
      await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    }
  }

  // Always return sent:true — don't leak account existence
  return { sent: true };
}
