import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /auth/callback
 * Google redirects here after OAuth. This handler:
 *  1. Exchanges the one-time code for a Supabase session.
 *  2. Checks the email against the members allowlist.
 *  3. Signs out + bounces unauthorized users immediately.
 *  4. On success: links auth_user_id, stamps role in user_metadata,
 *     ensures a profiles row exists, then redirects into the app.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/seniors";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", siteUrl));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("Auth callback error:", error?.message);
    return NextResponse.redirect(new URL("/login?error=auth_failed", siteUrl));
  }

  const email = data.user.email?.toLowerCase().trim();
  if (!email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=no_email", siteUrl));
  }

  // ── Authoritative allowlist check ─────────────────────────────────────────
  // Use the admin client so we bypass RLS (the user's session isn't fully
  // established yet, and RLS itself depends on is_member() which needs this
  // lookup to succeed first).
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, role, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!member) {
    // Email not in allowlist — sign out immediately and show the gate page.
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/not-authorized", siteUrl));
  }

  // ── Link auth_user_id on first sign-in ────────────────────────────────────
  if (!member.auth_user_id) {
    await admin
      .from("members")
      .update({ auth_user_id: data.user.id })
      .eq("id", member.id);
  }

  // ── Stamp role into user_metadata ─────────────────────────────────────────
  // This lets middleware do a cheap JWT-based coarse redirect without a DB
  // call on every request. The authoritative check is getCurrentMember().
  await admin.auth.admin.updateUserById(data.user.id, {
    user_metadata: { role: member.role },
  });

  // ── Ensure a profiles row exists (idempotent) ─────────────────────────────
  await admin
    .from("profiles")
    .upsert({ id: data.user.id, email }, { onConflict: "id", ignoreDuplicates: true });

  return NextResponse.redirect(new URL(next, siteUrl));
}
