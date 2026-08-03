# Classes Page — Design Spec
**Date:** 2026-08-02
**Status:** Approved

## Overview

A crowdsourced "Rate My Class" page for AKΨ brothers at UNC Chapel Hill. Brothers post reviews of courses they've taken — rating, difficulty, workload, professor, whether it fulfills a UNC Focus Capacity, and a written review. Any member can post immediately; admins can remove reviews. No admin approval queue.

---

## Data Model

**Table: `class_reviews`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `course_code` | text NOT NULL | Normalized: "COMP 550" (uppercase, single space) |
| `course_name` | text NOT NULL | e.g. "Intro to Algorithms" |
| `department` | text NOT NULL | Derived from code prefix: "COMP" |
| `professor` | text NOT NULL | |
| `semester_taken` | text NOT NULL | "Fall 2025", "Spring 2026", etc. |
| `overall_rating` | int NOT NULL | 1–5 |
| `difficulty_rating` | int NOT NULL | 1–5 (1=easy, 5=brutal) |
| `workload` | text NOT NULL | 'light' \| 'medium' \| 'heavy' |
| `would_recommend` | boolean NOT NULL | |
| `grade_received` | text | Optional: A+/A/A-/B+/B/B-/C+/C/C-/D/F/P/NR |
| `focus_areas` | text[] | Array of curriculum codes |
| `review_text` | text NOT NULL | |
| `posted_by` | uuid NOT NULL | FK → auth.users.id |
| `posted_by_name` | text NOT NULL | Denormalized display name |
| `is_active` | boolean NOT NULL | Default true; admin sets false to remove |
| `created_at` | timestamptz | Default now() |

---

## UNC Curriculum Codes (hardcoded)

### IDEAs in Action (Fall 2022+)

**Focus Capacities:**
- FC-AESTH — Aesthetic and Interpretive Analysis
- FC-CREATE — Creative Expression, Practice, and Production
- FC-PAST — Engagement with the Human Past
- FC-VALUES — Ethical and Civic Values
- FC-GLOBAL — Global Understanding and Engagement
- FC-NATSCI — Natural Scientific Investigation
- FC-POWER — Power and Society
- FC-QUANT — Quantitative Reasoning
- FC-KNOWING — Ways of Knowing
- FC-LAB — Empirical Investigation Lab

**First-Year Foundations:**
- FY-WRITING — Writing at the Research University
- FY-SEMINAR — First-Year Seminar
- FY-LAUNCH — First-Year Launch
- FY-THRIVE — College Thriving
- FY-DATA — Data Literacy Lab (Triple-I)
- GLBL-LANG — Global Language

**Campus Life Experiences (CLEs):**
- CLE-CIVIC — Civic Engagement, Public Service, and Academic Enhancement
- CLE-ARTS — Films, Music, & Visual and Performing Arts
- CLE-CAREER — Career Exploration and Leadership Development
- CLE-CAMPUS — Campus Life and Personal Well-Being

### Making Connections (Pre-Fall 2022, legacy)
- MC-EFC — English and Communications
- MC-FCA — Aesthetic and Interpretive Approaches
- MC-FCB — Biological and Physical Science (w/ lab)
- MC-FCC — Social and Behavioral Sciences
- MC-FCH — Historical Analysis
- MC-FCK — Mathematical Sciences
- MC-FCL — Lifetime Fitness and Wellness
- MC-NFL — Foreign Language
- MC-PH — Physical Education and Health

---

## Page Layout

### Header
- Style: `page-banner` (compact, white surface, gold glow)
- Eyebrow: "AKΨ · UNC Chapel Hill"
- Title: "Rate My Class" (display font, navy)
- Subtitle: "Real talk from brothers who've been there."
- Right side: "Write a Review" button (`btn-primary`)

### Controls (client-side)
1. **Search input** — searches course_code, course_name, professor (full-text client filter)
2. **Filter pill row** — All · by difficulty · by workload · Recommends Only
3. **Department browse chips** — pills derived from unique `department` values in loaded reviews; clicking sets department filter; active chip turns navy

### Card Grid
- 3 columns → 2 → 1 (responsive)
- Flat list: one card per individual review (not aggregated per course)
- Sort: newest first by default

### Empty State
- Dashed border card, centered text: "No reviews yet" + CTA to write the first one

---

## Review Card

- **Top:** Course code (large, navy, display font) + course name; professor in muted text
- **Ratings row:** Overall stars (gold filled) + Difficulty stars (labeled Easy→Hard)
- **Badges:** Workload pill (light=green, medium=gold, heavy=red tint) + focus area badges (navy pill per code)
- **Recommend indicator:** Green checkmark "Would recommend" or muted "Not recommended"
- **Review text:** 3-line clamp
- **Footer:** Semester · grade (if provided) · reviewer name · time ago
- **Admin remove button:** Shown only to admins — `btn-ghost` red tint, calls server action

---

## Post Review Modal

Triggered by "Write a Review" button. Full-screen overlay with blur backdrop.

**Fields:**
1. Course Code * — text input, normalized on submit (trim + uppercase + ensure space between dept and number)
2. Course Name * — text input
3. Professor * — text input
4. Semester Taken * — select (last 6 semesters + "Other")
5. Overall Rating * — 5 interactive star buttons
6. Difficulty * — 5 interactive star buttons (labeled "Easy" ↔ "Hard")
7. Workload * — 3-button segmented toggle: Light / Medium / Heavy
8. Would Recommend? * — Yes / No toggle buttons
9. Grade Received — optional select (A+ through F, P, NR)
10. Focus Areas — multi-select checkbox list, grouped: "IDEAs in Action (2022+)" and "Making Connections (pre-2022)"
11. Review * — textarea (min ~50 chars encouraged)

On submit: server action inserts row, `revalidatePath("/classes")`, modal closes.

---

## Server Action

**`src/lib/actions/classes.ts`**

- `postClassReview(formData)` — validates, normalizes course_code, derives department, inserts to `class_reviews`, returns `{ success } | { error }`
- `removeClassReview(id)` — admin only, sets `is_active = false`

---

## File Structure

```
src/app/classes/
  page.tsx          ← server component, loads reviews, passes to client
  ClassesClient.tsx ← "use client", all interactivity
src/lib/actions/
  classes.ts        ← server actions
```

---

## Navigation

Add to `NavLinks.tsx`:
```ts
{ href: "/classes", label: "Classes", alumniVisible: false }
```

Page guarded with `requireMember()`. Alumni redirected to `/opportunities`.

---

## Access Control

- Any authenticated member can post reviews (immediate, no approval)
- Admins see a remove button on every card
- Non-admins see remove only on their own reviews (posted_by === currentUserId)
- `is_active = false` hides a review from all users

---

## Out of Scope (v1)

- Course detail / drill-down page per course
- Aggregated ratings per course
- Upvotes / helpful votes on reviews
- Image attachments
- Notifications
