"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  FieldWithResources,
  RecruitmentResource,
  MemberSubmissions,
  BatchWithItems,
  RecruitmentField,
} from "@/lib/actions/recruitment";
import { buildSubfolderTree, type SubfolderNode } from "@/lib/subfolderTree";
import { deleteMemberFieldProposal } from "@/lib/actions/recruitment";
import DownloadButton from "./DownloadButton";
import ProposeFieldModal from "./ProposeFieldModal";
import ContributeBatchEditor from "./ContributeBatchEditor";

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
    <details>
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
  memberSubmissions,
}: {
  fields: FieldWithResources[];
  isAdmin: boolean;
  memberSubmissions: MemberSubmissions;
}) {
  const router = useRouter();
  const [openFieldId, setOpenFieldId] = useState<string | null>(fields[0]?.id ?? null);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [editingProposal, setEditingProposal] = useState<RecruitmentField | null>(null);
  const [contributeField, setContributeField] = useState<FieldWithResources | null>(null);
  const [deletingProposalId, startDeleteTransition] = useTransition();

  // Hash-based field opening (unchanged)
  useEffect(() => {
    function openFromHash() {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        const match = fields.find((f) => f.slug === hash);
        setOpenFieldId(match ? match.id : null);
      }
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
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

  function getBatchForField(fieldId: string): BatchWithItems | null {
    return (
      memberSubmissions.batches.find(
        (b) => b.field_id === fieldId && b.status !== "approved"
      ) ?? null
    );
  }

  function batchStatusLabel(batch: BatchWithItems): string {
    const count = (batch.recruitment_resources?.length ?? 0) + (batch.recruitment_subfolders?.length ?? 0);
    if (batch.status === "draft") return `Draft · ${count} item${count !== 1 ? "s" : ""}`;
    if (batch.status === "pending_review") return "Under Review";
    if (batch.status === "rejected") return "See Feedback";
    return "Contribute";
  }

  function handleContributeClose() {
    setContributeField(null);
    router.refresh();
  }

  function handleProposeClose() {
    setShowProposeModal(false);
    setEditingProposal(null);
    router.refresh();
  }

  return (
    <>
      {/* ── "Propose a Field" button ── */}
      {!isAdmin && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => { setEditingProposal(null); setShowProposeModal(true); }}
            className="btn btn-ghost btn-sm"
          >
            + Propose a Field
          </button>
        </div>
      )}

      {/* ── Member's own pending field proposals ── */}
      {memberSubmissions.fieldProposals.length > 0 && (
        <div className="flex flex-col gap-2 mb-6">
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-1"
            style={{ color: "var(--t-muted)" }}
          >
            Your Proposals
          </p>
          {memberSubmissions.fieldProposals.map((proposal) => (
            <div
              key={proposal.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "var(--s-0)",
                border: "1px solid var(--b-default)",
              }}
            >
              {proposal.icon && <span className="text-base shrink-0">{proposal.icon}</span>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--t-primary)" }}>
                  {proposal.name}
                </p>
                {proposal.description && (
                  <p className="text-xs truncate" style={{ color: "var(--t-muted)" }}>
                    {proposal.description}
                  </p>
                )}
              </div>
              <span
                className="badge shrink-0 text-[10px]"
                style={
                  proposal.status === "pending"
                    ? { background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }
                    : { background: "rgba(220,38,38,0.1)", color: "#dc2626" }
                }
              >
                {proposal.status === "pending" ? "Pending Review" : "Rejected"}
              </span>
              {proposal.status === "pending" && (
                <button
                  onClick={() => { setEditingProposal(proposal); setShowProposeModal(true); }}
                  className="btn btn-ghost btn-sm shrink-0"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => {
                  if (!confirm(`Cancel proposal "${proposal.name}"?`)) return;
                  startDeleteTransition(async () => {
                    await deleteMemberFieldProposal(proposal.id);
                    router.refresh();
                  });
                }}
                className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                style={{ color: "#dc2626" }}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Live field accordion ── */}
      <div className="flex flex-col gap-2">
        {fields.map((field) => {
          const isOpen = openFieldId === field.id;
          const count = totalResources(field);
          const batch = getBatchForField(field.id);

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
              {/* Header */}
              <button
                onClick={() => toggle(field.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors"
                style={{ background: isOpen ? "var(--s-1)" : "transparent" }}
                onMouseEnter={(e) => {
                  if (!isOpen) (e.currentTarget as HTMLElement).style.background = "var(--s-1)";
                }}
                onMouseLeave={(e) => {
                  if (!isOpen) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {field.icon && (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                    style={{ background: "var(--s-1)", border: "1px solid var(--b-default)" }}
                    aria-hidden
                  >
                    {field.icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[15px] font-bold"
                    style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
                  >
                    {field.name}
                  </p>
                  {field.description && (
                    <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--t-muted)" }}>
                      {field.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge text-[11px] ${count > 0 ? "badge-navy" : "badge-neutral"}`}>
                    {count > 0 ? `${count} resource${count !== 1 ? "s" : ""}` : "Coming soon"}
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
                  {/* Contribute button for non-alumni, non-admin members */}
                  {!isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContributeField(field);
                      }}
                      className="btn btn-ghost btn-sm text-[11px]"
                      style={
                        batch?.status === "rejected"
                          ? { color: "#dc2626" }
                          : batch?.status === "pending_review"
                          ? { color: "var(--t-muted)" }
                          : {}
                      }
                    >
                      {batch ? batchStatusLabel(batch) : "Contribute"}
                    </button>
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

              {/* Rejected batch feedback inline */}
              {batch?.status === "rejected" && batch.rejection_reason && (
                <div
                  className="mx-4 mb-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: "rgba(220,38,38,0.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.15)" }}
                >
                  <span className="font-semibold">Feedback: </span>
                  {batch.rejection_reason}
                </div>
              )}

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

      {/* ── Modals ── */}
      {showProposeModal && (
        <ProposeFieldModal
          proposal={editingProposal}
          onClose={handleProposeClose}
        />
      )}

      {contributeField && (
        <ContributeBatchEditor
          field={contributeField}
          existingBatch={getBatchForField(contributeField.id)}
          onClose={handleContributeClose}
        />
      )}
    </>
  );
}
