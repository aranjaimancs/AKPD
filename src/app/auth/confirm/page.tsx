"use client";

/**
 * /auth/confirm
 *
 * Landing page for hash-fragment based email links (implicit / non-PKCE flow).
 * Supabase invite and recovery emails redirect here via the thin HTML shim in
 * /auth/callback/route.ts when no token_hash query param is present.
 *
 * The URL contains the session as a hash fragment:
 *   /auth/confirm#access_token=...&refresh_token=...&type=invite
 *
 * We use the Supabase browser client to exchange those tokens for a real session,
 * then call the completeEmailAuth server action to do the allowlist check,
 * profile upsert, and metadata stamp — identical to what the PKCE callback does.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { completeEmailAuth } from "@/lib/actions/auth";

export default function AuthConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1); // strip leading #
    const params = new URLSearchParams(hash);
    const accessToken  = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      router.replace("/login?error=no_code");
      return;
    }

    const supabase = createClient();

    const type = params.get("type"); // "invite" | "recovery" | "magiclink" | …

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(async ({ error: sessionError }) => {
        if (sessionError) {
          console.error("setSession error:", sessionError.message);
          setError("Sign-in link is invalid or has expired. Please request a new one.");
          return;
        }

        // Session is established — run server-side setup (allowlist, profile, metadata).
        const dest = await completeEmailAuth();

        // For recovery links (re-sent "forgot password" flow) mirror the PKCE path:
        // route to /auth/reset-password so the user can set their password before
        // continuing.  Only do this if setup actually succeeded (dest is not an error
        // redirect like /not-authorized or /login?error=…).
        const setupSucceeded = dest === "/onboarding" || dest === "/people";
        if (type === "recovery" && setupSucceeded) {
          router.replace("/auth/reset-password");
        } else {
          router.replace(dest);
        }
      });
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4"
      style={{ background: "var(--s-page)" }}
    >
      {error ? (
        <div className="w-full max-w-sm flex flex-col items-center gap-5 px-6 text-center">
          <div
            className="rounded-xl px-5 py-4 text-[13px]"
            style={{
              background: "rgba(220,38,38,0.08)",
              color: "#dc2626",
              border: "1px solid rgba(220,38,38,0.2)",
            }}
          >
            {error}
          </div>
          <button
            onClick={() => router.push("/login")}
            className="btn btn-primary btn-sm"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <>
          {/* Spinner */}
          <div
            className="w-8 h-8 rounded-full border-[3px] animate-spin"
            style={{
              borderColor: "var(--b-default)",
              borderTopColor: "var(--akp-gold)",
            }}
          />
          <p className="text-[13px]" style={{ color: "var(--t-muted)" }}>
            Signing you in…
          </p>
        </>
      )}
    </div>
  );
}
