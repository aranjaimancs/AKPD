"use client";

import { useActionState, useState } from "react";
import { signInWithEmail, sendPasswordReset } from "@/lib/actions/auth";

// ── Error messages ────────────────────────────────────────────────────────────

const SIGN_IN_ERRORS: Record<string, string> = {
  missing_fields:       "Please enter your email and password.",
  not_authorized:       "Your email isn't authorized. Contact a chapter admin.",
  invalid_credentials:  "Wrong email or password — double-check and try again.",
  email_not_confirmed:  "Check your inbox — you need to confirm your email first.",
  auth_failed:          "Sign-in failed. Please try again.",
};

const RESET_ERRORS: Record<string, string> = {
  missing_fields:  "Please enter your email address.",
  not_authorized:  "That email isn't in our member list. Contact a chapter admin.",
};

// ── Google sign-in button ─────────────────────────────────────────────────────

function GoogleButton() {
  async function handleGoogleSignIn() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-[14px] font-semibold transition-all duration-200 cursor-pointer"
      style={{
        background: "var(--s-0)",
        color: "var(--t-primary)",
        border: "1px solid var(--b-default)",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--b-strong)";
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--b-default)";
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8H6.1C9.5 37.5 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.4 5.6l6.2 5.2C41.1 35.7 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z" />
      </svg>
      Continue with Google
    </button>
  );
}

// ── Sign-in form ──────────────────────────────────────────────────────────────

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const [state, action, pending] = useActionState(signInWithEmail, null);
  const errorMsg = state?.error ? (SIGN_IN_ERRORS[state.error] ?? "Something went wrong.") : null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="input-label">Email</label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@email.com"
          className="input"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="input-label">Password</label>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="input"
        />
      </div>

      {errorMsg && (
        <div className="rounded-xl px-4 py-3 text-[13px] feedback-error">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary w-full mt-1"
        style={{ opacity: pending ? 0.7 : 1 }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <button
        type="button"
        onClick={onForgot}
        className="text-[12px] text-center mt-1 transition-colors"
        style={{ color: "var(--t-muted)" }}
      >
        Forgot password or signing in for the first time?
      </button>
    </form>
  );
}

// ── Password reset form ───────────────────────────────────────────────────────

function ResetForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(sendPasswordReset, null);
  const errorMsg = state?.error ? (RESET_ERRORS[state.error] ?? "Something went wrong.") : null;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] w-fit transition-colors"
        style={{ color: "var(--t-muted)" }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to sign in
      </button>

      <div>
        <h3
          className="text-[15px] font-bold mb-1"
          style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
        >
          {state?.sent ? "Check your inbox" : "Set your password"}
        </h3>
        <p className="text-[13px]" style={{ color: "var(--t-secondary)" }}>
          {state?.sent
            ? "We sent a sign-in link to your email. Click it to set your password."
            : "Enter your chapter email and we'll send you a link to set your password."}
        </p>
      </div>

      {!state?.sent && (
        <form action={action} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="input-label">Email</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@email.com"
              className="input"
              autoFocus
            />
          </div>

          {errorMsg && (
            <div className="rounded-xl px-4 py-3 text-[13px] feedback-error">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary w-full"
            style={{ opacity: pending ? 0.7 : 1 }}
          >
            {pending ? "Sending…" : "Send link"}
          </button>
        </form>
      )}

      {state?.sent && (
        <div
          className="rounded-xl px-4 py-3 text-[13px] flex items-center gap-2"
          style={{ background: "rgba(34,197,94,0.08)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Link sent — check your spam folder if it doesn't arrive in a minute.
        </div>
      )}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px" style={{ background: "var(--b-subtle)" }} />
      <span className="text-[11px] font-medium" style={{ color: "var(--t-faint)" }}>or</span>
      <div className="flex-1 h-px" style={{ background: "var(--b-subtle)" }} />
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function LoginPanel() {
  const [view, setView] = useState<"signin" | "reset">("signin");

  return (
    <div className="flex flex-col gap-5">
      {view === "signin" ? (
        <>
          <SignInForm onForgot={() => setView("reset")} />
          <Divider />
          <GoogleButton />
        </>
      ) : (
        <ResetForm onBack={() => setView("signin")} />
      )}
    </div>
  );
}
