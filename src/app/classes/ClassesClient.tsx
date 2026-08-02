"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { postClassReview, removeClassReview } from "@/lib/actions/classes";
import { FOCUS_AREAS } from "./curriculum";

/* ── Types ── */
export type ClassReview = {
  id: string;
  course_code: string;
  course_name: string;
  department: string;
  professor: string;
  semester_taken: string;
  overall_rating: number;
  difficulty_rating: number;
  workload: string;
  would_recommend: boolean;
  grade_received: string | null;
  focus_areas: string[];
  review_text: string;
  posted_by: string;
  posted_by_name: string;
  created_at: string;
};

/* ── Constants ── */
const WORKLOAD_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  light:  { bg: "rgba(16,185,129,0.10)",  color: "#059669",          label: "Light" },
  medium: { bg: "rgba(201,168,76,0.12)",  color: "var(--akp-gold)",  label: "Medium" },
  heavy:  { bg: "rgba(220,38,38,0.10)",   color: "#dc2626",          label: "Heavy" },
};

const GRADES = ["A+","A","A-","B+","B","B-","C+","C","C-","D","F","P","NR"];

function getSemesters(): string[] {
  const result: string[] = [];
  const now = new Date();
  let year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  // Determine starting term: 0-3=Spring, 4-6=Summer, 7-11=Fall
  const termOrder = ["Spring", "Summer", "Fall"];
  let termIdx = month >= 7 ? 2 : month >= 4 ? 1 : 0;
  for (let i = 0; i < 8; i++) {
    result.push(`${termOrder[termIdx]} ${year}`);
    termIdx--;
    if (termIdx < 0) { termIdx = 2; year--; }
  }
  return result;
}
const SEMESTERS = getSemesters();

/* ── Helpers ── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── StarDisplay (read-only) ── */
function StarDisplay({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1,2,3,4,5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24"
          fill={n <= value ? "var(--akp-gold)" : "var(--b-default)"}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </span>
  );
}

/* ── StarPicker (interactive, controlled) ── */
function StarPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-0.5 transition-transform hover:scale-110 active:scale-95"
        >
          <svg width="26" height="26" viewBox="0 0 24 24"
            fill={(hover || value) >= n ? "var(--akp-gold)" : "var(--b-default)"}
            style={{ transition: "fill 0.1s" }}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </button>
      ))}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

/* ── ReviewCard ── */
function ReviewCard({
  review,
  currentUserId,
  isAdmin,
}: {
  review: ClassReview;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const wl = WORKLOAD_STYLES[review.workload] ?? WORKLOAD_STYLES.medium;
  const canRemove = isAdmin || currentUserId === review.posted_by;
  const diffLabel =
    review.difficulty_rating <= 2 ? "Easy"
    : review.difficulty_rating === 3 ? "Moderate"
    : "Hard";

  return (
    <div className="card card-interactive p-5 flex flex-col gap-3 animate-fade-up">
      {/* Course header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span
            className="text-[17px] font-black tracking-tight leading-none"
            style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
          >
            {review.course_code}
          </span>
          <p className="text-[13px] font-semibold mt-0.5 leading-snug" style={{ color: "var(--t-primary)" }}>
            {review.course_name}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>
            {review.professor}
          </p>
        </div>
        <span
          className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
          style={{ background: wl.bg, color: wl.color }}
        >
          {wl.label}
        </span>
      </div>

      {/* Ratings row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <StarDisplay value={review.overall_rating} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--t-secondary)" }}>
            Overall
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <StarDisplay value={review.difficulty_rating} size={11} />
          <span className="text-[11px]" style={{ color: "var(--t-muted)" }}>
            {diffLabel}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: review.would_recommend ? "#059669" : "var(--t-muted)" }}
        >
          {review.would_recommend ? (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Recommend
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Not recommended
            </>
          )}
        </span>
      </div>

      {/* Focus area badges */}
      {review.focus_areas?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {review.focus_areas.map((code) => (
            <span key={code} className="badge badge-navy" style={{ fontSize: 10 }}>
              {code}
            </span>
          ))}
        </div>
      )}

      {/* Review text */}
      <p className="text-[13px] leading-relaxed line-clamp-3" style={{ color: "var(--t-secondary)" }}>
        {review.review_text}
      </p>

      {/* Footer */}
      <div
        className="flex items-center justify-between gap-2 pt-2 text-[11px] flex-wrap"
        style={{ borderTop: "1px solid var(--b-subtle)", color: "var(--t-muted)" }}
      >
        <span className="flex flex-wrap gap-x-2">
          <span>{review.semester_taken}</span>
          {review.grade_received && <span>· {review.grade_received}</span>}
          <span>· {review.posted_by_name}</span>
          <span>· {timeAgo(review.created_at)}</span>
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={async () => {
              const result = await removeClassReview(review.id);
              if (result.error) alert(result.error);
            }}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: "3px 10px", color: "#dc2626", borderColor: "rgba(220,38,38,0.2)" }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

/* ── PostModal ── */
function PostModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(postClassReview, {});
  const overlayRef = useRef<HTMLDivElement>(null);

  // Controlled state for interactive form fields
  const [overallRating,    setOverallRating]    = useState(0);
  const [difficultyRating, setDifficultyRating] = useState(0);
  const [workload,         setWorkload]         = useState<"light"|"medium"|"heavy"|"">("");
  const [wouldRecommend,   setWouldRecommend]   = useState<boolean|null>(null);
  const [focusAreas,       setFocusAreas]       = useState<string[]>([]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Auto-close after success
  useEffect(() => {
    if (state.success) setTimeout(onClose, 800);
  }, [state.success, onClose]);

  function toggleFocusArea(code: string) {
    setFocusAreas((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  const workloadOptions = [
    { value: "light",  label: "Light" },
    { value: "medium", label: "Medium" },
    { value: "heavy",  label: "Heavy" },
  ] as const;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,18,16,0.45)", backdropFilter: "blur(6px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden animate-scale-in flex flex-col"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-xl)",
          maxHeight: "90vh",
        }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--b-subtle)" }}
        >
          <h2
            className="text-base font-bold"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            Write a Review
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--s-1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {state.success ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center px-6">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: "rgba(16,185,129,0.12)", color: "#059669" }}
              >
                ✓
              </div>
              <p className="font-semibold" style={{ color: "var(--t-primary)" }}>Review posted!</p>
            </div>
          ) : (
            <form action={action} className="p-6 flex flex-col gap-5">
              {/* Course Code + Name */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="input-label">Course Code *</label>
                  <input
                    name="course_code"
                    required
                    placeholder="e.g. COMP 550"
                    className="input"
                    style={{ textTransform: "uppercase" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="input-label">Course Name *</label>
                  <input
                    name="course_name"
                    required
                    placeholder="e.g. Intro to Algorithms"
                    className="input"
                  />
                </div>
              </div>

              {/* Professor + Semester */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="input-label">Professor *</label>
                  <input
                    name="professor"
                    required
                    placeholder="e.g. Dr. Smith"
                    className="input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="input-label">Semester Taken *</label>
                  <select name="semester_taken" required className="input" defaultValue="">
                    <option value="" disabled>Select…</option>
                    {SEMESTERS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Overall Rating */}
              <div className="flex flex-col gap-2">
                <label className="input-label">Overall Rating *</label>
                <StarPicker name="overall_rating" value={overallRating} onChange={setOverallRating} />
                {overallRating > 0 && (
                  <p className="text-[12px]" style={{ color: "var(--t-muted)" }}>
                    {["","Poor","Fair","Good","Great","Excellent"][overallRating]}
                  </p>
                )}
              </div>

              {/* Difficulty */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="input-label" style={{ marginBottom: 0 }}>Difficulty *</label>
                  <span className="text-[11px]" style={{ color: "var(--t-muted)" }}>Easy ← → Hard</span>
                </div>
                <StarPicker name="difficulty_rating" value={difficultyRating} onChange={setDifficultyRating} />
              </div>

              {/* Workload */}
              <div className="flex flex-col gap-2">
                <label className="input-label">Workload *</label>
                <div className="flex gap-2">
                  {workloadOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWorkload(value)}
                      className="flex-1 py-2 text-[13px] font-semibold rounded-xl transition-all border"
                      style={{
                        background: workload === value
                          ? WORKLOAD_STYLES[value].bg
                          : "var(--s-1)",
                        color: workload === value
                          ? WORKLOAD_STYLES[value].color
                          : "var(--t-secondary)",
                        borderColor: workload === value
                          ? WORKLOAD_STYLES[value].color
                          : "var(--b-default)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="workload" value={workload} />
              </div>

              {/* Would Recommend */}
              <div className="flex flex-col gap-2">
                <label className="input-label">Would you recommend this class? *</label>
                <div className="flex gap-2">
                  {[
                    { value: true,  label: "Yes", color: "#059669", bg: "rgba(16,185,129,0.10)" },
                    { value: false, label: "No",  color: "#dc2626", bg: "rgba(220,38,38,0.10)"  },
                  ].map(({ value, label, color, bg }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setWouldRecommend(value)}
                      className="flex-1 py-2 text-[13px] font-semibold rounded-xl transition-all border"
                      style={{
                        background: wouldRecommend === value ? bg : "var(--s-1)",
                        color: wouldRecommend === value ? color : "var(--t-secondary)",
                        borderColor: wouldRecommend === value ? color : "var(--b-default)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="hidden"
                  name="would_recommend"
                  value={wouldRecommend === null ? "" : String(wouldRecommend)}
                />
              </div>

              {/* Grade Received */}
              <div className="flex flex-col gap-1.5">
                <label className="input-label">Grade Received (optional)</label>
                <select name="grade_received" className="input" defaultValue="">
                  <option value="">Prefer not to say</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Focus Areas */}
              <div className="flex flex-col gap-2">
                <label className="input-label">UNC Focus Areas / Gen Ed (optional)</label>
                <div
                  className="rounded-xl p-4 flex flex-col gap-4"
                  style={{ background: "var(--s-1)", border: "1px solid var(--b-subtle)" }}
                >
                  {/* IDEAs in Action: Focus Capacities */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: "var(--t-muted)" }}>
                      IDEAs in Action — Focus Capacities (2022+)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {FOCUS_AREAS.ideas.map(({ code, label }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleFocusArea(code)}
                          title={label}
                          className="pill text-[11px]"
                          style={
                            focusAreas.includes(code)
                              ? { background: "var(--akp-navy)", color: "#fff", borderColor: "var(--akp-navy)" }
                              : {}
                          }
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* IDEAs in Action: First-Year Foundations */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: "var(--t-muted)" }}>
                      IDEAs in Action — First-Year Foundations
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {FOCUS_AREAS.foundations.map(({ code, label }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleFocusArea(code)}
                          title={label}
                          className="pill text-[11px]"
                          style={
                            focusAreas.includes(code)
                              ? { background: "var(--akp-navy)", color: "#fff", borderColor: "var(--akp-navy)" }
                              : {}
                          }
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CLEs */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: "var(--t-muted)" }}>
                      Campus Life Experiences (CLEs)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {FOCUS_AREAS.cle.map(({ code, label }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleFocusArea(code)}
                          title={label}
                          className="pill text-[11px]"
                          style={
                            focusAreas.includes(code)
                              ? { background: "var(--akp-navy)", color: "#fff", borderColor: "var(--akp-navy)" }
                              : {}
                          }
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Making Connections (legacy) */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: "var(--t-muted)" }}>
                      Making Connections — legacy (pre-2022)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {FOCUS_AREAS.makingConnections.map(({ code, label }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleFocusArea(code)}
                          title={label}
                          className="pill text-[11px]"
                          style={
                            focusAreas.includes(code)
                              ? { background: "var(--akp-navy)", color: "#fff", borderColor: "var(--akp-navy)" }
                              : {}
                          }
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Hidden inputs — one per selected focus area */}
                {focusAreas.map((code) => (
                  <input key={code} type="hidden" name="focus_areas" value={code} />
                ))}
              </div>

              {/* Review text */}
              <div className="flex flex-col gap-1.5">
                <label className="input-label">Your Review *</label>
                <textarea
                  name="review_text"
                  required
                  rows={4}
                  placeholder="What did you think? Workload, exams, what to know going in…"
                  className="input resize-none"
                />
              </div>

              {/* Error */}
              {state.error && (
                <p className="text-[13px]" style={{ color: "#dc2626" }}>{state.error}</p>
              )}

              {/* Actions */}
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
                  {pending ? "Posting…" : "Post Review"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Client Component ── */
export default function ClassesClient({
  initialReviews,
  currentUserId,
  isAdmin,
}: {
  initialReviews: ClassReview[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [showModal,      setShowModal]      = useState(false);
  const [query,          setQuery]          = useState("");
  const [activeDept,     setActiveDept]     = useState("all");
  const [activeDiff,     setActiveDiff]     = useState("all");
  const [activeWorkload, setActiveWorkload] = useState("all");
  const [recommendOnly,  setRecommendOnly]  = useState(false);

  // Unique sorted departments from all reviews
  const departments = Array.from(
    new Set(initialReviews.map((r) => r.department))
  ).sort();

  const filtered = initialReviews.filter((r) => {
    if (activeDept !== "all" && r.department !== activeDept) return false;
    if (activeWorkload !== "all" && r.workload !== activeWorkload) return false;
    if (activeDiff === "easy"     && r.difficulty_rating > 2)  return false;
    if (activeDiff === "moderate" && r.difficulty_rating !== 3) return false;
    if (activeDiff === "hard"     && r.difficulty_rating < 4)  return false;
    if (recommendOnly && !r.would_recommend) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !r.course_code.toLowerCase().includes(q) &&
        !r.course_name.toLowerCase().includes(q) &&
        !r.professor.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <>
      {/* ── Controls ── */}
      <div className="flex flex-col gap-3 mb-8">
        {/* Row 1: Search + Write a Review */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: "var(--t-muted)" }}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses, professors…"
              className="input pl-9"
            />
          </div>
          <button onClick={() => setShowModal(true)} className="btn btn-primary shrink-0">
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Write a Review
          </button>
        </div>

        {/* Row 2: Department browse chips */}
        {departments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] mr-1" style={{ color: "var(--t-muted)" }}>
              Dept:
            </span>
            <button
              onClick={() => setActiveDept("all")}
              className={`pill ${activeDept === "all" ? "pill-active" : ""}`}
            >
              All
            </button>
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`pill ${activeDept === dept ? "pill-active" : ""}`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}

        {/* Row 3: Difficulty + Workload + Recommend filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] mr-1" style={{ color: "var(--t-muted)" }}>
            Filter:
          </span>
          {/* Difficulty */}
          {(["all","easy","moderate","hard"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setActiveDiff(d)}
              className={`pill ${activeDiff === d ? "pill-active" : ""}`}
            >
              {d === "all" ? "Any Diff." : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
          <span style={{ color: "var(--b-default)" }}>|</span>
          {/* Workload */}
          {(["all","light","medium","heavy"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setActiveWorkload(w)}
              className={`pill ${activeWorkload === w ? "pill-active" : ""}`}
            >
              {w === "all" ? "Any Load" : w.charAt(0).toUpperCase() + w.slice(1)}
            </button>
          ))}
          <span style={{ color: "var(--b-default)" }}>|</span>
          {/* Recommend only */}
          <button
            onClick={() => setRecommendOnly(!recommendOnly)}
            className={`pill ${recommendOnly ? "pill-active" : ""}`}
          >
            ★ Recommend Only
          </button>
        </div>

        {/* Result count */}
        {(query || activeDept !== "all" || activeDiff !== "all" || activeWorkload !== "all" || recommendOnly) && (
          <p className="text-[12px]" style={{ color: "var(--t-muted)" }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            {query && ` for "${query}"`}
          </p>
        )}
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl"
          style={{ background: "var(--s-0)", border: "1px dashed var(--b-default)" }}
        >
          <p className="text-base font-semibold mb-1" style={{ color: "var(--t-primary)" }}>
            {initialReviews.length === 0 ? "No reviews yet" : "No matches"}
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--t-muted)" }}>
            {initialReviews.length === 0
              ? "Be the first brother to leave a review."
              : "Try adjusting your search or filters."}
          </p>
          {initialReviews.length === 0 && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              Write the first review →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {showModal && <PostModal onClose={() => setShowModal(false)} />}
    </>
  );
}
