# CSV Member Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins upload a Google Forms CSV to bulk-add members, with a review/approve step before any DB writes.

**Architecture:** Client-side CSV parsing in the browser, cross-referenced against the already-loaded members list for instant duplicate detection. Approved rows are sent to a single `bulkAddMembers` server action that does one upsert call. All UI lives in the existing `MembersClient.tsx` modal pattern — no new files, no new dependencies.

**Tech Stack:** Next.js 16 App Router, React 19 Server Actions (`useTransition`), Supabase JS v2, TypeScript, Tailwind + CSS custom properties (design system tokens)

## Global Constraints

- All CSS uses design system tokens (`var(--s-0)`, `var(--t-primary)`, `var(--b-default)`, `var(--akp-gold)`, etc.) — never hardcode colours except the existing red `#dc2626` for errors
- Server actions must call `requireAdmin()` as first line
- Admin client (`createAdminClient()`) is server-side only
- `revalidatePath("/admin/members")` after any DB mutation
- No new npm packages
- Follow the existing modal pattern: overlay with `backdropFilter: blur(4px)`, `animate-scale-in` card, Escape-to-close, click-outside-to-close
- All imported members get `role: "member"`
- Google Form CSV column contract: `Timestamp` (ignored), `Email Address`, `Full Name`, `Position`

---

## File Map

| File | Change |
|---|---|
| `src/lib/actions/members.ts` | Add `bulkAddMembers` export |
| `src/app/admin/members/MembersClient.tsx` | Add `parseCSVLine`, `parseGoogleFormCsv`, `ParsedRow` type, `ImportModal` component, `↑ Import CSV` button in toolbar |

---

## Task 1: `bulkAddMembers` server action

**Files:**
- Modify: `src/lib/actions/members.ts` (append after `setMemberPassword`)

**Interfaces:**
- Produces: `bulkAddMembers(rows: BulkMemberRow[]): Promise<{ added: number; skipped: number; error?: string }>`
  where `BulkMemberRow = { email: string; full_name: string | null; position: string | null }`

---

- [ ] **Step 1: Add the type and function to `members.ts`**

Open `src/lib/actions/members.ts` and append at the bottom:

```ts
export type BulkMemberRow = {
  email: string;
  full_name: string | null;
  position: string | null;
};

export async function bulkAddMembers(
  rows: BulkMemberRow[]
): Promise<{ added: number; skipped: number; error?: string }> {
  await requireAdmin();

  if (!rows.length) return { added: 0, skipped: 0 };

  // Normalise + validate
  const clean = rows
    .map((r) => ({
      email: r.email.toLowerCase().trim(),
      full_name: r.full_name?.trim() || null,
      position: r.position?.trim() || null,
      role: "member" as const,
    }))
    .filter((r) => r.email.length > 0);

  if (!clean.length) return { added: 0, skipped: rows.length };

  const admin = createAdminClient();

  // upsert with ignoreDuplicates: existing emails are silently skipped,
  // returned data contains only the rows that were actually inserted.
  const { data, error } = await admin
    .from("members")
    .upsert(clean, { onConflict: "email", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("bulkAddMembers error:", error.message);
    return { added: 0, skipped: rows.length, error: "Import failed. Please try again." };
  }

  const added = data?.length ?? 0;
  const skipped = clean.length - added;

  revalidatePath("/admin/members");
  return { added, skipped };
}
```

- [ ] **Step 2: Verify the build still passes**

```bash
cd akpd-site && npm run build 2>&1 | tail -10
```

Expected: no TypeScript errors, all routes listed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/members.ts
git commit -m "feat: add bulkAddMembers server action"
```

---

## Task 2: CSV parser

**Files:**
- Modify: `src/app/admin/members/MembersClient.tsx` (add before the first component, after the imports)

**Interfaces:**
- Produces:
  ```ts
  type ParsedRow = {
    email: string;
    full_name: string | null;
    position: string | null;
    valid: boolean;      // false when email is blank
    rawIndex: number;    // 0-based index among data rows
  };
  function parseGoogleFormCsv(text: string): ParsedRow[]
  ```
- Consumes: nothing from earlier tasks

---

- [ ] **Step 1: Add the parser code to `MembersClient.tsx`**

Open `src/app/admin/members/MembersClient.tsx`. After the imports (before the `Field` component) insert:

```ts
// ── CSV parser ────────────────────────────────────────────────────────────────

type ParsedRow = {
  email: string;
  full_name: string | null;
  position: string | null;
  valid: boolean;
  rawIndex: number;
};

/** Parse a single CSV line respecting RFC 4180 quoted fields. */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse a Google Forms CSV export into structured rows.
 * Expected headers: Timestamp, Email Address, Full Name, Position
 * Timestamp is ignored. Header matching is case-insensitive.
 */
function parseGoogleFormCsv(text: string): ParsedRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const emailIdx = headers.findIndex((h) => h === "email address" || h === "email");
  const nameIdx  = headers.findIndex((h) => h === "full name");
  const posIdx   = headers.findIndex((h) => h === "position");

  return lines.slice(1).map((line, i) => {
    const fields = parseCSVLine(line);
    const get = (idx: number) => (idx >= 0 ? (fields[idx] ?? "").trim() : "");

    const email     = get(emailIdx).toLowerCase();
    const full_name = get(nameIdx) || null;
    const position  = get(posIdx) || null;

    return { email, full_name, position, valid: email.length > 0, rawIndex: i };
  });
}
```

- [ ] **Step 2: Quick inline sanity check — verify the parser in the browser console**

After the dev server starts (`npm run dev`), open the browser console on any page and paste:

```js
// Simulate a Google Forms CSV with a quoted name (comma inside)
const csv = `Timestamp,Email Address,Full Name,Position
2026-08-01,john@unc.edu,"Smith, John",President
2026-08-01,jane@unc.edu,Jane Doe,
2026-08-01,,No Email,VP`;
```

The function isn't exposed to the window, so this is a build-check — make sure `npm run build` passes cleanly.

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -10
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/members/MembersClient.tsx
git commit -m "feat: add parseGoogleFormCsv CSV parser"
```

---

## Task 3: `ImportModal` component + toolbar button

**Files:**
- Modify: `src/app/admin/members/MembersClient.tsx`
  - Add `ImportModal` component (after `SetPasswordModal`, before `MemberRow`)
  - Add `↑ Import CSV` button to the toolbar in `MembersClient`
  - Add `showImportModal` state and wire up open/close

**Interfaces:**
- Consumes:
  - `parseGoogleFormCsv(text: string): ParsedRow[]` (Task 2)
  - `bulkAddMembers(rows: BulkMemberRow[]): Promise<{ added: number; skipped: number; error?: string }>` (Task 1)
  - `Member` type from `@/lib/auth`
- Produces: nothing (leaf component)

---

- [ ] **Step 1: Add the import for `bulkAddMembers` at the top of `MembersClient.tsx`**

Find the existing import line:
```ts
import { addMember, updateMember, updateMemberRole, removeMember, setMemberPassword } from "@/lib/actions/members";
```
Replace with:
```ts
import { addMember, updateMember, updateMemberRole, removeMember, setMemberPassword, bulkAddMembers } from "@/lib/actions/members";
```

- [ ] **Step 2: Add `ImportModal` component**

After `SetPasswordModal` and before `// ── Member row`, insert:

```tsx
// ── Import CSV modal ──────────────────────────────────────────────────────────

function ImportModal({
  existingEmails,
  onClose,
}: {
  existingEmails: Set<string>;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseGoogleFormCsv(text);
      setRows(parsed);
      // Pre-select all valid, non-duplicate rows
      const initial = new Set(
        parsed
          .filter((r) => r.valid && !existingEmails.has(r.email))
          .map((r) => r.rawIndex)
      );
      setSelected(initial);
      setError(null);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function toggleRow(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function handleImport() {
    const toImport = rows
      .filter((r) => selected.has(r.rawIndex) && r.valid && !existingEmails.has(r.email))
      .map(({ email, full_name, position }) => ({ email, full_name, position }));

    if (!toImport.length) return;

    setError(null);
    startTransition(async () => {
      const res = await bulkAddMembers(toImport);
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
        setTimeout(onClose, 1800);
      }
    });
  }

  const validRows    = rows.filter((r) => r.valid);
  const dupRows      = rows.filter((r) => r.valid && existingEmails.has(r.email));
  const invalidRows  = rows.filter((r) => !r.valid);
  const importCount  = rows.filter((r) => selected.has(r.rawIndex)).length;
  const hasRows      = rows.length > 0;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,18,16,0.5)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col animate-scale-in"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-xl)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 shrink-0"
          style={{ borderBottom: "1px solid var(--b-subtle)" }}
        >
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}>
              Import Members from CSV
            </h2>
            {fileName && (
              <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>{fileName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--s-1)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {result ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center gap-2 py-12 px-6">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
              >
                ✓
              </div>
              <p className="font-semibold text-sm" style={{ color: "var(--t-primary)" }}>
                {result.added} member{result.added !== 1 ? "s" : ""} added.
              </p>
              {result.skipped > 0 && (
                <p className="text-xs" style={{ color: "var(--t-muted)" }}>
                  {result.skipped} skipped (already existed).
                </p>
              )}
            </div>
          ) : !hasRows ? (
            /* ── Upload state ── */
            <div className="p-6">
              <label
                className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-colors"
                style={{
                  border: "2px dashed var(--b-default)",
                  background: "var(--s-1)",
                  minHeight: 160,
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "var(--akp-gold)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = "var(--b-default)"}
              >
                <input
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <span className="text-2xl" style={{ color: "var(--t-muted)" }}>↑</span>
                <span className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                  Click to upload or drag & drop
                </span>
                <span className="text-xs text-center" style={{ color: "var(--t-muted)" }}>
                  Export your Google Form responses as CSV and upload here.
                  <br />
                  Expected columns: <code style={{ color: "var(--t-secondary)" }}>Email Address, Full Name, Position</code>
                </span>
              </label>
            </div>
          ) : (
            /* ── Review state ── */
            <div className="flex flex-col">
              {/* Summary bar */}
              <div
                className="px-6 py-3 text-[12px] flex gap-4 shrink-0"
                style={{ background: "var(--s-1)", borderBottom: "1px solid var(--b-subtle)", color: "var(--t-secondary)" }}
              >
                <span>{validRows.length} valid</span>
                {dupRows.length > 0 && (
                  <span style={{ color: "#b45309" }}>{dupRows.length} already exist (skipped)</span>
                )}
                {invalidRows.length > 0 && (
                  <span style={{ color: "#dc2626" }}>{invalidRows.length} missing email (skipped)</span>
                )}
              </div>

              {/* Review table */}
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--s-1)" }}>
                    <th className="px-4 py-2 w-8" />
                    <th className="text-left text-[11px] font-bold uppercase tracking-[0.08em] px-4 py-2" style={{ color: "var(--t-muted)" }}>Name</th>
                    <th className="text-left text-[11px] font-bold uppercase tracking-[0.08em] px-4 py-2" style={{ color: "var(--t-muted)" }}>Email</th>
                    <th className="text-left text-[11px] font-bold uppercase tracking-[0.08em] px-4 py-2 hidden sm:table-cell" style={{ color: "var(--t-muted)" }}>Position</th>
                    <th className="px-4 py-2 w-28" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isDup     = row.valid && existingEmails.has(row.email);
                    const isInvalid = !row.valid;
                    const isDisabled = isDup || isInvalid;
                    const isChecked  = selected.has(row.rawIndex);

                    return (
                      <tr
                        key={row.rawIndex}
                        className="border-t"
                        style={{
                          borderColor: "var(--b-default)",
                          opacity: isDisabled ? 0.5 : 1,
                        }}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={() => toggleRow(row.rawIndex)}
                            className="accent-[var(--akp-gold)]"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--t-primary)" }}>
                          {row.full_name ?? <span style={{ color: "var(--t-faint)" }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--t-secondary)" }}>
                          {row.email || <span style={{ color: "var(--t-faint)" }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm hidden sm:table-cell" style={{ color: "var(--t-muted)" }}>
                          {row.position ?? <span style={{ color: "var(--t-faint)" }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isDup && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(180,83,9,0.1)", color: "#b45309" }}
                            >
                              Already exists
                            </span>
                          )}
                          {isInvalid && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}
                            >
                              Missing email
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div
            className="flex items-center justify-between gap-4 px-6 py-4 shrink-0"
            style={{ borderTop: "1px solid var(--b-subtle)" }}
          >
            <p className="text-[12px]" style={{ color: "var(--t-muted)" }}>
              {hasRows
                ? `${importCount} of ${rows.length} row${rows.length !== 1 ? "s" : ""} will be imported`
                : "No file selected"}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              {hasRows && (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importCount === 0 || isPending}
                  className="btn btn-primary btn-sm disabled:opacity-50"
                >
                  {isPending ? "Importing…" : `Import ${importCount} Member${importCount !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm px-6 pb-4 shrink-0" style={{ color: "#dc2626" }}>{error}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `showImportModal` state to `MembersClient` and wire it up**

In the `MembersClient` function body, find the existing state declarations:
```ts
const [showAddModal, setShowAddModal] = useState(false);
```
Add below it:
```ts
const [showImportModal, setShowImportModal] = useState(false);
```

- [ ] **Step 4: Add the `↑ Import CSV` button to the toolbar**

Find the toolbar `<div>` in `MembersClient` — it currently contains the search input and `+ Add Member` button:
```tsx
<button
  onClick={() => setShowAddModal(true)}
  className="btn btn-primary shrink-0"
>
  + Add Member
</button>
```

Add the Import button immediately before it:
```tsx
<button
  onClick={() => setShowImportModal(true)}
  className="btn btn-ghost shrink-0"
>
  ↑ Import CSV
</button>
<button
  onClick={() => setShowAddModal(true)}
  className="btn btn-primary shrink-0"
>
  + Add Member
</button>
```

- [ ] **Step 5: Render `ImportModal` at the bottom of the return**

Find where `AddMemberModal` is conditionally rendered:
```tsx
{showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} />}
```

Add below it:
```tsx
{showImportModal && (
  <ImportModal
    existingEmails={new Set(members.map((m) => m.email.toLowerCase()))}
    onClose={() => setShowImportModal(false)}
  />
)}
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -15
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 7: Manual test — upload state**

```bash
npm run dev
```

1. Sign in as admin, navigate to `/admin/members`
2. Click `↑ Import CSV` — modal should open with the file upload zone
3. Press Escape — modal should close
4. Click outside the modal card — modal should close

- [ ] **Step 8: Manual test — review state**

Create a test CSV file `test-import.csv`:
```
Timestamp,Email Address,Full Name,Position
2026-08-01 10:00:00,newbrother@unc.edu,Test Brother,Rush Chair
2026-08-01 10:01:00,anothernew@unc.edu,Another Brother,
2026-08-01 10:02:00,,No Email Person,Treasurer
```

Then also add one row with an email that already exists in your members table (e.g. your own admin email).

Expected review table:
- `newbrother@unc.edu` — checked, no badge
- `anothernew@unc.edu` — checked, no badge, position shows `—`
- blank email row — unchecked/disabled, red "Missing email" badge
- your existing email — unchecked/disabled, amber "Already exists" badge

Footer should read: `2 of 4 rows will be imported`

- [ ] **Step 9: Manual test — import**

With the test CSV loaded, click `Import 2 Members`.

Expected:
- Button shows `Importing…` briefly
- Success state: `✓ 2 members added.`
- Modal auto-closes after ~1.8s
- The two new emails now appear in the members table

- [ ] **Step 10: Commit**

```bash
git add src/app/admin/members/MembersClient.tsx
git commit -m "feat: add CSV member import modal with review step"
```
