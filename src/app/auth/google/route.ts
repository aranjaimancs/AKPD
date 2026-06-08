import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /auth/google
 * Initiates the Google OAuth (PKCE) flow server-side.
 *
 * signInWithOAuth writes a `code_verifier` cookie that must reach the browser
 * so the /auth/callback can later call exchangeCodeForSession successfully.
 * We capture that cookie by wiring the Supabase client to a temp response, then
 * copy it onto the final redirect — the same pattern used in /auth/callback.
 */
function getSiteUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // x-forwarded-host = the hostname the browser actually requested (Vercel/proxies)
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) return `https://${forwardedHost}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const siteUrl = getSiteUrl(request);

  // Temporary response object solely to capture the PKCE code_verifier cookie.
  const tempResponse = new NextResponse();

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
          cookiesToSet.forEach(({ name, value, options }) => {
            tempResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error("Google OAuth init error:", error?.message);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", siteUrl));
  }

  // Redirect to Google, carrying the code_verifier cookie so the callback
  // can complete the PKCE exchange when Google redirects back.
  const response = NextResponse.redirect(data.url);
  tempResponse.cookies.getAll().forEach(({ name, value, ...rest }) => {
    response.cookies.set(name, value, rest);
  });

  return response;
}
