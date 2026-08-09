# Recruitment Subfolders — Design Spec
**Date:** 2026-08-09  
**Status:** Approved

## Problem

The recruitment page currently shows a flat list of resources under each field (e.g. "Management Consulting → [file, file, file]"). In practice, resources are organized into sub-folders in Google Drive (e.g. Cases, Guides, Interview Prep, Literature). The site needs to mirror that structure so members can navigate resources by category and admins can maintain them over time.

---

## Data Model

### New table: `recruitment_subfolders`

```sql
id          uuid        PK  DEFAULT gen_random_uuid()
field_id    uuid        NOT NULL  FK → recruitment_fields(id) ON DELETE CASCADE
name        text        NOT NULL
sort_order  int         NOT NULL DEFAULT 0
created_at  timestamptz NOT NULL DEFAULT now()
```

RLS mirrors `recruitment_fields`: members can SELECT, admins can INSERT/UPDATE/DELETE.

### `recruitment_resources` — new column

```sql
subfolder_id  uuid  NULLABLE  FK → recruitment_subfolders(id) ON DELETE SET NULL
```

- Resources without a `subfolder_id` are "top-level" and render as a flat grid below any subfolders (backwards compatible — no existing data needs migration).

### Migration file

`migrations/011_recruitment_subfolders.sql` — creates the table, adds the column + FK + index, sets RLS.

---

## Member-Facing `/recruitment` Page

Each `FieldSection` changes from a flat resource grid to a subfolder accordion:

- Subfolders render as collapsible sections, first one open by default
- Each subfolder header shows name + resource count
- Resources within a subfolder render as the existing `ResourceCard` grid
- Resources with no `subfolder_id` render in a plain grid below the subfolders (fallback, for backwards compat)
- Fields with no subfolders at all continue to render the existing flat grid — no visual regression

The data fetch adds a join: `recruitment_subfolders(id, name, sort_order, recruitment_resources(...))` ordered by `sort_order`.

---

## Admin UI — `/admin/recruitment`

### Subfolder management (within each FieldCard)

When a field is expanded, subfolders appear above the resource list:

- Each subfolder row: name, resource count, ↑↓ reorder, rename (inline or modal), delete (with confirm)
- "Add Subfolder" button per field — opens a small inline form (name only)
- Deleting a subfolder sets `subfolder_id = null` on its resources (via ON DELETE SET NULL) — resources are not deleted

### "Upload Folder" — bulk import from local folder

New button on each field card: **Upload Folder**. Opens a modal with:

1. A folder picker (`<input type="file" webkitdirectory multiple />`)
2. On file selection, the modal previews the detected subfolder structure:
   ```
   📁 Cases           (4 files)
   📁 Guides          (2 files)
   📁 Interview Prep  (6 files)
   📁 Literature      (3 files)
   ```
3. User confirms → upload begins
4. Progress indicator: "Uploading 3 of 15 files…"
5. Logic:
   - Group files by their immediate parent folder name (`file.webkitRelativePath.split("/")[1]`)
   - For each unique folder name: upsert a `recruitment_subfolder` row (skip if name already exists for this field)
   - For each file: upload to storage at `{field.slug}/{subfolder-name}/{timestamp}-{filename}`, then insert a `recruitment_resources` row with `subfolder_id` set
   - Files at the root of the selected folder (no subfolder) upload as top-level resources

### "Add Resource" modal update

- New optional "Subfolder" field: a `<select>` populated with existing subfolders for the selected field, plus a "— none —" option
- Selecting a different field refreshes the subfolder list

---

## New Server Actions (`src/lib/actions/recruitment.ts`)

- `upsertSubfolder(input: { id?: string; field_id: string; name: string; sort_order?: number })` → `{ error? }`
- `deleteSubfolder(id: string)` → `{ error? }` — DB cascade sets resources' `subfolder_id` to null
- `moveSubfolder(id: string, direction: "up" | "down")` → `{ error? }` — same swap pattern as `moveField`

---

## Updated Types

```ts
export type RecruitmentSubfolder = {
  id: string;
  field_id: string;
  name: string;
  sort_order: number;
};

export type SubfolderWithResources = RecruitmentSubfolder & {
  recruitment_resources: RecruitmentResource[];
};

// FieldWithResources expands to include subfolders:
export type FieldWithResources = RecruitmentField & {
  recruitment_subfolders: SubfolderWithResources[];
  recruitment_resources: RecruitmentResource[]; // top-level only (subfolder_id IS NULL)
};
```

---

## What Does NOT Change

- `recruitment_fields` table and its CRUD — unchanged
- `getSignedDownloadUrl`, `getSignedUploadUrl`, `deleteStorageObject` — unchanged
- Storage bucket (`recruitment-resources`) — unchanged
- RLS patterns — new table mirrors existing pattern exactly
- Alumni hard-block on `/recruitment` — unchanged
- `DownloadButton` component — unchanged
