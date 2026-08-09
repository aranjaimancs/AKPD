# Recruitment Subfolders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a subfolder layer between recruitment fields and resources, with bulk folder-upload from a local directory and per-subfolder resource management in the admin UI.

**Architecture:** New `recruitment_subfolders` table sits between `recruitment_fields` and `recruitment_resources`. A nullable `subfolder_id` FK on `recruitment_resources` is backwards-compatible — existing resources without a subfolder render as top-level. The member page uses native `<details>/<summary>` for a zero-JS accordion. The admin panel adds subfolder CRUD inline to each FieldCard plus a new FolderUploadModal that reads `webkitRelativePath` to auto-group files.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + Storage), Tailwind CSS v4, React 19 (`useTransition`).

## Global Constraints

- All pages export `export const dynamic = "force-dynamic"` — no caching
- Server-side DB access always via `createAdminClient()` (service role), never the user-scoped client
- Mutations use `revalidatePath("/recruitment")` and `revalidatePath("/admin/recruitment")` after every write
- Auth checks: `getCurrentMember()` at top of every server action, role checked inline
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never import `admin.ts` in a Client Component
- Storage upload path must not contain `..` (path traversal guard already in `getSignedUploadUrl`)
- File size limit: 50 MB (enforced by Supabase bucket config from migration 003)
- Dark-mode text: never use `var(--akp-navy)` for readable text — use `var(--t-primary)`
- React 19 mutations pattern: `useTransition` + `startTransition(async () => { await serverAction(); })`
- Next.js 16 has breaking changes — check `node_modules/next/dist/docs/` before writing Next-specific code

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `migrations/011_recruitment_subfolders.sql` | **Create** | New table + FK column + RLS |
| `src/lib/actions/recruitment.ts` | **Modify** | New types + 3 subfolder actions + update ResourceInput |
| `src/app/recruitment/page.tsx` | **Modify** | Updated query + subfolder accordion rendering |
| `src/app/admin/recruitment/page.tsx` | **Modify** | Updated query to include subfolders |
| `src/app/admin/recruitment/RecruitmentAdminClient.tsx` | **Modify** | SubfolderRow, AddSubfolderForm, FolderUploadModal, updated FieldCard + ResourceModal |

---

## Task 1: DB Migration

**Files:**
- Create: `migrations/011_recruitment_subfolders.sql`

**Interfaces:**
- Produces: `recruitment_subfolders` table with columns `(id, field_id, name, sort_order, created_at)`; `recruitment_resources.subfolder_id` nullable FK column

- [ ] **Step 1: Create the migration file**

Create `migrations/011_recruitment_subfolders.sql` with this exact content:

```sql
-- ============================================================
-- AKPD · Migration 011 — Recruitment subfolders
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (IF NOT EXISTS / IF NOT EXISTS column guard)
-- ============================================================

-- ── 1. New table ────────────────────────────────────────────

create table if not exists public.recruitment_subfolders (
  id         uuid        primary key default gen_random_uuid(),
  field_id   uuid        not null
               references public.recruitment_fields(id)
               on delete cascade,
  name       text        not null,
  sort_order int         not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_recruitment_subfolders_field_id
  on public.recruitment_subfolders(field_id);

-- ── 2. Add subfolder_id to resources ───────────────────────

alter table public.recruitment_resources
  add column if not exists subfolder_id uuid
  references public.recruitment_subfolders(id)
  on delete set null;

create index if not exists idx_recruitment_resources_subfolder_id
  on public.recruitment_resources(subfolder_id);

-- ── 3. RLS — recruitment_subfolders ────────────────────────

alter table public.recruitment_subfolders enable row level security;

drop policy if exists "members can read recruitment subfolders"  on public.recruitment_subfolders;
drop policy if exists "admins can insert recruitment subfolders" on public.recruitment_subfolders;
drop policy if exists "admins can update recruitment subfolders" on public.recruitment_subfolders;
drop policy if exists "admins can delete recruitment subfolders" on public.recruitment_subfolders;

create policy "members can read recruitment subfolders"
  on public.recruitment_subfolders for select
  using (public.is_member());

create policy "admins can insert recruitment subfolders"
  on public.recruitment_subfolders for insert
  with check (public.is_admin());

create policy "admins can update recruitment subfolders"
  on public.recruitment_subfolders for update
  using  (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete recruitment subfolders"
  on public.recruitment_subfolders for delete
  using (public.is_admin());

-- ── Done ────────────────────────────────────────────────────
```

- [ ] **Step 2: Run migration in Supabase**

Open Supabase Dashboard → SQL Editor → New query. Paste the SQL above and run it.

Verify: In the Table Editor, confirm `recruitment_subfolders` exists and `recruitment_resources` now has a `subfolder_id` column.

- [ ] **Step 3: Commit**

```bash
git add migrations/011_recruitment_subfolders.sql
git commit -m "feat: add recruitment_subfolders migration"
```

---

## Task 2: Types + Server Actions

**Files:**
- Modify: `src/lib/actions/recruitment.ts`

**Interfaces:**
- Consumes: `recruitment_subfolders` table (Task 1), `recruitment_resources.subfolder_id` column (Task 1)
- Produces:
  - `RecruitmentSubfolder` type `{ id: string; field_id: string; name: string; sort_order: number }`
  - `SubfolderWithResources` type `RecruitmentSubfolder & { recruitment_resources: RecruitmentResource[] }`
  - Updated `FieldWithResources` type — adds `recruitment_subfolders: SubfolderWithResources[]`
  - Updated `RecruitmentResource` type — adds `subfolder_id: string | null`
  - Updated `ResourceInput` type — adds `subfolder_id?: string | null`
  - `upsertSubfolder(input: SubfolderInput): Promise<{ error?: string; id?: string }>`
  - `deleteSubfolder(id: string): Promise<{ error?: string }>`
  - `moveSubfolder(id: string, direction: "up" | "down"): Promise<{ error?: string }>`

- [ ] **Step 1: Update types in `src/lib/actions/recruitment.ts`**

Add `subfolder_id` to `RecruitmentResource`. Replace the `FieldWithResources` type. Add two new types. Find the `// ── Public types ──` section (lines 14–38) and replace it with:

```ts
export type RecruitmentField = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_published: boolean;
};

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
};

export type RecruitmentSubfolder = {
  id: string;
  field_id: string;
  name: string;
  sort_order: number;
};

export type SubfolderWithResources = RecruitmentSubfolder & {
  recruitment_resources: RecruitmentResource[];
};

export type FieldWithResources = RecruitmentField & {
  recruitment_subfolders: SubfolderWithResources[];
  // All resources for this field (filter subfolder_id === null for top-level only)
  recruitment_resources: RecruitmentResource[];
};
```

- [ ] **Step 2: Add `subfolder_id` to `ResourceInput` and `upsertResource`**

Find `export type ResourceInput` and add the new optional field:

```ts
export type ResourceInput = {
  id?: string;
  field_id: string;
  subfolder_id?: string | null;
  title: string;
  description?: string;
  resource_type: "file" | "link";
  file_path?: string | null;
  file_mime?: string | null;
  external_url?: string | null;
  sort_order?: number;
};
```

In `upsertResource`, find where `row` is constructed and add `subfolder_id`:

```ts
const row = {
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
};
```

- [ ] **Step 3: Add the three new subfolder server actions**

Append these to the bottom of `src/lib/actions/recruitment.ts`:

```ts
// ── Admin: subfolder CRUD ─────────────────────────────────────────────────────

export type SubfolderInput = {
  id?: string;
  field_id: string;
  name: string;
  sort_order?: number;
};

export async function upsertSubfolder(
  input: SubfolderInput
): Promise<{ error?: string; id?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();

  if (input.id) {
    const { error } = await supabase
      .from("recruitment_subfolders")
      .update({ name: input.name.trim(), sort_order: input.sort_order ?? 0 })
      .eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePath("/recruitment");
    revalidatePath("/admin/recruitment");
    return {};
  } else {
    const { data, error } = await supabase
      .from("recruitment_subfolders")
      .insert({
        field_id: input.field_id,
        name: input.name.trim(),
        sort_order: input.sort_order ?? 0,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/recruitment");
    revalidatePath("/admin/recruitment");
    return { id: data.id };
  }
}

export async function deleteSubfolder(
  id: string
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  // ON DELETE SET NULL on subfolder_id means resources survive, unlinked
  const { error } = await createAdminClient()
    .from("recruitment_subfolders")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function moveSubfolder(
  id: string,
  direction: "up" | "down"
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();

  const { data: subfolder } = await supabase
    .from("recruitment_subfolders")
    .select("id, field_id, sort_order")
    .eq("id", id)
    .maybeSingle();

  if (!subfolder) return { error: "Subfolder not found." };

  const { data: siblings } = await supabase
    .from("recruitment_subfolders")
    .select("id, sort_order")
    .eq("field_id", subfolder.field_id)
    .order("sort_order");

  if (!siblings) return {};

  const idx = siblings.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return {};

  const a = siblings[idx];
  const b = siblings[swapIdx];

  await Promise.all([
    supabase
      .from("recruitment_subfolders")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id),
    supabase
      .from("recruitment_subfolders")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id),
  ]);

  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd akpd-site && npx tsc --noEmit
```

Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/recruitment.ts
git commit -m "feat: add subfolder types and server actions"
```

---

## Task 3: Member-Facing Page

**Files:**
- Modify: `src/app/recruitment/page.tsx`

**Interfaces:**
- Consumes: `SubfolderWithResources`, `FieldWithResources` (Task 2)
- Produces: `/recruitment` page renders subfolders as `<details>/<summary>` accordion within each field section; top-level resources (no subfolder) render below as a flat grid; fields with no subfolders and no resources render existing empty state

- [ ] **Step 1: Update the Supabase query in `page.tsx`**

Find the query in `RecruitmentPage` (around line 184) and replace the `.select(...)` call with:

```ts
const { data: raw } = await createAdminClient()
  .from("recruitment_fields")
  .select(
    `*,
     recruitment_subfolders (
       id, field_id, name, sort_order,
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
  .eq("is_published", true)
  .order("sort_order")
  .order("sort_order", { referencedTable: "recruitment_subfolders" })
  .order("sort_order", { referencedTable: "recruitment_resources" });
```

- [ ] **Step 2: Update `fieldsWithContent` filter**

After the query, replace the `fieldsWithContent` line:

```ts
const fields = (raw ?? []) as FieldWithResources[];
const fieldsWithContent = fields.filter(
  (f) =>
    (f.recruitment_subfolders ?? []).length > 0 ||
    (f.recruitment_resources ?? []).length > 0
);
```

- [ ] **Step 3: Replace `FieldSection` with the subfolder-aware version**

Find the `FieldSection` component (starting around line 101) and replace it entirely:

```tsx
function FieldSection({
  field,
  isAdmin,
}: {
  field: FieldWithResources;
  isAdmin: boolean;
}) {
  const subfolders = (field.recruitment_subfolders ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const topLevelResources = (field.recruitment_resources ?? []).filter(
    (r) => r.subfolder_id === null
  );
  const hasContent = subfolders.length > 0 || topLevelResources.length > 0;

  const totalCount = subfolders.reduce(
    (n, sf) => n + (sf.recruitment_resources?.length ?? 0),
    topLevelResources.length
  );

  return (
    <section id={field.slug} className="scroll-mt-20">
      {/* Field header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          {field.icon && (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
              style={{ background: "var(--s-1)", border: "1px solid var(--b-default)" }}
              aria-hidden
            >
              {field.icon}
            </div>
          )}
          <div>
            <h2
              className="text-base font-bold"
              style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
            >
              {field.name}
            </h2>
            {field.description && (
              <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>
                {field.description}
              </p>
            )}
          </div>
        </div>
        <span className={`badge shrink-0 ${hasContent ? "badge-navy" : "badge-neutral"}`}>
          {hasContent
            ? subfolders.length > 0
              ? `${subfolders.length} folder${subfolders.length !== 1 ? "s" : ""} · ${totalCount} resource${totalCount !== 1 ? "s" : ""}`
              : `${totalCount} resource${totalCount !== 1 ? "s" : ""}`
            : "Coming soon"}
        </span>
      </div>

      {/* Content */}
      {!hasContent ? (
        <div
          className="rounded-xl px-6 py-7 text-center text-[13px]"
          style={{
            background: "var(--s-1)",
            border: "1px dashed var(--b-default)",
            color: "var(--t-muted)",
          }}
        >
          Resources for this track are being added.
          {isAdmin && (
            <>
              {" "}
              <a
                href="/admin/recruitment"
                style={{ color: "var(--akp-gold)", fontWeight: 600 }}
              >
                Add the first one →
              </a>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Subfolder accordions */}
          {subfolders.map((sf, idx) => (
            <details key={sf.id} {...(idx === 0 ? { open: true } : {})}>
              <summary
                className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer list-none select-none transition-colors"
                style={{
                  background: "var(--s-1)",
                  border: "1px solid var(--b-default)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: "var(--t-muted)" }}>
                    📁
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--t-primary)" }}
                  >
                    {sf.name}
                  </span>
                </div>
                <span className="badge badge-neutral text-[11px]">
                  {sf.recruitment_resources?.length ?? 0}
                </span>
              </summary>
              <div className="pt-3 pb-1 px-1">
                {(sf.recruitment_resources ?? []).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(sf.recruitment_resources ?? []).map((r) => (
                      <ResourceCard key={r.id} resource={r} />
                    ))}
                  </div>
                ) : (
                  <p
                    className="text-[13px] text-center py-4"
                    style={{ color: "var(--t-muted)" }}
                  >
                    No resources in this folder yet.
                  </p>
                )}
              </div>
            </details>
          ))}

          {/* Top-level resources (no subfolder) */}
          {topLevelResources.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              {topLevelResources.map((r) => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Start dev server and visually verify**

```bash
npm run dev
```

Navigate to `http://localhost:3000/recruitment`. With no subfolders in the DB yet, the page should look identical to before (flat resource grids). If there are existing resources, they appear as top-level. No visual regression.

- [ ] **Step 6: Commit**

```bash
git add src/app/recruitment/page.tsx
git commit -m "feat: update recruitment page to render subfolder accordions"
```

---

## Task 4: Admin Subfolder Management UI

**Files:**
- Modify: `src/app/admin/recruitment/page.tsx` (query update)
- Modify: `src/app/admin/recruitment/RecruitmentAdminClient.tsx` (SubfolderRow, AddSubfolderForm, updated FieldCard)

**Interfaces:**
- Consumes: `upsertSubfolder`, `deleteSubfolder`, `moveSubfolder` (Task 2); `SubfolderWithResources`, `RecruitmentSubfolder` (Task 2)
- Produces: Each FieldCard (when expanded) shows a "Subfolders" section above the resources list with rename/reorder/delete per subfolder and an inline "Add Subfolder" form

- [ ] **Step 1: Update the query in `src/app/admin/recruitment/page.tsx`**

Find the `.select(...)` call and replace it:

```ts
const { data: raw } = await createAdminClient()
  .from("recruitment_fields")
  .select(
    `*,
     recruitment_subfolders (
       id, field_id, name, sort_order,
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
  .order("sort_order")
  .order("sort_order", { referencedTable: "recruitment_subfolders" })
  .order("sort_order", { referencedTable: "recruitment_resources" });
```

- [ ] **Step 2: Add subfolder imports to `RecruitmentAdminClient.tsx`**

At the top of the import block, add the new actions and types:

```ts
import {
  upsertField,
  deleteField,
  toggleFieldPublished,
  moveField,
  upsertResource,
  deleteResource,
  moveResource,
  getSignedUploadUrl,
  upsertSubfolder,
  deleteSubfolder,
  moveSubfolder,
} from "@/lib/actions/recruitment";
import type {
  FieldWithResources,
  RecruitmentResource,
  RecruitmentSubfolder,
  SubfolderWithResources,
  FieldInput,
} from "@/lib/actions/recruitment";
```

- [ ] **Step 3: Add `SubfolderRow` component**

Insert this new component in `RecruitmentAdminClient.tsx` before `FieldCard` (around line 870):

```tsx
// ── Subfolder row ─────────────────────────────────────────────────────────────

function SubfolderRow({
  subfolder,
  resourceCount,
  isFirst,
  isLast,
}: {
  subfolder: RecruitmentSubfolder;
  resourceCount: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(subfolder.name);
  const [pending, startTransition] = useTransition();

  function saveRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === subfolder.name) {
      setName(subfolder.name);
      setRenaming(false);
      return;
    }
    startTransition(async () => {
      await upsertSubfolder({
        id: subfolder.id,
        field_id: subfolder.field_id,
        name: trimmed,
        sort_order: subfolder.sort_order,
      });
      setRenaming(false);
    });
  }

  return (
    <div
      className="flex items-center gap-2 py-2 px-3 rounded-xl transition-opacity"
      style={{
        background: "var(--s-2)",
        border: "1px solid var(--b-subtle)",
        opacity: pending ? 0.5 : 1,
      }}
    >
      <span className="text-sm shrink-0" style={{ color: "var(--t-muted)" }}>
        📁
      </span>

      {renaming ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename();
            if (e.key === "Escape") {
              setName(subfolder.name);
              setRenaming(false);
            }
          }}
          className="input flex-1 text-sm"
          style={{ padding: "2px 8px", height: "auto" }}
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium truncate"
          style={{ color: "var(--t-primary)" }}
        >
          {subfolder.name}
        </span>
      )}

      <span className="badge badge-neutral text-[10px] shrink-0">
        {resourceCount}
      </span>

      {/* Reorder */}
      <button
        disabled={isFirst || pending}
        onClick={() =>
          startTransition(async () => {
            await moveSubfolder(subfolder.id, "up");
          })
        }
        className="w-5 h-5 flex items-center justify-center text-xs disabled:opacity-20 transition-colors rounded"
        style={{ color: "var(--t-muted)" }}
        title="Move up"
      >
        ↑
      </button>
      <button
        disabled={isLast || pending}
        onClick={() =>
          startTransition(async () => {
            await moveSubfolder(subfolder.id, "down");
          })
        }
        className="w-5 h-5 flex items-center justify-center text-xs disabled:opacity-20 transition-colors rounded"
        style={{ color: "var(--t-muted)" }}
        title="Move down"
      >
        ↓
      </button>

      {renaming ? (
        <>
          <button
            onClick={saveRename}
            disabled={pending}
            className="btn btn-primary btn-sm disabled:opacity-50"
            style={{ padding: "2px 10px" }}
          >
            Save
          </button>
          <button
            onClick={() => {
              setName(subfolder.name);
              setRenaming(false);
            }}
            className="btn btn-ghost btn-sm"
            style={{ padding: "2px 10px" }}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => setRenaming(true)}
          className="btn btn-ghost btn-sm"
        >
          Rename
        </button>
      )}

      <button
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              `Delete "${subfolder.name}"? Its resources won't be deleted — they'll appear as top-level.`
            )
          )
            return;
          startTransition(async () => {
            await deleteSubfolder(subfolder.id);
          });
        }}
        className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30 shrink-0"
        style={{ color: "#dc2626" }}
      >
        Delete
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add `AddSubfolderForm` component**

Insert after `SubfolderRow`:

```tsx
// ── Add subfolder inline form ─────────────────────────────────────────────────

function AddSubfolderForm({ fieldId, nextSortOrder }: { fieldId: string; nextSortOrder: number }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");
    startTransition(async () => {
      const result = await upsertSubfolder({
        field_id: fieldId,
        name: trimmed,
        sort_order: nextSortOrder,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setName("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex gap-2 items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="New subfolder name…"
          className="input flex-1 text-sm"
        />
        <button
          onClick={submit}
          disabled={pending || !name.trim()}
          className="btn btn-primary btn-sm disabled:opacity-50 shrink-0"
        >
          {pending ? "Adding…" : "+ Add"}
        </button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Update `FieldCard` to show subfolders section**

In `FieldCard`, find the expanded resources section (the `{expanded && (...)}` block around line 1036) and replace it:

```tsx
{/* Expanded: subfolders + resources */}
{expanded && (
  <div
    className="px-4 pb-4 flex flex-col gap-4"
    style={{ borderTop: "1px solid var(--b-subtle)" }}
  >
    {/* ── Subfolders section ── */}
    <div className="pt-3">
      <div className="flex items-center justify-between pb-2">
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--t-muted)" }}
        >
          Subfolders
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {(field.recruitment_subfolders ?? []).length === 0 ? (
          <p className="text-xs" style={{ color: "var(--t-faint)" }}>
            No subfolders yet — add one to group resources.
          </p>
        ) : (
          (field.recruitment_subfolders ?? []).map((sf, i, arr) => (
            <SubfolderRow
              key={sf.id}
              subfolder={sf}
              resourceCount={sf.recruitment_resources?.length ?? 0}
              isFirst={i === 0}
              isLast={i === arr.length - 1}
            />
          ))
        )}
        <AddSubfolderForm
          fieldId={field.id}
          nextSortOrder={
            (field.recruitment_subfolders ?? []).length > 0
              ? Math.max(...(field.recruitment_subfolders ?? []).map((s) => s.sort_order)) + 10
              : 10
          }
        />
      </div>
    </div>

    {/* ── Resources section ── */}
    <div style={{ borderTop: "1px solid var(--b-subtle)", paddingTop: "1rem" }}>
      <div className="flex items-center justify-between pb-2">
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--t-muted)" }}
        >
          Resources
        </p>
        <button
          onClick={() => onAddResource(field.id)}
          className="btn btn-primary btn-sm"
        >
          + Add Resource
        </button>
      </div>

      {(field.recruitment_resources ?? []).length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "var(--t-muted)" }}>
          No resources yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {(field.recruitment_resources ?? []).map((r, i, arr) => (
            <ResourceRow
              key={r.id}
              resource={r}
              subfolder={
                (field.recruitment_subfolders ?? []).find(
                  (sf) => sf.id === r.subfolder_id
                ) ?? null
              }
              fields={fields}
              isFirst={i === 0}
              isLast={i === arr.length - 1}
              onEdit={(res) => setEditingResource(res)}
            />
          ))}
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 6: Update `ResourceRow` to accept and display subfolder name**

Find `ResourceRow` (around line 757) and update its props + render to show which subfolder a resource belongs to:

```tsx
function ResourceRow({
  resource,
  subfolder,
  fields,
  isFirst,
  isLast,
  onEdit,
}: {
  resource: RecruitmentResource;
  subfolder: RecruitmentSubfolder | null;
  fields: FieldWithResources[];
  isFirst: boolean;
  isLast: boolean;
  onEdit: (r: RecruitmentResource) => void;
}) {
```

Inside the component's JSX, after the type badge and before the title, add a subfolder label when present:

```tsx
{/* Type badge */}
<span
  className="shrink-0 badge"
  style={
    resource.resource_type === "file"
      ? { background: "rgba(10,34,64,0.07)", color: "var(--t-secondary)" }
      : { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }
  }
>
  {resource.resource_type === "file"
    ? mimeLabel(resource.file_mime)
    : "Link"}
</span>

{/* Subfolder tag */}
{subfolder && (
  <span
    className="shrink-0 text-[10px] px-2 py-0.5 rounded-md font-medium hidden sm:block"
    style={{ background: "var(--s-0)", color: "var(--t-muted)", border: "1px solid var(--b-subtle)" }}
  >
    📁 {subfolder.name}
  </span>
)}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Start dev server and visually verify admin**

```bash
npm run dev
```

Go to `http://localhost:3000/admin/recruitment`. Expand a field card. You should see:
- "Subfolders" section with "No subfolders yet" message and the inline Add form
- "Resources" section with existing resources (unchanged)
- Each resource row shows a subfolder tag if it has one (none yet)

Try adding a subfolder — it should appear immediately via `revalidatePath`.

- [ ] **Step 9: Commit**

```bash
git add src/app/admin/recruitment/page.tsx src/app/admin/recruitment/RecruitmentAdminClient.tsx
git commit -m "feat: add subfolder management UI to admin recruitment panel"
```

---

## Task 5: Folder Upload Modal

**Files:**
- Modify: `src/app/admin/recruitment/RecruitmentAdminClient.tsx`

**Interfaces:**
- Consumes: `upsertSubfolder` (Task 2), `upsertResource` (Task 2), `getSignedUploadUrl` (existing), `FieldWithResources` (Task 2)
- Produces: "Upload Folder" button on each FieldCard header that opens a modal; modal accepts a local folder via `webkitdirectory` input; previews subfolder structure; uploads all files with correct subfolder assignments and shows progress

- [ ] **Step 1: Add `FolderUploadModal` component**

Add this component to `RecruitmentAdminClient.tsx` before `FieldCard`:

```tsx
// ── Folder upload modal ───────────────────────────────────────────────────────

type FolderGroup = {
  subfolderName: string | null; // null = top-level
  files: File[];
};

function groupFilesBySubfolder(files: FileList): FolderGroup[] {
  const map = new Map<string | null, File[]>();
  for (const file of Array.from(files)) {
    const parts = file.webkitRelativePath.split("/");
    // parts[0] = root folder, parts[1] = subfolder OR filename
    const key = parts.length > 2 ? parts[1] : null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(file);
  }
  // Convert to sorted array: named groups first (alphabetically), then top-level
  const named = Array.from(map.entries())
    .filter(([k]) => k !== null)
    .sort((a, b) => a[0]!.localeCompare(b[0]!))
    .map(([k, v]) => ({ subfolderName: k, files: v }));
  const topLevel = map.has(null) ? [{ subfolderName: null, files: map.get(null)! }] : [];
  return [...named, ...topLevel];
}

function FolderUploadModal({
  field,
  onClose,
}: {
  field: FieldWithResources;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [phase, setPhase] = useState<"pick" | "preview" | "uploading" | "done" | "error">("pick");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setGroups(groupFilesBySubfolder(files));
    setPhase("preview");
  }

  async function startUpload() {
    setPhase("uploading");
    const total = groups.reduce((n, g) => n + g.files.length, 0);
    setProgress({ done: 0, total });

    // Build subfolder id map from existing subfolders
    const subfolderIdMap = new Map<string, string>();
    for (const sf of field.recruitment_subfolders ?? []) {
      subfolderIdMap.set(sf.name.toLowerCase(), sf.id);
    }

    let nextOrder =
      (field.recruitment_subfolders ?? []).length > 0
        ? Math.max(...(field.recruitment_subfolders ?? []).map((s) => s.sort_order)) + 10
        : 10;

    let done = 0;

    for (const group of groups) {
      let subfolderId: string | null = null;

      // Upsert subfolder row if named
      if (group.subfolderName !== null) {
        const existingId = subfolderIdMap.get(group.subfolderName.toLowerCase());
        if (existingId) {
          subfolderId = existingId;
        } else {
          const result = await upsertSubfolder({
            field_id: field.id,
            name: group.subfolderName,
            sort_order: nextOrder,
          });
          if (result.error) {
            setErrorMsg(`Failed to create subfolder "${group.subfolderName}": ${result.error}`);
            setPhase("error");
            return;
          }
          subfolderId = result.id!;
          subfolderIdMap.set(group.subfolderName.toLowerCase(), subfolderId);
          nextOrder += 10;
        }
      }

      // Upload each file in the group
      for (const file of group.files) {
        const ext = file.name.split(".").pop() ?? "";
        const base = safeName(file.name.replace(/\.[^.]+$/, ""));
        const subfolderSlug = group.subfolderName
          ? group.subfolderName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
          : null;
        const storagePath = subfolderSlug
          ? `${field.slug}/${subfolderSlug}/${Date.now()}-${base}${ext ? "." + ext : ""}`
          : `${field.slug}/${Date.now()}-${base}${ext ? "." + ext : ""}`;

        const urlResult = await getSignedUploadUrl(storagePath);
        if ("error" in urlResult) {
          setErrorMsg(`Upload failed for "${file.name}": ${urlResult.error}`);
          setPhase("error");
          return;
        }

        const res = await fetch(urlResult.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) {
          setErrorMsg(`Upload failed for "${file.name}": ${res.statusText}`);
          setPhase("error");
          return;
        }

        const saveResult = await upsertResource({
          field_id: field.id,
          subfolder_id: subfolderId,
          title: file.name.replace(/\.[^.]+$/, ""),
          resource_type: "file",
          file_path: storagePath,
          file_mime: file.type || null,
        });
        if (saveResult.error) {
          setErrorMsg(`Failed to save "${file.name}": ${saveResult.error}`);
          setPhase("error");
          return;
        }

        done++;
        setProgress({ done, total });
      }
    }

    setPhase("done");
    setTimeout(onClose, 1000);
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
        style={{ background: "var(--s-0)", border: "1px solid var(--b-default)", boxShadow: "var(--shadow-xl)" }}
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
            Upload Folder — {field.name}
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

        <div className="p-6">
          {phase === "pick" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm" style={{ color: "var(--t-secondary)" }}>
                Select a folder from your computer. Sub-folders inside it become subfolder sections.
                Files at the root become top-level resources.
              </p>
              <label
                className="flex flex-col items-center justify-center gap-3 px-4 py-10 rounded-xl cursor-pointer border-2 border-dashed transition-colors"
                style={{ borderColor: "var(--b-default)" }}
              >
                <input
                  type="file"
                  className="sr-only"
                  // @ts-expect-error — webkitdirectory is non-standard but widely supported
                  webkitdirectory=""
                  multiple
                  onChange={onFilesSelected}
                />
                <svg width="28" height="28" fill="none" stroke="var(--t-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                  Click to select a folder
                </p>
                <p className="text-xs" style={{ color: "var(--t-muted)" }}>
                  Sub-folders are detected automatically
                </p>
              </label>
            </div>
          )}

          {phase === "preview" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                Detected structure:
              </p>
              <div
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{ background: "var(--s-1)", border: "1px solid var(--b-default)" }}
              >
                {groups.map((g) => (
                  <div key={g.subfolderName ?? "__top__"} className="flex items-center gap-3">
                    <span className="text-sm" style={{ color: "var(--t-muted)" }}>
                      {g.subfolderName ? "📁" : "📄"}
                    </span>
                    <span className="text-sm flex-1" style={{ color: "var(--t-primary)" }}>
                      {g.subfolderName ?? "(top-level files)"}
                    </span>
                    <span className="badge badge-neutral text-[11px]">
                      {g.files.length} file{g.files.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--t-muted)" }}>
                {groups.reduce((n, g) => n + g.files.length, 0)} files total
              </p>
              <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--b-subtle)" }}>
                <button onClick={() => setPhase("pick")} className="btn btn-ghost btn-sm">
                  Back
                </button>
                <button onClick={startUpload} className="btn btn-primary btn-sm">
                  Upload All
                </button>
              </div>
            </div>
          )}

          {phase === "uploading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <span
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--akp-navy)", borderTopColor: "transparent" }}
              />
              <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                Uploading {progress.done} of {progress.total} files…
              </p>
              <div className="w-full rounded-full h-1.5" style={{ background: "var(--b-default)" }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    background: "var(--akp-gold)",
                    width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
              >
                ✓
              </div>
              <p className="font-semibold" style={{ color: "var(--t-primary)" }}>
                {progress.total} file{progress.total !== 1 ? "s" : ""} uploaded.
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm" style={{ color: "#dc2626" }}>
                {errorMsg}
              </p>
              <p className="text-xs" style={{ color: "var(--t-muted)" }}>
                Files uploaded before the error were saved. You can retry the remaining files manually.
              </p>
              <div className="flex justify-end">
                <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `folderUploadFieldId` state to `FieldCard` and wire the button**

In `FieldCard`, add state for the folder upload modal and the button in the field header row:

At the top of `FieldCard`, add state alongside `expanded` and `editingResource`:
```tsx
const [showFolderUpload, setShowFolderUpload] = useState(false);
```

In the field header row (after the resource count/expand button and before the reorder buttons), add:
```tsx
{/* Upload Folder */}
<button
  onClick={() => setShowFolderUpload(true)}
  title="Upload a folder"
  className="shrink-0 btn btn-ghost btn-sm"
>
  📁 Upload Folder
</button>
```

At the bottom of `FieldCard`'s return (after the `editingResource` modal), add:
```tsx
{showFolderUpload && (
  <FolderUploadModal
    field={field}
    onClose={() => setShowFolderUpload(false)}
  />
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. The `@ts-expect-error` on `webkitdirectory` is intentional.

- [ ] **Step 4: Start dev server and test folder upload**

```bash
npm run dev
```

Go to `/admin/recruitment`. Expand a field card. Click "📁 Upload Folder". Select a local folder that has sub-folders inside it. Verify:
- Preview shows the detected subfolder structure with file counts
- Clicking "Upload All" shows the progress bar incrementing
- After completion, refreshing `/recruitment` shows the resources grouped under subfolder accordions

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/recruitment/RecruitmentAdminClient.tsx
git commit -m "feat: add folder upload modal with auto-subfolder detection"
```

---

## Task 6: Add Resource Modal — Subfolder Dropdown

**Files:**
- Modify: `src/app/admin/recruitment/RecruitmentAdminClient.tsx`

**Interfaces:**
- Consumes: `SubfolderWithResources` from each `FieldWithResources` (Task 2); `upsertResource` now accepts `subfolder_id` (Task 2)
- Produces: "Add Resource" / "Edit Resource" modal shows an optional "Subfolder" select field, populated from the selected field's existing subfolders; selected subfolder_id is passed to `upsertResource`

- [ ] **Step 1: Add `subfolderId` state to `ResourceModal`**

In `ResourceModal`, find the existing state declarations (around line 328) and add:

```tsx
const [subfolderId, setSubfolderId] = useState<string | null>(
  resource?.subfolder_id ?? null
);
```

Also update `selectedField` derivation to be reactive:
```tsx
const selectedField = fields.find((f) => f.id === fieldId);
const subfolderOptions = selectedField?.recruitment_subfolders ?? [];
```

When the field changes, reset `subfolderId`:
```tsx
// Add this effect after the existing useEffect (or alongside it)
// In the onChange for the field selector, also call: setSubfolderId(null)
```

- [ ] **Step 2: Add the subfolder select to `ResourceModal` JSX**

In `ResourceModal`'s JSX, after the "Field" selector and before the "Type toggle", add:

```tsx
{/* Subfolder selector */}
{subfolderOptions.length > 0 && (
  <div className="flex flex-col gap-1">
    <label className="input-label">
      Subfolder{" "}
      <span className="font-normal normal-case" style={{ color: "var(--t-muted)" }}>
        (optional)
      </span>
    </label>
    <select
      value={subfolderId ?? ""}
      onChange={(e) => setSubfolderId(e.target.value || null)}
      className="input"
    >
      <option value="">— No subfolder (top-level) —</option>
      {subfolderOptions.map((sf) => (
        <option key={sf.id} value={sf.id}>
          📁 {sf.name}
        </option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 3: Wire `subfolderId` into every `upsertResource` call in `handleSave`**

In `handleSave`, every call to `upsertResource` needs `subfolder_id: subfolderId`. There are three places:

**Multi-file loop** (around line 408):
```tsx
const result = await upsertResource({
  field_id: fieldId,
  subfolder_id: subfolderId,
  title: file.name.replace(/\.[^.]+$/, ""),
  description: description || undefined,
  resource_type: "file",
  file_path: path,
  file_mime: file.type || null,
});
```

**Single file** (around line 455):
```tsx
const result = await upsertResource({
  id: resource?.id,
  field_id: fieldId,
  subfolder_id: subfolderId,
  title: title || (selectedFiles[0]?.name.replace(/\.[^.]+$/, "") ?? ""),
  description: description || undefined,
  resource_type: "file",
  file_path: path,
  file_mime: mime,
});
```

**Link** (around line 478):
```tsx
const result = await upsertResource({
  id: resource?.id,
  field_id: fieldId,
  subfolder_id: subfolderId,
  title,
  description: description || undefined,
  resource_type: "link",
  external_url: externalUrl,
});
```

- [ ] **Step 4: Reset subfolderId when field changes**

Find the field selector's `onChange`:
```tsx
onChange={(e) => setFieldId(e.target.value)}
```
Update it to also reset the subfolder:
```tsx
onChange={(e) => {
  setFieldId(e.target.value);
  setSubfolderId(null);
}}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Start dev server and test the subfolder dropdown**

```bash
npm run dev
```

Go to `/admin/recruitment`. After having created at least one subfolder in Task 4:
1. Click "+ Add Resource" on a field that has subfolders
2. Confirm the "Subfolder" dropdown appears and lists the field's subfolders
3. Select a subfolder, upload a file, save
4. On `/recruitment`, confirm the resource appears inside the correct subfolder accordion

Also test:
- Adding a resource with no subfolder selected → appears as top-level
- Changing the field selector → subfolder dropdown updates to new field's subfolders

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/recruitment/RecruitmentAdminClient.tsx
git commit -m "feat: add subfolder selector to add/edit resource modal"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `recruitment_subfolders` table + `subfolder_id` FK column (Task 1)
- ✅ RLS mirrors existing pattern (Task 1)
- ✅ `upsertSubfolder`, `deleteSubfolder`, `moveSubfolder` actions (Task 2)
- ✅ Updated types including `RecruitmentSubfolder`, `SubfolderWithResources`, updated `FieldWithResources` (Task 2)
- ✅ Member page subfolder accordion with `<details>/<summary>` (Task 3)
- ✅ Top-level resources (no subfolder) still render below subfolders (Task 3)
- ✅ Fields with no subfolders render unchanged flat grid (Task 3)
- ✅ Admin subfolder management: add, rename, reorder, delete (Task 4)
- ✅ ON DELETE SET NULL — resources survive subfolder deletion (Task 1 + Task 4 confirm message)
- ✅ Folder upload modal with `webkitdirectory`, structure preview, progress bar (Task 5)
- ✅ Auto-upserts subfolder rows on upload, skips existing names (Task 5)
- ✅ Files at folder root upload as top-level resources (Task 5)
- ✅ Add Resource modal gets subfolder dropdown (Task 6)
- ✅ Subfolder dropdown resets when field changes (Task 6)

**Type consistency check:**
- `SubfolderWithResources` defined in Task 2, consumed in Tasks 3, 4, 5 ✅
- `upsertSubfolder` returns `{ error?: string; id?: string }` — Task 5 reads `result.id!` only after confirming no error ✅
- `RecruitmentResource.subfolder_id` added in Task 2, used in Task 3 filter and Task 4 resource row lookup ✅
- `ResourceInput.subfolder_id` added in Task 2, all three `upsertResource` call sites in Task 6 pass it ✅
