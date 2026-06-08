import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/google
 * Initiates the Google OAuth flow server-side.
 * The login page links here; this handler asks Supabase for the
 * Google authorization URL and redirects the browser to it.
 * After the user approves, Google redirects to /auth/callback.
 */
/** Resolves the canonical public URL of this deployment. Priority:
 *  1. NEXT_PUBLIC_SITE_URL — set this in Vercel env vars for your custom domain
 *  2. VERCEL_URL          — auto-set by Vercel to the deployment host (no protocol)
 *  3. Incoming request origin — reliable in local dev, unreliable behind proxies
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
  const siteUrl = getSiteUrl(request);

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
      // Optional: restrict the Google account picker to unc.edu accounts.
      // This is a UX hint only — the members allowlist is the real gate.
      // Uncomment when you're ready to enforce the domain:
      // queryParams: { hd: "unc.edu" },
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error("Google OAuth init error:", error?.message);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", siteUrl));
  }

  return NextResponse.redirect(data.url);
}
