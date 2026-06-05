"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addMember, updateMemberRole, removeMember } from "@/lib/actions/members";
import type { Member } from "@/lib/auth";

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
      style={{ background: "rgba(10,34,64,0.6)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
        style={{
          background: "var(--akp-white)",
          boxShadow: "0 8px 48px rgba(10,34,64,0.2)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="text-lg font-extrabold"
            style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
          >
            Add Member
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm hover:bg-gray-100 transition-colors"
            style={{ color: "var(--akp-gray-400)" }}
          >
            ✕
          </button>
        </div>

        {state.success ? (
          <div className="flex flex-col items-center gap-2 py-6" style={{ color: "var(--akp-navy)" }}>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: "rgba(201,168,76,0.15)" }}
            >
              ✓
            </div>
            <p className="font-semibold text-sm">Member added.</p>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <Field label="Email *" name="email" type="email" required placeholder="name@unc.edu" />
            <Field label="Full name" name="full_name" placeholder="Jane Smith" />
            <Field label="Position" name="position" placeholder="e.g. Professional Development" />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--akp-gray-600)" }}>
                Role *
              </label>
              <select
                name="role"
                defaultValue="member"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--akp-off-white)",
                  border: "1px solid var(--akp-gray-200)",
                  color: "var(--akp-gray-800)",
                }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {state.error && (
              <p className="text-sm" style={{ color: "#dc2626" }}>{state.error}</p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--akp-gray-100)", color: "var(--akp-gray-600)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
              >
                {pending ? "Adding…" : "Add Member"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label, name, type = "text", required, placeholder,
}: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--akp-gray-600)" }}>
        {label}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
        style={{
          background: "var(--akp-off-white)",
          border: "1px solid var(--akp-gray-200)",
          color: "var(--akp-gray-800)",
        }}
      />
    </div>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({ member, currentEmail }: { member: Member; currentEmail: string }) {
  const [isPending, startTransition] = useTransition();
  const [removing, setRemoving] = useState(false);
  const isSelf = member.email === currentEmail;

  function toggleRole() {
    const next = member.role === "admin" ? "member" : "admin";
    startTransition(() => updateMemberRole(member.id, next));
  }

  function remove() {
    if (!confirm(`Remove ${member.email} from the member list?`)) return;
    setRemoving(true);
    startTransition(() => removeMember(member.id));
  }

  return (
    <tr
      className="border-t transition-colors"
      style={{
        borderColor: "var(--akp-gray-200)",
        opacity: isPending || removing ? 0.5 : 1,
      }}
    >
      {/* Name + email */}
      <td className="py-3.5 pr-4">
        <p className="text-sm font-semibold" style={{ color: "var(--akp-navy)" }}>
          {member.full_name ?? <span style={{ color: "var(--akp-gray-400)" }}>—</span>}
          {isSelf && (
            <span
              className="ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }}
            >
              you
            </span>
          )}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--akp-gray-400)" }}>{member.email}</p>
      </td>

      {/* Position */}
      <td className="py-3.5 pr-4 hidden sm:table-cell">
        <span className="text-sm" style={{ color: "var(--akp-gray-600)" }}>
          {member.position ?? "—"}
        </span>
      </td>

      {/* Linked */}
      <td className="py-3.5 pr-4 hidden md:table-cell text-center">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: member.auth_user_id ? "#22c55e" : "var(--akp-gray-300)" }}
          title={member.auth_user_id ? "Signed in at least once" : "Never signed in"}
        />
      </td>

      {/* Role toggle */}
      <td className="py-3.5 pr-4">
        <button
          onClick={toggleRole}
          disabled={isPending || isSelf}
          className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all disabled:cursor-not-allowed"
          style={
            member.role === "admin"
              ? { background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }
              : { background: "var(--akp-gray-100)", color: "var(--akp-gray-600)" }
          }
          title={isSelf ? "You cannot change your own role" : `Click to make ${member.role === "admin" ? "member" : "admin"}`}
        >
          {member.role}
        </button>
      </td>

      {/* Remove */}
      <td className="py-3.5 text-right">
        <button
          onClick={remove}
          disabled={isPending || isSelf}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: "#dc2626" }}
          title={isSelf ? "You cannot remove yourself" : "Remove from member list"}
        >
          Remove
        </button>
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
  const [showModal, setShowModal] = useState(false);
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

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, position…"
          className="w-full max-w-xs rounded-xl px-3.5 py-2 text-sm outline-none"
          style={{
            background: "var(--akp-white)",
            border: "1px solid var(--akp-gray-200)",
            color: "var(--akp-gray-800)",
          }}
        />
        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
          style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
        >
          + Add Member
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--akp-white)",
          border: "1px solid var(--akp-gray-200)",
          boxShadow: "0 1px 4px rgba(10,34,64,0.04)",
        }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ background: "var(--akp-off-white)" }}>
              <th className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3" style={{ color: "var(--akp-gray-400)" }}>
                Member
              </th>
              <th className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3 hidden sm:table-cell" style={{ color: "var(--akp-gray-400)" }}>
                Position
              </th>
              <th className="text-center text-xs font-bold uppercase tracking-wide px-4 py-3 hidden md:table-cell" style={{ color: "var(--akp-gray-400)" }}>
                Linked
              </th>
              <th className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3" style={{ color: "var(--akp-gray-400)" }}>
                Role
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="px-4">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-sm" style={{ color: "var(--akp-gray-400)" }}>
                  {members.length === 0 ? "No members yet." : "No results."}
                </td>
              </tr>
            )}

            {admins.length > 0 && (
              <>
                <tr style={{ background: "var(--akp-off-white)" }}>
                  <td
                    colSpan={5}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--akp-gold)" }}
                  >
                    Admins — {admins.length}
                  </td>
                </tr>
                {admins.map((m) => (
                  <MemberRow key={m.id} member={m} currentEmail={currentEmail} />
                ))}
              </>
            )}

            {regularMembers.length > 0 && (
              <>
                <tr style={{ background: "var(--akp-off-white)" }}>
                  <td
                    colSpan={5}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--akp-gray-400)" }}
                  >
                    Members — {regularMembers.length}
                  </td>
                </tr>
                {regularMembers.map((m) => (
                  <MemberRow key={m.id} member={m} currentEmail={currentEmail} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {showModal && <AddMemberModal onClose={() => setShowModal(false)} />}
    </>
  );
}
