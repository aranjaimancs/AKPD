"use client";

import { useState } from "react";
import { getSignedDownloadUrl } from "@/lib/actions/recruitment";

type MimeInfo = { label: string; bgColor: string; textColor: string };

function getMimeInfo(mime: string | null): MimeInfo {
  if (!mime) return { label: "File", bgColor: "rgba(10,34,64,0.06)", textColor: "var(--akp-gray-600)" };
  if (mime.includes("pdf"))
    return { label: "PDF", bgColor: "rgba(220,38,38,0.08)", textColor: "#dc2626" };
  if (mime.includes("word") || mime.includes("document"))
    return { label: "DOC", bgColor: "rgba(37,99,235,0.08)", textColor: "#2563eb" };
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return { label: "PPT", bgColor: "rgba(234,88,12,0.08)", textColor: "#ea580c" };
  if (mime.includes("sheet") || mime.includes("excel"))
    return { label: "XLS", bgColor: "rgba(22,163,74,0.08)", textColor: "#16a34a" };
  return { label: "File", bgColor: "rgba(10,34,64,0.06)", textColor: "var(--akp-gray-600)" };
}

export default function DownloadButton({
  filePath,
  title,
  mime,
}: {
  filePath: string;
  title: string;
  mime?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { label, bgColor, textColor } = getMimeInfo(mime ?? null);

  async function handleClick() {
    setLoading(true);
    setErr(null);

    const result = await getSignedDownloadUrl(filePath);

    setLoading(false);

    if ("error" in result) {
      if (result.error === "not_authorized") {
        setErr("Sign in to access this file.");
      } else {
        setErr("Could not load file — try again.");
      }
      return;
    }

    // Open in a new tab so PDFs/slides render in the browser inline.
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 hover:opacity-80 active:scale-95"
        style={{ background: bgColor, color: textColor }}
        title={`Open ${title}`}
      >
        {loading ? (
          <>
            <span
              className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin shrink-0"
              style={{ borderColor: textColor, borderTopColor: "transparent" }}
            />
            Loading…
          </>
        ) : (
          <>
            <FileIcon mime={mime ?? null} color={textColor} />
            {label}
          </>
        )}
      </button>
      {err && (
        <p className="text-xs" style={{ color: "#dc2626" }}>
          {err}
        </p>
      )}
    </div>
  );
}

// ── Inline SVG file icon ──────────────────────────────────────────────────────

function FileIcon({ mime, color }: { mime: string | null; color: string }) {
  if (!mime) return <GenericFileIcon color={color} />;
  if (mime.includes("pdf")) return <PdfIcon color={color} />;
  if (mime.includes("word") || mime.includes("document"))
    return <DocIcon color={color} />;
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return <SlidesIcon color={color} />;
  if (mime.includes("sheet") || mime.includes("excel"))
    return <SheetIcon color={color} />;
  return <GenericFileIcon color={color} />;
}

const iconProps = {
  width: "14",
  height: "14",
  fill: "none",
  strokeWidth: "2",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  className: "shrink-0",
};

function PdfIcon({ color }: { color: string }) {
  return (
    <svg {...iconProps} stroke={color}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="9" y2="17" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="15" y1="14" x2="15" y2="17" />
    </svg>
  );
}

function DocIcon({ color }: { color: string }) {
  return (
    <svg {...iconProps} stroke={color}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function SlidesIcon({ color }: { color: string }) {
  return (
    <svg {...iconProps} stroke={color}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function SheetIcon({ color }: { color: string }) {
  return (
    <svg {...iconProps} stroke={color}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="12" y1="11" x2="12" y2="13" />
    </svg>
  );
}

function GenericFileIcon({ color }: { color: string }) {
  return (
    <svg {...iconProps} stroke={color}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
