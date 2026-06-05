"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { postOpportunity } from "@/lib/actions/opportunities";

export type Opportunity = {
  id: string;
  title: string;
  organization: string;
  type: string;
  description: string | null;
  deadline: string | null;
  link: string | null;
  posted_by: string | null;
  posted_by_name: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  internship: "Internship",
  "full-time": "Full-Time",
  club: "Club",
  research: "Research",
  other: "Other",
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  internship: { bg: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" },
  "full-time": { bg: "rgba(10,34,64,0.08)", color: "var(--akp-navy)" },
  club: { bg: "rgba(59,130,246,0.1)", color: "#2563eb" },
  research: { bg: "rgba(16,185,129,0.1)", color: "#059669" },
  other: { bg: "var(--akp-gray-100)", color: "var(--akp-gray-600)" },
};

const ALL_TYPES = ["all", "internship", "full-time", "club", "research", "other"];

function formatDeadline(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── Post Modal ── */
function PostModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(postOpportunity, {});
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.success) {
      setTimeout(onClose, 600);
    }
  }, [state.success, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,34,64,0.55)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5"
        style={{
          background: "var(--akp-white)",
          boxShadow: "0 8px 48px rgba(10,34,64,0.2)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="text-xl font-extrabold"
            style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
          >
            Post an Opportunity
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
            style={{ color: "var(--akp-gray-400)" }}
          >
            ✕
          </button>
        </div>

        {state.success ? (
          <div
            className="flex flex-col items-center gap-3 py-8"
            style={{ color: "var(--akp-navy)" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
              style={{ background: "rgba(201,168,76,0.15)" }}
            >
              ✓
            </div>
            <p className="font-semibold">Posted successfully!</p>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--akp-gray-600)" }}>
                Title *
              </label>
              <input
                name="title"
                required
                placeholder="e.g. Summer 2026 Analyst"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: "var(--akp-off-white)",
                  border: "1px solid var(--akp-gray-200)",
                  color: "var(--akp-gray-800)",
                }}
              />
            </div>

            {/* Organization */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--akp-gray-600)" }}>
                Organization *
              </label>
              <input
                name="organization"
                required
                placeholder="e.g. Goldman Sachs"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: "var(--akp-off-white)",
                  border: "1px solid var(--akp-gray-200)",
                  color: "var(--akp-gray-800)",
                }}
              />
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--akp-gray-600)" }}>
                Type *
              </label>
              <select
                name="type"
                defaultValue="internship"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--akp-off-white)",
                  border: "1px solid var(--akp-gray-200)",
                  color: "var(--akp-gray-800)",
                }}
              >
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--akp-gray-600)" }}>
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="Brief description, requirements, compensation..."
                className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none"
                style={{
                  background: "var(--akp-off-white)",
                  border: "1px solid var(--akp-gray-200)",
                  color: "var(--akp-gray-800)",
                }}
              />
            </div>

            {/* Deadline + Link row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--akp-gray-600)" }}>
                  Deadline
                </label>
                <input
                  name="deadline"
                  type="date"
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
                  style={{
                    background: "var(--akp-off-white)",
                    border: "1px solid var(--akp-gray-200)",
                    color: "var(--akp-gray-800)",
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--akp-gray-600)" }}>
                  Link
                </label>
                <input
                  name="link"
                  type="url"
                  placeholder="https://..."
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
                  style={{
                    background: "var(--akp-off-white)",
                    border: "1px solid var(--akp-gray-200)",
                    color: "var(--akp-gray-800)",
                  }}
                />
              </div>
            </div>

            {state.error && (
              <p className="text-sm font-medium" style={{ color: "#dc2626" }}>
                {state.error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{
                  background: "var(--akp-gray-100)",
                  color: "var(--akp-gray-600)",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-5 py-2 rounded-xl text-sm font-bold transition-opacity disabled:opacity-50"
                style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
              >
                {pending ? "Posting…" : "Post"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Opportunity Card ── */
function OpportunityCard({
  opp,
  currentUserId,
  isAdmin,
}: {
  opp: Opportunity;
  currentUserId?: string;
  isAdmin: boolean;
}) {
  const typeStyle = TYPE_COLORS[opp.type] ?? TYPE_COLORS.other;
  const isOwner = currentUserId === opp.posted_by;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "var(--akp-white)",
        border: "1px solid var(--akp-gray-200)",
        boxShadow: "0 1px 4px rgba(10,34,64,0.04), 0 4px 16px rgba(10,34,64,0.06)",
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold mb-0.5 truncate" style={{ color: "var(--akp-gray-400)" }}>
            {opp.organization}
          </p>
          <h3
            className="text-base font-extrabold leading-tight"
            style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
          >
            {opp.title}
          </h3>
        </div>
        <span
          className="shrink-0 text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full"
          style={{ background: typeStyle.bg, color: typeStyle.color }}
        >
          {TYPE_LABELS[opp.type] ?? opp.type}
        </span>
      </div>

      {/* Description */}
      {opp.description && (
        <p
          className="text-sm leading-relaxed line-clamp-3"
          style={{ color: "var(--akp-gray-600)" }}
        >
          {opp.description}
        </p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--akp-gray-400)" }}>
        {opp.deadline && (
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Due {formatDeadline(opp.deadline)}
          </span>
        )}
        <span>Posted by {opp.posted_by_name ?? "Member"}</span>
        <span>{timeAgo(opp.created_at)}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 pt-1">
        {opp.link && (
          <a
            href={opp.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
            style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
          >
            View →
          </a>
        )}
        {(isOwner || isAdmin) && (
          <form action={async () => {
            const { deleteOpportunity } = await import("@/lib/actions/opportunities");
            await deleteOpportunity(opp.id);
          }}>
            <button
              type="submit"
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-red-50"
              style={{ color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}
            >
              Remove
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Main Client Component ── */
export default function OpportunitiesClient({
  initialOpportunities,
  currentUserId,
  isAdmin = false,
}: {
  initialOpportunities: Opportunity[];
  currentUserId?: string;
  isAdmin?: boolean;
}) {
  const [activeType, setActiveType] = useState("all");
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filtered = initialOpportunities.filter((o) => {
    const matchType = activeType === "all" || o.type === activeType;
    const q = query.toLowerCase();
    const matchQuery =
      !q ||
      o.title.toLowerCase().includes(q) ||
      o.organization.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q);
    return matchType && matchQuery;
  });

  return (
    <>
      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        {/* Type pills */}
        <div className="flex flex-wrap gap-2">
          {ALL_TYPES.map((t) => {
            const active = activeType === t;
            return (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all"
                style={{
                  background: active ? "var(--akp-navy)" : "var(--akp-gray-100)",
                  color: active ? "var(--akp-gold)" : "var(--akp-gray-600)",
                }}
              >
                {t === "all" ? "All" : TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>

        {/* Search + Post */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="flex-1 sm:w-52 rounded-xl px-3.5 py-2 text-sm outline-none"
            style={{
              background: "var(--akp-white)",
              border: "1px solid var(--akp-gray-200)",
              color: "var(--akp-gray-800)",
            }}
          />
          <button
            onClick={() => setShowModal(true)}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
            style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
          >
            + Post
          </button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl"
          style={{ background: "var(--akp-white)", border: "1px solid var(--akp-gray-200)" }}
        >
          <p className="text-4xl mb-4">📋</p>
          <p className="font-bold text-lg mb-1" style={{ color: "var(--akp-navy)" }}>
            {initialOpportunities.length === 0 ? "No opportunities yet" : "No matches"}
          </p>
          <p className="text-sm" style={{ color: "var(--akp-gray-400)" }}>
            {initialOpportunities.length === 0
              ? "Be the first to post one."
              : "Try a different filter or search term."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((opp) => (
            <OpportunityCard key={opp.id} opp={opp} currentUserId={currentUserId} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && <PostModal onClose={() => setShowModal(false)} />}
    </>
  );
}
