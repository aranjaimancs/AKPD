import { Suspense } from "react";
import Link from "next/link";
import ErrorBanner from "./ErrorBanner";

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--akp-navy)" }}
    >
      {/* Background dot texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(201,168,76,0.15) 1px, transparent 1px)",
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
        {/* Logo */}
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
              style={{
                color: "var(--akp-navy)",
                fontFamily: "var(--font-display)",
              }}
            >
              Alpha Kappa Psi
            </p>
            <p className="text-xs" style={{ color: "var(--akp-gray-400)" }}>
              AKPD · Member Portal
            </p>
          </div>
        </div>

        <h1
          className="text-2xl font-extrabold mb-1"
          style={{
            color: "var(--akp-navy)",
            fontFamily: "var(--font-display)",
          }}
        >
          Welcome back
        </h1>
        <p className="text-sm mb-7" style={{ color: "var(--akp-gray-600)" }}>
          Sign in with your Google account to access the portal.
        </p>

        {/* Error banner — reads ?error= from the URL */}
        <Suspense>
          <ErrorBanner />
        </Suspense>

        {/* Google sign-in button */}
        <Link
          href="/auth/google"
          className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:opacity-90"
          style={{
            background: "var(--akp-navy)",
            color: "var(--akp-gold)",
            boxShadow: "0 4px 16px rgba(10,34,64,0.2)",
          }}
        >
          {/* Google "G" logo */}
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8H6.1C9.5 37.5 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.4 5.6l6.2 5.2C41.1 35.7 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z"
            />
          </svg>
          Sign in with Google
        </Link>

        <p
          className="mt-6 text-xs text-center"
          style={{ color: "var(--akp-gray-400)" }}
        >
          Access is limited to authorised AKPsi members.
        </p>
      </div>
    </div>
  );
}
