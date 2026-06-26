"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addMember, updateMember, updateMemberRole, removeMember } from "@/lib/actions/members";
import type { Member } from "@/lib/auth";

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

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  currentEmail,
  onEdit,
}: {
  member: Member;
  currentEmail: string;
  onEdit: (m: Member) => void;
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
  const [editingMember, setEditingMember] = useState<Member | null>(null);
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
                  <MemberRow key={m.id} member={m} currentEmail={currentEmail} onEdit={setEditingMember} />
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
                  <MemberRow key={m.id} member={m} currentEmail={currentEmail} onEdit={setEditingMember} />
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
                  <MemberRow key={m.id} member={m} currentEmail={currentEmail} onEdit={setEditingMember} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} />}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          currentEmail={currentEmail}
          onClose={() => setEditingMember(null)}
        />
      )}
    </>
  );
}
