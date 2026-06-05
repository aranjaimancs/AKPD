import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/google
 * Initiates the Google OAuth flow server-side.
 * The login page links here; this handler asks Supabase for the
 * Google authorization URL and redirects the browser to it.
 * After the user approves, Google redirects to /auth/callback.
 */
export async function GET(request: NextRequest) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

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
