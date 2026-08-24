# Member Recruitment Submissions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any active member (non-alumni) to propose recruitment fields and contribute resource batches, both gated by admin approval before going live.

**Architecture:** Add `status` + `proposed_by` to `recruitment_fields`, a new `recruitment_batches` table, and `batch_id` + `status` to resources/subfolders. All authorization is enforced in server actions via `getCurrentMember()` (same pattern as existing code). The `/recruitment` page gains a JS-side filter for `status === 'live'`; pending member content is fetched separately and shown only to its author.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + Storage), Tailwind CSS 4, React 19 Server Components + Server Actions, `createAdminClient()` (service role, bypasses RLS).

## Global Constraints

- All server actions must call `getCurrentMember()` and check role before touching the DB — never trust client-provided identity.
- Alumni (`member.role === 'alumni'`) must never see or access contribution UI.
- Use `createAdminClient()` for all DB writes (same as existing actions) — no RLS policy changes needed.
- `revalidatePath('/recruitment')` and `revalidatePath('/admin/recruitment')` after every mutation that affects either page.
- Design tokens: `var(--akp-gold)`, `var(--t-primary)`, `var(--t-muted)`, `var(--s-0)`, `var(--s-1)`, `var(--b-default)`, `var(--b-subtle)` — never hardcode colors.
- Button classes: `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`; card: `.card`; badge: `.badge`, `.badge-neutral`, `.badge-navy`, `.pill`.
- No new npm packages.
- `AGENTS.md` says: read `node_modules/next/dist/docs/` before writing Next.js code if unsure.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `migrations/014_member_recruitment_submissions.sql` | Create | DB schema changes |
| `src/lib/actions/recruitment.ts` | Modify | All new types + server actions (member + admin) |
| `src/app/recruitment/page.tsx` | Modify | Add status='live' filter; load member submissions |
| `src/app/recruitment/RecruitmentClient.tsx` | Modify | Propose + Contribute buttons; member proposals section |
| `src/app/recruitment/ProposeFieldModal.tsx` | Create | Modal for members to propose a new field |
| `src/app/recruitment/ContributeBatchEditor.tsx` | Create | Batch editor modal (add/remove resources; submit/withdraw) |
| `src/app/admin/recruitment/page.tsx` | Modify | Load pending submissions count |
| `src/app/admin/recruitment/RecruitmentAdminClient.tsx` | Modify | Pending panel: review field proposals + batches |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/014_member_recruitment_submissions.sql`

**Interfaces:**
- Produces: Four modified/created DB tables with these new columns:
  - `recruitment_fields.status text not null default 'live'` / `.proposed_by uuid`
  - `recruitment_batches` table (new)
  - `recruitment_resources.batch_id uuid` / `.status text not null default 'live'`
  - `recruitment_subfolders.batch_id uuid` / `.status text not null default 'live'`

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================
-- AKPD · Migration 014 — Member recruitment submissions
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (IF NOT EXISTS / IF NOT EXISTS column guards).
-- ============================================================

-- ── 1. Add status + proposed_by to recruitment_fields ───────

alter table public.recruitment_fields
  add column if not exists status text not null default 'live',
  add column if not exists proposed_by uuid references auth.users(id) on delete set null;

-- Add check constraint (drop first so re-runs don't fail)
alter table public.recruitment_fields
  drop constraint if exists chk_recruitment_fields_status;

alter table public.recruitment_fields
  add constraint chk_recruitment_fields_status
  check (status in ('live', 'pending', 'rejected'));

-- Backfill all existing admin-created fields
update public.recruitment_fields set status = 'live' where status != 'pending' and status != 'rejected';

-- ── 2. Create recruitment_batches ────────────────────────────

create table if not exists public.recruitment_batches (
  id                uuid        primary key default gen_random_uuid(),
  field_id          uuid        not null
                                  references public.recruitment_fields(id) on delete cascade,
  submitted_by      uuid        not null references auth.users(id) on delete cascade,
  submitted_by_name text        not null,
  status            text        not null default 'draft'
                                  check (status in ('draft', 'pending_review', 'approved', 'rejected')),
  rejection_reason  text,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_recruitment_batches_field_id
  on public.recruitment_batches(field_id);
create index if not exists idx_recruitment_batches_submitted_by
  on public.recruitment_batches(submitted_by);

-- RLS (admin client bypasses, but set up for completeness)
alter table public.recruitment_batches enable row level security;

drop policy if exists "members can read own batches"    on public.recruitment_batches;
drop policy if exists "admins can read all batches"     on public.recruitment_batches;
drop policy if exists "members can insert own batches"  on public.recruitment_batches;
drop policy if exists "members can update own batches"  on public.recruitment_batches;

create policy "members can read own batches"
  on public.recruitment_batches for select
  using (public.is_member() and submitted_by = auth.uid());

create policy "admins can read all batches"
  on public.recruitment_batches for select
  using (public.is_admin());

create policy "members can insert own batches"
  on public.recruitment_batches for insert
  with check (public.is_member() and submitted_by = auth.uid());

create policy "members can update own batches"
  on public.recruitment_batches for update
  using (public.is_member() and submitted_by = auth.uid());

-- ── 3. Add batch_id + status to recruitment_resources ────────

alter table public.recruitment_resources
  add column if not exists batch_id uuid
    references public.recruitment_batches(id) on delete cascade,
  add column if not exists status text not null default 'live';

alter table public.recruitment_resources
  drop constraint if exists chk_recruitment_resources_status;

alter table public.recruitment_resources
  add constraint chk_recruitment_resources_status
  check (status in ('live', 'pending', 'rejected'));

-- Backfill: existing admin resources have no batch, mark live
update public.recruitment_resources set status = 'live' where batch_id is null;

create index if not exists idx_recruitment_resources_batch_id
  on public.recruitment_resources(batch_id);

-- ── 4. Add batch_id + status to recruitment_subfolders ───────

alter table public.recruitment_subfolders
  add column if not exists batch_id uuid
    references public.recruitment_batches(id) on delete cascade,
  add column if not exists status text not null default 'live';

alter table public.recruitment_subfolders
  drop constraint if exists chk_recruitment_subfolders_status;

alter table public.recruitment_subfolders
  add constraint chk_recruitment_subfolders_status
  check (status in ('live', 'pending', 'rejected'));

-- Backfill
update public.recruitment_subfolders set status = 'live' where batch_id is null;

create index if not exists idx_recruitment_subfolders_batch_id
  on public.recruitment_subfolders(batch_id);
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase Dashboard → SQL Editor → New query. Paste the entire file and click Run. Verify no errors appear.

- [ ] **Step 3: Verify schema in Table Editor**

In the Supabase dashboard, check:
- `recruitment_fields` has columns `status` (text, default 'live') and `proposed_by` (uuid, nullable)
- `recruitment_batches` table exists with all 8 columns
- `recruitment_resources` has `batch_id` (uuid, nullable) and `status` (text, default 'live')
- `recruitment_subfolders` has same two new columns
- Existing rows in all tables show `status = 'live'`

---

## Task 2: New Types + Member Field Proposal Actions

**Files:**
- Modify: `src/lib/actions/recruitment.ts`

**Interfaces:**
- Consumes: `getCurrentMember()` from `@/lib/auth`, `createAdminClient()`, `revalidatePath`
- Produces (new exports used by Tasks 6, 7, 8):
  - Types: `MemberBatch`, `BatchWithItems`, `MemberSubmissions`, `FieldProposalInput`
  - Updated types: `RecruitmentField` (gains `status`, `proposed_by`), `RecruitmentResource` (gains `batch_id`, `status`), `RecruitmentSubfolder` (gains `batch_id`, `status`)
  - Functions: `proposeMemberField`, `updateMemberFieldProposal`, `deleteMemberFieldProposal`, `getMemberSubmissions`
  - Updated function: `getSignedUploadUrl(filePath, batchId?)` — new optional second param

- [ ] **Step 1: Update existing types and add new types**

In `src/lib/actions/recruitment.ts`, update the three existing types and add new types after the existing type block:

```typescript
// ── Updated types ─────────────────────────────────────────────────────────────

// Replace the existing RecruitmentField type:
export type RecruitmentField = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_published: boolean;
  status: "live" | "pending" | "rejected";
  proposed_by: string | null;
};

// Replace the existing RecruitmentResource type (adds batch_id + status):
export type RecruitmentResource = {
  id: string;
  field_id: string;
  subfolder_id: string | null;
  title: string;
  description: string | null;
  resource_type: "file" | "link";
  file_path: string | null;
  file_mime: string | null;
  external_url: string | null;
  sort_order: number;
  batch_id: string | null;
  status: "live" | "pending" | "rejected";
};

// Replace the existing RecruitmentSubfolder type (adds batch_id + status):
export type RecruitmentSubfolder = {
  id: string;
  field_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  batch_id: string | null;
  status: "live" | "pending" | "rejected";
};

// ── New types ─────────────────────────────────────────────────────────────────

export type MemberBatch = {
  id: string;
  field_id: string;
  submitted_by: string;
  submitted_by_name: string;
  status: "draft" | "pending_review" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type BatchWithItems = MemberBatch & {
  recruitment_resources: RecruitmentResource[];
  recruitment_subfolders: RecruitmentSubfolder[];
};

export type MemberSubmissions = {
  fieldProposals: RecruitmentField[];
  batches: BatchWithItems[];
};

export type FieldProposalInput = {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
};
```

- [ ] **Step 2: Update `getSignedUploadUrl` to accept optional `batchId`**

Replace the existing `getSignedUploadUrl` function:

```typescript
export async function getSignedUploadUrl(
  filePath: string,
  batchId?: string
): Promise<{ signedUrl: string; token: string; path: string } | { error: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "not_authorized" };
  if (!filePath || filePath.includes("..")) return { error: "invalid_path" };

  if (member.role !== "admin") {
    // Non-admins must supply a batchId they own and that is in draft state
    if (!batchId) return { error: "admin_required" };
    const { data: batch } = await createAdminClient()
      .from("recruitment_batches")
      .select("submitted_by, status")
      .eq("id", batchId)
      .maybeSingle();
    if (!batch) return { error: "Batch not found." };
    if (batch.submitted_by !== member.auth_user_id) return { error: "not_authorized" };
    if (batch.status !== "draft") return { error: "Batch is not in draft status." };
  }

  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUploadUrl(filePath);

  if (error || !data) {
    return { error: error?.message ?? "Could not generate upload URL." };
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}
```

- [ ] **Step 3: Add member field proposal actions**

Add after the existing admin field CRUD section:

```typescript
// ── Member: field proposals ───────────────────────────────────────────────────

export async function proposeMemberField(
  input: FieldProposalInput
): Promise<{ error?: string; id?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const row = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase().replace(/\s+/g, "-"),
    description: input.description?.trim() || null,
    icon: input.icon?.trim() || null,
    sort_order: 0,
    is_published: false,
    status: "pending",
    proposed_by: member.auth_user_id,
  };

  const { data, error } = await createAdminClient()
    .from("recruitment_fields")
    .insert(row)
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return { id: data.id };
}

export async function updateMemberFieldProposal(
  id: string,
  input: FieldProposalInput
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();
  const { data: field } = await supabase
    .from("recruitment_fields")
    .select("proposed_by, status")
    .eq("id", id)
    .maybeSingle();

  if (!field) return { error: "Not found." };
  if (field.proposed_by !== member.auth_user_id) return { error: "not_authorized" };
  if (field.status !== "pending") return { error: "Cannot edit a field that is no longer pending." };

  const { error } = await supabase
    .from("recruitment_fields")
    .update({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      description: input.description?.trim() || null,
      icon: input.icon?.trim() || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  return {};
}

export async function deleteMemberFieldProposal(id: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();
  const { data: field } = await supabase
    .from("recruitment_fields")
    .select("proposed_by, status")
    .eq("id", id)
    .maybeSingle();

  if (!field) return { error: "Not found." };
  if (field.proposed_by !== member.auth_user_id) return { error: "not_authorized" };
  if (field.status === "live") return { error: "Cannot delete a live field." };

  const { error } = await supabase.from("recruitment_fields").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function getMemberSubmissions(): Promise<MemberSubmissions> {
  const member = await getCurrentMember();
  if (!member) return { fieldProposals: [], batches: [] };

  const supabase = createAdminClient();

  const { data: proposals } = await supabase
    .from("recruitment_fields")
    .select("*")
    .eq("proposed_by", member.auth_user_id)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false });

  const { data: batches } = await supabase
    .from("recruitment_batches")
    .select(
      `*, recruitment_resources (
        id, field_id, subfolder_id, title, description, resource_type,
        file_path, file_mime, external_url, sort_order, batch_id, status
      ), recruitment_subfolders (
        id, field_id, parent_id, name, sort_order, batch_id, status
      )`
    )
    .eq("submitted_by", member.auth_user_id)
    .not("status", "eq", "approved")
    .order("created_at", { ascending: false });

  return {
    fieldProposals: (proposals ?? []) as RecruitmentField[],
    batches: (batches ?? []) as BatchWithItems[],
  };
}
```

- [ ] **Step 4: Type-check**

```bash
cd akpd-site && npx tsc --noEmit
```

Fix any type errors before continuing. Pre-existing errors unrelated to the new code can be noted and skipped.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/recruitment.ts
git commit -m "feat: add member field proposal actions and new types"
```

---

## Task 3: Member Batch Management Actions

**Files:**
- Modify: `src/lib/actions/recruitment.ts`

**Interfaces:**
- Consumes: `MemberBatch`, `BatchWithItems`, `ResourceInput`, `SubfolderInput` from Task 2
- Produces (used by Task 7 `ContributeBatchEditor`):
  - `getOrCreateDraftBatch(fieldId: string): Promise<{ id: string } | { error: string }>`
  - `addResourceToBatch(batchId: string, input: Omit<ResourceInput, 'id'>): Promise<{ error?: string; id?: string }>`
  - `removeResourceFromBatch(resourceId: string): Promise<{ error?: string }>`
  - `addSubfolderToBatch(batchId: string, input: Omit<SubfolderInput, 'id'>): Promise<{ error?: string; id?: string }>`
  - `removeSubfolderFromBatch(subfolderId: string): Promise<{ error?: string }>`
  - `submitBatchForReview(batchId: string): Promise<{ error?: string }>`
  - `withdrawBatch(batchId: string): Promise<{ error?: string }>`

- [ ] **Step 1: Add batch management actions**

Append to `src/lib/actions/recruitment.ts`:

```typescript
// ── Member: batch management ──────────────────────────────────────────────────

export async function getOrCreateDraftBatch(
  fieldId: string
): Promise<{ id: string } | { error: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();

  // Verify field is live
  const { data: field } = await supabase
    .from("recruitment_fields")
    .select("id, status")
    .eq("id", fieldId)
    .maybeSingle();
  if (!field || field.status !== "live") return { error: "Field not found or not live." };

  // Return existing draft if one exists
  const { data: existing } = await supabase
    .from("recruitment_batches")
    .select("id")
    .eq("field_id", fieldId)
    .eq("submitted_by", member.auth_user_id)
    .eq("status", "draft")
    .maybeSingle();
  if (existing) return { id: existing.id };

  // Create new draft batch
  const { data: created, error } = await supabase
    .from("recruitment_batches")
    .insert({
      field_id: fieldId,
      submitted_by: member.auth_user_id,
      submitted_by_name: member.full_name ?? member.email,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: created.id };
}

export async function addResourceToBatch(
  batchId: string,
  input: Omit<ResourceInput, "id">
): Promise<{ error?: string; id?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();
  const { data: batch } = await supabase
    .from("recruitment_batches")
    .select("submitted_by, status")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return { error: "Batch not found." };
  if (batch.submitted_by !== member.auth_user_id) return { error: "not_authorized" };
  if (batch.status !== "draft") return { error: "Batch is not editable." };

  const { data, error } = await supabase
    .from("recruitment_resources")
    .insert({
      field_id: input.field_id,
      subfolder_id: input.subfolder_id ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      resource_type: input.resource_type,
      file_path: input.file_path ?? null,
      file_mime: input.file_mime ?? null,
      external_url: input.external_url?.trim() || null,
      sort_order: input.sort_order ?? 0,
      created_by: member.auth_user_id,
      batch_id: batchId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function removeResourceFromBatch(
  resourceId: string
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();
  const { data: resource } = await supabase
    .from("recruitment_resources")
    .select("batch_id, file_path, status")
    .eq("id", resourceId)
    .maybeSingle();

  if (!resource?.batch_id) return { error: "Resource not found or not in a batch." };

  const { data: batch } = await supabase
    .from("recruitment_batches")
    .select("submitted_by, status")
    .eq("id", resource.batch_id)
    .maybeSingle();

  if (!batch) return { error: "Batch not found." };
  if (batch.submitted_by !== member.auth_user_id) return { error: "not_authorized" };
  if (batch.status !== "draft") return { error: "Batch is not editable." };

  if (resource.file_path) {
    await supabase.storage.from(BUCKET).remove([resource.file_path]);
  }

  const { error } = await supabase
    .from("recruitment_resources")
    .delete()
    .eq("id", resourceId);
  if (error) return { error: error.message };
  return {};
}

export async function addSubfolderToBatch(
  batchId: string,
  input: Omit<SubfolderInput, "id">
): Promise<{ error?: string; id?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();
  const { data: batch } = await supabase
    .from("recruitment_batches")
    .select("submitted_by, status")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return { error: "Batch not found." };
  if (batch.submitted_by !== member.auth_user_id) return { error: "not_authorized" };
  if (batch.status !== "draft") return { error: "Batch is not editable." };

  const { data, error } = await supabase
    .from("recruitment_subfolders")
    .insert({
      field_id: input.field_id,
      parent_id: input.parent_id ?? null,
      name: input.name.trim(),
      sort_order: input.sort_order ?? 0,
      batch_id: batchId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function removeSubfolderFromBatch(
  subfolderId: string
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();
  const { data: subfolder } = await supabase
    .from("recruitment_subfolders")
    .select("batch_id, status")
    .eq("id", subfolderId)
    .maybeSingle();

  if (!subfolder?.batch_id) return { error: "Subfolder not found or not in a batch." };

  const { data: batch } = await supabase
    .from("recruitment_batches")
    .select("submitted_by, status")
    .eq("id", subfolder.batch_id)
    .maybeSingle();

  if (!batch) return { error: "Batch not found." };
  if (batch.submitted_by !== member.auth_user_id) return { error: "not_authorized" };
  if (batch.status !== "draft") return { error: "Batch is not editable." };

  const { error } = await supabase
    .from("recruitment_subfolders")
    .delete()
    .eq("id", subfolderId);
  if (error) return { error: error.message };
  return {};
}

export async function submitBatchForReview(
  batchId: string
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();
  const { data: batch } = await supabase
    .from("recruitment_batches")
    .select("submitted_by, status")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return { error: "Batch not found." };
  if (batch.submitted_by !== member.auth_user_id) return { error: "not_authorized" };
  if (batch.status !== "draft") return { error: "Batch is already submitted." };

  const { count: resourceCount } = await supabase
    .from("recruitment_resources")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);

  const { count: subfolderCount } = await supabase
    .from("recruitment_subfolders")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);

  if ((resourceCount ?? 0) + (subfolderCount ?? 0) === 0) {
    return { error: "Add at least one file, link, or folder before submitting." };
  }

  const { error } = await supabase
    .from("recruitment_batches")
    .update({ status: "pending_review" })
    .eq("id", batchId);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function withdrawBatch(batchId: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();
  const { data: batch } = await supabase
    .from("recruitment_batches")
    .select("submitted_by, status")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return { error: "Batch not found." };
  if (batch.submitted_by !== member.auth_user_id) return { error: "not_authorized" };
  if (batch.status !== "pending_review") return { error: "Batch is not under review." };

  const { error } = await supabase
    .from("recruitment_batches")
    .update({ status: "draft" })
    .eq("id", batchId);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/recruitment.ts
git commit -m "feat: add member batch management actions"
```

---

## Task 4: Admin Review Actions

**Files:**
- Modify: `src/lib/actions/recruitment.ts`

**Interfaces:**
- Produces (used by Task 9 `RecruitmentAdminClient`):
  - `PendingFieldProposal` type (= `RecruitmentField & { proposed_by_name?: string }`)
  - `PendingBatch` type (= `BatchWithItems & { field_name: string; field_slug: string }`)
  - `getPendingSubmissions(): Promise<{ fieldProposals: PendingFieldProposal[], batches: PendingBatch[] }>`
  - `approveFieldProposal(id: string): Promise<{ error?: string }>`
  - `rejectFieldProposal(id: string): Promise<{ error?: string }>`
  - `approveBatch(id: string): Promise<{ error?: string }>`
  - `rejectBatch(id: string, reason: string): Promise<{ error?: string }>`

- [ ] **Step 1: Add admin review types**

Add after the existing type block in `src/lib/actions/recruitment.ts`:

```typescript
export type PendingBatch = BatchWithItems & {
  field_name: string;
  field_slug: string;
};
```

- [ ] **Step 2: Add admin review actions**

Append to `src/lib/actions/recruitment.ts`:

```typescript
// ── Admin: review pending submissions ────────────────────────────────────────

export async function getPendingSubmissions(): Promise<{
  fieldProposals: RecruitmentField[];
  batches: PendingBatch[];
}> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { fieldProposals: [], batches: [] };

  const supabase = createAdminClient();

  const { data: proposals } = await supabase
    .from("recruitment_fields")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const { data: rawBatches } = await supabase
    .from("recruitment_batches")
    .select(
      `*, recruitment_fields!inner (name, slug),
       recruitment_resources (
         id, field_id, subfolder_id, title, description, resource_type,
         file_path, file_mime, external_url, sort_order, batch_id, status
       ),
       recruitment_subfolders (
         id, field_id, parent_id, name, sort_order, batch_id, status
       )`
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });

  const batches: PendingBatch[] = (rawBatches ?? []).map((b) => {
    const { recruitment_fields, ...rest } = b as typeof b & {
      recruitment_fields: { name: string; slug: string };
    };
    return {
      ...rest,
      field_name: recruitment_fields?.name ?? "",
      field_slug: recruitment_fields?.slug ?? "",
      recruitment_resources: (rest.recruitment_resources ?? []) as RecruitmentResource[],
      recruitment_subfolders: (rest.recruitment_subfolders ?? []) as RecruitmentSubfolder[],
    };
  });

  return {
    fieldProposals: (proposals ?? []) as RecruitmentField[],
    batches,
  };
}

export async function approveFieldProposal(id: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const { error } = await createAdminClient()
    .from("recruitment_fields")
    .update({ status: "live", is_published: true })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function rejectFieldProposal(id: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const { error } = await createAdminClient()
    .from("recruitment_fields")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function approveBatch(id: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();

  await Promise.all([
    supabase
      .from("recruitment_resources")
      .update({ status: "live" })
      .eq("batch_id", id)
      .eq("status", "pending"),
    supabase
      .from("recruitment_subfolders")
      .update({ status: "live" })
      .eq("batch_id", id)
      .eq("status", "pending"),
  ]);

  const { error } = await supabase
    .from("recruitment_batches")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending_review");

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function rejectBatch(
  id: string,
  reason: string
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();

  // Clean up uploaded files from storage
  const { data: resources } = await supabase
    .from("recruitment_resources")
    .select("file_path")
    .eq("batch_id", id)
    .not("file_path", "is", null);

  const paths = (resources ?? [])
    .map((r) => r.file_path)
    .filter(Boolean) as string[];
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  // Delete the pending resources and subfolders
  await Promise.all([
    supabase.from("recruitment_resources").delete().eq("batch_id", id),
    supabase.from("recruitment_subfolders").delete().eq("batch_id", id),
  ]);

  const { error } = await supabase
    .from("recruitment_batches")
    .update({
      status: "rejected",
      rejection_reason: reason.trim() || "No reason provided.",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending_review");

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/recruitment.ts
git commit -m "feat: add admin review actions for field proposals and batches"
```

---

## Task 5: Update Page Data Loading

**Files:**
- Modify: `src/app/recruitment/page.tsx`
- Modify: `src/app/admin/recruitment/page.tsx`

**Interfaces:**
- Consumes: `getMemberSubmissions()` (Task 2), `getPendingSubmissions()` (Task 4)
- Produces:
  - `RecruitmentClient` now receives `memberSubmissions: MemberSubmissions` prop (Task 8 depends on this)
  - `RecruitmentAdminClient` now receives `pendingCount: number` prop (Task 9 depends on this)

- [ ] **Step 1: Update `src/app/recruitment/page.tsx`**

Replace the entire file:

```typescript
import { requireMember } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMemberSubmissions,
  type FieldWithResources,
  type MemberSubmissions,
} from "@/lib/actions/recruitment";
import RecruitmentClient from "./RecruitmentClient";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const member = await requireMember();
  if (member.role === "alumni") redirect("/opportunities");
  const isAdmin = member.role === "admin";

  const { data: raw } = await createAdminClient()
    .from("recruitment_fields")
    .select(
      `*,
       recruitment_subfolders (
         id, field_id, parent_id, name, sort_order, batch_id, status,
         recruitment_resources (
           id, field_id, subfolder_id, title, description, resource_type,
           file_path, file_mime, external_url, sort_order, batch_id, status
         )
       ),
       recruitment_resources (
         id, field_id, subfolder_id, title, description, resource_type,
         file_path, file_mime, external_url, sort_order, batch_id, status
       )`
    )
    .eq("is_published", true)
    .eq("status", "live")
    .order("sort_order")
    .order("sort_order", { referencedTable: "recruitment_subfolders" })
    .order("sort_order", { referencedTable: "recruitment_resources" });

  // Filter pending/rejected content from nested resources and subfolders
  const fields: FieldWithResources[] = (raw ?? []).map((f) => ({
    ...f,
    recruitment_subfolders: (f.recruitment_subfolders ?? [])
      .filter((sf: { status: string }) => sf.status === "live")
      .map((sf: { recruitment_resources?: { status: string }[] }) => ({
        ...sf,
        recruitment_resources: (sf.recruitment_resources ?? []).filter(
          (r: { status: string }) => r.status === "live"
        ),
      })),
    recruitment_resources: (f.recruitment_resources ?? []).filter(
      (r: { status: string }) => r.status === "live"
    ),
  })) as FieldWithResources[];

  const fieldsWithContent = fields.filter(
    (f) =>
      (f.recruitment_subfolders ?? []).length > 0 ||
      (f.recruitment_resources ?? []).length > 0
  );

  const memberSubmissions: MemberSubmissions = await getMemberSubmissions();

  return (
    <main className="flex-1">
      {/* ── Title bar ── */}
      <div
        style={{
          background: "var(--s-0)",
          borderBottom: "1px solid var(--b-default)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 pt-4 pb-3">
          <h1
            className="text-[17px] font-bold mb-3"
            style={{
              color: "var(--t-primary)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.01em",
            }}
          >
            Recruiting Resources
          </h1>
          {fieldsWithContent.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {fieldsWithContent.map((f) => (
                <a key={f.id} href={`#${f.slug}`} className="pill text-[12px]">
                  {f.icon && <span className="mr-1">{f.icon}</span>}
                  {f.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {fields.length === 0 && memberSubmissions.fieldProposals.length === 0 ? (
          <div className="rounded-2xl px-8 py-16 text-center card">
            <p
              className="text-base font-bold mb-2"
              style={{ color: "var(--t-primary)" }}
            >
              No fields yet.
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--t-muted)" }}>
              Recruitment resources will appear here once they&apos;re added.
            </p>
            {isAdmin && (
              <a
                href="/admin/recruitment"
                className="text-sm font-bold"
                style={{ color: "var(--akp-gold)" }}
              >
                Add a field →
              </a>
            )}
          </div>
        ) : (
          <RecruitmentClient
            fields={fields}
            isAdmin={isAdmin}
            memberSubmissions={memberSubmissions}
          />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Update `src/app/admin/recruitment/page.tsx`**

Replace the entire file:

```typescript
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingSubmissions, type FieldWithResources } from "@/lib/actions/recruitment";
import RecruitmentAdminClient from "./RecruitmentAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminRecruitmentPage() {
  await requireAdmin();

  const { data: raw } = await createAdminClient()
    .from("recruitment_fields")
    .select(
      `*,
     recruitment_subfolders (
       id, field_id, parent_id, name, sort_order,
       recruitment_resources (
         id, field_id, subfolder_id, title, description, resource_type,
         file_path, file_mime, external_url, sort_order
       )
     ),
     recruitment_resources (
       id, field_id, subfolder_id, title, description, resource_type,
       file_path, file_mime, external_url, sort_order
     )`
    )
    .eq("status", "live")
    .order("sort_order")
    .order("sort_order", { referencedTable: "recruitment_subfolders" })
    .order("sort_order", { referencedTable: "recruitment_resources" });

  const fields = (raw ?? []) as FieldWithResources[];
  const totalResources = fields.reduce(
    (n, f) => n + (f.recruitment_resources?.length ?? 0),
    0
  );

  const pendingSubmissions = await getPendingSubmissions();
  const pendingCount =
    pendingSubmissions.fieldProposals.length + pendingSubmissions.batches.length;

  return (
    <main className="flex-1" style={{ background: "var(--s-page)", minHeight: "100vh" }}>
      {/* ── Breadcrumb bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2">
          <a href="/admin" className="text-[13px] transition-opacity hover:opacity-70" style={{ color: "var(--t-muted)" }}>Admin</a>
          <span style={{ color: "var(--b-strong)" }}>/</span>
          <span className="text-[13px] font-semibold" style={{ color: "var(--t-primary)" }}>Recruitment Resources</span>
          {pendingCount > 0 && (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "var(--akp-gold)", color: "#fff" }}
            >
              {pendingCount} pending
            </span>
          )}
          <span className="ml-auto text-[12px]" style={{ color: "var(--t-faint)" }}>
            {fields.length} field{fields.length !== 1 ? "s" : ""} · {totalResources} resource{totalResources !== 1 ? "s" : ""}
          </span>
          <a href="/recruitment" className="btn btn-ghost btn-sm">View Page</a>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <RecruitmentAdminClient fields={fields} pendingSubmissions={pendingSubmissions} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors on `RecruitmentClient` (missing `memberSubmissions` prop) and `RecruitmentAdminClient` (missing `pendingSubmissions` prop) — these are fixed in Tasks 8 and 9. Note them but proceed.

- [ ] **Step 4: Commit**

```bash
git add src/app/recruitment/page.tsx src/app/admin/recruitment/page.tsx
git commit -m "feat: update page data loading for member submissions and pending count"
```

---

## Task 6: ProposeFieldModal Component

**Files:**
- Create: `src/app/recruitment/ProposeFieldModal.tsx`

**Interfaces:**
- Consumes:
  - `proposeMemberField(input: FieldProposalInput): Promise<{ error?: string; id?: string }>` from `@/lib/actions/recruitment`
  - `updateMemberFieldProposal(id: string, input: FieldProposalInput): Promise<{ error?: string }>` from `@/lib/actions/recruitment`
  - `type FieldProposalInput`, `type RecruitmentField` from `@/lib/actions/recruitment`
- Produces: `default export ProposeFieldModal` — used in Task 8 by `RecruitmentClient`
  - Props: `proposal: RecruitmentField | null, onClose: () => void`

- [ ] **Step 1: Create `src/app/recruitment/ProposeFieldModal.tsx`**

```typescript
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  proposeMemberField,
  updateMemberFieldProposal,
  type RecruitmentField,
} from "@/lib/actions/recruitment";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ProposeFieldModal({
  proposal,
  onClose,
}: {
  proposal: RecruitmentField | null; // null = new proposal
  onClose: () => void;
}) {
  const [name, setName] = useState(proposal?.name ?? "");
  const [slug, setSlug] = useState(proposal?.slug ?? "");
  const [description, setDescription] = useState(proposal?.description ?? "");
  const [icon, setIcon] = useState(proposal?.icon ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Auto-derive slug from name when creating new
  useEffect(() => {
    if (!proposal && name) setSlug(slugify(name));
  }, [proposal, name]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function submit() {
    if (!name.trim() || !slug.trim()) return;
    setError("");
    startTransition(async () => {
      const input = { name, slug, description, icon };
      const result = proposal
        ? await updateMemberFieldProposal(proposal.id, input)
        : await proposeMemberField(input);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(onClose, 600);
      }
    });
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(20,18,16,0.5)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-lg my-8 rounded-2xl flex flex-col animate-scale-in"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--b-subtle)" }}
        >
          <h2
            className="text-[16px] font-bold"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            {proposal ? "Edit Field Proposal" : "Propose a New Field"}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--s-1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-12 px-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
              style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
            >
              ✓
            </div>
            <p className="font-semibold" style={{ color: "var(--t-primary)" }}>
              {proposal ? "Proposal updated." : "Proposal submitted for review."}
            </p>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-4">
            <p className="text-[13px]" style={{ color: "var(--t-secondary)" }}>
              Once approved by an admin, the field will appear on the recruitment page and all members will be able to contribute resources to it.
            </p>

            {/* Name */}
            <div className="flex flex-col gap-1">
              <label htmlFor="pf-name" className="input-label">
                Field name <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                id="pf-name"
                type="text"
                placeholder="e.g. Restructuring"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>

            {/* Slug */}
            <div className="flex flex-col gap-1">
              <label htmlFor="pf-slug" className="input-label">
                Slug <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                id="pf-slug"
                type="text"
                placeholder="restructuring"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="input"
              />
              <p className="text-[11px]" style={{ color: "var(--t-muted)" }}>
                URL-safe identifier — auto-filled from name.
              </p>
            </div>

            {/* Description + Icon */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label htmlFor="pf-desc" className="input-label">Description</label>
                <input
                  id="pf-desc"
                  type="text"
                  placeholder="Short description…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex flex-col gap-1 w-24">
                <label htmlFor="pf-icon" className="input-label">Icon</label>
                <input
                  id="pf-icon"
                  type="text"
                  placeholder="🏗️"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="input text-center"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm" style={{ color: "#dc2626" }}>
                {error}
              </p>
            )}

            <div
              className="flex justify-end gap-2 pt-2"
              style={{ borderTop: "1px solid var(--b-subtle)", paddingTop: "1rem" }}
            >
              <button onClick={onClose} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={pending || !name.trim() || !slug.trim()}
                className="btn btn-primary btn-sm disabled:opacity-50"
              >
                {pending
                  ? "Submitting…"
                  : proposal
                  ? "Save Changes"
                  : "Submit Proposal"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/recruitment/ProposeFieldModal.tsx
git commit -m "feat: add ProposeFieldModal for member field proposals"
```

---

## Task 7: ContributeBatchEditor Component

**Files:**
- Create: `src/app/recruitment/ContributeBatchEditor.tsx`

**Interfaces:**
- Consumes:
  - `getOrCreateDraftBatch`, `addResourceToBatch`, `removeResourceFromBatch`, `addSubfolderToBatch`, `removeSubfolderFromBatch`, `submitBatchForReview`, `withdrawBatch`, `getSignedUploadUrl` from `@/lib/actions/recruitment`
  - Types: `FieldWithResources`, `BatchWithItems`, `RecruitmentResource`, `RecruitmentSubfolder`
- Produces: `default export ContributeBatchEditor`
  - Props: `field: FieldWithResources, existingBatch: BatchWithItems | null, onClose: () => void`

- [ ] **Step 1: Create `src/app/recruitment/ContributeBatchEditor.tsx`**

```typescript
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  getOrCreateDraftBatch,
  addResourceToBatch,
  removeResourceFromBatch,
  addSubfolderToBatch,
  removeSubfolderFromBatch,
  submitBatchForReview,
  withdrawBatch,
  getSignedUploadUrl,
  type FieldWithResources,
  type BatchWithItems,
  type RecruitmentResource,
  type RecruitmentSubfolder,
} from "@/lib/actions/recruitment";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function mimeLabel(mime: string | null): string {
  if (!mime) return "File";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("document")) return "DOC";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "PPT";
  if (mime.includes("sheet") || mime.includes("excel")) return "XLS";
  return "File";
}

export default function ContributeBatchEditor({
  field,
  existingBatch,
  onClose,
}: {
  field: FieldWithResources;
  existingBatch: BatchWithItems | null;
  onClose: () => void;
}) {
  const [batchId, setBatchId] = useState<string | null>(existingBatch?.id ?? null);
  const [batchStatus, setBatchStatus] = useState<BatchWithItems["status"]>(
    existingBatch?.status ?? "draft"
  );
  const [resources, setResources] = useState<RecruitmentResource[]>(
    existingBatch?.recruitment_resources ?? []
  );
  const [subfolders, setSubfolders] = useState<RecruitmentSubfolder[]>(
    existingBatch?.recruitment_subfolders ?? []
  );
  const [initError, setInitError] = useState<string | null>(null);
  const [initDone, setInitDone] = useState(existingBatch !== null);

  const [addMode, setAddMode] = useState<"file" | "link" | "folder" | null>(null);

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Link state
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");

  // Folder (subfolder) state
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);
  const [submitPending, startSubmitTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement>(null);

  const isDraft = batchStatus === "draft";

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // On mount: create/get draft batch if none exists
  useEffect(() => {
    if (initDone) return;
    getOrCreateDraftBatch(field.id).then((result) => {
      if ("error" in result) {
        setInitError(result.error);
      } else {
        setBatchId(result.id);
        setInitDone(true);
      }
    });
  }, [field.id, initDone]);

  async function uploadFiles() {
    if (!batchId || selectedFiles.length === 0) return;
    setUploadStatus("uploading");
    setUploadError(null);
    setUploadedCount(0);
    let count = 0;

    for (const file of selectedFiles) {
      const ext = file.name.split(".").pop() ?? "";
      const base = safeName(file.name.replace(/\.[^.]+$/, ""));
      const path = `${field.slug}/${Date.now()}-${base}${ext ? "." + ext : ""}`;

      const urlResult = await getSignedUploadUrl(path, batchId);
      if ("error" in urlResult) {
        setUploadError(urlResult.error);
        setUploadStatus("error");
        return;
      }

      const res = await fetch(urlResult.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) {
        setUploadError(`Upload failed: ${res.statusText}`);
        setUploadStatus("error");
        return;
      }

      const saveResult = await addResourceToBatch(batchId, {
        field_id: field.id,
        title: file.name.replace(/\.[^.]+$/, ""),
        resource_type: "file",
        file_path: path,
        file_mime: file.type || null,
        sort_order: resources.length + count,
      });
      if (saveResult.error) {
        setUploadError(saveResult.error);
        setUploadStatus("error");
        return;
      }

      // Add to local state optimistically
      setResources((prev) => [
        ...prev,
        {
          id: saveResult.id ?? "",
          field_id: field.id,
          subfolder_id: null,
          title: file.name.replace(/\.[^.]+$/, ""),
          description: null,
          resource_type: "file",
          file_path: path,
          file_mime: file.type || null,
          external_url: null,
          sort_order: prev.length,
          batch_id: batchId,
          status: "pending",
        } as RecruitmentResource,
      ]);
      count++;
      setUploadedCount(count);
    }

    setUploadStatus("done");
    setSelectedFiles([]);
    setAddMode(null);
  }

  async function addLink() {
    if (!batchId || !linkUrl.trim()) {
      setLinkError("URL is required.");
      return;
    }
    setLinkError("");
    const result = await addResourceToBatch(batchId, {
      field_id: field.id,
      title: linkTitle.trim() || linkUrl.trim(),
      resource_type: "link",
      external_url: linkUrl.trim(),
      sort_order: resources.length,
    });
    if (result.error) {
      setLinkError(result.error);
      return;
    }
    setResources((prev) => [
      ...prev,
      {
        id: result.id ?? "",
        field_id: field.id,
        subfolder_id: null,
        title: linkTitle.trim() || linkUrl.trim(),
        description: null,
        resource_type: "link",
        file_path: null,
        file_mime: null,
        external_url: linkUrl.trim(),
        sort_order: prev.length,
        batch_id: batchId,
        status: "pending",
      } as RecruitmentResource,
    ]);
    setLinkTitle("");
    setLinkUrl("");
    setAddMode(null);
  }

  async function addFolder() {
    if (!batchId || !folderName.trim()) {
      setFolderError("Folder name is required.");
      return;
    }
    setFolderError("");
    const result = await addSubfolderToBatch(batchId, {
      field_id: field.id,
      name: folderName.trim(),
      sort_order: subfolders.length,
    });
    if (result.error) {
      setFolderError(result.error);
      return;
    }
    setSubfolders((prev) => [
      ...prev,
      {
        id: result.id ?? "",
        field_id: field.id,
        parent_id: null,
        name: folderName.trim(),
        sort_order: prev.length,
        batch_id: batchId,
        status: "pending",
      } as RecruitmentSubfolder,
    ]);
    setFolderName("");
    setAddMode(null);
  }

  async function removeResource(id: string) {
    const result = await removeResourceFromBatch(id);
    if (result.error) { setActionError(result.error); return; }
    setResources((prev) => prev.filter((r) => r.id !== id));
  }

  async function removeSubfolder(id: string) {
    const result = await removeSubfolderFromBatch(id);
    if (result.error) { setActionError(result.error); return; }
    setSubfolders((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSubmit() {
    if (!batchId) return;
    setActionError(null);
    startSubmitTransition(async () => {
      const result = await submitBatchForReview(batchId);
      if (result.error) {
        setActionError(result.error);
      } else {
        setBatchStatus("pending_review");
      }
    });
  }

  function handleWithdraw() {
    if (!batchId) return;
    setActionError(null);
    startSubmitTransition(async () => {
      const result = await withdrawBatch(batchId);
      if (result.error) {
        setActionError(result.error);
      } else {
        setBatchStatus("draft");
      }
    });
  }

  const totalItems = resources.length + subfolders.length;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(20,18,16,0.5)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-xl my-8 rounded-2xl flex flex-col animate-scale-in"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--b-subtle)" }}
        >
          <div>
            <h2
              className="text-[16px] font-bold"
              style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
            >
              Contribute to {field.icon ? `${field.icon} ` : ""}{field.name}
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>
              {batchStatus === "draft"
                ? "Add resources to your batch, then submit for admin review."
                : batchStatus === "pending_review"
                ? "Your batch is under review. Withdraw to make changes."
                : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--s-1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Init error */}
          {initError && (
            <p className="text-sm text-center py-4" style={{ color: "#dc2626" }}>
              {initError}
            </p>
          )}

          {/* Loading state */}
          {!initDone && !initError && (
            <div className="flex justify-center py-8">
              <span
                className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--akp-navy)", borderTopColor: "transparent" }}
              />
            </div>
          )}

          {initDone && (
            <>
              {/* Current batch items */}
              {totalItems === 0 ? (
                <div
                  className="rounded-xl px-4 py-8 text-center"
                  style={{ background: "var(--s-1)", border: "1px dashed var(--b-default)" }}
                >
                  <p className="text-sm" style={{ color: "var(--t-muted)" }}>
                    No items yet. Add files, links, or folders below.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Subfolders */}
                  {subfolders.map((sf) => (
                    <div
                      key={sf.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "var(--s-1)", border: "1px solid var(--b-subtle)" }}
                    >
                      <span className="text-sm" style={{ color: "var(--t-muted)" }}>📁</span>
                      <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--t-primary)" }}>
                        {sf.name}
                      </span>
                      <span className="badge badge-neutral text-[10px]">Folder</span>
                      {isDraft && (
                        <button
                          onClick={() => removeSubfolder(sf.id)}
                          className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                          style={{ color: "#dc2626" }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Resources */}
                  {resources.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "var(--s-1)", border: "1px solid var(--b-subtle)" }}
                    >
                      <span
                        className="badge text-[10px] shrink-0"
                        style={
                          r.resource_type === "file"
                            ? { background: "rgba(10,34,64,0.07)", color: "var(--t-secondary)" }
                            : { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }
                        }
                      >
                        {r.resource_type === "file" ? mimeLabel(r.file_mime) : "Link"}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--t-primary)" }}>
                        {r.title}
                      </span>
                      {isDraft && (
                        <button
                          onClick={() => removeResource(r.id)}
                          className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                          style={{ color: "#dc2626" }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add controls (only in draft mode) */}
              {isDraft && (
                <div
                  className="flex flex-col gap-3 pt-3"
                  style={{ borderTop: "1px solid var(--b-subtle)" }}
                >
                  {/* Add type selector */}
                  {addMode === null && (
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setAddMode("file")} className="btn btn-ghost btn-sm">
                        + Upload files
                      </button>
                      <button onClick={() => setAddMode("link")} className="btn btn-ghost btn-sm">
                        + Add link
                      </button>
                      <button onClick={() => setAddMode("folder")} className="btn btn-ghost btn-sm">
                        + Add folder
                      </button>
                    </div>
                  )}

                  {/* File upload */}
                  {addMode === "file" && (
                    <div className="flex flex-col gap-3">
                      <label
                        className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl cursor-pointer border-2 border-dashed transition-colors"
                        style={{ borderColor: "var(--b-default)" }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          setSelectedFiles(Array.from(e.dataTransfer.files));
                        }}
                      >
                        <input
                          type="file"
                          className="sr-only"
                          multiple
                          onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
                        />
                        {selectedFiles.length > 0 ? (
                          <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                            {selectedFiles.length === 1
                              ? selectedFiles[0].name
                              : `${selectedFiles.length} files selected`}
                          </p>
                        ) : (
                          <>
                            <svg width="22" height="22" fill="none" stroke="var(--t-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                            </svg>
                            <p className="text-sm" style={{ color: "var(--t-secondary)" }}>
                              Click or drag files here
                            </p>
                          </>
                        )}
                      </label>
                      {uploadStatus === "uploading" && (
                        <p className="text-xs text-center" style={{ color: "var(--t-muted)" }}>
                          Uploading {uploadedCount + 1} of {selectedFiles.length}…
                        </p>
                      )}
                      {uploadError && (
                        <p className="text-xs" style={{ color: "#dc2626" }}>{uploadError}</p>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setAddMode(null); setSelectedFiles([]); }} className="btn btn-ghost btn-sm">
                          Cancel
                        </button>
                        <button
                          onClick={uploadFiles}
                          disabled={selectedFiles.length === 0 || uploadStatus === "uploading"}
                          className="btn btn-primary btn-sm disabled:opacity-50"
                        >
                          {uploadStatus === "uploading" ? "Uploading…" : `Upload ${selectedFiles.length > 0 ? selectedFiles.length + " " : ""}file${selectedFiles.length !== 1 ? "s" : ""}`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Link */}
                  {addMode === "link" && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="input-label">URL *</label>
                        <input
                          type="url"
                          placeholder="https://…"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          className="input"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="input-label">
                          Title{" "}
                          <span className="font-normal normal-case" style={{ color: "var(--t-muted)" }}>
                            (optional — defaults to URL)
                          </span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Bloomberg Terminal Guide"
                          value={linkTitle}
                          onChange={(e) => setLinkTitle(e.target.value)}
                          className="input"
                        />
                      </div>
                      {linkError && <p className="text-xs" style={{ color: "#dc2626" }}>{linkError}</p>}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setAddMode(null); setLinkTitle(""); setLinkUrl(""); }} className="btn btn-ghost btn-sm">
                          Cancel
                        </button>
                        <button onClick={addLink} className="btn btn-primary btn-sm">
                          Add Link
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Folder */}
                  {addMode === "folder" && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="input-label">Folder name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Interview Prep"
                          value={folderName}
                          onChange={(e) => setFolderName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addFolder(); }}
                          className="input"
                        />
                      </div>
                      {folderError && <p className="text-xs" style={{ color: "#dc2626" }}>{folderError}</p>}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setAddMode(null); setFolderName(""); }} className="btn btn-ghost btn-sm">
                          Cancel
                        </button>
                        <button onClick={addFolder} className="btn btn-primary btn-sm">
                          Add Folder
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action error */}
              {actionError && (
                <p className="text-sm" style={{ color: "#dc2626" }}>
                  {actionError}
                </p>
              )}

              {/* Footer actions */}
              <div
                className="flex justify-between items-center pt-2"
                style={{ borderTop: "1px solid var(--b-subtle)" }}
              >
                <button onClick={onClose} className="btn btn-ghost btn-sm">
                  Close
                </button>
                <div className="flex gap-2">
                  {batchStatus === "draft" && (
                    <button
                      onClick={handleSubmit}
                      disabled={submitPending || totalItems === 0}
                      className="btn btn-primary btn-sm disabled:opacity-50"
                    >
                      {submitPending ? "Submitting…" : `Submit for Review (${totalItems} item${totalItems !== 1 ? "s" : ""})`}
                    </button>
                  )}
                  {batchStatus === "pending_review" && (
                    <button
                      onClick={handleWithdraw}
                      disabled={submitPending}
                      className="btn btn-ghost btn-sm disabled:opacity-50"
                    >
                      {submitPending ? "Withdrawing…" : "Withdraw"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/recruitment/ContributeBatchEditor.tsx
git commit -m "feat: add ContributeBatchEditor component for member batch submissions"
```

---

## Task 8: Update RecruitmentClient

**Files:**
- Modify: `src/app/recruitment/RecruitmentClient.tsx`

**Interfaces:**
- Consumes:
  - `ProposeFieldModal` from `./ProposeFieldModal`
  - `ContributeBatchEditor` from `./ContributeBatchEditor`
  - New prop: `memberSubmissions: MemberSubmissions`
  - `deleteMemberFieldProposal` from `@/lib/actions/recruitment`
  - `type MemberSubmissions, type BatchWithItems, type RecruitmentField` from `@/lib/actions/recruitment`
- Produces: Updated `RecruitmentClient` accepting `memberSubmissions` prop (fixes Task 5 type error)

- [ ] **Step 1: Replace `src/app/recruitment/RecruitmentClient.tsx`**

Keep the existing `mimeLabel`, `mimeDot`, `ResourceCard`, `SubfolderPanel`, and `FieldPanel` functions unchanged. Only the `RecruitmentClient` export function changes — update it as follows:

```typescript
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  FieldWithResources,
  RecruitmentResource,
  MemberSubmissions,
  BatchWithItems,
  RecruitmentField,
} from "@/lib/actions/recruitment";
import { buildSubfolderTree, type SubfolderNode } from "@/lib/subfolderTree";
import { deleteMemberFieldProposal } from "@/lib/actions/recruitment";
import DownloadButton from "./DownloadButton";
import ProposeFieldModal from "./ProposeFieldModal";
import ContributeBatchEditor from "./ContributeBatchEditor";

// ... (keep mimeLabel, mimeDot, ResourceCard, SubfolderPanel, FieldPanel as-is) ...

// ── RecruitmentClient: main accordion ─────────────────────────────────────────

export default function RecruitmentClient({
  fields,
  isAdmin,
  memberSubmissions,
}: {
  fields: FieldWithResources[];
  isAdmin: boolean;
  memberSubmissions: MemberSubmissions;
}) {
  const router = useRouter();
  const [openFieldId, setOpenFieldId] = useState<string | null>(fields[0]?.id ?? null);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [editingProposal, setEditingProposal] = useState<RecruitmentField | null>(null);
  const [contributeField, setContributeField] = useState<FieldWithResources | null>(null);
  const [deletingProposalId, startDeleteTransition] = useTransition();

  // Hash-based field opening (unchanged)
  useEffect(() => {
    function openFromHash() {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        const match = fields.find((f) => f.slug === hash);
        setOpenFieldId(match ? match.id : null);
      }
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [fields]);

  function toggle(id: string) {
    setOpenFieldId((prev) => (prev === id ? null : id));
  }

  function totalResources(field: FieldWithResources): number {
    const inSubfolders = (field.recruitment_subfolders ?? []).reduce(
      (n, sf) => n + (sf.recruitment_resources?.length ?? 0),
      0
    );
    const topLevel = (field.recruitment_resources ?? []).filter(
      (r) => r.subfolder_id === null
    ).length;
    return inSubfolders + topLevel;
  }

  function getBatchForField(fieldId: string): BatchWithItems | null {
    return (
      memberSubmissions.batches.find(
        (b) => b.field_id === fieldId && b.status !== "approved"
      ) ?? null
    );
  }

  function batchStatusLabel(batch: BatchWithItems): string {
    const count = (batch.recruitment_resources?.length ?? 0) + (batch.recruitment_subfolders?.length ?? 0);
    if (batch.status === "draft") return `Draft · ${count} item${count !== 1 ? "s" : ""}`;
    if (batch.status === "pending_review") return "Under Review";
    if (batch.status === "rejected") return "See Feedback";
    return "Contribute";
  }

  function handleContributeClose() {
    setContributeField(null);
    router.refresh();
  }

  function handleProposeClose() {
    setShowProposeModal(false);
    setEditingProposal(null);
    router.refresh();
  }

  return (
    <>
      {/* ── "Propose a Field" button ── */}
      {!isAdmin && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => { setEditingProposal(null); setShowProposeModal(true); }}
            className="btn btn-ghost btn-sm"
          >
            + Propose a Field
          </button>
        </div>
      )}

      {/* ── Member's own pending field proposals ── */}
      {memberSubmissions.fieldProposals.length > 0 && (
        <div className="flex flex-col gap-2 mb-6">
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-1"
            style={{ color: "var(--t-muted)" }}
          >
            Your Proposals
          </p>
          {memberSubmissions.fieldProposals.map((proposal) => (
            <div
              key={proposal.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "var(--s-0)",
                border: "1px solid var(--b-default)",
              }}
            >
              {proposal.icon && <span className="text-base shrink-0">{proposal.icon}</span>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--t-primary)" }}>
                  {proposal.name}
                </p>
                {proposal.description && (
                  <p className="text-xs truncate" style={{ color: "var(--t-muted)" }}>
                    {proposal.description}
                  </p>
                )}
              </div>
              <span
                className="badge shrink-0 text-[10px]"
                style={
                  proposal.status === "pending"
                    ? { background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }
                    : { background: "rgba(220,38,38,0.1)", color: "#dc2626" }
                }
              >
                {proposal.status === "pending" ? "Pending Review" : "Rejected"}
              </span>
              {proposal.status === "pending" && (
                <button
                  onClick={() => { setEditingProposal(proposal); setShowProposeModal(true); }}
                  className="btn btn-ghost btn-sm shrink-0"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => {
                  if (!confirm(`Cancel proposal "${proposal.name}"?`)) return;
                  startDeleteTransition(async () => {
                    await deleteMemberFieldProposal(proposal.id);
                    router.refresh();
                  });
                }}
                className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                style={{ color: "#dc2626" }}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Live field accordion ── */}
      <div className="flex flex-col gap-2">
        {fields.map((field) => {
          const isOpen = openFieldId === field.id;
          const count = totalResources(field);
          const batch = getBatchForField(field.id);

          return (
            <div
              key={field.id}
              id={field.slug}
              className="rounded-2xl overflow-hidden scroll-mt-20"
              style={{
                background: "var(--s-0)",
                border: `1px solid ${isOpen ? "var(--b-strong)" : "var(--b-default)"}`,
                boxShadow: isOpen ? "var(--shadow-sm)" : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            >
              {/* Header */}
              <button
                onClick={() => toggle(field.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors"
                style={{ background: isOpen ? "var(--s-1)" : "transparent" }}
                onMouseEnter={(e) => {
                  if (!isOpen) (e.currentTarget as HTMLElement).style.background = "var(--s-1)";
                }}
                onMouseLeave={(e) => {
                  if (!isOpen) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {field.icon && (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                    style={{ background: "var(--s-1)", border: "1px solid var(--b-default)" }}
                    aria-hidden
                  >
                    {field.icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[15px] font-bold"
                    style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
                  >
                    {field.name}
                  </p>
                  {field.description && (
                    <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--t-muted)" }}>
                      {field.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge text-[11px] ${count > 0 ? "badge-navy" : "badge-neutral"}`}>
                    {count > 0 ? `${count} resource${count !== 1 ? "s" : ""}` : "Coming soon"}
                  </span>
                  {isAdmin && (
                    <a
                      href="/admin/recruitment"
                      className="text-[11px] font-semibold hidden sm:block"
                      style={{ color: "var(--akp-gold)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Manage →
                    </a>
                  )}
                  {/* Contribute button for non-alumni, non-admin members */}
                  {!isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContributeField(field);
                      }}
                      className="btn btn-ghost btn-sm text-[11px]"
                      style={
                        batch?.status === "rejected"
                          ? { color: "#dc2626" }
                          : batch?.status === "pending_review"
                          ? { color: "var(--t-muted)" }
                          : {}
                      }
                    >
                      {batch ? batchStatusLabel(batch) : "Contribute"}
                    </button>
                  )}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      color: "var(--t-muted)",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Rejected batch feedback inline */}
              {batch?.status === "rejected" && batch.rejection_reason && (
                <div
                  className="mx-4 mb-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: "rgba(220,38,38,0.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.15)" }}
                >
                  <span className="font-semibold">Feedback: </span>
                  {batch.rejection_reason}
                </div>
              )}

              {/* Content panel */}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--b-subtle)" }}>
                  <FieldPanel field={field} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modals ── */}
      {showProposeModal && (
        <ProposeFieldModal
          proposal={editingProposal}
          onClose={handleProposeClose}
        />
      )}

      {contributeField && (
        <ContributeBatchEditor
          field={contributeField}
          existingBatch={getBatchForField(contributeField.id)}
          onClose={handleContributeClose}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Fix any errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/recruitment/RecruitmentClient.tsx
git commit -m "feat: add propose field and contribute batch UI to RecruitmentClient"
```

---

## Task 9: Admin Pending Panel

**Files:**
- Modify: `src/app/admin/recruitment/RecruitmentAdminClient.tsx`

**Interfaces:**
- Consumes:
  - New prop: `pendingSubmissions: { fieldProposals: RecruitmentField[], batches: PendingBatch[] }`
  - `approveFieldProposal`, `rejectFieldProposal`, `approveBatch`, `rejectBatch` from `@/lib/actions/recruitment`
  - Types: `PendingBatch`, `RecruitmentField` from `@/lib/actions/recruitment`
- Produces: Updated `RecruitmentAdminClient` accepting `pendingSubmissions` prop (fixes Task 5 type error)

- [ ] **Step 1: Add imports and new prop to `RecruitmentAdminClient`**

At the top of `src/app/admin/recruitment/RecruitmentAdminClient.tsx`, add to the existing import from `@/lib/actions/recruitment`:

```typescript
import {
  // ... (all existing imports) ...
  approveFieldProposal,
  rejectFieldProposal,
  approveBatch,
  rejectBatch,
  type PendingBatch,
} from "@/lib/actions/recruitment";
```

Update the `RecruitmentAdminClient` function signature:

```typescript
export default function RecruitmentAdminClient({
  fields,
  pendingSubmissions,
}: {
  fields: FieldWithResources[];
  pendingSubmissions: { fieldProposals: RecruitmentField[]; batches: PendingBatch[] };
})
```

- [ ] **Step 2: Add `PendingPanel` component inside the file (above `RecruitmentAdminClient`)**

```typescript
// ── PendingPanel ──────────────────────────────────────────────────────────────

function PendingPanel({
  fieldProposals,
  batches,
}: {
  fieldProposals: RecruitmentField[];
  batches: PendingBatch[];
}) {
  const [rejectBatchId, setRejectBatchId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (fieldProposals.length === 0 && batches.length === 0) return null;

  function handleApproveField(id: string) {
    startTransition(async () => {
      await approveFieldProposal(id);
    });
  }

  function handleRejectField(id: string) {
    if (!confirm("Reject this field proposal?")) return;
    startTransition(async () => {
      await rejectFieldProposal(id);
    });
  }

  function handleApproveBatch(id: string) {
    if (!confirm("Approve this batch? All resources will go live immediately.")) return;
    startTransition(async () => {
      await approveBatch(id);
    });
  }

  async function handleRejectBatch() {
    if (!rejectBatchId) return;
    startTransition(async () => {
      await rejectBatch(rejectBatchId, rejectReason);
      setRejectBatchId(null);
      setRejectReason("");
    });
  }

  return (
    <div
      className="mb-8 rounded-2xl overflow-hidden"
      style={{
        background: "var(--s-0)",
        border: "1px solid var(--b-default)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid var(--b-subtle)", background: "var(--s-1)" }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: "var(--akp-gold)" }}
        />
        <p
          className="text-[13px] font-bold"
          style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
        >
          Pending Review
        </p>
        <span className="badge badge-neutral text-[11px] ml-auto">
          {fieldProposals.length + batches.length} item{fieldProposals.length + batches.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Field proposals */}
        {fieldProposals.length > 0 && (
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: "var(--t-muted)" }}
            >
              Field Proposals
            </p>
            <div className="flex flex-col gap-2">
              {fieldProposals.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-opacity"
                  style={{
                    background: "var(--s-1)",
                    border: "1px solid var(--b-default)",
                    opacity: pending ? 0.6 : 1,
                  }}
                >
                  {f.icon && <span className="text-base shrink-0">{f.icon}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--t-primary)" }}>
                      {f.name}
                    </p>
                    {f.description && (
                      <p className="text-xs truncate" style={{ color: "var(--t-muted)" }}>
                        {f.description}
                      </p>
                    )}
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                      /{f.slug}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      disabled={pending}
                      onClick={() => handleApproveField(f.id)}
                      className="btn btn-primary btn-sm disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => handleRejectField(f.id)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30"
                      style={{ color: "#dc2626" }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resource batches */}
        {batches.length > 0 && (
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: "var(--t-muted)" }}
            >
              Resource Batches
            </p>
            <div className="flex flex-col gap-3">
              {batches.map((batch) => {
                const resourceCount = batch.recruitment_resources?.length ?? 0;
                const subfolderCount = batch.recruitment_subfolders?.length ?? 0;
                const totalCount = resourceCount + subfolderCount;

                return (
                  <div
                    key={batch.id}
                    className="rounded-xl overflow-hidden transition-opacity"
                    style={{
                      border: "1px solid var(--b-default)",
                      opacity: pending ? 0.6 : 1,
                    }}
                  >
                    {/* Batch header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ background: "var(--s-1)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                          {batch.field_name}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--t-muted)" }}>
                          from <span className="font-medium">{batch.submitted_by_name}</span> · {totalCount} item{totalCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          disabled={pending}
                          onClick={() => handleApproveBatch(batch.id)}
                          className="btn btn-primary btn-sm disabled:opacity-50"
                        >
                          Approve All
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => {
                            setRejectBatchId(batch.id);
                            setRejectReason("");
                          }}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30"
                          style={{ color: "#dc2626" }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>

                    {/* Batch item preview */}
                    <div className="px-4 py-2 flex flex-col gap-1">
                      {(batch.recruitment_subfolders ?? []).map((sf) => (
                        <div key={sf.id} className="flex items-center gap-2 py-1">
                          <span className="text-xs" style={{ color: "var(--t-muted)" }}>📁</span>
                          <span className="text-xs" style={{ color: "var(--t-secondary)" }}>{sf.name}</span>
                          <span className="badge badge-neutral text-[10px]">Folder</span>
                        </div>
                      ))}
                      {(batch.recruitment_resources ?? []).map((r) => (
                        <div key={r.id} className="flex items-center gap-2 py-1">
                          <span
                            className="badge text-[10px] shrink-0"
                            style={
                              r.resource_type === "file"
                                ? { background: "rgba(10,34,64,0.07)", color: "var(--t-secondary)" }
                                : { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }
                            }
                          >
                            {r.resource_type === "file" ? "File" : "Link"}
                          </span>
                          <span className="text-xs truncate" style={{ color: "var(--t-secondary)" }}>
                            {r.title}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Inline rejection reason input */}
                    {rejectBatchId === batch.id && (
                      <div
                        className="px-4 pb-4 flex flex-col gap-2"
                        style={{ borderTop: "1px solid var(--b-subtle)" }}
                      >
                        <label className="input-label pt-3">
                          Rejection reason{" "}
                          <span className="font-normal normal-case" style={{ color: "var(--t-muted)" }}>
                            (shown to the member)
                          </span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Duplicate content, please check existing resources first."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="input text-sm"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setRejectBatchId(null)}
                            className="btn btn-ghost btn-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleRejectBatch}
                            disabled={pending}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                            style={{ color: "#dc2626" }}
                          >
                            {pending ? "Rejecting…" : "Confirm Reject"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire `PendingPanel` into the `RecruitmentAdminClient` render**

At the top of the `return (...)` block in `RecruitmentAdminClient`, add `<PendingPanel>` before the stats strip:

```typescript
return (
  <>
    {/* Pending review section */}
    <PendingPanel
      fieldProposals={pendingSubmissions.fieldProposals}
      batches={pendingSubmissions.batches}
    />

    {/* Stats strip (unchanged) */}
    <div className="flex gap-8 mb-8 pb-6" style={{ borderBottom: "1px solid var(--b-subtle)" }}>
      {/* ... existing stats ... */}
    </div>

    {/* rest of existing JSX unchanged */}
  </>
);
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

All errors from Task 5 should now be resolved. Fix any remaining issues.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/recruitment/RecruitmentAdminClient.tsx
git commit -m "feat: add pending review panel to admin recruitment page"
```

---

## Task 10: End-to-End Verification + Final Commit

**Files:** No new files. Verification only.

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors related to this feature. Note any pre-existing unrelated errors.

- [ ] **Step 2: Start dev server and manually verify member flow**

```bash
npm run dev
```

Sign in as a regular member (non-admin). Go to `/recruitment`:
- Verify "Propose a Field" button appears in the header area
- Click it → modal opens → fill in name/description/icon → submit → success state → proposal appears under "Your Proposals" with "Pending Review" badge
- On any live field, verify "Contribute" button appears in the field header
- Click "Contribute" → batch editor opens → add a file or link → item appears in the list
- Click "Submit for Review" → button changes to "Withdraw" → batch status shows "Under Review"
- Click "Withdraw" → status reverts to draft
- Add another item, re-submit

- [ ] **Step 3: Verify admin flow**

Sign in as admin. Go to `/admin/recruitment`:
- Verify "N pending" badge in breadcrumb when proposals/batches exist
- Verify "Pending Review" panel appears above the existing field list
- Under "Field Proposals": click "Approve" on the member's proposal → it disappears from pending; go to `/recruitment` → new field appears in the list
- Submit a batch as a member (Step 2), then as admin: click "Approve All" → go to `/recruitment` → resources appear under the field
- Test "Reject" on a batch: enter a reason → confirm → go to `/recruitment` as the member → rejected feedback appears on the Contribute button

- [ ] **Step 4: Verify alumni cannot see contribution UI**

Sign in as alumni. Go to `/recruitment`:
- No "Propose a Field" button
- No "Contribute" button on any field
- `/recruitment` loads normally showing live content

- [ ] **Step 5: Verify status filters (no pending content leaks)**

As an admin, submit a batch and do NOT approve it. Sign in as a different member:
- The pending resources should NOT appear on `/recruitment` for the other member
- The other member should not see the submitter's batch (no Contribute button state from another user)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: member recruitment submissions — full implementation"
```

- [ ] **Step 7: Push to remote**

```bash
git push
```
