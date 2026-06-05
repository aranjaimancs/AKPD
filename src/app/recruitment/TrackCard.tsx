"use client";

import type { Track } from "./tracks";

export default function TrackCard({
  track,
  iconPath,
  hasContent,
}: {
  track: Track;
  iconPath?: string;
  hasContent: boolean;
}) {
  return (
    <div
      className="group relative rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "var(--akp-white)",
        border: "1px solid var(--akp-gray-200)",
        boxShadow:
          "0 1px 4px rgba(10,34,64,0.04), 0 4px 16px rgba(10,34,64,0.06)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 4px 24px rgba(10,34,64,0.1), 0 0 0 1px rgba(201,168,76,0.4)";
        (e.currentTarget as HTMLElement).style.borderColor =
          "rgba(201,168,76,0.4)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 1px 4px rgba(10,34,64,0.04), 0 4px 16px rgba(10,34,64,0.06)";
        (e.currentTarget as HTMLElement).style.borderColor =
          "var(--akp-gray-200)";
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "var(--akp-navy)" }}
      >
        {iconPath ? (
          <svg
            width="18"
            height="18"
            fill="none"
            stroke="var(--akp-gold)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d={iconPath} />
          </svg>
        ) : (
          <span
            className="text-xs font-extrabold"
            style={{ color: "var(--akp-gold)" }}
          >
            {track.shortName.slice(0, 2)}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h2
            className="text-base font-extrabold leading-tight"
            style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
          >
            {track.name}
          </h2>
          <span
            className="shrink-0 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full"
            style={{
              background: hasContent
                ? "rgba(201,168,76,0.12)"
                : "var(--akp-gray-100)",
              color: hasContent ? "var(--akp-gold)" : "var(--akp-gray-400)",
            }}
          >
            {hasContent ? "Available" : "Coming soon"}
          </span>
        </div>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--akp-gray-600)" }}
        >
          {track.description}
        </p>
      </div>

      {/* Details preview */}
      {(track.timeline || track.interviewFormat) && (
        <div
          className="rounded-xl p-3.5 space-y-1.5 text-xs"
          style={{
            background: "var(--akp-off-white)",
            border: "1px solid var(--akp-gray-200)",
          }}
        >
          {track.timeline && (
            <div className="flex gap-2">
              <span style={{ color: "var(--akp-gray-400)" }}>Timeline</span>
              <span className="font-semibold" style={{ color: "var(--akp-gray-800)" }}>
                {track.timeline}
              </span>
            </div>
          )}
          {track.interviewFormat && (
            <div className="flex gap-2">
              <span style={{ color: "var(--akp-gray-400)" }}>Interviews</span>
              <span className="font-semibold" style={{ color: "var(--akp-gray-800)" }}>
                {track.interviewFormat}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Programs */}
      {track.keyPrograms && track.keyPrograms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {track.keyPrograms.map((p) => (
            <span
              key={p}
              className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
              style={{
                background: "var(--akp-navy)",
                color: "var(--akp-gold-light)",
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Tips count */}
      {track.tips && track.tips.length > 0 && (
        <p className="text-xs font-medium" style={{ color: "var(--akp-gray-400)" }}>
          {track.tips.length} tip{track.tips.length !== 1 ? "s" : ""} from members
        </p>
      )}
    </div>
  );
}
