# Invite System Design
**Date:** 2026-08-09  
**Status:** Approved

## Overview

A self-service invite flow for onboarding AKPsi Delta brothers and alumni. Admin generates a shareable link (valid 24 hours), pastes it in the group chat, members fill out their info, and admin approves them from the existing `/admin/members` panel. Approved members receive a Supabase invite email and proceed through password setup → onboarding.

---

## Database (Migration 013)

### `invite_links`
```sql
id          uuid        PK default gen_random_uuid()
token       uuid        UNIQUE default gen_random_uuid()
created_by  uuid        references auth.users(id)
expires_at  timestamptz not null
is_active   bool        not null default true
created_at  timestamptz not null default now()
```
- Only one link is ever active at a time
- Generating a new link sets `is_active = false` on all prior rows, inserts a fresh row with `expires_at = now() + interval '24 hours'`
- No RLS — all access via server actions using `createAdminClient()`

### `invite_requests`
```sql
id          uuid        PK default gen_random_uuid()
link_id     uuid        references invite_links(id) on delete cascade
full_name   text        not null
email       text        not null
role        text        not null  -- 'member' | 'alumni'
position    text                  -- nullable, e.g. "VP of Recruitment"
status      text        not null default 'pending'  -- 'pending' | 'approved' | 'rejected'
created_at  timestamptz not null default now()
```
- Unique constraint on `email` to prevent duplicate submissions
- RLS enabled but no user-facing policies — all access via admin client server actions

---

## Public Invite Page — `/invite/[token]`

### Route
- `src/app/invite/[token]/page.tsx` — Server Component
- Added to `PUBLIC_PREFIXES` in `src/middleware.ts` so unauthenticated users can access it

### Server-side validation
On every render, the server component:
1. Queries `invite_links` for the token where `is_active = true` AND `expires_at > now()`
2. If not found or expired → renders an error state: "This link has expired — ask your chapter admin for a new one."
3. If valid → renders the invite form. The token is bound into the server action via `bind` so it doesn't need to be a hidden field.

### Form fields
| Field | Type | Required | Notes |
|---|---|---|---|
| Full name | text | yes | |
| Email | email | yes | |
| Role | radio/select | yes | "Current Member" (→ `member`) or "Alumni" (→ `alumni`) |
| Position | text | no | Placeholder: "e.g. VP of Recruitment" |

### Submit — server action `submitInviteRequest(token, _prev, formData)`
1. Queries `invite_links` by token where `is_active = true` AND `expires_at > now()` — if not found, returns error (link expired between page load and submit)
2. Checks for duplicate email in `invite_requests` — if exists, returns error: "You've already submitted a request."
3. Inserts into `invite_requests` with the resolved `link_id` and `status: 'pending'`
4. Returns success state — page shows: "You're on the list! You'll get an email once an admin approves your request."

No redirect on success — inline confirmation message.

---

## Admin Panel — `/admin/members`

### Invite Link panel (new, top of page)
- Displays current link URL + time remaining (e.g. "Expires in 18 hrs"), or "No active link"
- **"Generate Link"** button (or **"Regenerate"** if one is active — warns the old link will die)
  - Server action `generateInviteLink`: deactivates all existing links, inserts new with 24hr expiry
  - Copies the generated URL to clipboard on the client
- All logic lives in `MembersClient.tsx` alongside existing member management UI

### Pending Requests section (new, between invite panel and member list)
- Only rendered when `invite_requests` with `status = 'pending'` exist
- Each row: name · email · role badge · position · "X mins ago"
- Per-row actions:
  - **Approve** → `approveInviteRequest(requestId)`:
    1. Inserts into `members` (email, full_name, position, role)
    2. Calls `admin.auth.admin.inviteUserByEmail(email)` — fires Supabase invite email
    3. Updates `invite_requests` row to `status: 'approved'`
    4. `revalidatePath("/admin/members")`
  - **Reject** → `rejectInviteRequest(requestId)`:
    1. Updates `invite_requests` row to `status: 'rejected'`
    2. No email sent
    3. `revalidatePath("/admin/members")`
- Approved/rejected rows vanish from the pending list immediately

---

## Email & Sign-in Flow

1. `approveInviteRequest` calls `admin.auth.admin.inviteUserByEmail(email)` — Supabase sends its native invite email
2. Person clicks the link → routed to `/auth/callback` with `token_hash` + `type=invite`
3. Existing callback handles this via `supabase.auth.verifyOtp({ token_hash, type: "invite" })`
4. Callback finds them in `members` allowlist (inserted at approval), links `auth_user_id`, upserts profile
5. Detects `isNewUser = true` (no `full_name` in profile yet) → redirects to `/onboarding`
6. Existing onboarding wizard completes their setup

### One-time Supabase Dashboard setup
- **Auth → Email Templates → Invite**: set redirect URL to `{{ .SiteURL }}/auth/callback`
- Optionally customize the invite email body to reference AKPsi Delta

---

## New Files

| File | Purpose |
|---|---|
| `migrations/013_invite_system.sql` | `invite_links` + `invite_requests` tables + RLS |
| `src/app/invite/[token]/page.tsx` | Public invite form page |
| `src/lib/actions/invites.ts` | `generateInviteLink`, `submitInviteRequest`, `approveInviteRequest`, `rejectInviteRequest` |

## Modified Files

| File | Change |
|---|---|
| `src/middleware.ts` | Add `/invite/` to `PUBLIC_PREFIXES` |
| `src/app/admin/members/page.tsx` | Fetch invite link + pending requests, pass to client |
| `src/app/admin/members/MembersClient.tsx` | Invite panel + pending requests UI |
| `HANDOFF.md` | Document the invite system |

---

## Constraints & Gotchas

- **One active link at a time.** Regenerating kills the previous link — anyone who saved the old URL will see "expired."
- **Duplicate email guard.** `submitInviteRequest` checks for existing requests before inserting — a person can't submit twice with the same email.
- **Email uniqueness in `members`.** `approveInviteRequest` will get a `23505` conflict if the email is already a member — handle gracefully with a user-facing error.
- **`inviteUserByEmail` is idempotent-ish.** If the person already has an auth account, Supabase may return an error or re-send. Handle the error and surface it to admin.
- **Migration number.** Migrations 011 and 012 are taken by recruitment subfolder work. This is **013**.
