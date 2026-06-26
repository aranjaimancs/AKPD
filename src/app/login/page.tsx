import { Suspense } from "react";
import Image from "next/image";
import ErrorBanner from "./ErrorBanner";
import LoginPanel from "./LoginPanel";

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--s-page)" }}
    >
      {/* ── Left panel — brand ───────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 relative overflow-hidden navy-texture"
      >
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute -bottom-40 -left-20 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, var(--akp-gold) 0%, transparent 60%)" }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <Image src="/aklogo.png" alt="AKΨ UNC" width={36} height={36} className="rounded-full" />
          <div>
            <p
              className="text-[13px] font-extrabold text-white leading-none tracking-[0.06em] uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Alpha Kappa Psi
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(201,168,76,0.7)" }}>
              Alpha Tau Chapter
            </p>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <p
            className="text-[11px] font-bold tracking-[0.15em] uppercase mb-6"
            style={{ color: "var(--akp-gold)", opacity: 0.8 }}
          >
            Member Portal
          </p>
          <h1
            className="text-5xl font-extrabold text-white leading-[1.08] mb-5"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
          >
            All your professional<br />development needs,<br /><em style={{ fontStyle: "normal", color: "var(--akp-gold)" }}>in one place.</em>
          </h1>
          <p className="text-[15px] leading-relaxed max-w-xs" style={{ color: "rgba(200,215,235,0.75)" }}>
            Senior profiles, recruiting resources, the alumni network, and live opportunities — built by members, for members.
          </p>
        </div>

        {/* Bottom stat strip */}
        <div className="relative z-10 flex gap-10 pt-8" style={{ borderTop: "1px solid rgba(201,168,76,0.15)" }}>
          {[
            { value: "100+", label: "Alumni" },
            { value: "4", label: "Career tracks" },
            { value: "∞", label: "Connections" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p
                className="text-2xl font-extrabold text-white"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
              >
                {value}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(201,168,76,0.6)", letterSpacing: "0.06em" }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — sign in ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 mb-12 lg:hidden">
          <Image src="/aklogo.png" alt="AKΨ UNC" width={36} height={36} className="rounded-full" />
          <div>
            <p
              className="text-[13px] font-extrabold leading-none tracking-[0.06em] uppercase"
              style={{ fontFamily: "var(--font-display)", color: "var(--t-primary)" }}
            >
              Alpha Kappa Psi
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--t-muted)" }}>
              AKPD · Member Portal
            </p>
          </div>
        </div>

        {/* Sign in card */}
        <div className="w-full max-w-[360px]">
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.015em" }}
          >
            Sign in to AKPD
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--t-secondary)" }}>
            Use your chapter email or Google account to access the portal.
          </p>

          {/* OAuth error banner (for Google callback errors) */}
          <Suspense>
            <ErrorBanner />
          </Suspense>

          <LoginPanel />

          <p className="mt-5 text-xs text-center" style={{ color: "var(--t-muted)" }}>
            Access is limited to authorized AKPsi members.
          </p>
        </div>

        {/* Bottom attribution */}
        <p className="absolute bottom-6 text-[11px]" style={{ color: "var(--t-faint)" }}>
          Alpha Kappa Psi · Alpha Tau Chapter
        </p>
      </div>
    </div>
  );
}
