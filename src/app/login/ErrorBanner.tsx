"use client";

import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  unauthorized: "Your account isn't authorised. Contact a chapter admin.",
  oauth_failed: "Google sign-in failed — please try again.",
  auth_failed:  "Authentication failed — please try again.",
  no_code:      "Invalid sign-in link. Please start over.",
  no_email:     "Could not read your email. Please try again.",
  db_error:     "Server configuration error — check SUPABASE_SERVICE_ROLE_KEY in Vercel.",
};

export default function ErrorBanner() {
  const params = useSearchParams();
  const code = params.get("error");
  if (!code) return null;

  const msg = MESSAGES[code] ?? "Something went wrong. Please try again.";

  return (
    <div
      className="rounded-xl p-3.5 mb-5 text-sm"
      style={{
        background: "#fef2f2",
        border: "1px solid #fca5a5",
        color: "#991b1b",
      }}
    >
      {msg}
    </div>
  );
}
