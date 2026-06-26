"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ── Tour stop data ────────────────────────────────────────────────────────────

const STOPS = [
  {
    href: "/people",
    label: "People",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
    title: "Your brothers, on the map",
    description:
      "See where everyone is in the world — filter by industry, interests, or pledge class. Click a pin to learn more.",
  },
  {
    href: "/seniors",
    label: "Seniors",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
    title: "Profiles from those who came before",
    description:
      "Detailed career profiles from graduating seniors — internships, timelines, and honest advice straight from brothers.",
  },
  {
    href: "/opportunities",
    label: "Opportunities",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
    title: "Find your next role",
    description:
      "Internship openings, full-time roles, and club positions shared by brothers across the network.",
  },
  {
    href: "/recruitment",
    label: "Recruitment",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="13" y2="13" />
      </svg>
    ),
    title: "Career guides by field",
    description:
      "Finance, consulting, tech, and more — curated resources, case guides, and interview prep organized by track.",
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function WelcomeTour({ show }: { show: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [currentStop, setCurrentStop] = useState(0);
  const [exiting, setExiting] = useState(false);

  // Delay mount so the page animation plays first
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [show]);

  if (!show && !visible) return null;

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      // Remove ?welcome=1 without a full reload
      const url = new URL(window.location.href);
      url.searchParams.delete("welcome");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    }, 300);
  };

  const next = () => {
    if (currentStop < STOPS.length - 1) {
      setCurrentStop((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const stop = STOPS[currentStop];
  const isLast = currentStop === STOPS.length - 1;

  return (
    <>
      {/* Subtle backdrop — doesn't block interaction */}
      <div
        className="fixed inset-0 z-[80] pointer-events-none"
        style={{ background: "rgba(10,34,64,0.12)" }}
      />

      {/* Tour card */}
      <div
        className="fixed bottom-6 right-6 z-[90] w-[340px]"
        style={{
          transform: visible && !exiting ? "translateY(0)" : "translateY(24px)",
          opacity: visible && !exiting ? 1 : 0,
          transition: "transform 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease",
        }}
      >
        <div
          className="card overflow-hidden"
          style={{ boxShadow: "var(--shadow-xl)" }}
        >
          {/* Gold top stripe */}
          <div
            className="h-1 w-full"
            style={{ background: "linear-gradient(90deg, var(--akp-navy) 0%, var(--akp-gold) 100%)" }}
          />

          <div className="p-5">
            {/* Header row */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Icon badge */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
                >
                  {stop.icon}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-0.5" style={{ color: "var(--akp-gold)" }}>
                    {stop.label}
                  </p>
                  <p className="text-[14px] font-bold leading-snug" style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}>
                    {stop.title}
                  </p>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={dismiss}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md -mt-0.5 -mr-0.5 transition-colors"
                style={{ color: "var(--t-faint)" }}
                title="Close tour"
                aria-label="Close tour"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Description */}
            <p className="text-[13px] leading-relaxed mb-5" style={{ color: "var(--t-secondary)" }}>
              {stop.description}
            </p>

            {/* Progress dots + actions */}
            <div className="flex items-center justify-between">
              {/* Dots */}
              <div className="flex items-center gap-1.5">
                {STOPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStop(i)}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: i === currentStop ? "18px" : "6px",
                      height: "6px",
                      background: i === currentStop
                        ? "var(--akp-navy)"
                        : i < currentStop
                          ? "var(--akp-gold)"
                          : "var(--b-strong)",
                    }}
                    aria-label={`Go to stop ${i + 1}`}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link
                  href={stop.href}
                  className="text-[12px] font-medium"
                  style={{ color: "var(--t-muted)" }}
                  onClick={dismiss}
                >
                  Explore →
                </Link>
                <button
                  onClick={next}
                  className="btn btn-primary"
                  style={{ fontSize: "12px", padding: "7px 16px" }}
                >
                  {isLast ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
