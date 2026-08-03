# AKPD Systematic Testing Design
**Date:** 2026-08-02
**Goal:** Deployment-ready QA pass for 60+ brothers. Priority-tiered, fixes included, regression tests written for every failure found.

---

## Context

- **App:** AKPD member portal — Next.js 15 App Router + TypeScript + Tailwind CSS 4 + Supabase (Postgres, Auth, Storage)
- **Target:** Production Supabase instance, exec board members already seeded
- **Test data hygiene:** All test records use clearly labeled emails (e.g. `test-qa@akpd.unc.edu`). No destructive operations on real member records. Clean up test data after each tier.
- **Auth constraint:** App uses admin allowlist model — automated tools can only take over AFTER a session is manually established via the email invite flow.

---

## Structure

Priority-tiered. Each tier has a checkpoint — **do not proceed if blocking issues remain.**

| Tier | Area | Priority |
|------|------|----------|
| 1 | Auth & Onboarding | CRITICAL |
| 2 | Data Integrity & RLS | HIGH |
| 3 | Feature Coverage | HIGH |
| 4 | Performance & Deployment Readiness | HIGH |

---

## Failure Protocol

When any check fails:
1. Invoke `superpowers:systematic-debugging` — diagnose root cause before touching code
2. Apply fix
3. Invoke `superpowers:test-driven-development` — write a regression test that would have caught the bug
4. Re-run the tier check to confirm it passes
5. A fix is NOT done until there is a test covering it

---

## Tier 1 — Auth & Onboarding (CRITICAL)

### Phase 1A: Manual Setup (human-in-the-loop)
1. Admin adds `test-qa@[domain]` to allowlist via `/admin/members` — verify row exists in `members` table
2. Trigger password reset / invite email — confirm it arrives
3. Click email link → verify lands on `/auth/reset-password`, not a 404 or error screen
4. Set password → verify redirect goes to `/onboarding` (not `/people`) since profile is incomplete
5. Confirm `profiles` row exists for the new user (created by `on_auth_user_created` trigger)

### Phase 1B: Automated Post-Auth Tests
- Onboarding wizard: each step saves correctly to `profiles` table
- Skipping optional fields — wizard still completes without error
- Avatar upload → lands in `avatars` storage bucket, URL persists in `profiles.avatar_url`
- Completing wizard → `profiles.full_name` is non-null, redirect fires to `/people`
- Revisiting `/onboarding` after completion → immediately redirects away (no re-onboarding loop)
- Middleware: unauthenticated user hitting `/people` → redirected to `/login`
- Non-allowlisted email attempting login → lands on `/not-authorized` (not a crash)
- Password reset link reuse → returns a clear error, not a blank page

### Checkpoint 1
All Phase 1A and 1B checks must pass before proceeding to Tier 2.

---

## Tier 2 — Data Integrity & RLS

All checks via direct Supabase client scripts (`npx tsx`), authenticating as specific users.

- Member A cannot read/write Member B's `profiles` row
- Non-admin member JWT cannot insert into `members` table (service role only)
- Non-admin member hitting `/admin/*` routes server-side → `requireAdmin()` throws, redirects away
- Opportunities: member can post and edit their own post, cannot edit/delete another member's post
- Recruitment resources: member can only read — cannot upload or delete
- `avatars` bucket: member can only overwrite their own avatar path, not another member's
- Signed URLs for recruitment file downloads expire after ~60 seconds (test with a delayed fetch)
- Admin can access and mutate all records across all tables

### Checkpoint 2
All RLS checks must pass. Any policy gap is a blocking issue.

---

## Tier 3 — Feature Coverage

Functional pass/fail for every route. Each check: does it load, does it do its job, does it handle empty/edge states gracefully?

| Route | Checks |
|-------|--------|
| `/people` | Map loads, pins render, sidebar search/filter narrows results, fly-to fires on pin click |
| `/seniors` | Cards render, search + class filter narrows correctly, empty state handled |
| `/seniors/[slug]` | Detail page loads, headshot serves correctly from `/seniors-content/` route |
| `/opportunities` | Post form submits, new post appears in list, filters work, empty state handled |
| `/recruitment` | Fields and resources load, file download triggers a valid signed URL |
| `/settings` | Profile edits save to `profiles`, location geocodes via Nominatim, avatar updates |
| `/admin` | Stats render correctly, 4 management cards link to correct sub-routes |
| `/admin/members` | Add member persists, role toggle persists, remove member persists |
| `/admin/recruitment` | Add/edit/delete fields and resources all persist |
| `/admin/seniors` | List loads, edit navigates correctly, delete removes record |

### Checkpoint 3
Any route that fails to load or corrupts data is a blocking issue.

---

## Tier 4 — Performance & Deployment Readiness

- `npm run build` completes with zero errors
- `npm run compile` (tsc) passes with zero type errors
- `npm run lint` passes clean
- Key pages (people, seniors, opportunities) load under 3s on cold server start
- No "too many connections" Supabase errors under a simulated 10-tab load
- All environment variables used by the app are present and accounted for (audit `.env` against actual `process.env` reads in source)
- `force-dynamic` pages do not accidentally serve stale cached responses
- No console errors on any route in the browser

### Final Scorecard
Claude produces a go/no-go verdict:
- Tier 1–4: PASS / FAIL / WARN per check
- Blocking issues list (must fix before launch)
- Non-blocking warnings list (can ship, fix post-launch)
- Overall verdict: GO / NO-GO

---

## Skills Invoked During This Run

| Situation | Skill |
|-----------|-------|
| Writing any automated test | `superpowers:test-driven-development` |
| Any check fails | `superpowers:systematic-debugging` |
