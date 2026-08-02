"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addMember, updateMember, updateMemberRole, removeMember, setMemberPassword, bulkAddMembers } from "@/lib/actions/members";
import type { Member } from "@/lib/auth";

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

// ── Shared field ──────────────────────────────────────────────────────────────

function Field({
  label, name, type = "text", required, placeholder, defaultValue,
}: {
  label: string; name: string; type?: string; required?: boolean;
  placeholder?: string; defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="input-label">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="input"
      />
    </div>
  );
}

// ── Add-member modal ──────────────────────────────────────────────────────────

function AddMemberModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(addMember, {});
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.success) setTimeout(onClose, 400);
  }, [state.success, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,18,16,0.5)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col animate-scale-in"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--b-subtle)" }}
        >
          <h2
            className="text-[16px] font-bold"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            Add Member
          </h2>
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

        {state.success ? (
          <div className="flex flex-col items-center gap-2 py-10 px-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
            >
              ✓
            </div>
            <p className="font-semibold text-sm" style={{ color: "var(--t-primary)" }}>Member added.</p>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4 p-6">
            <Field label="Email *" name="email" type="email" required placeholder="name@unc.edu" />
            <Field label="Full name" name="full_name" placeholder="Jane Smith" />
            <Field label="Position" name="position" placeholder="e.g. Professional Development" />

            <div className="flex flex-col gap-1.5">
              <label className="input-label">Role *</label>
              <select name="role" defaultValue="member" className="input">
                <option value="member">Member (student)</option>
                <option value="alumni">Alumni</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {state.error && (
              <p className="text-sm" style={{ color: "#dc2626" }}>{state.error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="btn btn-primary btn-sm disabled:opacity-50">
                {pending ? "Adding…" : "Add Member"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Edit-member modal ─────────────────────────────────────────────────────────

function EditMemberModal({
  member,
  currentEmail,
  onClose,
}: {
  member: Member;
  currentEmail: string;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const isSelf = member.email === currentEmail;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const full_name = (fd.get("full_name") as string).trim() || null;
    const position = (fd.get("position") as string).trim() || null;
    // Disabled selects are excluded from FormData — fall back to current role
    const role = (fd.get("role") as "admin" | "member" | "alumni" | null) ?? member.role;

    setError(null);
    startTransition(async () => {
      const result = await updateMember(member.id, { full_name, position, role });
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setTimeout(onClose, 500);
      }
    });
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,18,16,0.5)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col animate-scale-in"
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
              Edit Member
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>
              {member.email}
            </p>
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

        {done ? (
          <div className="flex flex-col items-center gap-2 py-10 px-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
            >
              ✓
            </div>
            <p className="font-semibold text-sm" style={{ color: "var(--t-primary)" }}>Saved.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
            <Field
              label="Full name"
              name="full_name"
              placeholder="Jane Smith"
              defaultValue={member.full_name ?? ""}
            />
            <Field
              label="Position"
              name="position"
              placeholder="e.g. President, VP Finance, Rush Chair…"
              defaultValue={member.position ?? ""}
            />

            <div className="flex flex-col gap-1.5">
              <label className="input-label">Role</label>
              <select
                name="role"
                defaultValue={member.role}
                disabled={isSelf}
                className="input"
                style={isSelf ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              >
                <option value="member">Member (student)</option>
                <option value="alumni">Alumni</option>
                <option value="admin">Admin</option>
              </select>
              {isSelf && (
                <p className="text-[11px]" style={{ color: "var(--t-muted)" }}>
                  You cannot change your own role.
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn btn-primary btn-sm disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Set-password modal ────────────────────────────────────────────────────────

function SetPasswordModal({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = (fd.get("password") as string).trim();
    const confirm = (fd.get("confirm") as string).trim();

    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setError(null);
    startTransition(async () => {
      const result = await setMemberPassword(member.id, password);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setTimeout(onClose, 1200);
      }
    });
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,18,16,0.5)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col animate-scale-in"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--b-subtle)" }}
        >
          <div>
            <h2
              className="text-[16px] font-bold"
              style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
            >
              Set Password
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>
              {member.email}
            </p>
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

        {done ? (
          <div className="flex flex-col items-center gap-2 py-10 px-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
            >
              ✓
            </div>
            <p className="font-semibold text-sm" style={{ color: "var(--t-primary)" }}>Password set.</p>
            <p className="text-xs text-center" style={{ color: "var(--t-muted)" }}>
              They can now sign in at /login with their email and this password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
            <div
              className="rounded-xl px-4 py-3 text-[12px]"
              style={{ background: "var(--s-1)", color: "var(--t-secondary)", border: "1px solid var(--b-subtle)" }}
            >
              This sets a password directly — no email link required. Share the password with the member securely.
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="input-label">New password</label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="input"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="input-label">Confirm password</label>
              <input
                name="confirm"
                type="password"
                required
                placeholder="Repeat password"
                className="input"
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn btn-primary btn-sm disabled:opacity-50"
              >
                {isPending ? "Setting…" : "Set Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

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

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  currentEmail,
  onEdit,
  onSetPassword,
}: {
  member: Member;
  currentEmail: string;
  onEdit: (m: Member) => void;
  onSetPassword: (m: Member) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [removing, setRemoving] = useState(false);
  const isSelf = member.email === currentEmail;

  function toggleRole() {
    // Only toggles admin ↔ member. Alumni role changes require the edit modal.
    if (member.role === "alumni") return;
    const next = member.role === "admin" ? "member" : "admin";
    startTransition(async () => { await updateMemberRole(member.id, next); });
  }

  function remove() {
    if (!confirm(`Remove ${member.email} from the member list?`)) return;
    setRemoving(true);
    startTransition(async () => { await removeMember(member.id); });
  }

  return (
    <tr
      className="border-t transition-opacity"
      style={{
        borderColor: "var(--b-default)",
        opacity: isPending || removing ? 0.5 : 1,
      }}
    >
      {/* Name + email */}
      <td className="py-3.5 px-4">
        <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
          {member.full_name ?? <span style={{ color: "var(--t-faint)" }}>—</span>}
          {isSelf && (
            <span
              className="ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }}
            >
              you
            </span>
          )}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--t-muted)" }}>{member.email}</p>
      </td>

      {/* Position */}
      <td className="py-3.5 px-4 hidden sm:table-cell">
        <span className="text-sm" style={{ color: "var(--t-secondary)" }}>
          {member.position ?? <span style={{ color: "var(--t-faint)" }}>—</span>}
        </span>
      </td>

      {/* Linked */}
      <td className="py-3.5 px-4 hidden md:table-cell text-center">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: member.auth_user_id ? "#22c55e" : "var(--b-strong)" }}
          title={member.auth_user_id ? "Signed in at least once" : "Never signed in"}
        />
      </td>

      {/* Role badge (click to toggle) */}
      <td className="py-3.5 px-4">
        <button
          onClick={toggleRole}
          disabled={isPending || isSelf || member.role === "alumni"}
          className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all disabled:cursor-not-allowed"
          style={
            member.role === "admin"
              ? { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }
              : member.role === "alumni"
              ? { background: "rgba(168,85,247,0.10)", color: "#c084fc" }
              : { background: "var(--s-1)", color: "var(--t-secondary)", border: "1px solid var(--b-default)" }
          }
          title={
            isSelf
              ? "You cannot change your own role"
              : member.role === "alumni"
              ? "Use Edit to change alumni role"
              : `Click to make ${member.role === "admin" ? "member" : "admin"}`
          }
        >
          {member.role}
        </button>
      </td>

      {/* Actions */}
      <td className="py-3.5 px-4">
        <div className="flex items-center justify-end gap-1">
          {/* Set Password */}
          <button
            onClick={() => onSetPassword(member)}
            disabled={isPending}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--s-1)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
            title="Set password directly (no email needed)"
          >
            Set PW
          </button>

          {/* Edit */}
          <button
            onClick={() => onEdit(member)}
            disabled={isPending}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: "var(--t-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--s-1)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
            title="Edit member"
          >
            Edit
          </button>

          {/* Remove */}
          <button
            onClick={remove}
            disabled={isPending || isSelf}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: "#dc2626" }}
            title={isSelf ? "You cannot remove yourself" : "Remove from member list"}
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function MembersClient({
  members,
  currentEmail,
}: {
  members: Member[];
  currentEmail: string;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [settingPasswordFor, setSettingPasswordFor] = useState<Member | null>(null);
  const [query, setQuery] = useState("");

  const filtered = members.filter((m) => {
    const q = query.toLowerCase();
    return (
      !q ||
      m.email.includes(q) ||
      m.full_name?.toLowerCase().includes(q) ||
      m.position?.toLowerCase().includes(q)
    );
  });

  const admins = filtered.filter((m) => m.role === "admin");
  const regularMembers = filtered.filter((m) => m.role === "member");
  const alumni = filtered.filter((m) => m.role === "alumni");

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, position…"
          className="input max-w-xs"
        />
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
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ background: "var(--s-1)" }}>
              <th className="text-left text-[11px] font-bold uppercase tracking-[0.08em] px-4 py-3" style={{ color: "var(--t-muted)" }}>
                Member
              </th>
              <th className="text-left text-[11px] font-bold uppercase tracking-[0.08em] px-4 py-3 hidden sm:table-cell" style={{ color: "var(--t-muted)" }}>
                Position
              </th>
              <th className="text-center text-[11px] font-bold uppercase tracking-[0.08em] px-4 py-3 hidden md:table-cell" style={{ color: "var(--t-muted)" }}>
                Linked
              </th>
              <th className="text-left text-[11px] font-bold uppercase tracking-[0.08em] px-4 py-3" style={{ color: "var(--t-muted)" }}>
                Role
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-sm" style={{ color: "var(--t-muted)" }}>
                  {members.length === 0 ? "No members yet." : "No results."}
                </td>
              </tr>
            )}

            {admins.length > 0 && (
              <>
                <tr style={{ background: "var(--s-1)", borderTop: "1px solid var(--b-subtle)" }}>
                  <td
                    colSpan={5}
                    className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--t-muted)" }}
                  >
                    Admins — {admins.length}
                  </td>
                </tr>
                {admins.map((m) => (
                  <MemberRow key={m.id} member={m} currentEmail={currentEmail} onEdit={setEditingMember} onSetPassword={setSettingPasswordFor} />
                ))}
              </>
            )}

            {regularMembers.length > 0 && (
              <>
                <tr style={{ background: "var(--s-1)", borderTop: "1px solid var(--b-subtle)" }}>
                  <td
                    colSpan={5}
                    className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--t-muted)" }}
                  >
                    Members — {regularMembers.length}
                  </td>
                </tr>
                {regularMembers.map((m) => (
                  <MemberRow key={m.id} member={m} currentEmail={currentEmail} onEdit={setEditingMember} onSetPassword={setSettingPasswordFor} />
                ))}
              </>
            )}

            {alumni.length > 0 && (
              <>
                <tr style={{ background: "var(--s-1)", borderTop: "1px solid var(--b-subtle)" }}>
                  <td
                    colSpan={5}
                    className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--t-muted)" }}
                  >
                    Alumni — {alumni.length}
                  </td>
                </tr>
                {alumni.map((m) => (
                  <MemberRow key={m.id} member={m} currentEmail={currentEmail} onEdit={setEditingMember} onSetPassword={setSettingPasswordFor} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} />}
      {showImportModal && (
        <ImportModal
          existingEmails={new Set(members.map((m) => m.email.toLowerCase()))}
          onClose={() => setShowImportModal(false)}
        />
      )}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          currentEmail={currentEmail}
          onClose={() => setEditingMember(null)}
        />
      )}
      {settingPasswordFor && (
        <SetPasswordModal
          member={settingPasswordFor}
          onClose={() => setSettingPasswordFor(null)}
        />
      )}
    </>
  );
}
