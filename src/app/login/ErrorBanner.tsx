"use client";

import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  unauthorized: "Your account isn't authorized. Contact a chapter admin.",
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
    <div className="rounded-xl p-3.5 mb-5 text-sm feedback-error">
      {msg}
    </div>
  );
}
