# AKPD — Developer Guide

This guide gets you from zero to a running local environment and covers the key workflows and gotchas. For full architecture detail, see `HANDOFF.md`.

---

## Prerequisites

- **Node.js 20+**
- Access to the Supabase project (get credentials from an existing contributor)
- Three environment variables (see Local Setup below)

---

## Local Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/aranjaimancs/AKPD.git
   cd akpd-site
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` in `akpd-site/`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```
   Get these values from the Supabase Dashboard → Project Settings → API.

4. Start the dev server:
   ```bash
   npm run dev
   ```
   App runs at http://localhost:3000.

---

## Running Migrations

All SQL migrations live in `migrations/`. Run them in order via the Supabase Dashboard:

1. Open **Supabase Dashboard → SQL Editor → New query**
2. Paste the contents of each file and run, in order: `001` through `010`
3. All migrations are idempotent — safe to re-run if needed

| File | What it does |
|---|---|
| 001_members_rls.sql | members allowlist table + RLS |
| 002_people_table.sql | alumni directory table |
| 003_recruitment.sql | recruitment fields + resources |
| 004_seniors_table.sql | seniors admin metadata |
| 005_alumni_role_and_audience.sql | alumni role support |
| 006_add_missing_columns.sql | backfill across tables |
| 007_opportunities_approval.sql | opportunities + approval workflow |
| 008_class_reviews.sql | class reviews table |
| 009_people_email.sql | email column on people table |
| 010_class_resources.sql | class resources table + storage bucket |

---

## Key Workflows

### Adding a Member
1. Sign in as admin → navigate to `/admin/members`
2. Enter the person's email, full name, and role (member / alumni / admin)
3. Click **Add Member** — they can now sign in with that email

### Adding a Senior Profile
Senior profiles are **file-based**, not in the database:

1. Create the folder: `content/seniors/[slug]/`
2. Add `meta.json`:
   ```json
   {
     "name": "Jane Smith",
     "major": "Business Administration",
     "track": "Finance",
     "tags": ["Investment Banking", "PE"],
     "linkedin": "https://linkedin.com/in/janesmith",
     "classYear": 2025
   }
   ```
3. Add a headshot image (any common format: `.jpg`, `.png`, `.webp`)
4. Optionally add `profile.generated.json` for AI-generated bio fields
5. Add the slug to `src/data/seniors.json`:
   ```json
   ["existing-slug-1", "existing-slug-2", "jane-smith"]
   ```
6. The senior will appear at `/seniors` and `/seniors/jane-smith`

### Adding a New Page
1. Create `src/app/[route]/page.tsx`
2. Start with auth:
   ```ts
   import { requireMember } from "@/lib/auth"; // or requireAdmin
   export const dynamic = "force-dynamic";

   export default async function MyPage() {
     const member = await requireMember(); // redirects to /login or /not-authorized if unauthorized
     // fetch data and render
   }
   ```
3. Use `createAdminClient()` from `@/lib/supabase/admin` for all DB reads
4. For mutations, write a Server Action in `src/lib/actions/[domain].ts` using `useActionState` in the Client Component

---

## Common Gotchas

1. **Middleware ≠ authoritative auth.** Middleware reads JWT metadata for speed. It can be out of sync. Always call `requireMember()` or `requireAdmin()` at the top of every page Server Component — that's the real access gate.

2. **Seniors are file-based, not DB-driven.** The public `/seniors` page reads from `content/seniors/[slug]/` files and `src/data/seniors.json`. There is a `seniors` DB table (from migration 004) used only by the admin UI. Don't confuse the two.

3. **Alumni hard-redirect on `/recruitment` and `/classes`.** Both pages check `member.role === "alumni"` and call `redirect("/opportunities")` before any data fetch. This is intentional — alumni don't have access.

4. **Dark mode text rule.** Never use `color: var(--akp-navy)` for readable text — it stays dark regardless of theme. Use `var(--t-primary)` for any text that needs to flip in dark mode.

5. **Signed URLs expire in 60 seconds.** Recruitment and class resource downloads fetch a fresh signed URL on every click. Don't cache or pre-fetch these URLs.

6. **`createAdminClient()` is server-only.** It uses `SUPABASE_SERVICE_ROLE_KEY` and must never be called in a Client Component or passed to the browser.

7. **`force-dynamic` on all pages.** All pages export `export const dynamic = "force-dynamic"` to prevent Next.js from caching page output. Don't remove this.

8. **Class resources storage bucket.** Created by migration 010. If the bucket doesn't exist in Supabase → Storage, file uploads will fail silently. Confirm it exists before testing uploads.

---

## Directory Cheat Sheet

| Path | What lives here |
|---|---|
| `src/app/` | Next.js App Router pages (one folder per route) |
| `src/app/layout.tsx` | Root layout: Navbar, ThemeProvider |
| `src/lib/auth.ts` | `requireMember()`, `requireAdmin()`, `getCurrentMember()` |
| `src/lib/supabase/server.ts` | `createClient()` — user-scoped SSR client |
| `src/lib/supabase/admin.ts` | `createAdminClient()` — service role, server-only |
| `src/lib/actions/` | Server Actions, one file per domain |
| `src/components/` | Shared React components |
| `src/middleware.ts` | Session refresh + fast route protection |
| `content/seniors/` | File-based senior profiles (slug folders) |
| `src/data/seniors.json` | Senior slug index |
| `migrations/` | SQL migrations (001–010), run via Supabase Dashboard |
