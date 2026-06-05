import Link from "next/link";

/**
 * Shown when a user completes Google sign-in but their email
 * is not in the members allowlist. They are signed out before
 * arriving here so no session exists at this point.
 */
export default function NotAuthorizedPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--akp-navy)" }}
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(201,168,76,0.15) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div
        className="relative z-10 w-full max-w-sm rounded-3xl p-10 text-center"
        style={{
          background: "var(--akp-white)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        }}
      >
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(201,168,76,0.12)" }}
        >
          <svg
            width="24"
            height="24"
            fill="none"
            stroke="var(--akp-navy)"
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
          className="text-xl font-extrabold mb-2"
          style={{
            color: "var(--akp-navy)",
            fontFamily: "var(--font-display)",
          }}
        >
          Not authorised
        </h1>
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: "var(--akp-gray-600)" }}
        >
          Your Google account isn't on the member access list. If you believe
          this is a mistake, contact a chapter admin to be added.
        </p>

        <Link
          href="/login"
          className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
          style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
