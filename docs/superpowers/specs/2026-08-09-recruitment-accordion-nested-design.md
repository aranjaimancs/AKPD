# Recruitment — Accordion Fields + Nested Subfolders
**Date:** 2026-08-09  
**Status:** Approved

## Problem

Two UX gaps remain in the recruitment section:

1. **All professions are expanded at once.** The member page dumps every field's content on screen simultaneously, making it hard to scan. Members want to browse one profession at a time.
2. **Subfolders are only one level deep.** Resources like `Consulting/Cases/2024/` need a second tier of organisation that the current flat subfolder model can't express.

---

## Change 1: Field Accordion — Member Page

### What changes

`/recruitment` currently uses a server-rendered list of `<FieldSection>` components, all visible at once. It becomes a **single-open accordion**: all professions listed, one open at a time.

### Architecture

**`src/app/recruitment/page.tsx`** (Server Component) — data fetching is unchanged. Instead of rendering `<FieldSection>` directly, it passes the full `fields` array to a new Client Component.

**`src/app/recruitment/RecruitmentClient.tsx`** (new Client Component) — owns all accordion state:
- `openFieldId: string | null` — which profession is currently expanded (null = all collapsed on load)
- Clicking a field header sets `openFieldId` to that field's id; clicking it again collapses it (toggle)
- Clicking a different field closes the previous one (single-open)

### Rendering

Each field renders as a **header row** (always visible) + a **content panel** (visible only when open):

**Header row** (clickable):
- Field icon + name (left)
- Resource/folder count badge + open/close chevron (right)
- Light hover background

**Content panel** (when open):
- Subfolders as nested `<details>/<summary>` accordion (unchanged from current implementation)
- Top-level resources (no subfolder) as flat grid below subfolders
- First subfolder open by default when the field expands

### Quick-jump pills

The existing quick-jump pills at the top (anchor links to `#field-slug`) remain. Clicking a pill opens that profession if it's collapsed and scrolls to it.

On mount, `RecruitmentClient` reads `window.location.hash`. If it matches a field's slug (`#consulting`, `#investment-banking`, etc.), that field is opened by default instead of starting fully collapsed.

### No change to admin

The admin `/admin/recruitment` page is unaffected by this change.

---

## Change 2: Nested Subfolders

### DB migration (`012_nested_subfolders.sql`)

```sql
ALTER TABLE public.recruitment_subfolders
  ADD COLUMN IF NOT EXISTS parent_id uuid
  REFERENCES public.recruitment_subfolders(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_recruitment_subfolders_parent_id
  ON public.recruitment_subfolders(parent_id);
```

Root subfolders: `parent_id IS NULL` (direct children of a field — unchanged behaviour).  
Sub-subfolders: `parent_id` points to their parent subfolder.

Only one extra level is built into the UI (field → subfolder → sub-subfolder). The schema supports arbitrary depth but the UI caps at two levels to keep complexity manageable.

### Updated type

```ts
export type RecruitmentSubfolder = {
  id: string;
  field_id: string;
  parent_id: string | null;   // NEW
  name: string;
  sort_order: number;
};
```

`SubfolderWithResources` and `FieldWithResources` are unchanged structurally — the flat array of subfolders is fetched as before; tree-building happens in application code.

### Tree building (shared utility)

A pure function used in both the member page and the admin client:

```ts
type SubfolderNode = SubfolderWithResources & {
  children: SubfolderNode[];
};

function buildSubfolderTree(subfolders: SubfolderWithResources[]): SubfolderNode[] {
  const map = new Map(subfolders.map(s => [s.id, { ...s, children: [] as SubfolderNode[] }]));
  const roots: SubfolderNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Sort each level by sort_order
  const sort = (nodes: SubfolderNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach(n => sort(n.children));
  };
  sort(roots);
  return roots;
}
```

Place this function in `src/lib/subfolderTree.ts` (imported by both page and admin client).

### Member page rendering

`RecruitmentClient.tsx` calls `buildSubfolderTree` on the subfolders for each field and renders recursively:

- **Root subfolders** → `<details>/<summary>` at the first indent level
- **Sub-subfolders** → `<details>/<summary>` indented one further level inside their parent, rendered before that parent's direct resources
- Resources with no subfolder remain at the bottom of the field panel as a flat grid

### Admin UI — subfolder management

Each `SubfolderRow` in the admin panel gains a **"+ Sub-folder"** button (small, secondary). Clicking it opens the `AddSubfolderForm` pre-filled with `parent_id` set to that subfolder's id.

Sub-subfolders render indented (left padding) beneath their parent subfolder row, with their own rename/reorder/delete controls. Reorder (↑↓) operates within siblings of the same parent — `moveSubfolder` already uses sibling-scoped sorting so no action change is needed; the admin just needs to pass the correct `parent_id` when calling `upsertSubfolder`.

`AddSubfolderForm` gains an optional `parentId: string | null` prop. When non-null, the form creates a sub-subfolder.

### Folder upload — deeper paths

`groupFilesBySubfolder` in `FolderUploadModal` currently reads only `parts[1]` (one level). Updated logic:

```
parts = file.webkitRelativePath.split("/")
// ["RootFolder", "Cases", "2024", "file.pdf"]  → subfolder="Cases", sub="2024"
// ["RootFolder", "Cases", "file.pdf"]           → subfolder="Cases", sub=null
// ["RootFolder", "file.pdf"]                    → subfolder=null (top-level)
```

The upload logic upserts the root subfolder first, then upserts the sub-subfolder with `parent_id` pointing to the root. Both use name-based deduplication (case-insensitive) against the existing subfolder list.

### `upsertSubfolder` — no action change needed

`SubfolderInput` already allows `id?`, `field_id`, `name`, `sort_order`. Add `parent_id?: string | null` to the input type and pass it through to the DB insert/update row.

---

## What Does NOT Change

- `/admin/recruitment` query — already fetches all subfolders flat; tree-building is client-side
- `moveSubfolder` action — already scoped to siblings with same `field_id`; add `parent_id` scoping so reorder only swaps within the same parent
- `deleteSubfolder` action — `ON DELETE CASCADE` on `parent_id` means deleting a root subfolder also deletes its children
- Storage paths, signed URLs, RLS policies, alumni block — all unchanged
- Admin field CRUD, resource CRUD — unchanged
