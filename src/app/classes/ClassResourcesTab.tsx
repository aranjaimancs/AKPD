"use client";

import { useState, useActionState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  uploadClassResource,
  removeClassResource,
  getClassResourceSignedUrl,
} from "@/lib/actions/classResources";
import type { ClassResource, CourseLookup } from "@/lib/actions/classResources";

/* ── Types ── */
type CourseFolder = {
  course_code: string;
  course_name: string;
  department: string;
  resources: ClassResource[];
  lastUpdated: string;
};

/* ── Helpers ── */
function normalizeCourseCode(raw: string): string {
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "");
  return upper.replace(/^([A-Z]+)(\d.*)$/, "$1 $2");
}

type MimeInfo = { label: string; dot: string; bg: string; color: string };

function getMimeInfo(mime: string | null): MimeInfo {
  if (!mime)
    return { label: "File",   dot: "#8a8278", bg: "rgba(138,130,120,0.10)", color: "#8a8278" };
  if (mime.includes("pdf"))
    return { label: "PDF",    dot: "#e53e3e", bg: "rgba(229,62,62,0.10)",   color: "#e53e3e" };
  if (mime.includes("word") || mime.includes("document"))
    return { label: "Word",   dot: "#3182ce", bg: "rgba(49,130,206,0.10)",  color: "#3182ce" };
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return { label: "Slides", dot: "#dd6b20", bg: "rgba(221,107,32,0.10)",  color: "#dd6b20" };
  if (mime.includes("sheet") || mime.includes("excel"))
    return { label: "Excel",  dot: "#38a169", bg: "rgba(56,161,105,0.10)",  color: "#38a169" };
  if (mime.includes("image"))
    return { label: "Image",  dot: "#805ad5", bg: "rgba(128,90,213,0.10)",  color: "#805ad5" };
  return { label: "File",   dot: "#8a8278", bg: "rgba(138,130,120,0.10)", color: "#8a8278" };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── ResourceDownloadButton ── */
function ResourceDownloadButton({
  filePath,
  mime,
}: {
  filePath: string;
  mime: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const info = getMimeInfo(mime);

  async function handleClick() {
    setLoading(true);
    setErr(null);
    const result = await getClassResourceSignedUrl(filePath);
    setLoading(false);
    if (result.error) { setErr("Could not load file."); return; }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="btn btn-ghost btn-sm"
        style={{ fontSize: 11, padding: "4px 12px", color: info.color, borderColor: info.bg }}
      >
        {loading ? "Loading…" : `Open ${info.label}`}
      </button>
      {err && <p className="text-[10px]" style={{ color: "#dc2626" }}>{err}</p>}
    </div>
  );
}

/* ── ResourceItem ── */
function ResourceItem({
  resource,
  currentUserId,
  isAdmin,
  onRemove,
}: {
  resource: ClassResource;
  currentUserId: string;
  isAdmin: boolean;
  onRemove: (id: string) => void;
}) {
  const canRemove = isAdmin || currentUserId === resource.uploaded_by;
  const info =
    resource.resource_type === "file"
      ? getMimeInfo(resource.file_mime)
      : { label: "Link", dot: "var(--akp-gold)", bg: "rgba(201,168,76,0.10)", color: "var(--akp-gold)" };

  return (
    <div className="flex items-start gap-3 py-3.5" style={{ borderBottom: "1px solid var(--b-subtle)" }}>
      {/* Type badge */}
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
        style={{ background: info.bg, color: info.color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: info.dot }} />
        {info.label}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--t-primary)" }}>
          {resource.title}
        </p>
        {resource.description && (
          <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--t-secondary)" }}>
            {resource.description}
          </p>
        )}
        <p className="text-[11px] mt-1" style={{ color: "var(--t-muted)" }}>
          {resource.file_size ? `${formatBytes(resource.file_size)} · ` : ""}
          {resource.uploaded_by_name} · {timeAgo(resource.created_at)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {resource.resource_type === "file" && resource.file_path ? (
          <ResourceDownloadButton filePath={resource.file_path} mime={resource.file_mime} />
        ) : resource.external_url ? (
          <a
            href={resource.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: "4px 12px", color: "var(--akp-gold)", borderColor: "rgba(201,168,76,0.25)" }}
          >
            Open link →
          </a>
        ) : null}
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(resource.id)}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: "4px 12px", color: "#dc2626", borderColor: "rgba(220,38,38,0.2)" }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

/* ── FolderCard ── */
function FolderCard({
  folder,
  currentUserId,
  isAdmin,
  isOpen,
  onToggle,
  onAddResource,
}: {
  folder: CourseFolder;
  currentUserId: string;
  isAdmin: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onAddResource: (code: string, name: string) => void;
}) {
  const router = useRouter();

  async function handleRemove(id: string) {
    const result = await removeClassResource(id);
    if (result.error) alert(result.error);
    else router.refresh();
  }

  return (
    <div
      className="card overflow-hidden animate-fade-up"
      style={{ borderColor: isOpen ? "var(--b-strong)" : undefined, transition: "border-color 0.2s" }}
    >
      {/* Header — clickable */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: isOpen ? "var(--s-1)" : "transparent" }}
        onMouseEnter={(e) => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = "var(--s-1)"; }}
        onMouseLeave={(e) => { if (!isOpen) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        {/* Folder icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(10,34,64,0.07)", color: "var(--akp-navy)" }}
        >
          <svg
            width="18" height="18" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
          >
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <span
            className="text-[16px] font-black tracking-tight"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            {folder.course_code}
          </span>
          <p className="text-[12px] font-medium mt-0.5 truncate" style={{ color: "var(--t-secondary)" }}>
            {folder.course_name}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--t-muted)" }}>
            {folder.department} · {folder.resources.length} resource{folder.resources.length !== 1 ? "s" : ""} · Updated {timeAgo(folder.lastUpdated)}
          </p>
        </div>

        {/* Chevron */}
        <svg
          width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
          style={{ color: "var(--t-muted)", flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--b-subtle)" }}>
          {folder.resources.length === 0 ? (
            <p className="text-[13px] py-6 text-center" style={{ color: "var(--t-muted)" }}>
              No resources yet.
            </p>
          ) : (
            <div>
              {folder.resources.map((r) => (
                <ResourceItem
                  key={r.id}
                  resource={r}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
          <div className="pt-4">
            <button
              type="button"
              onClick={() => onAddResource(folder.course_code, folder.course_name)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12 }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add to {folder.course_code}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── AddResourceModal ── */
function AddResourceModal({
  onClose,
  courseLookup,
  prefillCode = "",
  prefillName = "",
}: {
  onClose: () => void;
  courseLookup: CourseLookup;
  prefillCode?: string;
  prefillName?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadClassResource, {});
  const overlayRef = useRef<HTMLDivElement>(null);

  const [courseCode, setCourseCode] = useState(prefillCode);
  const [courseName, setCourseName] = useState(prefillName);
  const [resourceType, setResourceType] = useState<"file" | "link">("file");
  const [fileName, setFileName] = useState<string>("");

  const isPrefilled = !!prefillCode;
  const normalized = normalizeCourseCode(courseCode);
  const knownCourse = courseLookup[normalized];

  // Auto-fill course name when code matches a known course
  useEffect(() => {
    if (!isPrefilled && knownCourse) {
      setCourseName(knownCourse.course_name);
    }
  }, [normalized]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Refresh + close on success
  useEffect(() => {
    if (state.success) {
      router.refresh();
      setTimeout(onClose, 800);
    }
  }, [state.success]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,18,16,0.45)", backdropFilter: "blur(6px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden animate-scale-in flex flex-col"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-xl)",
          maxHeight: "90vh",
        }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--b-subtle)" }}
        >
          <h2
            className="text-base font-bold"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            {isPrefilled ? `Add to ${prefillCode}` : "Add Resource"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--s-1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {state.success ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center px-6">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: "rgba(16,185,129,0.12)", color: "#059669" }}
              >
                ✓
              </div>
              <p className="font-semibold" style={{ color: "var(--t-primary)" }}>Resource added!</p>
            </div>
          ) : (
            <form action={action} className="p-6 flex flex-col gap-5">

              {/* Course fields */}
              {isPrefilled ? (
                <>
                  <input type="hidden" name="course_code" value={prefillCode} />
                  <input type="hidden" name="course_name" value={prefillName} />
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="input-label">Course Code *</label>
                    <input
                      name="course_code"
                      required
                      list="resource-course-datalist"
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      placeholder="e.g. BUSI 100"
                      className="input"
                      style={{ textTransform: "uppercase" }}
                    />
                    <datalist id="resource-course-datalist">
                      {Object.keys(courseLookup).map((code) => (
                        <option key={code} value={code} />
                      ))}
                    </datalist>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="input-label">
                      Course Name *
                      {knownCourse && (
                        <span className="ml-1.5 text-[10px] font-semibold" style={{ color: "#059669" }}>
                          auto-filled
                        </span>
                      )}
                    </label>
                    <input
                      name="course_name"
                      required
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="e.g. Foundations of Business"
                      className="input"
                      style={knownCourse ? { background: "var(--s-1)", color: "var(--t-secondary)" } : undefined}
                    />
                  </div>
                </div>
              )}

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="input-label">Title *</label>
                <input
                  name="title"
                  required
                  placeholder="e.g. Fall 2024 Midterm Study Guide"
                  className="input"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="input-label">Description <span style={{ fontWeight: 400, color: "var(--t-muted)" }}>(optional)</span></label>
                <input
                  name="description"
                  placeholder="Brief description of what this is"
                  className="input"
                />
              </div>

              {/* Resource type toggle */}
              <div className="flex flex-col gap-2">
                <label className="input-label">Type *</label>
                <div className="flex gap-2">
                  {(["file", "link"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setResourceType(type)}
                      className="flex-1 py-2 text-[13px] font-semibold rounded-xl transition-all border"
                      style={{
                        background: resourceType === type ? "rgba(10,34,64,0.07)" : "var(--s-1)",
                        color: resourceType === type ? "var(--t-primary)" : "var(--t-secondary)",
                        borderColor: resourceType === type ? "var(--akp-navy)" : "var(--b-default)",
                      }}
                    >
                      {type === "file" ? "File Upload" : "Link / URL"}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="resource_type" value={resourceType} />
              </div>

              {/* File or link input */}
              {resourceType === "file" ? (
                <div className="flex flex-col gap-1.5">
                  <label className="input-label">
                    File *{" "}
                    <span style={{ fontWeight: 400, color: "var(--t-muted)" }}>max 50 MB, any type</span>
                  </label>
                  <label
                    className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all"
                    style={{
                      border: "2px dashed var(--b-default)",
                      padding: "28px 24px",
                      background: "var(--s-1)",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--b-strong)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--b-default)")}
                  >
                    <svg
                      width="22" height="22" fill="none" stroke="currentColor"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      viewBox="0 0 24 24" style={{ color: "var(--t-muted)" }}
                    >
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span
                      className="text-[13px] font-medium text-center"
                      style={{ color: fileName ? "var(--t-primary)" : "var(--t-muted)" }}
                    >
                      {fileName || "Click to choose a file"}
                    </span>
                    <input
                      name="file"
                      type="file"
                      className="sr-only"
                      onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                    />
                  </label>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="input-label">URL *</label>
                  <input
                    name="external_url"
                    type="url"
                    placeholder="https://drive.google.com/…"
                    className="input"
                  />
                </div>
              )}

              {/* Error */}
              {state.error && (
                <p className="text-[13px]" style={{ color: "#dc2626" }}>{state.error}</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="btn btn-ghost">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="btn btn-primary"
                  style={{ opacity: pending ? 0.6 : 1 }}
                >
                  {pending ? "Uploading…" : "Add Resource"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main export ── */
export default function ClassResourcesTab({
  initialResources,
  currentUserId,
  isAdmin,
  courseLookup,
}: {
  initialResources: ClassResource[];
  currentUserId: string;
  isAdmin: boolean;
  courseLookup: CourseLookup;
}) {
  const [query, setQuery] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    prefillCode: string;
    prefillName: string;
  }>({ open: false, prefillCode: "", prefillName: "" });

  // Build sorted folder list from resources
  const folders = useMemo<CourseFolder[]>(() => {
    const map = new Map<string, CourseFolder>();
    for (const r of initialResources) {
      if (!map.has(r.course_code)) {
        map.set(r.course_code, {
          course_code: r.course_code,
          course_name: r.course_name,
          department: r.department,
          resources: [],
          lastUpdated: r.created_at,
        });
      }
      const folder = map.get(r.course_code)!;
      folder.resources.push(r);
      if (r.created_at > folder.lastUpdated) folder.lastUpdated = r.created_at;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.course_code.localeCompare(b.course_code)
    );
  }, [initialResources]);

  const filtered = useMemo(() => {
    if (!query) return folders;
    const q = query.toLowerCase();
    return folders.filter(
      (f) =>
        f.course_code.toLowerCase().includes(q) ||
        f.course_name.toLowerCase().includes(q) ||
        f.department.toLowerCase().includes(q)
    );
  }, [folders, query]);

  function openAddModal(prefillCode = "", prefillName = "") {
    setModal({ open: true, prefillCode, prefillName });
  }

  return (
    <>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: "var(--t-muted)" }}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses…"
            className="input pl-9"
          />
        </div>
        <button onClick={() => openAddModal()} className="btn btn-primary shrink-0">
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Resource
        </button>
      </div>

      {/* Folder list */}
      {folders.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl"
          style={{ background: "var(--s-0)", border: "1px dashed var(--b-default)" }}
        >
          <p className="text-base font-semibold mb-1" style={{ color: "var(--t-primary)" }}>
            No resources yet
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--t-muted)" }}>
            Be the first brother to upload a study guide or resource.
          </p>
          <button onClick={() => openAddModal()} className="btn btn-primary">
            Add the first resource →
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm py-12 text-center" style={{ color: "var(--t-muted)" }}>
          No courses match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((folder) => (
            <FolderCard
              key={folder.course_code}
              folder={folder}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              isOpen={openCode === folder.course_code}
              onToggle={() =>
                setOpenCode(openCode === folder.course_code ? null : folder.course_code)
              }
              onAddResource={openAddModal}
            />
          ))}
        </div>
      )}

      {modal.open && (
        <AddResourceModal
          onClose={() => setModal({ open: false, prefillCode: "", prefillName: "" })}
          courseLookup={courseLookup}
          prefillCode={modal.prefillCode}
          prefillName={modal.prefillName}
        />
      )}
    </>
  );
}
