# CSV Member Import — Design Spec

**Date:** 2026-08-02  
**Status:** Approved

---

## Overview

Admins can bulk-add members by uploading a CSV exported from a Google Form. After upload the admin sees a review table, can deselect individual rows, and approves the import. All valid, non-duplicate rows are inserted into the `members` table in one server action call.

---

## Google Form Column Contract

The form must be built with exactly these question titles so the CSV headers match:

| CSV column | Maps to |
|---|---|
| `Timestamp` | ignored |
| `Email Address` | `members.email` (required) |
| `Full Name` | `members.full_name` (optional) |
| `Position` | `members.position` (optional) |

All imported rows get `role = "member"`.

---

## UI Flow

### Entry point

A second button is added to the toolbar in `MembersClient.tsx`, to the left of `+ Add Member`:

```
[ ↑ Import CSV ]  [ + Add Member ]
```

Clicking it opens `ImportModal`.

### ImportModal — Upload state

- A styled file-drop / click zone (`accept=".csv"`)
- Helper text: "Export your Google Form responses as CSV and upload here."
- No server call at this stage — parsing is entirely client-side

### ImportModal — Review state (after file selected)

Renders a scrollable table with columns: checkbox · Name · Email · Position · Status

**Row states:**

| Condition | Checkbox | Status badge |
|---|---|---|
| Valid, email not in members list | Checked (editable) | — |
| Email already in members list | Unchecked, disabled | "Already exists" (amber warning) |
| Missing email field | Unchecked, disabled | "Missing email" (red) |

**Footer summary:**  
`X of Y rows will be imported · Z already exist (skipped)`

**Buttons:** `Cancel` · `Import X Members` (disabled if 0 rows selected)

### After import

Success state shows:  
`✓ X members added.`  
Then auto-closes after 600 ms and the page revalidates.

If the server returns partial failures (duplicate slipped past client check), a non-fatal summary is shown: `X added, Y skipped (already existed).`

---

## CSV Parsing

Implemented as a small pure function `parseGoogleFormCsv(text: string)` — no library.

Rules:
- First row is headers; matched case-insensitively and trimmed
- `Timestamp` column is dropped
- Rows where `Email Address` is blank are marked invalid
- Emails are lowercased and trimmed
- Empty strings in optional fields become `null`
- Handles quoted fields (RFC 4180 basics) to cover names with commas

---

## Server Action — `bulkAddMembers`

**Location:** `src/lib/actions/members.ts`

**Signature:**
```ts
export async function bulkAddMembers(
  rows: { email: string; full_name: string | null; position: string | null }[]
): Promise<{ added: number; skipped: number; error?: string }>
```

**Behaviour:**
- Calls `requireAdmin()` — server-side auth guard
- Validates input: non-empty array, each row has a non-empty email
- Single `.upsert()` call with all rows plus `role: "member"`, using `{ onConflict: "email", ignoreDuplicates: true }` so any duplicate emails that slipped past the client-side check are silently skipped rather than erroring
- Returns `{ added, skipped }` counts derived from the response
- Calls `revalidatePath("/admin/members")` on success

---

## Files Changed

| File | Change |
|---|---|
| `src/app/admin/members/MembersClient.tsx` | Add `ImportModal` component + `↑ Import CSV` button |
| `src/lib/actions/members.ts` | Add `bulkAddMembers` server action |

No new files. No schema changes. No new dependencies.

---

## Out of Scope

- Editing individual rows inside the review table (admin can uncheck and re-add manually)
- Role selection per row (all imports are `role: "member"`)
- Server-side CSV parsing or file upload to storage
