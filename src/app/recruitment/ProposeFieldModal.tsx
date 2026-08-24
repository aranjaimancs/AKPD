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
                onChange={(e) => {
                  setName(e.target.value);
                  if (!proposal) setSlug(slugify(e.target.value));
                }}
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
