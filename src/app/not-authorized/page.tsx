import Link from "next/link";

/**
 * Shown when a user completes Google sign-in but their email
 * is not in the members allowlist. They are signed out before
 * arriving here so no session exists at this point.
 */
export default function NotAuthorizedPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--s-page)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(10,34,64,0.04) 0%, transparent 100%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm text-center">
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: "var(--s-1)",
            border: "1px solid var(--b-default)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <svg
            width="20"
            height="20"
            fill="none"
            stroke="var(--t-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        <h1
          className="text-xl font-bold mb-2"
          style={{
            color: "var(--t-primary)",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.01em",
          }}
        >
          Not authorized
        </h1>
        <p
          className="text-[14px] leading-relaxed mb-8"
          style={{ color: "var(--t-secondary)" }}
        >
          Your Google account isn&apos;t on the member access list. If you
          believe this is a mistake, contact a chapter admin to be added.
        </p>

        <Link href="/login" className="btn btn-primary">
          Back to sign in
        </Link>
      </div>

      {/* Footer */}
      <p className="absolute bottom-6 text-[11px]" style={{ color: "var(--t-faint)" }}>
        Alpha Kappa Psi · Delta Chapter
      </p>
    </div>
  );
}
