import Link from "next/link";
import { TRACKS, TRACK_ICONS } from "./tracks";
import TrackCard from "./TrackCard";

export default function RecruitmentPage() {
  return (
    <main className="flex-1">
      {/* ── Hero ── */}
      <div className="navy-texture relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--akp-gold) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-8" style={{ background: "var(--akp-gold)" }} />
            <span
              className="text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: "var(--akp-gold)" }}
            >
              Alpha Kappa Psi · AKPD
            </span>
          </div>

          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] text-white mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Recruiting
            <br />
            <span style={{ color: "var(--akp-gold)" }}>Guides.</span>
          </h1>
          <p className="text-blue-200 text-lg max-w-lg leading-relaxed">
            Track-by-track breakdowns of timelines, interview formats, and
            what it actually takes to land the role — written by members
            who've been through it.
          </p>
        </div>
        <div className="h-[3px]" style={{ background: "var(--akp-gold)" }} />
      </div>

      {/* ── Track grid ── */}
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TRACKS.map((track) => {
            const iconPath = TRACK_ICONS[track.id];
            const hasContent =
              track.timeline ||
              track.tips?.length ||
              track.keyPrograms?.length;

            return (
              <TrackCard
                key={track.id}
                track={track}
                iconPath={iconPath}
                hasContent={!!hasContent}
              />
            );
          })}
        </div>

        <p
          className="text-center text-sm mt-12"
          style={{ color: "var(--akp-gray-400)" }}
        >
          Content is added as members share their experiences.{" "}
          <Link
            href="/seniors"
            className="font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
            style={{ color: "var(--akp-navy)" }}
          >
            See senior profiles
          </Link>{" "}
          for real timelines.
        </p>
      </div>
    </main>
  );
}
