# AKPD Site — Project Handoff
**Last updated: 2026-08-08**

Member portal for Alpha Kappa Psi Delta chapter, UNC Chapel Hill. Lives at `C:\Users\aranj\AKPD\akpd-site`. Repo: `aranjaimancs/AKPD` on GitHub (`main` branch).

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `force-dynamic` everywhere) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + custom design system in `globals.css` |
| Database | Supabase (Postgres + Auth + Storage) |
| Auth | Google OAuth via Supabase PKCE flow |
| Maps | Leaflet + react-leaflet + Supercluster |
| Fonts | Poppins (display) + system-ui (body) |

**Important:** `AGENTS.md` reminds you that Next.js 16 has breaking changes from prior versions. Before writing any Next.js-specific code, check `node_modules/next/dist/docs/`. In particular, Server Action body size limit config is `experimental.serverActions.bodySizeLimit` (not a top-level option).

---

## Running Locally

```bash
cd akpd-site
npm install
npm run dev        # http://localhost:3000
```

Environment variables needed (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Directory Structure

```
akpd-site/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── layout.tsx              # Root layout (Navbar, ThemeProvider)
│   │   ├── page.tsx                # Root → redirects to /people
│   │   ├── login/                  # Google OAuth sign-in (split navy/white)
│   │   ├── not-authorized/         # Shown when email not in allowlist
│   │   ├── onboarding/             # First-run wizard (name, location, interests)
│   │   ├── people/                 # Alumni map + directory sidebar
│   │   ├── seniors/                # Career profile card grid
│   │   │   └── [slug]/             # Individual senior detail page
│   │   ├── seniors-content/        # Headshot file serving route (public)
│   │   ├── opportunities/          # Job board (internship/full-time/club/research)
│   │   ├── recruitment/            # Career resource library (hidden from alumni)
│   │   ├── classes/                # Rate My Class — reviews + resources
│   │   │   ├── page.tsx
│   │   │   ├── ClassesClient.tsx   # Tab switcher + reviews tab
│   │   │   ├── ClassResourcesTab.tsx  # Resources tab (folders, upload)
│   │   │   └── curriculum.ts       # UNC focus area codes (IDEAs, CLEs, etc.)
│   │   ├── settings/               # Profile editor (avatar, location, interests)
│   │   └── admin/                  # Admin hub + sub-pages (members, people, seniors, recruitment, opportunities)
│   ├── components/
│   │   ├── Navbar.tsx              # Server Component — fetches profile for avatar
│   │   ├── NavLinks.tsx            # Client Component — active-state underline
│   │   ├── ProfileDropdown.tsx     # Avatar + sign out
│   │   ├── ThemeProvider.tsx       # Dark/light mode (localStorage + prefers-color-scheme)
│   │   ├── SeniorForm.tsx          # Shared form for add/edit senior
│   │   ├── SeniorsGrid.tsx         # Reusable senior card grid
│   │   ├── WelcomeTour.tsx         # First-visit tooltip tour
│   │   └── AuthBar.tsx             # (legacy, may be unused)
│   ├── lib/
│   │   ├── auth.ts                 # getCurrentMember(), requireMember(), requireAdmin()
│   │   ├── supabase/
│   │   │   ├── server.ts           # createClient() — user-scoped, SSR
│   │   │   ├── client.ts           # createBrowserClient() — client components
│   │   │   └── admin.ts            # createAdminClient() — service role, server-only
│   │   └── actions/
│   │       ├── auth.ts             # signOut
│   │       ├── classes.ts          # postClassReview, removeClassReview
│   │       ├── classResources.ts   # uploadClassResource, removeClassResource, getClassResourceSignedUrl
│   │       ├── members.ts          # addMember, removeMember, toggleRole, importCSV
│   │       ├── onboarding.ts       # completeOnboarding
│   │       ├── opportunities.ts    # postOpportunity, approveOpportunity, etc.
│   │       ├── people.ts           # addPerson, updatePerson, deletePerson, geocode
│   │       ├── profile.ts          # updateProfile, uploadAvatar
│   │       └── recruitment.ts      # addField, addResource, getSignedDownloadUrl
│   ├── middleware.ts               # Session refresh + route protection
│   └── types/
│       └── profile.ts
├── content/seniors/                # File-based senior profiles
│   └── [slug]/
│       ├── meta.json               # name, major, track, tags, linkedin, etc.
│       ├── profile.generated.json  # AI-generated bio fields
│       └── headshot.*              # Photo file
├── migrations/                     # SQL migrations (run in Supabase SQL Editor)
│   ├── 001_members_rls.sql
│   ├── 002_people_table.sql
│   ├── 003_recruitment.sql
│   ├── 004_seniors_table.sql
│   ├── 005_alumni_role_and_audience.sql
│   ├── 006_add_missing_columns.sql
│   ├── 007_opportunities_approval.sql
│   ├── 008_class_reviews.sql
│   ├── 009_people_email.sql
│   └── 010_class_resources.sql     ← most recent
├── next.config.ts
├── AGENTS.md / CLAUDE.md           # AI assistant instructions
└── HANDOFF.md                      # this file
```

---

## Auth & Access Control

### How it works (two-layer)

**Layer 1 — Middleware** (`src/middleware.ts`):
- Validates the Supabase session JWT on every request
- Unauthenticated → redirect to `/login`
- Admin routes (`/admin/*`) → checks `user.user_metadata.role === "admin"` (set by auth callback)
- This is a fast first gate but **not trusted for data access**

**Layer 2 — Server-side allowlist check** (`src/lib/auth.ts`):
- `getCurrentMember()` — queries `members` table via admin client (bypasses RLS), returns null if not in allowlist
- `requireMember()` — wraps getCurrentMember, redirects to /login or /not-authorized
- `requireAdmin()` — wraps requireMember, enforces admin role
- **Always call one of these in every page Server Component.** Never trust client-side role.

### Roles

| Role | Access |
|---|---|
| `admin` | Everything including /admin/* routes |
| `member` | All member pages (people, seniors, classes, opportunities, recruitment, settings) |
| `alumni` | people, opportunities, seniors only — blocked from recruitment + classes |

### Auth flow
1. User clicks "Sign in with Google" → `/auth/google` → Supabase PKCE redirect
2. Callback at `/auth/callback` — writes `role` + `full_name` into `user.user_metadata`
3. Middleware reads `user_metadata.role` for fast admin gating
4. All DB queries use the admin client server-side for authoritative role checks

---

## Database Schema

All tables are in `public` schema with RLS enabled. Server-side actions always use `createAdminClient()` (service role) — RLS policies exist as a safety net, not the primary access control.

### `members` — allowlist
```
id, email (unique), full_name, position, role (admin|member|alumni), auth_user_id
```
Admin manages this at `/admin/members`. Adding an email here grants access. `auth_user_id` is linked when that person first signs in.

### `profiles` — user settings
```
id (= auth.users.id), full_name, email, avatar_url, location, interests (text[]),
linkedin_url, lat, lng, onboarding_complete
```
Auto-created by trigger `on_auth_user_created`. Editable at `/settings`.

### `people` — alumni directory
```
id, name, email, company, title, industry, interests (text[]), lat, lng, location, bio,
profile_image_url, is_member (bool)
```
Displayed on the `/people` map. Email added in migration 009 for profile photo auto-sync when an alumni member first signs in.

### `opportunities`
```
id, title, company, type (internship|full-time|club|research), description,
location, deadline, link, posted_by, posted_by_name, is_approved, is_active, created_at
```
Members post; admins approve at `/admin/opportunities`.

### `recruitment_fields`
```
id, name, slug, description, icon, sort_order, is_published
```

### `recruitment_resources`
```
id, field_id (→ recruitment_fields), title, description, resource_type (file|link),
file_path, file_mime, external_url, sort_order
```
Files live in `recruitment-resources` storage bucket (admin-only upload). Signed URL downloads (60s TTL).

### `class_reviews`
```
id, course_code, course_name, department, professor, semester_taken,
overall_rating (1-5), difficulty_rating (1-5), workload (light|medium|heavy),
would_recommend (bool), grade_received, focus_areas (text[]),
review_text, posted_by, posted_by_name, is_active, created_at
```
Soft-delete via `is_active`. Members can remove own; admins can remove any.

### `class_resources`
```
id, course_code, course_name, department, title, description,
resource_type (file|link), file_path, file_mime, file_size,
external_url, uploaded_by, uploaded_by_name, is_active, created_at
```
Files live in `class-resources` storage bucket (private, 50MB limit). Signed URL downloads (60s TTL). Soft-delete only.

### Storage buckets

| Bucket | Access | Used for |
|---|---|---|
| `avatars` | Public read, auth write | Profile photos |
| `recruitment-resources` | Admin only | Recruitment file downloads |
| `class-resources` | Authenticated read/write | Class resource file uploads |

### Seniors — file-based (not DB)
Senior profiles live at `content/seniors/[slug]/` with `meta.json` + optional `profile.generated.json` + headshot. An index at `src/data/seniors.json` lists all slugs. Headshots served via `/seniors-content/[slug]/[file]` route handler. Admin CRUD at `/admin/seniors`, `/admin/add-senior`, `/admin/edit-senior/[slug]`.

---

## Pages & Features

### `/people`
Interactive Leaflet map + directory sidebar. Search by name, filter by industry/interest. Click a pin → fly to + show card. Data from `people` table + `profiles` table combined. Supercluster for pin clustering. Leaflet loaded with `dynamic(() => ..., { ssr: false })`.

### `/seniors`
Career profile card grid (4:3 photo + info panel). Search by name/major, filter by class year and track/tag pills. Data from file-based seniors system.

### `/seniors/[slug]`
Full profile page. Reads `meta.json` + `profile.generated.json` + headshot from `content/seniors/[slug]/`.

### `/opportunities`
Job board. Members post; posts require admin approval before appearing. Filter by type (internship/full-time/club/research). Visible to all roles including alumni.

### `/recruitment`
Career resource library organized by track/field with file downloads and external links. **Blocked for alumni** — `redirect("/opportunities")` on server. Files delivered via 60s signed URLs from `recruitment-resources` bucket.

### `/classes`
Two-tab interface:

**Reviews tab** — searchable grid of class reviews. Filters: department, difficulty (easy/moderate/hard), workload (light/medium/heavy), recommend-only toggle. "Write a Review" modal with star pickers, UNC focus area selector (IDEAs in Action, First-Year Foundations, CLEs — pre-2022 Making Connections removed), semester dropdown, grade (optional). Soft-delete for own reviews + admin.

**Resources tab** — course folder accordion. Each folder = unique course code, lists all uploaded resources. "Add Resource" modal: course code with datalist autocomplete (pulls known courses from both reviews and resources), auto-fills course name for known codes, File Upload or Link/URL toggle, 50MB file limit. Resources downloadable via 60s signed URLs. Folder-level "Add to COMP 550" button for quick contextual upload. **Blocked for alumni** — `redirect("/opportunities")` on server.

### `/settings`
Profile editor: full name, location (geocoded via Nominatim/OpenStreetMap), interests multi-select, LinkedIn URL, avatar upload to `avatars` bucket.

### `/admin`
Hub dashboard with stats + 4 management cards.

### `/admin/members`
Allowlist management: add by email, remove, toggle role (member ↔ admin). CSV bulk import.

### `/admin/people`
Alumni directory CRUD: add/edit/delete people, geocode location via Nominatim.

### `/admin/seniors`
List all seniors with edit/delete. `/admin/add-senior` and `/admin/edit-senior/[slug]` use shared `SeniorForm`.

### `/admin/recruitment`
Manage recruitment fields and resources (file upload + links).

### `/admin/opportunities`
Approve/reject submitted opportunities.

---

## Design System

All tokens defined in `src/app/globals.css`. Dark mode via `[data-theme="dark"]` CSS overrides toggled by `ThemeProvider` (localStorage + `prefers-color-scheme` fallback).

### Key tokens
```css
/* Surfaces */
--s-page   /* page background */
--s-0      /* card/panel */
--s-1      /* inset/secondary (inputs, sidebars) */
--s-2      /* subtle divider bg */

/* Borders */
--b-subtle / --b-default / --b-strong

/* Text */
--t-primary / --t-secondary / --t-muted / --t-faint

/* Brand (never override in dark mode) */
--akp-navy      #0a2240
--akp-gold      #c9a84c
```

**Critical rule:** Never use `--akp-navy` for text that needs to be readable in dark mode — it's a brand anchor that stays dark regardless of theme. Use `--t-primary` instead.

### Utility classes
`.card`, `.card-interactive` — surface + hover lift  
`.btn`, `.btn-primary`, `.btn-gold`, `.btn-ghost`, `.btn-sm` — buttons  
`.pill`, `.pill-active` — filter chips  
`.badge`, `.badge-navy`, `.badge-gold`, `.badge-neutral` — inline labels  
`.input`, `.input-label` — form fields  
`.page-hero` / `.page-banner` / `.page-cap` — three header modes  
`.animate-fade-up` / `.animate-fade-in` / `.animate-scale-in` — entry animations  

---

## Key Patterns & Conventions

### Data fetching
- Server Components fetch at render time with `async/await` — no loading skeletons by default
- All pages have `export const dynamic = "force-dynamic"` to disable caching
- Always use `createAdminClient()` server-side for DB reads — RLS on the user client can interfere with cross-table lookups

### Mutations
- Server Actions with `useActionState` (React 19 API, not legacy `useFormState`)
- Pattern: `const [state, action, pending] = useActionState(myAction, {})`
- Always call `revalidatePath("/route")` at the end of mutating actions
- For client state refresh after mutations: `router.refresh()` from `next/navigation`

### File uploads
- Supabase Storage via `createAdminClient().storage.from("bucket").upload(...)`
- Pass `File.arrayBuffer()` as bytes — works up to 50MB with `experimental.serverActions.bodySizeLimit: "50mb"` in `next.config.ts`
- Private buckets use `createSignedUrl(path, 60)` for 60-second download URLs

### Course code normalization
Used in both `classes.ts` and `classResources.ts` actions:
```ts
function normalizeCourseCode(raw: string): string {
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "");
  return upper.replace(/^([A-Z]+)(\d.*)$/, "$1 $2");
  // "comp550" → "COMP 550", "BUSI  101" → "BUSI 101"
}
```

### Geocoding
Nominatim (OpenStreetMap) used in `people.ts` and `profile.ts` actions for converting location strings to lat/lng.

### Leaflet
Must be loaded with `dynamic(() => import("./PeopleMapInner"), { ssr: false })` — will break with SSR.

---

## Role-Based Nav Visibility

`NavLinks.tsx` uses `alumniVisible` flag per link:

| Route | Members | Alumni | Admins |
|---|---|---|---|
| /people | ✓ | ✓ | ✓ |
| /recruitment | ✓ | ✗ | ✓ |
| /classes | ✓ | ✗ | ✓ |
| /opportunities | ✓ | ✓ | ✓ |
| /seniors | ✓ | ✓ | ✓ |
| /admin | ✗ | ✗ | ✓ |

Alumni are also hard-blocked server-side (redirect) on `/recruitment` and `/classes`.

---

## Migrations Log

Run each in order via **Supabase Dashboard → SQL Editor → New query**. All are idempotent (safe to re-run).

| # | File | What it does |
|---|---|---|
| 001 | `001_members_rls.sql` | members table + RLS |
| 002 | `002_people_table.sql` | people (alumni directory) table |
| 003 | `003_recruitment.sql` | recruitment_fields + recruitment_resources |
| 004 | `004_seniors_table.sql` | seniors metadata table (supplements file system) |
| 005 | `005_alumni_role_and_audience.sql` | alumni role + audience filtering |
| 006 | `006_add_missing_columns.sql` | backfill missing columns across tables |
| 007 | `007_opportunities_approval.sql` | opportunities + approval workflow |
| 008 | `008_class_reviews.sql` | class_reviews table + RLS |
| 009 | `009_people_email.sql` | adds email column to people table for profile sync |
| 010 | `010_class_resources.sql` | class_resources table + RLS + class-resources storage bucket |

---

## Things to Know / Gotchas

1. **Middleware role check is not authoritative.** It reads `user_metadata.role` for speed. The DB allowlist check in `auth.ts` is the real gate. If a role gets out of sync, the metadata might let someone past middleware but the page's `requireMember()` will catch them.

2. **Seniors are file-based, not DB.** Adding/editing seniors writes to `content/seniors/[slug]/` files and updates `src/data/seniors.json`. There's no seniors table that drives the public pages — the DB table (`004`) is used only by admin management. Don't mix these up.

3. **Alumni have a hard redirect on /recruitment and /classes.** Both pages check `member.role === "alumni"` and call `redirect("/opportunities")` before any data fetch or render.

4. **Dark mode text:** Never use `color: var(--akp-navy)` for readable text — it stays dark regardless of theme. Use `var(--t-primary)` for any text that needs to flip in dark mode.

5. **Opportunities need admin approval.** Posts submitted by members have `is_approved: false` and won't appear on the public board until an admin approves at `/admin/opportunities`.

6. **Signed URLs expire in 60 seconds.** Both recruitment and class resource downloads use 60s TTL signed URLs. The download button fetches a fresh URL on each click — don't try to cache or pre-fetch these.

7. **Supabase admin client is server-only.** `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` — it must never be called in a Client Component or exposed to the browser.

8. **`force-dynamic` on all pages.** Without this, Next.js might cache page output. All pages export `export const dynamic = "force-dynamic"` to ensure fresh data on every request.

9. **Class resources storage bucket.** Created as part of migration 010. If the bucket doesn't exist, file uploads will fail silently (storage error caught, returns user-facing error). Confirm the bucket exists in Supabase Dashboard → Storage before testing uploads.

10. **Course code normalization.** Both the review and resource forms normalize input (`"comp550"` → `"COMP 550"`). The department is always derived as the letter prefix (`"COMP"`). This normalization runs server-side in the action — the client form may display raw input until submit.
