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

/* Subtle semantic colors for type badges */
const TYPE_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  internship:  { bg: "rgba(201,168,76,0.10)", color: "#78550a", dot: "#c9a84c" },
  "full-time": { bg: "rgba(10,34,64,0.07)",   color: "#0a2240", dot: "#0a2240" },
  club:        { bg: "rgba(59,130,246,0.08)",  color: "#1d4ed8", dot: "#3b82f6" },
  research:    { bg: "rgba(16,185,129,0.08)",  color: "#065f46", dot: "#10b981" },
  other:       { bg: "var(--s-1)",             color: "var(--t-secondary)", dot: "var(--t-muted)" },
};

const ALL_TYPES = ["all", "internship", "full-time", "club", "research", "other"];

function formatDeadline(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isUrgent(iso: string): boolean {
  const diff = new Date(iso + "T00:00:00").getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
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
    if (state.success) setTimeout(onClose, 600);
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
      style={{ background: "rgba(20,18,16,0.4)", backdropFilter: "blur(6px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-xl)",
          transformOrigin: "center",
        }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--b-subtle)" }}
        >
          <h2
            className="text-base font-bold"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            Post an Opportunity
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--s-1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {state.success ? (
            <div className="flex flex-col items-center gap-3 py-10" style={{ color: "var(--t-primary)" }}>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-lg"
                style={{ background: "rgba(16,185,129,0.12)", color: "#059669" }}
              >
                ✓
              </div>
              <p className="font-semibold">Posted successfully!</p>
            </div>
          ) : (
            <form action={action} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="input-label">Title *</label>
                <input name="title" required placeholder="e.g. Summer 2026 Analyst" className="input" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="input-label">Organization *</label>
                <input name="organization" required placeholder="e.g. Goldman Sachs" className="input" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="input-label">Type *</label>
                <select name="type" defaultValue="internship" className="input">
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="input-label">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Brief description, requirements, compensation…"
                  className="input resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="input-label">Deadline</label>
                  <input name="deadline" type="date" className="input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="input-label">Link</label>
                  <input name="link" type="url" placeholder="https://…" className="input" />
                </div>
              </div>

              {state.error && (
                <p className="text-sm" style={{ color: "#dc2626" }}>{state.error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="btn btn-ghost">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="btn btn-primary"
                  style={{ opacity: pending ? 0.6 : 1 }}
                >
                  {pending ? "Posting…" : "Post"}
                </button>
              </div>
            </form>
          )}
        </div>
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
  const typeStyle = TYPE_STYLES[opp.type] ?? TYPE_STYLES.other;
  const isOwner = currentUserId === opp.posted_by;
  const urgent = opp.deadline ? isUrgent(opp.deadline) : false;

  return (
    <div className="card card-interactive p-5 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium mb-0.5 truncate" style={{ color: "var(--t-muted)" }}>
            {opp.organization}
          </p>
          <h3
            className="text-[15px] font-bold leading-snug"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            {opp.title}
          </h3>
        </div>
        {/* Type badge */}
        <span
          className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: typeStyle.bg, color: typeStyle.color }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: typeStyle.dot }}
          />
          {TYPE_LABELS[opp.type] ?? opp.type}
        </span>
      </div>

      {/* Description */}
      {opp.description && (
        <p className="text-[13px] leading-relaxed line-clamp-3" style={{ color: "var(--t-secondary)" }}>
          {opp.description}
        </p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--t-muted)" }}>
        {opp.deadline && (
          <span
            className="inline-flex items-center gap-1"
            style={{ color: urgent ? "#dc2626" : "var(--t-muted)", fontWeight: urgent ? 600 : 400 }}
          >
            {urgent && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            )}
            Due {formatDeadline(opp.deadline)}
          </span>
        )}
        <span>by {opp.posted_by_name ?? "Member"}</span>
        <span>{timeAgo(opp.created_at)}</span>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-1" style={{ borderTop: "1px solid var(--b-subtle)" }}>
        {opp.link && (
          <a
            href={opp.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm flex-1 text-center"
          >
            Apply
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
        {(isOwner || isAdmin) && (
          <form action={async () => {
            const { deleteOpportunity } = await import("@/lib/actions/opportunities");
            await deleteOpportunity(opp.id);
          }}>
            <button
              type="submit"
              className="btn btn-ghost btn-sm"
              style={{ color: "#dc2626", borderColor: "rgba(220,38,38,0.2)" }}
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
      {/* ── Controls ── */}
      <div className="flex flex-col gap-4 mb-8">
        {/* Top row: search + post */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: "var(--t-muted)" }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search opportunities…"
              className="input pl-9"
            />
          </div>
          <button onClick={() => setShowModal(true)} className="btn btn-primary shrink-0">
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Post
          </button>
        </div>

        {/* Type filter row */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`pill ${activeType === t ? "pill-active" : ""}`}
            >
              {t === "all" ? "All types" : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl"
          style={{ background: "var(--s-0)", border: "1px dashed var(--b-default)" }}
        >
          <p className="text-base font-semibold mb-1" style={{ color: "var(--t-primary)" }}>
            {initialOpportunities.length === 0 ? "No opportunities yet" : "No matches"}
          </p>
          <p className="text-sm" style={{ color: "var(--t-muted)" }}>
            {initialOpportunities.length === 0
              ? "Be the first to post one."
              : "Try a different filter or search term."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((opp) => (
            <OpportunityCard key={opp.id} opp={opp} currentUserId={currentUserId} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {showModal && <PostModal onClose={() => setShowModal(false)} />}
    </>
  );
}
