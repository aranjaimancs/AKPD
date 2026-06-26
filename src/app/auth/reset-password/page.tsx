"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Inner component (reads searchParams) ─────────────────────────────────────

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [status, setStatus] = useState<"verifying" | "ready" | "error">("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Exchange the token hash for a session when the page loads
  useEffect(() => {
    const tokenHash = params.get("token_hash");
    const type = params.get("type") as string | null;

    // Accept both recovery (existing user reset) and invite (first-time setup)
    if (!tokenHash || (type !== "recovery" && type !== "invite")) {
      setStatus("error");
      return;
    }

    const supabase = createClient();
    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: type as "recovery" | "invite" })
      .then(({ error }) => {
        setStatus(error ? "error" : "ready");
      });
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (password.length < 8) {
      setSaveError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setSaveError("Passwords don't match.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setSaveError("Failed to set password — the link may have expired. Request a new one.");
      setSaving(false);
      return;
    }

    setDone(true);
    // Give them a moment to read the success message, then redirect
    setTimeout(() => router.push("/people"), 2000);
  };

  // ── States ────────────────────────────────────────────────────────────────

  if (status === "verifying") {
    return (
      <div className="flex flex-col items-center gap-3" style={{ color: "var(--t-muted)" }}>
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--akp-navy)", borderTopColor: "transparent" }}
        />
        <p className="text-[13px]">Verifying your link…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="rounded-xl px-4 py-3 text-[13px]"
          style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}
        >
          This link is invalid or has expired. Head back to the login page and request a new one.
        </div>
        <button
          onClick={() => router.push("/login")}
          className="btn btn-primary w-full"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center animate-scaleIn"
          style={{ background: "var(--akp-navy)" }}
        >
          <svg width="28" height="28" fill="none" stroke="var(--akp-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <p className="text-[16px] font-bold mb-1" style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}>
            Password set!
          </p>
          <p className="text-[13px]" style={{ color: "var(--t-secondary)" }}>
            Taking you to the portal…
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h2
          className="text-2xl font-bold mb-1"
          style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.015em" }}
        >
          Set your password
        </h2>
        <p className="text-[13px]" style={{ color: "var(--t-secondary)" }}>
          Choose a password for your AKPD account.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="input-label">New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="input"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="input-label">Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          placeholder="Same as above"
          className="input"
          required
        />
      </div>

      {saveError && (
        <div
          className="rounded-xl px-4 py-3 text-[13px]"
          style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}
        >
          {saveError}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary w-full"
        style={{ opacity: saving ? 0.7 : 1 }}
      >
        {saving ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ background: "var(--s-page)" }}>
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <Image src="/aklogo.png" alt="AKΨ" width={32} height={32} className="rounded-full" />
          <span
            className="text-[12px] font-extrabold uppercase tracking-[0.08em]"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            AKPD
          </span>
        </div>

        <Suspense>
          <ResetPasswordInner />
        </Suspense>
      </div>
    </div>
  );
}
