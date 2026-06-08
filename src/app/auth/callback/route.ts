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
function getSiteUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // x-forwarded-host = the hostname the browser actually requested (set by Vercel/proxies)
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) return `https://${forwardedHost}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/seniors";
  const siteUrl = getSiteUrl(request);

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

  // ── Link, stamp, and upsert profile — all in parallel ────────────────────
  await Promise.all([
    // Link auth_user_id on first sign-in
    !member.auth_user_id
      ? admin.from("members").update({ auth_user_id: data.user.id }).eq("id", member.id)
      : Promise.resolve(),

    // Stamp role into user_metadata so middleware can do cheap JWT-based
    // coarse redirects without a DB call on every request.
    admin.auth.admin.updateUserById(data.user.id, {
      user_metadata: { role: member.role },
    }),

    // Ensure a profiles row exists (idempotent)
    admin
      .from("profiles")
      .upsert({ id: data.user.id, email }, { onConflict: "id", ignoreDuplicates: true }),
  ]);

  return NextResponse.redirect(new URL(next, siteUrl));
}
