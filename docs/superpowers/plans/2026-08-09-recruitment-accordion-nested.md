# Recruitment Accordion + Nested Subfolders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static all-expanded recruitment page with a single-open field accordion, and add one level of subfolder nesting (field → subfolder → sub-subfolder) throughout the admin and member pages.

**Architecture:** A new `RecruitmentClient.tsx` Client Component owns accordion state on the member page; the Server Component only fetches data. A shared `src/lib/subfolderTree.ts` utility builds the tree from a flat subfolder array and is used by both the member page and the admin client. A single new nullable `parent_id` FK column on `recruitment_subfolders` powers the nesting.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19 (`useState`, `useEffect`, `useTransition`), Supabase, Tailwind CSS v4.

## Global Constraints

- All pages export `export const dynamic = "force-dynamic"` — unchanged
- Server-side DB access always via `createAdminClient()` — never user-scoped client
- Mutations call `revalidatePath("/recruitment")` AND `revalidatePath("/admin/recruitment")` after every write
- Auth checks: `getCurrentMember()` at top of every server action, role checked inline
- Dark-mode text: never use `var(--akp-navy)` for readable text — use `var(--t-primary)`
- React 19 mutations pattern: `useTransition` + `startTransition(async () => { await serverAction(); })`
- Alumni hard-block on `/recruitment` (`if (member.role === "alumni") redirect("/opportunities")`) — unchanged
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never import `admin.ts` in a Client Component
- TypeScript must compile clean after every task (`npx tsc --noEmit`)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `migrations/012_nested_subfolders.sql` | **Create** | Add `parent_id` column + index to `recruitment_subfolders` |
| `src/lib/subfolderTree.ts` | **Create** | `SubfolderNode` type + `buildSubfolderTree` pure utility |
| `src/lib/actions/recruitment.ts` | **Modify** | Add `parent_id` to types + `SubfolderInput`; fix `moveSubfolder` sibling scope; add `parent_id` to `upsertSubfolder` insert |
| `src/app/recruitment/RecruitmentClient.tsx` | **Create** | Client Component: field accordion + nested subfolder rendering |
| `src/app/recruitment/page.tsx` | **Modify** | Remove inline rendering; pass fields to `RecruitmentClient` |
| `src/app/admin/recruitment/RecruitmentAdminClient.tsx` | **Modify** | Nested subfolder UI, updated `AddSubfolderForm`, updated `FolderUploadModal` |

---

## Task 1: DB Migration

**Files:**
- Create: `migrations/012_nested_subfolders.sql`

**Interfaces:**
- Produces: `recruitment_subfolders.parent_id` nullable UUID FK (self-reference, ON DELETE CASCADE); index `idx_recruitment_subfolders_parent_id`

- [ ] **Step 1: Create the migration file**

Create `migrations/012_nested_subfolders.sql`:

```sql
-- ============================================================
-- AKPD · Migration 012 — Nested subfolders (parent_id)
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (ADD COLUMN IF NOT EXISTS)
-- ============================================================

alter table public.recruitment_subfolders
  add column if not exists parent_id uuid
  references public.recruitment_subfolders(id)
  on delete cascade;

create index if not exists idx_recruitment_subfolders_parent_id
  on public.recruitment_subfolders(parent_id);
```

- [ ] **Step 2: Run in Supabase**

Open Supabase Dashboard → SQL Editor → New query. Paste and run.

Verify: Table Editor → `recruitment_subfolders` → confirm `parent_id` column exists (nullable UUID).

- [ ] **Step 3: Commit**

```bash
git add migrations/012_nested_subfolders.sql
git commit -m "feat: add parent_id to recruitment_subfolders for nesting"
```

---

## Task 2: Tree Utility + Type/Action Updates

**Files:**
- Create: `src/lib/subfolderTree.ts`
- Modify: `src/lib/actions/recruitment.ts`

**Interfaces:**
- Consumes: `SubfolderWithResources` from `src/lib/actions/recruitment.ts`
- Produces:
  - `SubfolderNode` type: `SubfolderWithResources & { children: SubfolderNode[] }`
  - `buildSubfolderTree(subfolders: SubfolderWithResources[]): SubfolderNode[]` — pure function, exported from `src/lib/subfolderTree.ts`
  - Updated `RecruitmentSubfolder`: adds `parent_id: string | null`
  - Updated `SubfolderInput`: adds `parent_id?: string | null`
  - `upsertSubfolder` insert row now includes `parent_id`
  - `moveSubfolder` scopes siblings by `parent_id` (`.is("parent_id", null)` for roots, `.eq("parent_id", x)` for children)

- [ ] **Step 1: Create `src/lib/subfolderTree.ts`**

```ts
import type { SubfolderWithResources } from "@/lib/actions/recruitment";

export type SubfolderNode = SubfolderWithResources & {
  children: SubfolderNode[];
};

/**
 * Converts a flat subfolder array into a sorted tree.
 * Subfolders whose parent_id points to an unknown id are treated as roots.
 */
export function buildSubfolderTree(
  subfolders: SubfolderWithResources[]
): SubfolderNode[] {
  const map = new Map<string, SubfolderNode>();
  for (const sf of subfolders) {
    map.set(sf.id, { ...sf, children: [] });
  }

  const roots: SubfolderNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortLevel(nodes: SubfolderNode[]) {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    for (const n of nodes) sortLevel(n.children);
  }
  sortLevel(roots);

  return roots;
}
```

- [ ] **Step 2: Add `parent_id` to `RecruitmentSubfolder` type in `src/lib/actions/recruitment.ts`**

Find the `RecruitmentSubfolder` type and add `parent_id`:

```ts
export type RecruitmentSubfolder = {
  id: string;
  field_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
};
```

- [ ] **Step 3: Add `parent_id` to `SubfolderInput` in `src/lib/actions/recruitment.ts`**

Find `SubfolderInput` and add `parent_id`:

```ts
export type SubfolderInput = {
  id?: string;
  field_id: string;
  parent_id?: string | null;
  name: string;
  sort_order?: number;
};
```

- [ ] **Step 4: Pass `parent_id` through in `upsertSubfolder` insert**

In `upsertSubfolder`, find the `insert` call and add `parent_id` to the row:

```ts
const { data, error } = await supabase
  .from("recruitment_subfolders")
  .insert({
    field_id: input.field_id,
    parent_id: input.parent_id ?? null,
    name: input.name.trim(),
    sort_order: input.sort_order ?? 0,
  })
  .select("id")
  .single();
```

The update path (rename) does NOT change `parent_id` — leave the update row as `{ name, sort_order }` only.

- [ ] **Step 5: Fix `moveSubfolder` to scope siblings by `parent_id`**

Find `moveSubfolder` and replace the sibling query to scope by `parent_id`:

```ts
export async function moveSubfolder(
  id: string,
  direction: "up" | "down"
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();

  const { data: subfolder } = await supabase
    .from("recruitment_subfolders")
    .select("id, field_id, parent_id, sort_order")
    .eq("id", id)
    .maybeSingle();

  if (!subfolder) return { error: "Subfolder not found." };
  if (subfolder.id === undefined) return { error: "Subfolder not found." };

  // Scope siblings to same parent level
  const baseQuery = supabase
    .from("recruitment_subfolders")
    .select("id, sort_order")
    .eq("field_id", subfolder.field_id)
    .order("sort_order");

  const { data: siblings } = await (
    subfolder.parent_id
      ? baseQuery.eq("parent_id", subfolder.parent_id)
      : baseQuery.is("parent_id", null)
  );

  if (!siblings) return {};

  const idx = siblings.findIndex((s) => s.id === id);
  if (idx === -1) return {};

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return {};

  const a = siblings[idx];
  const b = siblings[swapIdx];

  await Promise.all([
    supabase.from("recruitment_subfolders").update({ sort_order: b.sort_order }).eq("id", a.id),
    supabase.from("recruitment_subfolders").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);

  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}
```

- [ ] **Step 6: Update the Supabase queries to include `parent_id` in subfolder selects**

Both the member page query and the admin page query already select `id, field_id, name, sort_order` from `recruitment_subfolders`. Add `parent_id` to both. In `src/app/recruitment/page.tsx`:

```ts
recruitment_subfolders (
  id, field_id, parent_id, name, sort_order,
  recruitment_resources (
    id, field_id, subfolder_id, title, description, resource_type,
    file_path, file_mime, external_url, sort_order
  )
),
```

In `src/app/admin/recruitment/page.tsx`:

```ts
recruitment_subfolders (
  id, field_id, parent_id, name, sort_order,
  recruitment_resources (
    id, field_id, subfolder_id, title, description, resource_type,
    file_path, file_mime, external_url, sort_order
  )
),
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd akpd-site && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/subfolderTree.ts src/lib/actions/recruitment.ts \
        src/app/recruitment/page.tsx src/app/admin/recruitment/page.tsx
git commit -m "feat: add subfolder tree utility and parent_id to actions"
```

---

## Task 3: Member Page Accordion

**Files:**
- Create: `src/app/recruitment/RecruitmentClient.tsx`
- Modify: `src/app/recruitment/page.tsx`

**Interfaces:**
- Consumes:
  - `FieldWithResources` from `@/lib/actions/recruitment`
  - `RecruitmentResource` from `@/lib/actions/recruitment`
  - `buildSubfolderTree`, `SubfolderNode` from `@/lib/subfolderTree`
  - `DownloadButton` from `./DownloadButton`
- Produces: `<RecruitmentClient fields={FieldWithResources[]} isAdmin={boolean} />` — default export, Client Component

- [ ] **Step 1: Create `src/app/recruitment/RecruitmentClient.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { FieldWithResources, RecruitmentResource } from "@/lib/actions/recruitment";
import { buildSubfolderTree, type SubfolderNode } from "@/lib/subfolderTree";
import DownloadButton from "./DownloadButton";

// ── Helpers (copied from page.tsx which will no longer need them) ─────────────

function mimeLabel(mime: string | null): string {
  if (!mime) return "File";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("document")) return "Word";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "Slides";
  if (mime.includes("sheet") || mime.includes("excel")) return "Excel";
  return "File";
}

function mimeDot(mime: string | null): string {
  if (!mime) return "#8a8278";
  if (mime.includes("pdf")) return "#e53e3e";
  if (mime.includes("word") || mime.includes("document")) return "#3182ce";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "#dd6b20";
  if (mime.includes("sheet") || mime.includes("excel")) return "#38a169";
  return "#8a8278";
}

// ── ResourceCard ──────────────────────────────────────────────────────────────

function ResourceCard({ resource }: { resource: RecruitmentResource }) {
  const isFile = resource.resource_type === "file";
  const dot = isFile ? mimeDot(resource.file_mime) : "#c9a84c";
  const label = isFile ? mimeLabel(resource.file_mime) : "Link";

  return (
    <div className="card card-interactive p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
        <span
          className="text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "var(--t-muted)" }}
        >
          {label}
        </span>
      </div>
      <p
        className="text-[13px] font-semibold leading-snug flex-1"
        style={{ color: "var(--t-primary)" }}
      >
        {resource.title}
      </p>
      {resource.description && (
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--t-secondary)" }}>
          {resource.description}
        </p>
      )}
      <div className="mt-auto pt-2" style={{ borderTop: "1px solid var(--b-subtle)" }}>
        {isFile && resource.file_path ? (
          <DownloadButton
            filePath={resource.file_path}
            title={resource.title}
            mime={resource.file_mime}
          />
        ) : resource.external_url ? (
          <a
            href={resource.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm w-full justify-center"
          >
            <svg
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              className="shrink-0"
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open link
          </a>
        ) : null}
      </div>
    </div>
  );
}

// ── SubfolderPanel: renders one node and its children recursively ─────────────

function SubfolderPanel({
  node,
  depth = 0,
}: {
  node: SubfolderNode;
  depth?: number;
}) {
  const resources = node.recruitment_resources ?? [];
  const totalCount =
    resources.length +
    node.children.reduce(
      (n, c) => n + (c.recruitment_resources?.length ?? 0),
      0
    );

  return (
    <details open={depth === 0}>
      <summary
        className="flex items-center justify-between px-4 py-3 cursor-pointer list-none select-none transition-colors rounded-xl"
        style={{
          background: depth === 0 ? "var(--s-1)" : "var(--s-2)",
          border: "1px solid var(--b-default)",
          marginLeft: depth > 0 ? "1rem" : "0",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "var(--t-muted)" }}>📁</span>
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--t-primary)" }}
          >
            {node.name}
          </span>
        </div>
        <span className="badge badge-neutral text-[11px]">{totalCount}</span>
      </summary>

      <div
        className="pt-2 pb-1"
        style={{ paddingLeft: depth > 0 ? "1rem" : "0.25rem" }}
      >
        {/* Nested children first */}
        {node.children.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {node.children.map((child) => (
              <SubfolderPanel key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
        {/* Resources in this node */}
        {resources.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        )}
        {resources.length === 0 && node.children.length === 0 && (
          <p
            className="text-[13px] text-center py-4"
            style={{ color: "var(--t-muted)" }}
          >
            No resources in this folder yet.
          </p>
        )}
      </div>
    </details>
  );
}

// ── FieldPanel: content area shown when a field is open ───────────────────────

function FieldPanel({ field }: { field: FieldWithResources }) {
  const tree = buildSubfolderTree(field.recruitment_subfolders ?? []);
  const topLevelResources = (field.recruitment_resources ?? []).filter(
    (r) => r.subfolder_id === null
  );
  const hasContent = tree.length > 0 || topLevelResources.length > 0;

  return (
    <div className="px-4 pb-6 pt-4 flex flex-col gap-3">
      {tree.map((node) => (
        <SubfolderPanel key={node.id} node={node} />
      ))}
      {topLevelResources.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
          {topLevelResources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}
      {!hasContent && (
        <p
          className="text-[13px] text-center py-6"
          style={{ color: "var(--t-muted)" }}
        >
          Resources for this track are being added.
        </p>
      )}
    </div>
  );
}

// ── RecruitmentClient: main accordion ─────────────────────────────────────────

export default function RecruitmentClient({
  fields,
  isAdmin,
}: {
  fields: FieldWithResources[];
  isAdmin: boolean;
}) {
  const [openFieldId, setOpenFieldId] = useState<string | null>(null);

  // If the page was linked to with a hash (e.g. from the quick-jump pills),
  // open that field on mount.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const match = fields.find((f) => f.slug === hash);
      if (match) setOpenFieldId(match.id);
    }
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

  return (
    <div className="flex flex-col gap-2">
      {fields.map((field) => {
        const isOpen = openFieldId === field.id;
        const count = totalResources(field);

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
            {/* Header — always visible */}
            <button
              onClick={() => toggle(field.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors"
              style={{ background: isOpen ? "var(--s-1)" : "transparent" }}
              onMouseEnter={(e) => {
                if (!isOpen)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--s-1)";
              }}
              onMouseLeave={(e) => {
                if (!isOpen)
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
              }}
            >
              {field.icon && (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                  style={{
                    background: "var(--s-1)",
                    border: "1px solid var(--b-default)",
                  }}
                  aria-hidden
                >
                  {field.icon}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p
                  className="text-[15px] font-bold"
                  style={{
                    color: "var(--t-primary)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {field.name}
                </p>
                {field.description && (
                  <p
                    className="text-[12px] mt-0.5 truncate"
                    style={{ color: "var(--t-muted)" }}
                  >
                    {field.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`badge text-[11px] ${
                    count > 0 ? "badge-navy" : "badge-neutral"
                  }`}
                >
                  {count > 0
                    ? `${count} resource${count !== 1 ? "s" : ""}`
                    : "Coming soon"}
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
  );
}
```

- [ ] **Step 2: Update `src/app/recruitment/page.tsx`**

The page no longer renders `FieldSection`, `ResourceCard`, `mimeLabel`, `mimeDot`, or imports `DownloadButton` — all of those move to `RecruitmentClient.tsx`. Replace the entire file content:

```tsx
import { requireMember, getCurrentMember } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FieldWithResources } from "@/lib/actions/recruitment";
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
    .eq("is_published", true)
    .order("sort_order")
    .order("sort_order", { referencedTable: "recruitment_subfolders" })
    .order("sort_order", { referencedTable: "recruitment_resources" });

  const fields = (raw ?? []) as FieldWithResources[];
  const fieldsWithContent = fields.filter(
    (f) =>
      (f.recruitment_subfolders ?? []).length > 0 ||
      (f.recruitment_resources ?? []).length > 0
  );

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
        {fields.length === 0 ? (
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
          <RecruitmentClient fields={fields} isAdmin={isAdmin} />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/recruitment/RecruitmentClient.tsx src/app/recruitment/page.tsx
git commit -m "feat: replace static recruitment page with single-open field accordion"
```

---

## Task 4: Admin Nested Subfolder UI

**Files:**
- Modify: `src/app/admin/recruitment/RecruitmentAdminClient.tsx`

**Interfaces:**
- Consumes: `buildSubfolderTree`, `SubfolderNode` from `@/lib/subfolderTree`; `upsertSubfolder` now accepts `parent_id`
- Produces: SubfolderRow shows "+ Sub-folder" button; AddSubfolderForm accepts `parentId`; FieldCard subfolders section renders tree (indented); FolderUploadModal handles 3-level paths

- [ ] **Step 1: Add imports to `RecruitmentAdminClient.tsx`**

At the top of the imports, add:

```ts
import { buildSubfolderTree, type SubfolderNode } from "@/lib/subfolderTree";
```

- [ ] **Step 2: Update `AddSubfolderForm` to accept `parentId` and `onDone`**

Find `AddSubfolderForm` and replace it entirely:

```tsx
function AddSubfolderForm({
  fieldId,
  parentId = null,
  nextSortOrder,
  onDone,
}: {
  fieldId: string;
  parentId?: string | null;
  nextSortOrder: number;
  onDone?: () => void;
}) {
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
        parent_id: parentId,
        name: trimmed,
        sort_order: nextSortOrder,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setName("");
        onDone?.();
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
          placeholder={
            parentId ? "New sub-folder name…" : "New subfolder name…"
          }
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

- [ ] **Step 3: Update `SubfolderRow` to show "+ Sub-folder" button**

Find `SubfolderRow` and replace it entirely:

```tsx
function SubfolderRow({
  subfolder,
  resourceCount,
  isFirst,
  isLast,
  childSortOrder,
}: {
  subfolder: RecruitmentSubfolder;
  resourceCount: number;
  isFirst: boolean;
  isLast: boolean;
  childSortOrder: number;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(subfolder.name);
  const [showAddChild, setShowAddChild] = useState(false);
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
      className="flex flex-col gap-1 transition-opacity"
      style={{ opacity: pending ? 0.5 : 1 }}
    >
      {/* Row */}
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-xl"
        style={{
          background: "var(--s-2)",
          border: "1px solid var(--b-subtle)",
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
          <>
            <button
              onClick={() => setRenaming(true)}
              className="btn btn-ghost btn-sm"
            >
              Rename
            </button>
            <button
              onClick={() => setShowAddChild((v) => !v)}
              className="btn btn-ghost btn-sm"
              title="Add a sub-folder inside this folder"
            >
              + Sub-folder
            </button>
          </>
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

      {/* Inline add-child form */}
      {showAddChild && (
        <div className="pl-6">
          <AddSubfolderForm
            fieldId={subfolder.field_id}
            parentId={subfolder.id}
            nextSortOrder={childSortOrder}
            onDone={() => setShowAddChild(false)}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add `SubfolderTreeAdmin` recursive component**

Insert this component after `SubfolderRow` and before `AddSubfolderForm`:

```tsx
function SubfolderTreeAdmin({
  nodes,
  depth = 0,
}: {
  nodes: SubfolderNode[];
  depth?: number;
}) {
  return (
    <div
      className="flex flex-col gap-2"
      style={{ paddingLeft: depth > 0 ? "1.5rem" : "0" }}
    >
      {nodes.map((node, i) => (
        <div key={node.id}>
          <SubfolderRow
            subfolder={node}
            resourceCount={node.recruitment_resources?.length ?? 0}
            isFirst={i === 0}
            isLast={i === nodes.length - 1}
            childSortOrder={
              node.children.length > 0
                ? Math.max(...node.children.map((c) => c.sort_order)) + 10
                : 10
            }
          />
          {node.children.length > 0 && (
            <SubfolderTreeAdmin nodes={node.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Update FieldCard subfolders section to use `SubfolderTreeAdmin`**

In `FieldCard`, find the subfolders section inside the expanded panel. Replace the flat `.map(...)` with:

```tsx
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
      <SubfolderTreeAdmin
        nodes={buildSubfolderTree(field.recruitment_subfolders ?? [])}
      />
    )}
    <AddSubfolderForm
      fieldId={field.id}
      parentId={null}
      nextSortOrder={
        (field.recruitment_subfolders ?? []).filter((s) => !s.parent_id)
          .length > 0
          ? Math.max(
              ...(field.recruitment_subfolders ?? [])
                .filter((s) => !s.parent_id)
                .map((s) => s.sort_order)
            ) + 10
          : 10
      }
    />
  </div>
</div>
```

- [ ] **Step 6: Update `FolderUploadModal` — `FolderGroup` type + `groupFilesBySubfolder`**

Find the `FolderGroup` type and `groupFilesBySubfolder` function in `RecruitmentAdminClient.tsx` and replace both:

```tsx
type FolderGroup = {
  subfolderName: string | null;       // null = top-level file
  parentSubfolderName: string | null; // null = root subfolder
  files: File[];
};

function groupFilesBySubfolder(files: FileList): FolderGroup[] {
  const map = new Map<string, FolderGroup>();

  for (const file of Array.from(files)) {
    const parts = file.webkitRelativePath.split("/");
    // parts[0] = root folder (the selected folder itself)
    // depth 2: parts = [root, filename]           → top-level
    // depth 3: parts = [root, sub, filename]      → one subfolder
    // depth 4: parts = [root, sub, subsub, file]  → nested subfolder

    let key: string;
    let subfolderName: string | null;
    let parentSubfolderName: string | null;

    if (parts.length <= 2) {
      key = "__root__";
      subfolderName = null;
      parentSubfolderName = null;
    } else if (parts.length === 3) {
      key = parts[1];
      subfolderName = parts[1];
      parentSubfolderName = null;
    } else {
      // depth >= 4: use first two levels only (cap at two levels)
      key = `${parts[1]}/${parts[2]}`;
      subfolderName = parts[2];
      parentSubfolderName = parts[1];
    }

    if (!map.has(key)) {
      map.set(key, { subfolderName, parentSubfolderName, files: [] });
    }
    map.get(key)!.files.push(file);
  }

  // Order: top-level files first, root subfolders next, nested last (alphabetical within each tier)
  return Array.from(map.values()).sort((a, b) => {
    if (a.subfolderName === null) return -1;
    if (b.subfolderName === null) return 1;
    if (a.parentSubfolderName === null && b.parentSubfolderName !== null) return -1;
    if (a.parentSubfolderName !== null && b.parentSubfolderName === null) return 1;
    return (
      (a.parentSubfolderName ?? "").localeCompare(b.parentSubfolderName ?? "") ||
      a.subfolderName.localeCompare(b.subfolderName)
    );
  });
}
```

- [ ] **Step 7: Update `startUpload` in `FolderUploadModal` to handle `parentSubfolderName`**

Find the `startUpload` async function inside `FolderUploadModal`. Replace the subfolder upsert section (the part that builds `subfolderIdMap` and calls `upsertSubfolder`):

```tsx
async function startUpload() {
  setPhase("uploading");
  const total = groups.reduce((n, g) => n + g.files.length, 0);
  setProgress({ done: 0, total });

  // Seed map with existing subfolders (case-insensitive key = "name" or "parentname/name")
  const subfolderIdMap = new Map<string, string>();
  for (const sf of field.recruitment_subfolders ?? []) {
    subfolderIdMap.set(sf.name.toLowerCase(), sf.id);
    // Also index nested ones by parent/child key if we ever see them
  }

  let nextRootOrder =
    (field.recruitment_subfolders ?? []).filter((s) => !s.parent_id).length > 0
      ? Math.max(
          ...(field.recruitment_subfolders ?? [])
            .filter((s) => !s.parent_id)
            .map((s) => s.sort_order)
        ) + 10
      : 10;
  let nextChildOrder = 10;

  let done = 0;

  for (const group of groups) {
    let subfolderId: string | null = null;

    if (group.subfolderName !== null) {
      if (group.parentSubfolderName !== null) {
        // Nested subfolder — ensure root exists first
        const rootKey = group.parentSubfolderName.toLowerCase();
        let rootId = subfolderIdMap.get(rootKey);
        if (!rootId) {
          const r = await upsertSubfolder({
            field_id: field.id,
            parent_id: null,
            name: group.parentSubfolderName,
            sort_order: nextRootOrder,
          });
          if (r.error) { setErrorMsg(`Failed to create folder "${group.parentSubfolderName}": ${r.error}`); setPhase("error"); return; }
          rootId = r.id!;
          subfolderIdMap.set(rootKey, rootId);
          nextRootOrder += 10;
        }

        // Now upsert the child subfolder
        const childKey = `${rootKey}/${group.subfolderName.toLowerCase()}`;
        let childId = subfolderIdMap.get(childKey);
        if (!childId) {
          const r = await upsertSubfolder({
            field_id: field.id,
            parent_id: rootId,
            name: group.subfolderName,
            sort_order: nextChildOrder,
          });
          if (r.error) { setErrorMsg(`Failed to create folder "${group.subfolderName}": ${r.error}`); setPhase("error"); return; }
          childId = r.id!;
          subfolderIdMap.set(childKey, childId);
          nextChildOrder += 10;
        }
        subfolderId = childId;
      } else {
        // Root subfolder
        const rootKey = group.subfolderName.toLowerCase();
        let rootId = subfolderIdMap.get(rootKey);
        if (!rootId) {
          const r = await upsertSubfolder({
            field_id: field.id,
            parent_id: null,
            name: group.subfolderName,
            sort_order: nextRootOrder,
          });
          if (r.error) { setErrorMsg(`Failed to create folder "${group.subfolderName}": ${r.error}`); setPhase("error"); return; }
          rootId = r.id!;
          subfolderIdMap.set(rootKey, rootId);
          nextRootOrder += 10;
        }
        subfolderId = rootId;
      }
    }

    // Upload files in this group
    for (const file of group.files) {
      const ext = file.name.split(".").pop() ?? "";
      const base = safeName(file.name.replace(/\.[^.]+$/, ""));
      const subfolderSlug = group.subfolderName
        ? group.subfolderName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        : null;
      const parentSlug = group.parentSubfolderName
        ? group.parentSubfolderName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        : null;
      const storagePath = subfolderSlug
        ? parentSlug
          ? `${field.slug}/${parentSlug}/${subfolderSlug}/${Date.now()}-${base}${ext ? "." + ext : ""}`
          : `${field.slug}/${subfolderSlug}/${Date.now()}-${base}${ext ? "." + ext : ""}`
        : `${field.slug}/${Date.now()}-${base}${ext ? "." + ext : ""}`;

      const urlResult = await getSignedUploadUrl(storagePath);
      if ("error" in urlResult) { setErrorMsg(`Upload failed for "${file.name}": ${urlResult.error}`); setPhase("error"); return; }

      const res = await fetch(urlResult.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) { setErrorMsg(`Upload failed for "${file.name}": ${res.statusText}`); setPhase("error"); return; }

      const saveResult = await upsertResource({
        field_id: field.id,
        subfolder_id: subfolderId,
        title: file.name.replace(/\.[^.]+$/, ""),
        resource_type: "file",
        file_path: storagePath,
        file_mime: file.type || null,
      });
      if (saveResult.error) { setErrorMsg(`Failed to save "${file.name}": ${saveResult.error}`); setPhase("error"); return; }

      done++;
      setProgress({ done, total });
    }
  }

  setPhase("done");
  setTimeout(onClose, 1000);
}
```

- [ ] **Step 8: Update the preview section in `FolderUploadModal` to show nested structure**

Find the preview panel in `FolderUploadModal` (the `phase === "preview"` block) and update the group display to show nesting:

```tsx
{groups.map((g) => (
  <div
    key={g.subfolderName ?? "__top__"}
    className="flex items-center gap-3"
    style={{ paddingLeft: g.parentSubfolderName ? "1.25rem" : "0" }}
  >
    <span className="text-sm" style={{ color: "var(--t-muted)" }}>
      {g.subfolderName
        ? g.parentSubfolderName
          ? "  📂"
          : "📁"
        : "📄"}
    </span>
    <span
      className="text-sm flex-1"
      style={{ color: "var(--t-primary)" }}
    >
      {g.subfolderName ?? "(top-level files)"}
    </span>
    <span className="badge badge-neutral text-[11px]">
      {g.files.length} file{g.files.length !== 1 ? "s" : ""}
    </span>
  </div>
))}
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 10: Commit**

```bash
git add src/app/admin/recruitment/RecruitmentAdminClient.tsx
git commit -m "feat: add nested subfolder UI to admin recruitment panel"
```

---

## Self-Review

**Spec coverage:**
- ✅ `parent_id` column + index (Task 1)
- ✅ `buildSubfolderTree` utility in `src/lib/subfolderTree.ts` (Task 2)
- ✅ `RecruitmentSubfolder.parent_id: string | null` (Task 2)
- ✅ `SubfolderInput.parent_id?: string | null` + passed through upsert (Task 2)
- ✅ `moveSubfolder` scoped by `parent_id` — `.is("parent_id", null)` for roots (Task 2)
- ✅ `RecruitmentClient.tsx` single-open accordion, hash-aware on mount (Task 3)
- ✅ `FieldPanel` uses `buildSubfolderTree` for recursive `SubfolderPanel` rendering (Task 3)
- ✅ `SubfolderPanel` renders children before own resources, `depth > 0` starts closed (Task 3)
- ✅ Quick-jump pills unchanged in `page.tsx` header; hash opens correct field via `useEffect` (Task 3)
- ✅ `SubfolderRow` gets "+ Sub-folder" button, shows `AddSubfolderForm` with `parentId` (Task 4)
- ✅ `AddSubfolderForm` accepts `parentId` + `onDone` (Task 4)
- ✅ `SubfolderTreeAdmin` renders tree recursively with indentation (Task 4)
- ✅ `FolderUploadModal` handles 3-level paths, upserts root before child (Task 4)
- ✅ `ON DELETE CASCADE` on `parent_id` — deleting root subfolder cascades to children (Task 1)
- ✅ Alumni hard-block unchanged (Task 3 page.tsx)
- ✅ Admin page query unchanged — already fetches all subfolders flat

**Type consistency:**
- `SubfolderNode` defined in Task 2 (`src/lib/subfolderTree.ts`), consumed in Tasks 3 and 4 ✅
- `buildSubfolderTree` signature: `(SubfolderWithResources[]) => SubfolderNode[]` — consistent across all uses ✅
- `AddSubfolderForm` `parentId` prop: `string | null` — matches `SubfolderInput.parent_id?: string | null` ✅
- `SubfolderRow` `childSortOrder` prop: `number` — passed correctly in `SubfolderTreeAdmin` ✅
- `FolderGroup.parentSubfolderName: string | null` — used consistently in `startUpload` ✅
