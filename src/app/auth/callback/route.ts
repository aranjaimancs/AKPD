import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /auth/callback
 * Google redirects here after OAuth. This handler:
 *  1. Exchanges the one-time code for a Supabase session.
 *  2. Checks the email against the members allowlist.
 *  3. Signs out + bounces unauthorized users immediately.
 *  4. On success: links auth_user_id, upserts profile, fetches profile to
 *     detect new vs returning users, stamps role + onboarding status in
 *     user_metadata, then redirects appropriately.
 *     — New users (no full_name set):     → /onboarding
 *     — Returning users (full_name set):  → `next` param (default /people)
 *
 * Important: cookies must be written directly onto the redirect response,
 * not via cookies() from next/headers — otherwise the session is lost after
 * the redirect and the user ends up back at /login.
 */
function getSiteUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) return `https://${forwardedHost}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Email invite/recovery links use token_hash+type instead of a PKCE code.
  const tokenHash = url.searchParams.get("token_hash");
  const tokenType = (url.searchParams.get("type") ?? "magiclink") as
    | "recovery"
    | "invite"
    | "signup"
    | "email"
    | "magiclink";
  const next = url.searchParams.get("next") ?? "/people";
  const siteUrl = getSiteUrl(request);

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL("/login?error=no_code", siteUrl));
  }

  // Use /onboarding as the initial redirect target so session cookies are
  // always written regardless of which branch we ultimately take.
  const cookieResponse = NextResponse.redirect(new URL("/onboarding", siteUrl));

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
            cookieResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // ── Establish session ─────────────────────────────────────────────────────
  // OAuth (Google) sends a PKCE `code`; email invite/recovery links send a
  // `token_hash` with a `type`. Handle both so a single callback URL covers
  // every auth flow without needing extra entries in Supabase's redirect allowlist.
  let sessionUser: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error("Auth callback code error:", error?.message);
      return NextResponse.redirect(new URL("/login?error=auth_failed", siteUrl));
    }
    sessionUser = data.user;
  } else {
    // token_hash — invite or recovery
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash!,
      type: tokenType,
    });
    if (error || !data.user) {
      console.error("Auth callback OTP error:", error?.message);
      return NextResponse.redirect(new URL("/login?error=auth_failed", siteUrl));
    }
    sessionUser = data.user;
  }

  const email = sessionUser.email?.toLowerCase().trim();
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=no_email", siteUrl));
  }

  // ── Authoritative allowlist check ─────────────────────────────────────────
  const admin = createAdminClient();
  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id, role, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (memberError) {
    console.error("Members DB lookup error:", memberError.message, "| email:", email);
    return NextResponse.redirect(new URL("/login?error=db_error", siteUrl));
  }

  if (!member) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/not-authorized", siteUrl));
  }

  // ── Link auth_user_id + upsert profile (parallel) ─────────────────────────
  await Promise.all([
    !member.auth_user_id
      ? admin.from("members").update({ auth_user_id: sessionUser.id }).eq("id", member.id)
      : Promise.resolve(),
    admin
      .from("profiles")
      .upsert({ id: sessionUser.id, email }, { onConflict: "id", ignoreDuplicates: true }),
  ]);

  // ── Check profile completeness to route correctly ─────────────────────────
  // full_name being set is the canonical signal that onboarding was completed.
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", sessionUser.id)
    .maybeSingle();

  const isNewUser = !profile?.full_name;

  // ── Stamp role + onboarding status in JWT metadata ────────────────────────
  await admin.auth.admin.updateUserById(sessionUser.id, {
    user_metadata: {
      role: member.role,
      // Existing users get marked complete immediately so they never hit /onboarding.
      // New users are left without the flag so the onboarding page can detect them.
      ...(isNewUser ? {} : { onboarding_complete: true }),
    },
  });

  // ── Redirect to the right destination ─────────────────────────────────────
  // If an explicit `next` was provided (e.g. password setup flow), always honour
  // it — even for new users — so the password page is shown before onboarding.
  const hasExplicitNext = url.searchParams.has("next");

  // New users with no explicit next → /onboarding
  if (isNewUser && !hasExplicitNext) return cookieResponse;

  // Everyone else → next param (default /people)
  // Copy session cookies from cookieResponse onto the new redirect response.
  const finalResponse = NextResponse.redirect(new URL(next, siteUrl));
  cookieResponse.headers.getSetCookie().forEach((cookie) => {
    finalResponse.headers.append("Set-Cookie", cookie);
  });
  return finalResponse;
}
