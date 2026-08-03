# Classes Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a crowdsourced "Rate My Class" page where AKΨ brothers at UNC Chapel Hill can post and browse course reviews with ratings, difficulty, workload, professor info, and UNC curriculum Focus Capacity tags.

**Architecture:** Six tasks progressing from DB → server actions → client UI → nav wiring. Server component (`page.tsx`) fetches all active reviews and passes them to a client component (`ClassesClient.tsx`) that handles search, filtering, department browsing, and the post-review modal. Server actions handle insert and soft-delete.

**Tech Stack:** Next.js App Router (server + client components), TypeScript, Supabase (postgres + service-role admin client), Tailwind CSS with AKPsi design system CSS vars.

## Global Constraints

- Use design system CSS vars exclusively: `var(--akp-navy)`, `var(--akp-gold)`, `var(--t-primary)`, `var(--s-0)`, `var(--b-default)`, etc. — never hardcode colors that have a token.
- All CSS classes from `globals.css`: `card`, `card-interactive`, `pill`, `pill-active`, `badge`, `badge-navy`, `badge-gold`, `badge-neutral`, `btn`, `btn-primary`, `btn-ghost`, `btn-sm`, `input`, `input-label`, `page-banner`, `page-eyebrow`, `animate-fade-up`, `animate-scale-in`.
- Font: display headings use `fontFamily: "var(--font-display)"` inline style (Poppins).
- All DB writes go through `createAdminClient()` (service role, bypasses RLS). Reads that need RLS bypass also use admin client.
- Auth pattern: `requireMember()` redirects unauthenticated users; `getCurrentMember()` returns null for unauthenticated.
- `export const dynamic = "force-dynamic"` on every page that reads from Supabase.
- AGENTS.md: read `node_modules/next/dist/docs/` before writing any Next.js code if uncertain about APIs.
- No automated test framework exists — verification is done by running `npm run dev` in `akpd-site/` and checking the browser.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `migrations/008_class_reviews.sql` | Create | DB table + RLS policies |
| `src/app/classes/curriculum.ts` | Create | Hardcoded UNC focus area constants |
| `src/lib/actions/classes.ts` | Create | `postClassReview` + `removeClassReview` server actions |
| `src/app/classes/ClassesClient.tsx` | Create | All client-side interactivity: search, filters, cards, modal |
| `src/app/classes/page.tsx` | Create | Server component: auth guard, DB fetch, render shell |
| `src/components/NavLinks.tsx` | Modify | Add Classes nav link |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/008_class_reviews.sql`

**Interfaces:**
- Produces: `public.class_reviews` table with columns consumed by all later tasks

- [ ] **Step 1: Create migration file**

Create `migrations/008_class_reviews.sql`:

```sql
-- ============================================================
-- AKPD · Migration 008 — class_reviews table
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).
-- ============================================================

create table if not exists public.class_reviews (
  id               uuid primary key default gen_random_uuid(),
  course_code      text not null,
  course_name      text not null,
  department       text not null,
  professor        text not null,
  semester_taken   text not null,
  overall_rating   int  not null check (overall_rating   between 1 and 5),
  difficulty_rating int not null check (difficulty_rating between 1 and 5),
  workload         text not null check (workload in ('light', 'medium', 'heavy')),
  would_recommend  boolean not null,
  grade_received   text,
  focus_areas      text[] not null default '{}',
  review_text      text not null,
  posted_by        uuid not null references auth.users(id) on delete cascade,
  posted_by_name   text not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Row-level security
alter table public.class_reviews enable row level security;

-- Authenticated users can read all active reviews
create policy "Authenticated users can read active class reviews"
  on public.class_reviews for select
  to authenticated
  using (is_active = true);

-- Members can insert their own reviews
create policy "Members can insert class reviews"
  on public.class_reviews for insert
  to authenticated
  with check (auth.uid() = posted_by);

-- Members can soft-delete their own reviews (set is_active = false)
create policy "Members can deactivate own class reviews"
  on public.class_reviews for update
  to authenticated
  using (auth.uid() = posted_by);
```

- [ ] **Step 2: Run migration**

Go to Supabase Dashboard → SQL Editor → New query. Paste the entire file contents and click Run.

- [ ] **Step 3: Verify**

In Supabase Dashboard → Table Editor, confirm `class_reviews` table exists with all 16 columns.

- [ ] **Step 4: Commit**

```bash
cd akpd-site
git add migrations/008_class_reviews.sql
git commit -m "feat: add class_reviews migration"
```

---

## Task 2: Curriculum Constants

**Files:**
- Create: `src/app/classes/curriculum.ts`

**Interfaces:**
- Produces:
  - `FOCUS_AREAS: { ideas: FocusArea[], foundations: FocusArea[], cle: FocusArea[], makingConnections: FocusArea[] }`
  - `ALL_FOCUS_AREAS: FocusArea[]`
  - `getFocusAreaLabel(code: string): string`
  - `type FocusArea = { code: string; label: string }`

- [ ] **Step 1: Create curriculum.ts**

Create `src/app/classes/curriculum.ts`:

```ts
export type FocusArea = { code: string; label: string };

export const FOCUS_AREAS = {
  ideas: [
    { code: "FC-AESTH",   label: "Aesthetic and Interpretive Analysis" },
    { code: "FC-CREATE",  label: "Creative Expression, Practice, and Production" },
    { code: "FC-PAST",    label: "Engagement with the Human Past" },
    { code: "FC-VALUES",  label: "Ethical and Civic Values" },
    { code: "FC-GLOBAL",  label: "Global Understanding and Engagement" },
    { code: "FC-NATSCI",  label: "Natural Scientific Investigation" },
    { code: "FC-POWER",   label: "Power and Society" },
    { code: "FC-QUANT",   label: "Quantitative Reasoning" },
    { code: "FC-KNOWING", label: "Ways of Knowing" },
    { code: "FC-LAB",     label: "Empirical Investigation Lab" },
  ] as FocusArea[],
  foundations: [
    { code: "FY-WRITING", label: "Writing at the Research University" },
    { code: "FY-SEMINAR", label: "First-Year Seminar" },
    { code: "FY-LAUNCH",  label: "First-Year Launch" },
    { code: "FY-THRIVE",  label: "College Thriving" },
    { code: "FY-DATA",    label: "Data Literacy Lab (Triple-I)" },
    { code: "GLBL-LANG",  label: "Global Language" },
  ] as FocusArea[],
  cle: [
    { code: "CLE-CIVIC",  label: "Civic Engagement & Public Service" },
    { code: "CLE-ARTS",   label: "Films, Music & Visual and Performing Arts" },
    { code: "CLE-CAREER", label: "Career Exploration and Leadership" },
    { code: "CLE-CAMPUS", label: "Campus Life and Personal Well-Being" },
  ] as FocusArea[],
  makingConnections: [
    { code: "MC-EFC", label: "English and Communications" },
    { code: "MC-FCA", label: "Aesthetic and Interpretive Approaches" },
    { code: "MC-FCB", label: "Biological and Physical Science (w/ lab)" },
    { code: "MC-FCC", label: "Social and Behavioral Sciences" },
    { code: "MC-FCH", label: "Historical Analysis" },
    { code: "MC-FCK", label: "Mathematical Sciences" },
    { code: "MC-FCL", label: "Lifetime Fitness and Wellness" },
    { code: "MC-NFL", label: "Foreign Language" },
    { code: "MC-PH",  label: "Physical Education and Health" },
  ] as FocusArea[],
};

export const ALL_FOCUS_AREAS: FocusArea[] = [
  ...FOCUS_AREAS.ideas,
  ...FOCUS_AREAS.foundations,
  ...FOCUS_AREAS.cle,
  ...FOCUS_AREAS.makingConnections,
];

export function getFocusAreaLabel(code: string): string {
  return ALL_FOCUS_AREAS.find((f) => f.code === code)?.label ?? code;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/classes/curriculum.ts
git commit -m "feat: add UNC curriculum focus area constants"
```

---

## Task 3: Server Actions

**Files:**
- Create: `src/lib/actions/classes.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, `createAdminClient` from `@/lib/supabase/admin`
- Produces:
  - `type ClassReviewFormState = { error?: string; success?: boolean }`
  - `postClassReview(_prev: ClassReviewFormState, formData: FormData): Promise<ClassReviewFormState>`
  - `removeClassReview(id: string): Promise<{ error?: string }>`

- [ ] **Step 1: Create classes.ts**

Create `src/lib/actions/classes.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClassReviewFormState = {
  error?: string;
  success?: boolean;
};

/** Normalize raw course code input: "comp550" → "COMP 550", "BUSI  101" → "BUSI 101" */
function normalizeCourseCode(raw: string): string {
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "");
  // Insert a single space between the letter prefix and the digit suffix
  return upper.replace(/^([A-Z]+)(\d.*)$/, "$1 $2");
}

/** Derive department from normalized code: "COMP 550" → "COMP" */
function deriveDepartment(code: string): string {
  return code.split(" ")[0];
}

export async function postClassReview(
  _prev: ClassReviewFormState,
  formData: FormData
): Promise<ClassReviewFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const rawCode       = (formData.get("course_code")    as string)?.trim() ?? "";
  const course_code   = normalizeCourseCode(rawCode);
  const course_name   = (formData.get("course_name")    as string)?.trim() ?? "";
  const professor     = (formData.get("professor")      as string)?.trim() ?? "";
  const semester_taken = (formData.get("semester_taken") as string)?.trim() ?? "";
  const overall_rating   = parseInt(formData.get("overall_rating")    as string, 10);
  const difficulty_rating = parseInt(formData.get("difficulty_rating") as string, 10);
  const workload       = (formData.get("workload")        as string) ?? "";
  const would_recommend = formData.get("would_recommend") === "true";
  const grade_received  = (formData.get("grade_received") as string) || null;
  const focus_areas     = formData.getAll("focus_areas") as string[];
  const review_text     = (formData.get("review_text")   as string)?.trim() ?? "";

  if (!course_code)   return { error: "Course code is required." };
  if (!course_name)   return { error: "Course name is required." };
  if (!professor)     return { error: "Professor name is required." };
  if (!semester_taken) return { error: "Semester is required." };
  if (!overall_rating || overall_rating < 1 || overall_rating > 5)
    return { error: "Overall rating (1–5) is required." };
  if (!difficulty_rating || difficulty_rating < 1 || difficulty_rating > 5)
    return { error: "Difficulty rating (1–5) is required." };
  if (!["light", "medium", "heavy"].includes(workload))
    return { error: "Workload is required." };
  if (formData.get("would_recommend") === null || formData.get("would_recommend") === "")
    return { error: "Please indicate whether you'd recommend this class." };
  if (!review_text)   return { error: "Review text is required." };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const posted_by_name = profile?.full_name || profile?.email || "Member";
  const department = deriveDepartment(course_code);

  const { error } = await admin.from("class_reviews").insert({
    course_code,
    course_name,
    department,
    professor,
    semester_taken,
    overall_rating,
    difficulty_rating,
    workload,
    would_recommend,
    grade_received,
    focus_areas: focus_areas.length > 0 ? focus_areas : [],
    review_text,
    posted_by: user.id,
    posted_by_name,
    is_active: true,
  });

  if (error) {
    console.error("postClassReview error:", error.message);
    return { error: "Failed to post review. Please try again." };
  }

  revalidatePath("/classes");
  return { success: true };
}

export async function removeClassReview(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("members")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isAdmin = member?.role === "admin";

  // Admins can remove any review; members can only remove their own
  const query = admin
    .from("class_reviews")
    .update({ is_active: false })
    .eq("id", id);

  const { error } = isAdmin ? await query : await query.eq("posted_by", user.id);

  if (error) return { error: "Could not remove review." };

  revalidatePath("/classes");
  return {};
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd akpd-site && npx tsc --noEmit
```
Expected: no errors relating to `classes.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/classes.ts
git commit -m "feat: add postClassReview and removeClassReview server actions"
```

---

## Task 4: ClassesClient Component

**Files:**
- Create: `src/app/classes/ClassesClient.tsx`

**Interfaces:**
- Consumes:
  - `postClassReview` from `@/lib/actions/classes`
  - `removeClassReview` from `@/lib/actions/classes`
  - `FOCUS_AREAS`, `getFocusAreaLabel` from `./curriculum`
- Produces:
  - `export type ClassReview` (re-exported for `page.tsx`)
  - `export default function ClassesClient({ initialReviews, currentUserId, isAdmin })`

- [ ] **Step 1: Create ClassesClient.tsx**

Create `src/app/classes/ClassesClient.tsx`:

```tsx
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
            onClick={() => removeClassReview(review.id)}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd akpd-site && npx tsc --noEmit
```
Expected: no errors in `ClassesClient.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/classes/ClassesClient.tsx
git commit -m "feat: add ClassesClient with search, filters, review cards, and post modal"
```

---

## Task 5: Server Page Component

**Files:**
- Create: `src/app/classes/page.tsx`

**Interfaces:**
- Consumes:
  - `requireMember` from `@/lib/auth`
  - `createAdminClient` from `@/lib/supabase/admin`
  - `ClassesClient`, `type ClassReview` from `./ClassesClient`
- Produces: Next.js page at route `/classes`

- [ ] **Step 1: Create page.tsx**

Create `src/app/classes/page.tsx`:

```tsx
import { requireMember } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ClassesClient, { type ClassReview } from "./ClassesClient";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const member = await requireMember();
  // Alumni don't need class recommendations — send them to opportunities
  if (member.role === "alumni") redirect("/opportunities");

  const isAdmin = member.role === "admin";

  const { data } = await createAdminClient()
    .from("class_reviews")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const reviews = (data ?? []) as ClassReview[];

  return (
    <main className="flex-1">
      {/* ── Page header ── */}
      <div className="page-banner">
        <div className="max-w-6xl mx-auto px-6">
          <p className="page-eyebrow">AKΨ · UNC Chapel Hill</p>
          <h1 className="page-title page-title-md">
            Rate My <em>Class</em>
          </h1>
          <p className="page-subtitle">
            Real talk from brothers who&apos;ve been there — ratings, difficulty, workload, and which Gen Ed boxes they tick.
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <ClassesClient
          initialReviews={reviews}
          currentUserId={member.auth_user_id ?? ""}
          isAdmin={isAdmin}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Start dev server and verify page loads**

```bash
cd akpd-site && npm run dev
```

Navigate to `http://localhost:3000/classes`. Expected:
- Page renders with "Rate My Class" header, gold eyebrow, gold italic "Class" in title
- Search bar and "Write a Review" button visible
- Empty state with "No reviews yet" and a CTA button (since table is empty)
- No TypeScript or runtime errors in terminal

- [ ] **Step 3: Test post modal end-to-end**

1. Click "Write a Review"
2. Fill in all required fields (course code, name, professor, semester, ratings, workload, recommend toggle, review text)
3. Click "Post Review"
4. Expected: success checkmark in modal, modal closes, review card appears in grid
5. Check Supabase Dashboard → Table Editor → `class_reviews` to confirm row was inserted

- [ ] **Step 4: Test filters**

1. Add 2–3 more reviews with different departments and difficulty levels
2. Click department chips — grid should filter to matching reviews
3. Try difficulty and workload filter pills
4. Try search — type a course code, name, or professor
5. Toggle "★ Recommend Only" — should hide non-recommended reviews

- [ ] **Step 5: Test remove**

1. As a regular member: click Remove on your own review — row should disappear
2. As admin: Remove button should appear on all cards

- [ ] **Step 6: Commit**

```bash
git add src/app/classes/page.tsx
git commit -m "feat: add Classes page server component"
```

---

## Task 6: Nav Wire-Up

**Files:**
- Modify: `src/components/NavLinks.tsx:6-11`

**Interfaces:**
- Consumes: existing `ALL_LINKS` array in `NavLinks.tsx`
- Produces: "Classes" nav link visible to non-alumni members

- [ ] **Step 1: Add Classes to NavLinks**

In `src/components/NavLinks.tsx`, add the Classes entry to `ALL_LINKS`:

```ts
const ALL_LINKS = [
  { href: "/people",        label: "People",        alumniVisible: true  },
  { href: "/recruitment",   label: "Recruitment",   alumniVisible: false },
  { href: "/classes",       label: "Classes",       alumniVisible: false },
  { href: "/opportunities", label: "Opportunities", alumniVisible: true  },
  { href: "/seniors",       label: "Seniors",       alumniVisible: true  },
];
```

- [ ] **Step 2: Verify nav in browser**

Reload `http://localhost:3000`. Expected:
- "Classes" appears in the nav between Recruitment and Opportunities
- Clicking it navigates to `/classes`
- Active nav underline (gold bar) appears when on the Classes page
- Alumni accounts do NOT see the Classes link (same behavior as Recruitment)

- [ ] **Step 3: Commit**

```bash
git add src/components/NavLinks.tsx
git commit -m "feat: add Classes to navigation"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| `class_reviews` table with all 16 columns + RLS | Task 1 |
| Full UNC IDEAs in Action + Making Connections codes | Task 2 |
| `postClassReview` server action with normalization | Task 3 |
| `removeClassReview` server action (admin or own) | Task 3 |
| Search + department browse + filter pills | Task 4 |
| Star pickers (overall + difficulty) | Task 4 |
| Workload segmented toggle | Task 4 |
| Would Recommend Yes/No toggle | Task 4 |
| Grade received optional dropdown | Task 4 |
| Focus area multi-select grouped by curriculum era | Task 4 |
| Review cards with all fields | Task 4 |
| Admin remove button on all cards | Task 4 |
| Own-review remove button for non-admins | Task 4 |
| Empty state with CTA | Task 4 |
| `page-banner` header with eyebrow + gold italic title | Task 5 |
| `requireMember()` guard + alumni redirect | Task 5 |
| `export const dynamic = "force-dynamic"` | Task 5 |
| Classes in nav, `alumniVisible: false` | Task 6 |

All requirements covered. No gaps found.
