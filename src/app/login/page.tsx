"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink } from "@/lib/actions/auth";

// useSearchParams() must be wrapped in a Suspense boundary
function LoginForm() {
  const [result, action, pending] = useActionState(sendMagicLink, null);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const sent = result === "CHECK_EMAIL";

  let spError: string | null = null;
  if (urlError === "unauthorized") spError = "That email isn't on the access list.";
  else if (urlError === "auth_failed") spError = "Authentication failed — try again.";
  else if (urlError) spError = "Something went wrong. Please try again.";

  const errorMsg = !sent && result !== null && result !== "CHECK_EMAIL" ? result : spError;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--akp-navy)" }}
    >
      {/* Background dot texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(201,168,76,0.15) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm rounded-3xl p-10"
        style={{
          background: "var(--akp-white)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        }}
      >
        {/* Logo / wordmark */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold shrink-0"
            style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
          >
            AK
          </div>
          <div>
            <p
              className="text-sm font-extrabold leading-tight"
              style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
            >
              Alpha Kappa Psi
            </p>
            <p className="text-xs" style={{ color: "var(--akp-gray-400)" }}>
              AKPD · Member Portal
            </p>
          </div>
        </div>

        {sent ? (
          /* ── Success state ── */
          <div className="text-center py-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--akp-gold-muted)" }}
            >
              <svg width="24" height="24" fill="none" stroke="var(--akp-navy)" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2
              className="text-xl font-bold mb-2"
              style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
            >
              Check your email
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--akp-gray-600)" }}>
              We sent a magic link to your inbox. Click it to sign in — no password needed.
            </p>
            <p className="text-xs mt-4" style={{ color: "var(--akp-gray-400)" }}>
              Didn't get it? Check your spam folder.
            </p>
          </div>
        ) : (
          /* ── Login form ── */
          <>
            <h1
              className="text-2xl font-extrabold mb-1"
              style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
            >
              Welcome back
            </h1>
            <p className="text-sm mb-7" style={{ color: "var(--akp-gray-600)" }}>
              Enter your email to receive a sign-in link.
            </p>

            {errorMsg && (
              <div
                className="rounded-xl p-3.5 mb-5 text-sm"
                style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b" }}
              >
                {errorMsg}
              </div>
            )}

            <form action={action} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: "var(--akp-gray-600)" }}
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                  className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{
                    borderColor: "var(--akp-gray-200)",
                    color: "var(--akp-gray-800)",
                    background: "var(--akp-off-white)",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={pending}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "var(--akp-navy)",
                  color: "var(--akp-gold)",
                  boxShadow: "0 4px 16px rgba(10,34,64,0.2)",
                }}
              >
                {pending ? "Sending…" : "Send magic link"}
              </button>
            </form>

            <p className="mt-6 text-xs text-center" style={{ color: "var(--akp-gray-400)" }}>
              Access is limited to AKPsi members.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
