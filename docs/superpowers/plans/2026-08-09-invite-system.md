# Invite System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin generates a 24-hour shareable invite link; invitees fill out a public form; admin approves requests from `/admin/members`; approved users receive a Supabase invite email and proceed through onboarding.

**Architecture:** Two new DB tables (`invite_links`, `invite_requests`) back four server actions. A public `/invite/[token]` page serves the form. The existing `/admin/members` page gets an invite panel and pending-requests section. Approval calls Supabase's native `inviteUserByEmail` which routes through the already-working `/auth/callback` invite flow.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + Auth), Tailwind CSS v4 design tokens, `useActionState` / `useTransition` per existing patterns.

## Global Constraints

- All DB access from server code uses `createAdminClient()` (service-role key, never browser-exposed)
- Every page Server Component exports `export const dynamic = "force-dynamic"`
- Server Actions use React 19 `useActionState` for form submissions, `useTransition` for non-form button calls
- Design tokens only — no raw hex colours except `#dc2626` (error red) and `#22c55e` (green linked dot) which match existing usage
- `revalidatePath("/admin/members")` at end of every mutating action
- Migration numbered **013** (011 and 012 are taken by recruitment subfolder work)
- Never call `createAdminClient()` from a Client Component

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `migrations/013_invite_system.sql` | Create | `invite_links` + `invite_requests` tables, indexes, RLS |
| `src/lib/actions/invites.ts` | Create | `generateInviteLink`, `submitInviteRequest`, `approveInviteRequest`, `rejectInviteRequest` |
| `src/app/invite/[token]/page.tsx` | Create | Public invite form page (Server Component + Client form) |
| `src/middleware.ts` | Modify | Add `/invite/` to `PUBLIC_PREFIXES` |
| `src/app/admin/members/page.tsx` | Modify | Fetch `activeLink` + `pendingRequests`, pass to `MembersClient` |
| `src/app/admin/members/MembersClient.tsx` | Modify | Add `InvitePanel` + `PendingRequests` sections at top |
| `tests/qa/tier4-invite-system.ts` | Create | QA tests covering the full invite flow |
| `HANDOFF.md` | Modify | Document invite system |

---

## Task 1: Migration + Server Actions

**Files:**
- Create: `migrations/013_invite_system.sql`
- Create: `src/lib/actions/invites.ts`

**Interfaces:**
- Produces:
  - `InviteLink` type
  - `InviteRequest` type
  - `InviteFormState` type
  - `generateInviteLink(): Promise<{ token?: string; error?: string }>`
  - `submitInviteRequest(token: string, _prev: InviteFormState, formData: FormData): Promise<InviteFormState>`
  - `approveInviteRequest(requestId: string): Promise<{ error?: string }>`
  - `rejectInviteRequest(requestId: string): Promise<{ error?: string }>`

- [ ] **Step 1: Write the migration**

Create `migrations/013_invite_system.sql`:

```sql
-- ============================================================
-- AKPD · Migration 013 — Invite system
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (IF NOT EXISTS guards throughout)
-- ============================================================

-- ── 1. invite_links ─────────────────────────────────────────

create table if not exists public.invite_links (
  id          uuid        primary key default gen_random_uuid(),
  token       uuid        not null unique default gen_random_uuid(),
  created_by  uuid        references auth.users(id) on delete set null,
  expires_at  timestamptz not null,
  is_active   bool        not null default true,
  created_at  timestamptz not null default now()
);

-- ── 2. invite_requests ──────────────────────────────────────

create table if not exists public.invite_requests (
  id          uuid        primary key default gen_random_uuid(),
  link_id     uuid        references public.invite_links(id) on delete cascade,
  full_name   text        not null,
  email       text        not null,
  role        text        not null check (role in ('member', 'alumni')),
  position    text,
  status      text        not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now()
);

create unique index if not exists invite_requests_email_unique
  on public.invite_requests(lower(email));

create index if not exists idx_invite_requests_link_id
  on public.invite_requests(link_id);

create index if not exists idx_invite_requests_status
  on public.invite_requests(status);

-- ── 3. RLS ──────────────────────────────────────────────────
-- Both tables are accessed exclusively via createAdminClient()
-- server-side. RLS is enabled as a safety net with no user
-- policies — no authenticated user can query these tables
-- directly from the browser.

alter table public.invite_links    enable row level security;
alter table public.invite_requests enable row level security;
```

- [ ] **Step 2: Run the migration**

In Supabase Dashboard → SQL Editor → New query, paste and run the contents of `migrations/013_invite_system.sql`. Verify both tables appear in Table Editor.

- [ ] **Step 3: Write `src/lib/actions/invites.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type InviteLink = {
  id: string;
  token: string;
  created_by: string | null;
  expires_at: string;
  is_active: boolean;
  created_at: string;
};

export type InviteRequest = {
  id: string;
  link_id: string;
  full_name: string;
  email: string;
  role: "member" | "alumni";
  position: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type InviteFormState = { error?: string; success?: boolean };

// ── generateInviteLink ────────────────────────────────────────────────────────

export async function generateInviteLink(): Promise<{
  token?: string;
  error?: string;
}> {
  await requireAdmin();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const db = createAdminClient();

  // Deactivate all existing links
  await db.from("invite_links").update({ is_active: false }).eq("is_active", true);

  // Insert new link expiring in 24 hours
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("invite_links")
    .insert({ created_by: user?.id ?? null, expires_at: expiresAt })
    .select("token")
    .single();

  if (error || !data) {
    console.error("generateInviteLink error:", error?.message);
    return { error: "Failed to generate link. Please try again." };
  }

  revalidatePath("/admin/members");
  return { token: data.token as string };
}

// ── submitInviteRequest ───────────────────────────────────────────────────────

export async function submitInviteRequest(
  token: string,
  _prev: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  const db = createAdminClient();

  // Re-validate the token is still active and not expired
  const { data: link } = await db
    .from("invite_links")
    .select("id")
    .eq("token", token)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!link) {
    return { error: "This invite link has expired. Ask your chapter admin for a new one." };
  }

  const full_name = (formData.get("full_name") as string)?.trim();
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const role = formData.get("role") as string;
  const position = (formData.get("position") as string)?.trim() || null;

  if (!full_name) return { error: "Full name is required." };
  if (!email || !email.includes("@")) return { error: "A valid email is required." };
  if (!["member", "alumni"].includes(role)) return { error: "Please select a role." };

  const { error } = await db.from("invite_requests").insert({
    link_id: link.id,
    full_name,
    email,
    role,
    position,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You've already submitted a request with that email." };
    }
    console.error("submitInviteRequest error:", error.message);
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

// ── approveInviteRequest ──────────────────────────────────────────────────────

export async function approveInviteRequest(
  requestId: string
): Promise<{ error?: string }> {
  await requireAdmin();

  const db = createAdminClient();

  const { data: req } = await db
    .from("invite_requests")
    .select("id, full_name, email, role, position")
    .eq("id", requestId)
    .maybeSingle();

  if (!req) return { error: "Request not found." };

  // Insert into members allowlist
  const { error: memberError } = await db.from("members").insert({
    email: req.email,
    full_name: req.full_name,
    position: req.position,
    role: req.role,
  });

  if (memberError) {
    if (memberError.code === "23505") {
      // Already a member — still mark as approved so it clears the queue
      await db
        .from("invite_requests")
        .update({ status: "approved" })
        .eq("id", requestId);
      revalidatePath("/admin/members");
      return { error: `${req.email} is already a member. Request cleared.` };
    }
    console.error("approveInviteRequest insert member error:", memberError.message);
    return { error: "Failed to add member. Please try again." };
  }

  // Send Supabase invite email
  const { error: inviteError } = await db.auth.admin.inviteUserByEmail(req.email);
  if (inviteError) {
    // Non-fatal — member was added. Surface a warning but don't block.
    console.error("approveInviteRequest inviteUserByEmail error:", inviteError.message);
    await db.from("invite_requests").update({ status: "approved" }).eq("id", requestId);
    revalidatePath("/admin/members");
    return {
      error: `${req.email} added as member, but invite email failed: ${inviteError.message}. You may need to set their password manually.`,
    };
  }

  await db.from("invite_requests").update({ status: "approved" }).eq("id", requestId);
  revalidatePath("/admin/members");
  return {};
}

// ── rejectInviteRequest ───────────────────────────────────────────────────────

export async function rejectInviteRequest(
  requestId: string
): Promise<{ error?: string }> {
  await requireAdmin();

  const db = createAdminClient();
  const { error } = await db
    .from("invite_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  if (error) {
    console.error("rejectInviteRequest error:", error.message);
    return { error: "Failed to reject request." };
  }

  revalidatePath("/admin/members");
  return {};
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd akpd-site && npx tsc --noEmit
```

Expected: no errors. If there are import errors for `createClient` or `requireAdmin`, check that the import paths match exactly what's in `src/lib/supabase/server.ts` and `src/lib/auth.ts`.

- [ ] **Step 5: Commit**

```bash
git add migrations/013_invite_system.sql src/lib/actions/invites.ts
git commit -m "feat: add invite system migration and server actions"
```

---

## Task 2: Middleware Patch + Public Invite Page

**Files:**
- Modify: `src/middleware.ts` (line 5 — `PUBLIC_PREFIXES` array)
- Create: `src/app/invite/[token]/page.tsx`

**Interfaces:**
- Consumes: `submitInviteRequest(token, _prev, formData)` from `@/lib/actions/invites`
- Consumes: `InviteFormState` from `@/lib/actions/invites`

- [ ] **Step 1: Patch middleware**

In `src/middleware.ts`, change line 5 from:

```ts
const PUBLIC_PREFIXES = ["/login", "/auth/", "/not-authorized"];
```

to:

```ts
const PUBLIC_PREFIXES = ["/login", "/auth/", "/not-authorized", "/invite/"];
```

- [ ] **Step 2: Create the invite page**

Create `src/app/invite/[token]/page.tsx`:

```tsx
import { createAdminClient } from "@/lib/supabase/admin";
import InviteForm from "./InviteForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const db = createAdminClient();

  const { data: link } = await db
    .from("invite_links")
    .select("id")
    .eq("token", token)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--s-page)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {/* Header */}
        <div
          className="px-8 py-6"
          style={{
            background: "var(--akp-navy)",
            borderRadius: "1rem 1rem 0 0",
          }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-1"
            style={{ color: "var(--akp-gold)" }}
          >
            Alpha Kappa Psi · Delta Chapter
          </p>
          <h1
            className="text-xl font-bold"
            style={{ color: "#fff", fontFamily: "var(--font-display)" }}
          >
            Join the Member Portal
          </h1>
        </div>

        {/* Body */}
        <div className="p-8">
          {!link ? (
            <div className="text-center py-4">
              <p
                className="text-base font-semibold mb-2"
                style={{ color: "var(--t-primary)" }}
              >
                This link has expired.
              </p>
              <p className="text-sm" style={{ color: "var(--t-muted)" }}>
                Ask your chapter admin to generate a new invite link.
              </p>
            </div>
          ) : (
            <InviteForm token={token} />
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create the client form component**

Create `src/app/invite/[token]/InviteForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { submitInviteRequest, type InviteFormState } from "@/lib/actions/invites";

export default function InviteForm({ token }: { token: string }) {
  const boundAction = submitInviteRequest.bind(null, token);
  const [state, action, pending] = useActionState<InviteFormState, FormData>(
    boundAction,
    {}
  );

  if (state.success) {
    return (
      <div className="text-center py-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl mx-auto mb-4"
          style={{
            background: "rgba(201,168,76,0.15)",
            color: "var(--akp-gold)",
          }}
        >
          ✓
        </div>
        <p
          className="text-base font-semibold mb-2"
          style={{ color: "var(--t-primary)" }}
        >
          You&apos;re on the list!
        </p>
        <p className="text-sm" style={{ color: "var(--t-muted)" }}>
          You&apos;ll receive an email once an admin approves your request.
          Check your spam folder if you don&apos;t see it within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <p className="text-sm" style={{ color: "var(--t-muted)" }}>
        Fill in your info below. An admin will review and send you an email
        to finish setting up your account.
      </p>

      {/* Full name */}
      <div className="flex flex-col gap-1.5">
        <label className="input-label">Full name *</label>
        <input
          name="full_name"
          type="text"
          required
          placeholder="Jane Smith"
          className="input"
          autoFocus
        />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label className="input-label">Email *</label>
        <input
          name="email"
          type="email"
          required
          placeholder="jane@unc.edu"
          className="input"
        />
      </div>

      {/* Role */}
      <div className="flex flex-col gap-1.5">
        <label className="input-label">I am a… *</label>
        <select name="role" required defaultValue="" className="input">
          <option value="" disabled>Select one</option>
          <option value="member">Current Member</option>
          <option value="alumni">Alumni</option>
        </select>
      </div>

      {/* Position */}
      <div className="flex flex-col gap-1.5">
        <label className="input-label">Position / title</label>
        <input
          name="position"
          type="text"
          placeholder="e.g. VP of Recruitment"
          className="input"
        />
      </div>

      {state.error && (
        <p className="text-sm" style={{ color: "#dc2626" }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Request Access"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd akpd-site && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke-test the invite page locally**

```bash
npm run dev
```

In Supabase Dashboard → SQL Editor, run:

```sql
insert into public.invite_links (expires_at)
values (now() + interval '24 hours')
returning token;
```

Copy the returned token UUID. Visit `http://localhost:3000/invite/<token>`. You should see the form. Submit it. Check Supabase Table Editor → `invite_requests` for the new row with `status = 'pending'`.

Then test the expired path: run:

```sql
insert into public.invite_links (expires_at, is_active)
values (now() - interval '1 hour', true)
returning token;
```

Visit `http://localhost:3000/invite/<expired-token>` — should show the expired message.

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts src/app/invite/[token]/page.tsx src/app/invite/[token]/InviteForm.tsx
git commit -m "feat: add public invite form page at /invite/[token]"
```

---

## Task 3: Admin UI — Invite Panel + Pending Requests

**Files:**
- Modify: `src/app/admin/members/page.tsx`
- Modify: `src/app/admin/members/MembersClient.tsx`

**Interfaces:**
- Consumes from Task 1:
  - `InviteLink`, `InviteRequest` types from `@/lib/actions/invites`
  - `generateInviteLink()`, `approveInviteRequest(id)`, `rejectInviteRequest(id)` from `@/lib/actions/invites`
- `MembersClient` new props: `activeLink: InviteLink | null`, `pendingRequests: InviteRequest[]`

- [ ] **Step 1: Update `page.tsx` to fetch invite data**

Replace the contents of `src/app/admin/members/page.tsx` with:

```tsx
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/auth";
import type { InviteLink, InviteRequest } from "@/lib/actions/invites";
import MembersClient from "./MembersClient";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const [{ data: members }, { data: linkData }, { data: requestData }] =
    await Promise.all([
      admin
        .from("members")
        .select("id, email, full_name, position, role, auth_user_id, created_at")
        .order("role", { ascending: true })
        .order("full_name", { ascending: true }),
      admin
        .from("invite_links")
        .select("id, token, created_by, expires_at, is_active, created_at")
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("invite_requests")
        .select("id, link_id, full_name, email, role, position, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
    ]);

  return (
    <main className="flex-1" style={{ background: "var(--s-page)", minHeight: "100vh" }}>
      {/* ── Breadcrumb bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-2">
          <a href="/admin" className="text-[13px] transition-opacity hover:opacity-70" style={{ color: "var(--t-muted)" }}>Admin</a>
          <span style={{ color: "var(--b-strong)" }}>/</span>
          <span className="text-[13px] font-semibold" style={{ color: "var(--t-primary)" }}>Members</span>
          <span className="ml-auto text-[12px]" style={{ color: "var(--t-faint)" }}>
            {(members ?? []).length} total · {(members ?? []).filter((m) => m.role === "member").length} students · {(members ?? []).filter((m) => m.role === "alumni").length} alumni · {(members ?? []).filter((m) => m.role === "admin").length} admin{(members ?? []).filter((m) => m.role === "admin").length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <MembersClient
          members={(members ?? []) as Member[]}
          currentEmail={user?.email ?? ""}
          activeLink={(linkData as InviteLink | null) ?? null}
          pendingRequests={(requestData ?? []) as InviteRequest[]}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add `InvitePanel` component to `MembersClient.tsx`**

At the top of `MembersClient.tsx`, add the new imports alongside the existing ones:

```ts
import { generateInviteLink, approveInviteRequest, rejectInviteRequest } from "@/lib/actions/invites";
import type { InviteLink, InviteRequest } from "@/lib/actions/invites";
```

Then add the `InvitePanel` component before the `MemberRow` function (around line 792):

```tsx
// ── Invite Panel ──────────────────────────────────────────────────────────────

function InvitePanel({ activeLink }: { activeLink: InviteLink | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const siteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${activeLink?.token ?? ""}`
      : "";

  const expiresIn = activeLink
    ? Math.max(
        0,
        Math.round(
          (new Date(activeLink.expires_at).getTime() - Date.now()) / (1000 * 60 * 60)
        )
      )
    : 0;

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateInviteLink();
      if (result.error) {
        setError(result.error);
      } else if (result.token) {
        const url = `${window.location.origin}/invite/${result.token}`;
        navigator.clipboard.writeText(url).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(siteUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div
      className="rounded-2xl p-5 mb-6"
      style={{
        background: "var(--s-0)",
        border: "1px solid var(--b-default)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-[14px] font-bold"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            Invite Link
          </h2>
          {activeLink ? (
            <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>
              Active · expires in {expiresIn} hr{expiresIn !== 1 ? "s" : ""}
            </p>
          ) : (
            <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>
              No active link — generate one to onboard members.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeLink && (
            <button
              onClick={copyLink}
              className="btn btn-ghost btn-sm"
              disabled={isPending}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          )}
          <button
            onClick={generate}
            disabled={isPending}
            className="btn btn-primary btn-sm disabled:opacity-50"
          >
            {isPending
              ? "Generating…"
              : activeLink
              ? "Regenerate"
              : "Generate Link"}
          </button>
        </div>
      </div>

      {activeLink && (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-[11px] font-mono truncate"
          style={{
            background: "var(--s-1)",
            color: "var(--t-secondary)",
            border: "1px solid var(--b-subtle)",
          }}
        >
          {siteUrl}
        </div>
      )}

      {copied && !activeLink && (
        <p className="text-[12px] mt-2" style={{ color: "var(--akp-gold)" }}>
          Link copied to clipboard!
        </p>
      )}

      {error && (
        <p className="text-[12px] mt-2" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add `PendingRequests` component to `MembersClient.tsx`**

Add this component immediately after `InvitePanel`:

```tsx
// ── Pending Requests ──────────────────────────────────────────────────────────

function PendingRequests({ requests }: { requests: InviteRequest[] }) {
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (requests.length === 0) return null;

  function approve(id: string) {
    setErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    startTransition(async () => {
      const result = await approveInviteRequest(id);
      if (result.error) {
        setErrors((prev) => ({ ...prev, [id]: result.error! }));
      }
    });
  }

  function reject(id: string) {
    if (!confirm("Reject this request?")) return;
    setErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    startTransition(async () => {
      const result = await rejectInviteRequest(id);
      if (result.error) {
        setErrors((prev) => ({ ...prev, [id]: result.error! }));
      }
    });
  }

  function timeAgo(iso: string) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  return (
    <div
      className="rounded-2xl overflow-hidden mb-6"
      style={{
        background: "var(--s-0)",
        border: "1px solid var(--b-default)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{ background: "var(--s-1)", borderBottom: "1px solid var(--b-subtle)" }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--t-muted)" }}
        >
          Pending Requests
        </span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{
            background: "rgba(201,168,76,0.15)",
            color: "var(--akp-gold)",
          }}
        >
          {requests.length}
        </span>
      </div>

      <table className="w-full">
        <tbody>
          {requests.map((req) => (
            <tr
              key={req.id}
              className="border-t"
              style={{ borderColor: "var(--b-default)" }}
            >
              <td className="px-4 py-3.5">
                <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                  {req.full_name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--t-muted)" }}>
                  {req.email}
                  {req.position ? ` · ${req.position}` : ""}
                </p>
                {errors[req.id] && (
                  <p className="text-xs mt-1" style={{ color: "#dc2626" }}>
                    {errors[req.id]}
                  </p>
                )}
              </td>

              <td className="px-4 py-3.5 hidden sm:table-cell">
                <span
                  className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={
                    req.role === "alumni"
                      ? { background: "rgba(168,85,247,0.10)", color: "#c084fc" }
                      : { background: "var(--s-1)", color: "var(--t-secondary)", border: "1px solid var(--b-default)" }
                  }
                >
                  {req.role}
                </span>
              </td>

              <td
                className="px-4 py-3.5 text-right text-[11px] hidden md:table-cell"
                style={{ color: "var(--t-faint)" }}
              >
                {timeAgo(req.created_at)}
              </td>

              <td className="px-4 py-3.5">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => reject(req.id)}
                    disabled={isPending}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-30"
                    style={{ color: "#dc2626" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.06)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "transparent")
                    }
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => approve(req.id)}
                    disabled={isPending}
                    className="btn btn-primary btn-sm disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Wire the new props into `MembersClient`**

Update the `MembersClient` function signature and render to accept and use the new props. Find the existing export (around line 934):

```tsx
// BEFORE:
export default function MembersClient({
  members,
  currentEmail,
}: {
  members: Member[];
  currentEmail: string;
}) {
```

Change to:

```tsx
export default function MembersClient({
  members,
  currentEmail,
  activeLink,
  pendingRequests,
}: {
  members: Member[];
  currentEmail: string;
  activeLink: InviteLink | null;
  pendingRequests: InviteRequest[];
}) {
```

Then inside the return statement, add `<InvitePanel>` and `<PendingRequests>` before the existing toolbar `<div>`. Find the line `{/* Toolbar */}` and insert before it:

```tsx
      <InvitePanel activeLink={activeLink} />
      <PendingRequests requests={pendingRequests} />

      {/* Toolbar */}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd akpd-site && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Smoke-test the admin UI**

```bash
npm run dev
```

Sign in as an admin. Visit `/admin/members`. You should see:
1. The **Invite Link** panel at the top (showing "No active link")
2. Click "Generate Link" — panel updates with the link URL + time remaining, copies to clipboard
3. Submit a test invite request via the invite URL (from Task 2 smoke test)
4. Refresh `/admin/members` — the **Pending Requests** section appears with the submission
5. Click "Approve" — row disappears, check Supabase Table Editor → `members` for the new row and `invite_requests` for `status = 'approved'`
6. Click "Reject" on another test request — row disappears, `invite_requests` shows `status = 'rejected'`

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/members/page.tsx src/app/admin/members/MembersClient.tsx
git commit -m "feat: add invite panel and pending requests to admin members page"
```

---

## Task 4: QA Tests + HANDOFF Update

**Files:**
- Create: `tests/qa/tier4-invite-system.ts`
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: Supabase admin client (same pattern as existing QA tiers)

- [ ] **Step 1: Write QA tests**

Create `tests/qa/tier4-invite-system.ts`:

```ts
/**
 * Tier 4 — Invite System automated checks
 * Run: npx tsx --env-file=.env.local tests/qa/tier4-invite-system.ts
 *
 * Covers:
 *  1. generateInviteLink deactivates prior links and creates a new one
 *  2. submitInviteRequest inserts a pending row
 *  3. submitInviteRequest rejects duplicate email
 *  4. submitInviteRequest rejects expired/inactive token
 *  5. approveInviteRequest adds to members + marks approved
 *  6. rejectInviteRequest marks rejected, no member row created
 *  7. invite_links with is_active=false not returned by active query
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
const failures: string[] = [];

function pass(name: string) {
  console.log(`  ✅ PASS: ${name}`);
  passed++;
}

function fail(name: string, reason: string) {
  console.error(`  ❌ FAIL: ${name}`);
  console.error(`         Reason: ${reason}`);
  failed++;
  failures.push(`${name}: ${reason}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function createTestLink(overrides: {
  is_active?: boolean;
  expires_at?: string;
} = {}): Promise<{ id: string; token: string }> {
  const { data, error } = await db
    .from("invite_links")
    .insert({
      expires_at: overrides.expires_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      is_active: overrides.is_active ?? true,
    })
    .select("id, token")
    .single();
  if (error || !data) throw new Error(`createTestLink failed: ${error?.message}`);
  return data as { id: string; token: string };
}

async function cleanup(emails: string[]) {
  for (const email of emails) {
    await db.from("invite_requests").delete().eq("email", email);
    await db.from("members").delete().eq("email", email);
  }
  await db.from("invite_links").delete().eq("is_active", false);
}

// ── Test 1: generateInviteLink deactivates prior links ─────────────────────────

async function testGenerateLinkDeactivatesPrior() {
  const name = "generateInviteLink deactivates prior links and creates new one";
  try {
    // Insert a prior active link
    const { data: prior } = await db
      .from("invite_links")
      .insert({ expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString() })
      .select("id")
      .single();

    // Simulate the action: deactivate all, insert new
    await db.from("invite_links").update({ is_active: false }).eq("is_active", true);
    const { data: newLink } = await db
      .from("invite_links")
      .insert({ expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
      .select("id, token, is_active")
      .single();

    // Prior link should now be inactive
    const { data: priorCheck } = await db
      .from("invite_links")
      .select("is_active")
      .eq("id", prior!.id)
      .single();

    if (priorCheck?.is_active !== false) {
      fail(name, "Prior link was not deactivated");
      return;
    }
    if (!newLink?.token) {
      fail(name, "New link has no token");
      return;
    }
    if (newLink.is_active !== true) {
      fail(name, "New link is not active");
      return;
    }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  }
}

// ── Test 2: submitInviteRequest inserts pending row ────────────────────────────

async function testSubmitInviteRequest() {
  const name = "submitInviteRequest inserts pending invite_request row";
  const email = `akpd-qa-invite-submit-${Date.now()}@example.com`;
  try {
    const link = await createTestLink();

    const { error } = await db.from("invite_requests").insert({
      link_id: link.id,
      full_name: "QA Test User",
      email,
      role: "member",
      position: "VP of QA",
    });

    if (error) { fail(name, error.message); return; }

    const { data } = await db
      .from("invite_requests")
      .select("status")
      .eq("email", email)
      .single();

    if (data?.status !== "pending") {
      fail(name, `Expected status 'pending', got '${data?.status}'`);
      return;
    }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  } finally {
    await cleanup([email]);
  }
}

// ── Test 3: Duplicate email rejected ──────────────────────────────────────────

async function testDuplicateEmailRejected() {
  const name = "submitInviteRequest rejects duplicate email (unique constraint)";
  const email = `akpd-qa-invite-dup-${Date.now()}@example.com`;
  try {
    const link = await createTestLink();

    await db.from("invite_requests").insert({
      link_id: link.id,
      full_name: "QA First",
      email,
      role: "member",
    });

    const { error } = await db.from("invite_requests").insert({
      link_id: link.id,
      full_name: "QA Second",
      email,
      role: "alumni",
    });

    if (!error || error.code !== "23505") {
      fail(name, `Expected unique constraint violation (23505), got: ${error?.code ?? "no error"}`);
      return;
    }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  } finally {
    await cleanup([email]);
  }
}

// ── Test 4: Expired token not returned ────────────────────────────────────────

async function testExpiredTokenNotReturned() {
  const name = "Expired invite link not returned by active query";
  try {
    const expiredLink = await createTestLink({
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    const { data } = await db
      .from("invite_links")
      .select("id")
      .eq("token", expiredLink.token)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (data !== null) {
      fail(name, "Expired link was returned by active query");
      return;
    }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  }
}

// ── Test 5: approveInviteRequest adds to members + marks approved ──────────────

async function testApproveAddsToMembers() {
  const name = "approveInviteRequest adds email to members and marks approved";
  const email = `akpd-qa-invite-approve-${Date.now()}@example.com`;
  try {
    const link = await createTestLink();
    const { data: req } = await db
      .from("invite_requests")
      .insert({
        link_id: link.id,
        full_name: "QA Approve Test",
        email,
        role: "member",
        position: "QA Officer",
      })
      .select("id")
      .single();

    // Simulate approve: insert to members + update status
    await db.from("members").insert({
      email,
      full_name: "QA Approve Test",
      position: "QA Officer",
      role: "member",
    });
    await db.from("invite_requests").update({ status: "approved" }).eq("id", req!.id);

    const { data: memberRow } = await db
      .from("members")
      .select("email, role")
      .eq("email", email)
      .maybeSingle();

    const { data: reqRow } = await db
      .from("invite_requests")
      .select("status")
      .eq("id", req!.id)
      .single();

    if (!memberRow) { fail(name, "Member row not found after approval"); return; }
    if (memberRow.role !== "member") { fail(name, `Expected role 'member', got '${memberRow.role}'`); return; }
    if (reqRow?.status !== "approved") { fail(name, `Expected status 'approved', got '${reqRow?.status}'`); return; }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  } finally {
    await cleanup([email]);
  }
}

// ── Test 6: rejectInviteRequest marks rejected, no member row ─────────────────

async function testRejectNoMemberRow() {
  const name = "rejectInviteRequest marks rejected and does not add to members";
  const email = `akpd-qa-invite-reject-${Date.now()}@example.com`;
  try {
    const link = await createTestLink();
    const { data: req } = await db
      .from("invite_requests")
      .insert({
        link_id: link.id,
        full_name: "QA Reject Test",
        email,
        role: "alumni",
      })
      .select("id")
      .single();

    await db.from("invite_requests").update({ status: "rejected" }).eq("id", req!.id);

    const { data: memberRow } = await db
      .from("members")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const { data: reqRow } = await db
      .from("invite_requests")
      .select("status")
      .eq("id", req!.id)
      .single();

    if (memberRow) { fail(name, "Rejected request added to members table"); return; }
    if (reqRow?.status !== "rejected") { fail(name, `Expected status 'rejected', got '${reqRow?.status}'`); return; }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  } finally {
    await cleanup([email]);
  }
}

// ── Test 7: Inactive link not returned ────────────────────────────────────────

async function testInactiveLinkNotReturned() {
  const name = "Inactive invite link not returned by active query";
  try {
    const inactiveLink = await createTestLink({ is_active: false });

    const { data } = await db
      .from("invite_links")
      .select("id")
      .eq("token", inactiveLink.token)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (data !== null) {
      fail(name, "Inactive link was returned by active query");
      return;
    }
    pass(name);
  } catch (e) {
    fail(name, String(e));
  }
}

// ── Runner ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔍 Tier 4 — Invite System\n");

  await testGenerateLinkDeactivatesPrior();
  await testSubmitInviteRequest();
  await testDuplicateEmailRejected();
  await testExpiredTokenNotReturned();
  await testApproveAddsToMembers();
  await testRejectNoMemberRow();
  await testInactiveLinkNotReturned();

  console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.error("\nFailures:");
    failures.forEach((f) => console.error(`  · ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the QA tests**

```bash
cd akpd-site && npx tsx --env-file=.env.local tests/qa/tier4-invite-system.ts
```

Expected: 7 tests pass. If any fail, the test output tells you exactly which assertion broke.

- [ ] **Step 3: Update HANDOFF.md**

In `HANDOFF.md`, under the **Migrations Log** table, add the new row:

```
| 013 | `013_invite_system.sql` | invite_links + invite_requests tables for self-service onboarding |
```

Under **Pages & Features**, add a new section after `/admin/opportunities`:

```markdown
### Invite System
Admin generates a 24-hour shareable invite link from `/admin/members` (Invite Link panel). Anyone with the link visits `/invite/[token]`, fills in name/email/role/position. Submissions land in `invite_requests` as `pending`. Admin approves or rejects from the Pending Requests panel in `/admin/members`. Approval inserts the person into `members` and fires a Supabase invite email (`auth.admin.inviteUserByEmail`). Person clicks the email link → `/auth/callback` (existing token_hash invite flow) → onboarding.

**Regenerating the link** deactivates the old one immediately — anyone with the old URL sees "This link has expired."
```

Under **Things to Know / Gotchas**, add:

```markdown
11. **Invite email requires Supabase SMTP configured.** `inviteUserByEmail` uses Supabase's built-in email relay. In the Supabase Dashboard → Auth → Email Templates → Invite, set the redirect URL to `{{ .SiteURL }}/auth/callback`. If the email relay is not configured, approval will succeed (member row is inserted) but the invite email will fail — the admin will see an error and can use "Set PW" as a fallback.

12. **One active invite link at a time.** Generating a new link deactivates all prior links. Old URLs return the expired message immediately.
```

- [ ] **Step 4: Commit**

```bash
git add tests/qa/tier4-invite-system.ts HANDOFF.md
git commit -m "feat: add QA tests for invite system and update HANDOFF"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Admin generates shareable link (Task 3 — `InvitePanel`, `generateInviteLink`)
- ✅ 24-hour expiry (migration `expires_at`, all queries include `gt("expires_at", now)`)
- ✅ Regenerating deactivates old link (`generateInviteLink` sets `is_active=false` on all prior)
- ✅ Public form — name, email, role (member/alumni), position (Task 2 — `InviteForm`)
- ✅ Can't choose admin role (select only offers `member`/`alumni`)
- ✅ Duplicate email guard (unique index on `lower(email)`, `23505` handling in action + test)
- ✅ Token re-validated on submit (Task 1 — `submitInviteRequest` re-queries DB)
- ✅ Pending requests in admin panel (Task 3 — `PendingRequests`)
- ✅ Approve: inserts to `members` + fires `inviteUserByEmail` (Task 1)
- ✅ Reject: marks `rejected`, no member row (Task 1 + test 6)
- ✅ Invite email → `/auth/callback` → existing token_hash flow → onboarding (spec, no code change needed)
- ✅ Middleware allows `/invite/` unauthenticated (Task 2)
- ✅ Already-a-member edge case handled gracefully (Task 1 — `23505` in `approveInviteRequest`)
- ✅ `inviteUserByEmail` failure is non-fatal, surfaces warning (Task 1)

**Type consistency:**
- `InviteLink`, `InviteRequest`, `InviteFormState` defined once in `invites.ts`, imported everywhere
- `submitInviteRequest(token, _prev, formData)` — matches `.bind(null, token)` usage in `InviteForm`
- `approveInviteRequest(requestId)` / `rejectInviteRequest(requestId)` — string IDs, matches `req.id` usage in `PendingRequests`
