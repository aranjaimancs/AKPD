import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /auth/callback
 * Google redirects here after OAuth. This handler:
 *  1. Exchanges the one-time code for a Supabase session.
 *  2. Checks the email against the members allowlist.
 *  3. Signs out + bounces unauthorized users immediately.
 *  4. On success: links auth_user_id, stamps role in user_metadata,
 *     ensures a profiles row exists, then redirects into the app.
 *
 * Important: cookies must be written directly onto the redirect response,
 * not via cookies() from next/headers — otherwise the session is lost after
 * the redirect and the user ends up back at /login.
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
  const next = url.searchParams.get("next") ?? "/people";
  const siteUrl = getSiteUrl(request);

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", siteUrl));
  }

  // Build the success redirect response first so we can write session cookies
  // directly onto it — this is the only reliable way to persist the session
  // across the redirect in Next.js App Router route handlers.
  const successResponse = NextResponse.redirect(new URL(next, siteUrl));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write session cookies onto the redirect response so the browser
          // receives them in the same round-trip.
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("Auth callback error:", error?.message);
    return NextResponse.redirect(new URL("/login?error=auth_failed", siteUrl));
  }

  const email = data.user.email?.toLowerCase().trim();
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=no_email", siteUrl));
  }

  // ── Authoritative allowlist check ─────────────────────────────────────────
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, role, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!member) {
    // Email not in allowlist — sign out and show the gate page.
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/not-authorized", siteUrl));
  }

  // ── Link, stamp, and upsert profile — all in parallel ────────────────────
  await Promise.all([
    !member.auth_user_id
      ? admin.from("members").update({ auth_user_id: data.user.id }).eq("id", member.id)
      : Promise.resolve(),
    admin.auth.admin.updateUserById(data.user.id, {
      user_metadata: { role: member.role },
    }),
    admin
      .from("profiles")
      .upsert({ id: data.user.id, email }, { onConflict: "id", ignoreDuplicates: true }),
  ]);

  return successResponse;
}
