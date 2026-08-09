"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  upsertField,
  deleteField,
  toggleFieldPublished,
  moveField,
  upsertResource,
  deleteResource,
  moveResource,
  getSignedUploadUrl,
  upsertSubfolder,
  deleteSubfolder,
  moveSubfolder,
} from "@/lib/actions/recruitment";
import type {
  FieldWithResources,
  RecruitmentResource,
  RecruitmentSubfolder,
  SubfolderWithResources,
  FieldInput,
} from "@/lib/actions/recruitment";
import { buildSubfolderTree, type SubfolderNode } from "@/lib/subfolderTree";

// ── Shared helpers ────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function mimeLabel(mime: string | null): string {
  if (!mime) return "File";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("document")) return "DOC";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "PPT";
  if (mime.includes("sheet") || mime.includes("excel")) return "XLS";
  return "File";
}

// ── Small shared UI ───────────────────────────────────────────────────────────

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  value,
  onChange,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="input-label">
        {label}
        {required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      <input
        id={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
      {hint && (
        <p className="text-[11px]" style={{ color: "var(--t-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(20,18,16,0.5)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-lg my-8 rounded-2xl flex flex-col animate-scale-in"
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
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--s-1)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Field modal ───────────────────────────────────────────────────────────────

function FieldModal({
  field,
  nextSortOrder,
  onClose,
}: {
  field: FieldWithResources | null;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(field?.name ?? "");
  const [slug, setSlug] = useState(field?.slug ?? "");
  const [description, setDescription] = useState(field?.description ?? "");
  const [icon, setIcon] = useState(field?.icon ?? "");
  const [sortOrder, setSortOrder] = useState(
    String(field?.sort_order ?? nextSortOrder)
  );
  const [isPublished, setIsPublished] = useState(field?.is_published ?? true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  // Auto-derive slug from name when creating new
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!field && name) setSlug(slugify(name));
  }, [field, name]);

  function submit() {
    if (!name.trim() || !slug.trim()) return;
    setError("");
    startTransition(async () => {
      const input: FieldInput = {
        id: field?.id,
        name,
        slug,
        description,
        icon,
        sort_order: parseInt(sortOrder) || 0,
        is_published: isPublished,
      };
      const result = await upsertField(input);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(onClose, 500);
      }
    });
  }

  return (
    <ModalShell title={field ? "Edit Field" : "Add Field"} onClose={onClose}>
      {success ? (
        <div className="flex flex-col items-center gap-3 py-12 px-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
            style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
          >
            ✓
          </div>
          <p className="font-semibold" style={{ color: "var(--t-primary)" }}>
            {field ? "Saved." : "Field added."}
          </p>
        </div>
      ) : (
        <div className="p-6 flex flex-col gap-4">
          <Field
            label="Name"
            name="name"
            required
            placeholder="Investment Banking"
            value={name}
            onChange={setName}
          />
          <Field
            label="Slug"
            name="slug"
            required
            placeholder="investment-banking"
            value={slug}
            onChange={setSlug}
            hint="URL-safe identifier — auto-filled from name."
          />
          <Field
            label="Description"
            name="description"
            placeholder="Short description…"
            value={description}
            onChange={setDescription}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Icon (emoji)"
              name="icon"
              placeholder="🏦"
              value={icon}
              onChange={setIcon}
            />
            <Field
              label="Sort order"
              name="sort_order"
              type="number"
              placeholder="10"
              value={sortOrder}
              onChange={setSortOrder}
            />
          </div>

          {/* Publish toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isPublished}
              onClick={() => setIsPublished((v) => !v)}
              className="w-10 h-5 rounded-full transition-colors relative"
              style={{
                background: isPublished ? "var(--akp-gold)" : "var(--b-strong)",
              }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{
                  transform: isPublished
                    ? "translateX(1.25rem)"
                    : "translateX(0.125rem)",
                }}
              />
            </button>
            <span className="text-sm" style={{ color: "var(--t-secondary)" }}>
              {isPublished ? "Published" : "Hidden from members"}
            </span>
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
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={pending || !name.trim() || !slug.trim()}
              className="btn btn-primary btn-sm disabled:opacity-50"
            >
              {pending ? "Saving…" : field ? "Save Changes" : "Add Field"}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ── Resource modal ────────────────────────────────────────────────────────────

function ResourceModal({
  fields,
  resource,
  defaultFieldId,
  onClose,
}: {
  fields: FieldWithResources[];
  resource: RecruitmentResource | null;
  defaultFieldId: string;
  onClose: () => void;
}) {
  const [fieldId, setFieldId] = useState(
    resource?.field_id ?? defaultFieldId
  );
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(
    resource?.description ?? ""
  );
  const [resourceType, setResourceType] = useState<"file" | "link">(
    resource?.resource_type ?? "file"
  );
  const [externalUrl, setExternalUrl] = useState(
    resource?.external_url ?? ""
  );

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [uploadedPath, setUploadedPath] = useState<string | null>(
    resource?.resource_type === "file" ? resource.file_path : null
  );
  const [uploadedMime, setUploadedMime] = useState<string | null>(
    resource?.file_mime ?? null
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [subfolderId, setSubfolderId] = useState<string | null>(
    resource?.subfolder_id ?? null
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // For multi-file: track which files have been saved
  const [savedCount, setSavedCount] = useState(0);

  const isMulti = selectedFiles.length > 1;
  const isEditing = resource !== null;

  const selectedField = fields.find((f) => f.id === fieldId);
  const subfolderOptions = selectedField?.recruitment_subfolders ?? [];

  async function uploadFile(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop() ?? "";
    const base = safeName(file.name.replace(/\.[^.]+$/, ""));
    const path = `${selectedField?.slug ?? "general"}/${Date.now()}-${base}${ext ? "." + ext : ""}`;

    const result = await getSignedUploadUrl(path);
    if ("error" in result) {
      setUploadError(result.error);
      return null;
    }

    const res = await fetch(result.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    if (!res.ok) {
      setUploadError(`Upload failed: ${res.statusText}`);
      return null;
    }

    return path;
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    if (resourceType === "file") {
      if (isMulti && selectedFiles.length > 0) {
        // Multi-file: upload + save each independently
        let count = 0;
        for (const file of selectedFiles) {
          setUploadStatus("uploading");
          const path = await uploadFile(file);
          if (!path) {
            setUploadStatus("error");
            setSaving(false);
            return;
          }
          const result = await upsertResource({
            field_id: fieldId,
            subfolder_id: subfolderId,
            title: file.name.replace(/\.[^.]+$/, ""),
            description: description || undefined,
            resource_type: "file",
            file_path: path,
            file_mime: file.type || null,
          });
          if (result.error) {
            setSaveError(result.error);
            setSaving(false);
            setUploadStatus("error");
            return;
          }
          count++;
          setSavedCount(count);
        }
        setUploadStatus("done");
        setSuccess(true);
        setTimeout(onClose, 600);
        return;
      }

      // Single file (new or editing)
      let path = uploadedPath;
      let mime = uploadedMime;

      if (selectedFiles[0] && !isEditing) {
        setUploadStatus("uploading");
        path = await uploadFile(selectedFiles[0]);
        mime = selectedFiles[0].type || null;
        if (!path) {
          setUploadStatus("error");
          setSaving(false);
          return;
        }
        setUploadStatus("done");
        setUploadedPath(path);
        setUploadedMime(mime);
      }

      if (!path) {
        setSaveError("Please select a file to upload.");
        setSaving(false);
        return;
      }

      const result = await upsertResource({
        id: resource?.id,
        field_id: fieldId,
        subfolder_id: subfolderId,
        title: title || (selectedFiles[0]?.name.replace(/\.[^.]+$/, "") ?? ""),
        description: description || undefined,
        resource_type: "file",
        file_path: path,
        file_mime: mime,
      });

      if (result.error) {
        setSaveError(result.error);
        setSaving(false);
        return;
      }
    } else {
      // Link
      if (!externalUrl.trim()) {
        setSaveError("Please enter a URL.");
        setSaving(false);
        return;
      }

      const result = await upsertResource({
        id: resource?.id,
        field_id: fieldId,
        subfolder_id: subfolderId,
        title,
        description: description || undefined,
        resource_type: "link",
        external_url: externalUrl,
      });

      if (result.error) {
        setSaveError(result.error);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSuccess(true);
    setTimeout(onClose, 500);
  }

  const isExistingFile =
    isEditing && resource.resource_type === "file" && resource.file_path;

  return (
    <ModalShell
      title={resource ? "Edit Resource" : "Add Resource"}
      onClose={onClose}
    >
      {success ? (
        <div className="flex flex-col items-center gap-3 py-12 px-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
            style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
          >
            ✓
          </div>
          <p className="font-semibold" style={{ color: "var(--t-primary)" }}>
            {isMulti ? `${savedCount} resources added.` : resource ? "Saved." : "Resource added."}
          </p>
        </div>
      ) : (
        <div className="p-6 flex flex-col gap-4">
          {/* Field selector */}
          <div className="flex flex-col gap-1">
            <label className="input-label">Field *</label>
            <select
              value={fieldId}
              onChange={(e) => {
                setFieldId(e.target.value);
                setSubfolderId(null);
              }}
              className="input"
            >
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icon ? `${f.icon} ` : ""}{f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subfolder selector */}
          {subfolderOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="input-label">
                Subfolder{" "}
                <span className="font-normal normal-case" style={{ color: "var(--t-muted)" }}>
                  (optional)
                </span>
              </label>
              <select
                value={subfolderId ?? ""}
                onChange={(e) => setSubfolderId(e.target.value || null)}
                className="input"
              >
                <option value="">— No subfolder (top-level) —</option>
                {subfolderOptions.map((sf) => (
                  <option key={sf.id} value={sf.id}>
                    📁 {sf.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Type toggle */}
          {!isEditing && (
            <div className="flex gap-2">
              {(["file", "link"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setResourceType(t)}
                  className={`pill flex-1 text-center ${resourceType === t ? "pill-active" : ""}`}
                >
                  {t === "file" ? "Upload file" : "External link"}
                </button>
              ))}
            </div>
          )}

          {/* File upload section */}
          {resourceType === "file" && (
            <div className="flex flex-col gap-2">
              {isExistingFile ? (
                <p
                  className="text-xs px-3 py-2 rounded-lg"
                  style={{
                    background: "var(--s-1)",
                    color: "var(--t-secondary)",
                  }}
                >
                  Current file:{" "}
                  <span className="font-semibold">
                    {resource.file_path?.split("/").pop()}
                  </span>
                  <span className="ml-2 text-[10px]" style={{ color: "var(--t-muted)" }}>
                    (to replace, delete and re-add)
                  </span>
                </p>
              ) : (
                <>
                  <label className="input-label">File{!isEditing && " *"}</label>
                  <label
                    className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl cursor-pointer border-2 border-dashed transition-colors"
                    style={{ borderColor: "var(--b-default)" }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = Array.from(e.dataTransfer.files);
                      if (files.length > 0) {
                        setSelectedFiles(files);
                        if (files.length === 1 && !title) {
                          setTitle(files[0].name.replace(/\.[^.]+$/, ""));
                        }
                      }
                    }}
                  >
                    <input
                      type="file"
                      className="sr-only"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        setSelectedFiles(files);
                        if (files.length === 1 && !title) {
                          setTitle(files[0].name.replace(/\.[^.]+$/, ""));
                        }
                      }}
                    />
                    {selectedFiles.length > 0 ? (
                      <div className="text-center">
                        {selectedFiles.length === 1 ? (
                          <>
                            <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                              {selectedFiles[0].name}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--t-muted)" }}>
                              {(selectedFiles[0].size / 1024).toFixed(0)} KB
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                              {selectedFiles.length} files selected
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--t-muted)" }}>
                              Each file becomes its own resource
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <svg
                          width="24"
                          height="24"
                          fill="none"
                          stroke="var(--t-muted)"
                          strokeWidth="1.5"
                          viewBox="0 0 24 24"
                        >
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        <p className="text-sm" style={{ color: "var(--t-secondary)" }}>
                          Click or drag files here
                        </p>
                        <p className="text-xs" style={{ color: "var(--t-muted)" }}>
                          Drop multiple PDFs/docs to bulk-add
                        </p>
                      </>
                    )}
                  </label>
                </>
              )}

              {uploadStatus === "uploading" && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--t-secondary)" }}>
                  <span
                    className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--akp-navy)", borderTopColor: "transparent" }}
                  />
                  Uploading…{isMulti && ` (${savedCount + 1} of ${selectedFiles.length})`}
                </div>
              )}
              {uploadError && (
                <p className="text-xs" style={{ color: "#dc2626" }}>
                  {uploadError}
                </p>
              )}
            </div>
          )}

          {/* Link section */}
          {resourceType === "link" && (
            <div className="flex flex-col gap-1">
              <label className="input-label">URL *</label>
              <input
                type="url"
                placeholder="https://…"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="input"
              />
            </div>
          )}

          {/* Title (hidden for multi-file) */}
          {(!isMulti || resourceType === "link") && (
            <div className="flex flex-col gap-1">
              <label className="input-label">
                Title
                {resourceType === "file" && (
                  <span
                    className="ml-1 font-normal normal-case"
                    style={{ color: "var(--t-muted)" }}
                  >
                    (auto-filled from filename)
                  </span>
                )}
              </label>
              <input
                type="text"
                placeholder="e.g. IB Interview Prep Guide"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
              />
            </div>
          )}

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="input-label">
              Description{" "}
              <span className="font-normal normal-case" style={{ color: "var(--t-muted)" }}>
                (optional)
              </span>
            </label>
            <textarea
              rows={2}
              placeholder="Short description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input resize-none"
            />
          </div>

          {saveError && (
            <p className="text-sm" style={{ color: "#dc2626" }}>
              {saveError}
            </p>
          )}

          <div
            className="flex justify-end gap-2 pt-2"
            style={{ borderTop: "1px solid var(--b-subtle)", paddingTop: "1rem" }}
          >
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary btn-sm disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : isMulti
                ? `Add ${selectedFiles.length} resources`
                : resource
                ? "Save"
                : "Add Resource"}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ── Resource row ──────────────────────────────────────────────────────────────

function ResourceRow({
  resource,
  subfolder,
  fields,
  isFirst,
  isLast,
  onEdit,
}: {
  resource: RecruitmentResource;
  subfolder: RecruitmentSubfolder | null;
  fields: FieldWithResources[];
  isFirst: boolean;
  isLast: boolean;
  onEdit: (r: RecruitmentResource) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-opacity"
      style={{
        background: "var(--s-1)",
        opacity: pending ? 0.4 : 1,
      }}
    >
      {/* Type badge */}
      <span
        className="shrink-0 badge"
        style={
          resource.resource_type === "file"
            ? { background: "rgba(10,34,64,0.07)", color: "var(--t-secondary)" }
            : { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }
        }
      >
        {resource.resource_type === "file"
          ? mimeLabel(resource.file_mime)
          : "Link"}
      </span>

      {/* Subfolder tag */}
      {subfolder && (
        <span
          className="shrink-0 text-[10px] px-2 py-0.5 rounded-md font-medium hidden sm:block"
          style={{ background: "var(--s-0)", color: "var(--t-muted)", border: "1px solid var(--b-subtle)" }}
        >
          📁 {subfolder.name}
        </span>
      )}

      {/* Title */}
      <p
        className="flex-1 text-sm font-semibold truncate"
        style={{ color: "var(--t-primary)" }}
      >
        {resource.title}
      </p>
      {resource.description && (
        <p
          className="text-xs truncate max-w-[160px] hidden sm:block"
          style={{ color: "var(--t-muted)" }}
        >
          {resource.description}
        </p>
      )}

      {/* Reorder */}
      <div className="flex gap-0.5">
        <button
          disabled={isFirst || pending}
          onClick={() =>
            startTransition(async () => {
              await moveResource(resource.id, "up");
            })
          }
          className="w-6 h-6 rounded flex items-center justify-center text-xs disabled:opacity-20 transition-colors"
          style={{ color: "var(--t-muted)" }}
          onMouseEnter={(e) => !isFirst && ((e.currentTarget as HTMLElement).style.background = "var(--s-0)")}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
          title="Move up"
        >
          ↑
        </button>
        <button
          disabled={isLast || pending}
          onClick={() =>
            startTransition(async () => {
              await moveResource(resource.id, "down");
            })
          }
          className="w-6 h-6 rounded flex items-center justify-center text-xs disabled:opacity-20 transition-colors"
          style={{ color: "var(--t-muted)" }}
          onMouseEnter={(e) => !isLast && ((e.currentTarget as HTMLElement).style.background = "var(--s-0)")}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
          title="Move down"
        >
          ↓
        </button>
      </div>

      {/* Edit */}
      <button
        onClick={() => onEdit(resource)}
        className="btn btn-ghost btn-sm"
      >
        Edit
      </button>

      {/* Delete */}
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(`Delete "${resource.title}"?`)) return;
          startTransition(async () => {
            await deleteResource(resource.id);
          });
        }}
        className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-red-50 disabled:opacity-30"
        style={{ color: "#dc2626" }}
      >
        Delete
      </button>
    </div>
  );
}

// ── Subfolder row ─────────────────────────────────────────────────────────────

function SubfolderRow({
  subfolder,
  resourceCount,
  isFirst,
  isLast,
  childSortOrder,
}: {
  subfolder: RecruitmentSubfolder;
  resourceCount: number;
  isFirst: boolean;
  isLast: boolean;
  childSortOrder: number;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(subfolder.name);
  const [showAddChild, setShowAddChild] = useState(false);
  const [pending, startTransition] = useTransition();

  function saveRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === subfolder.name) {
      setName(subfolder.name);
      setRenaming(false);
      return;
    }
    startTransition(async () => {
      await upsertSubfolder({
        id: subfolder.id,
        field_id: subfolder.field_id,
        name: trimmed,
        sort_order: subfolder.sort_order,
      });
      setRenaming(false);
    });
  }

  return (
    <div
      className="flex flex-col gap-1 transition-opacity"
      style={{ opacity: pending ? 0.5 : 1 }}
    >
      {/* Row */}
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-xl"
        style={{
          background: "var(--s-2)",
          border: "1px solid var(--b-subtle)",
        }}
      >
        <span className="text-sm shrink-0" style={{ color: "var(--t-muted)" }}>
          📁
        </span>

        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setName(subfolder.name);
                setRenaming(false);
              }
            }}
            className="input flex-1 text-sm"
            style={{ padding: "2px 8px", height: "auto" }}
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium truncate"
            style={{ color: "var(--t-primary)" }}
          >
            {subfolder.name}
          </span>
        )}

        <span className="badge badge-neutral text-[10px] shrink-0">
          {resourceCount}
        </span>

        <button
          disabled={isFirst || pending}
          onClick={() =>
            startTransition(async () => {
              await moveSubfolder(subfolder.id, "up");
            })
          }
          className="w-5 h-5 flex items-center justify-center text-xs disabled:opacity-20 transition-colors rounded"
          style={{ color: "var(--t-muted)" }}
          title="Move up"
        >
          ↑
        </button>
        <button
          disabled={isLast || pending}
          onClick={() =>
            startTransition(async () => {
              await moveSubfolder(subfolder.id, "down");
            })
          }
          className="w-5 h-5 flex items-center justify-center text-xs disabled:opacity-20 transition-colors rounded"
          style={{ color: "var(--t-muted)" }}
          title="Move down"
        >
          ↓
        </button>

        {renaming ? (
          <>
            <button
              onClick={saveRename}
              disabled={pending}
              className="btn btn-primary btn-sm disabled:opacity-50"
              style={{ padding: "2px 10px" }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setName(subfolder.name);
                setRenaming(false);
              }}
              className="btn btn-ghost btn-sm"
              style={{ padding: "2px 10px" }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setRenaming(true)}
              className="btn btn-ghost btn-sm"
            >
              Rename
            </button>
            <button
              onClick={() => setShowAddChild((v) => !v)}
              className="btn btn-ghost btn-sm"
              title="Add a sub-folder inside this folder"
            >
              + Sub-folder
            </button>
          </>
        )}

        <button
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                `Delete "${subfolder.name}"? Its resources won't be deleted — they'll appear as top-level.`
              )
            )
              return;
            startTransition(async () => {
              await deleteSubfolder(subfolder.id);
            });
          }}
          className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30 shrink-0"
          style={{ color: "#dc2626" }}
        >
          Delete
        </button>
      </div>

      {/* Inline add-child form */}
      {showAddChild && (
        <div className="pl-6">
          <AddSubfolderForm
            fieldId={subfolder.field_id}
            parentId={subfolder.id}
            nextSortOrder={childSortOrder}
            onDone={() => setShowAddChild(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Subfolder tree (admin) ────────────────────────────────────────────────────

function SubfolderTreeAdmin({
  nodes,
  depth = 0,
}: {
  nodes: SubfolderNode[];
  depth?: number;
}) {
  return (
    <div
      className="flex flex-col gap-2"
      style={{ paddingLeft: depth > 0 ? "1.5rem" : "0" }}
    >
      {nodes.map((node, i) => (
        <div key={node.id}>
          <SubfolderRow
            subfolder={node}
            resourceCount={node.recruitment_resources?.length ?? 0}
            isFirst={i === 0}
            isLast={i === nodes.length - 1}
            childSortOrder={
              node.children.length > 0
                ? Math.max(...node.children.map((c) => c.sort_order)) + 10
                : 10
            }
          />
          {node.children.length > 0 && (
            <SubfolderTreeAdmin nodes={node.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Add subfolder inline form ─────────────────────────────────────────────────

function AddSubfolderForm({
  fieldId,
  parentId = null,
  nextSortOrder,
  onDone,
}: {
  fieldId: string;
  parentId?: string | null;
  nextSortOrder: number;
  onDone?: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");
    startTransition(async () => {
      const result = await upsertSubfolder({
        field_id: fieldId,
        parent_id: parentId,
        name: trimmed,
        sort_order: nextSortOrder,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setName("");
        onDone?.();
      }
    });
  }

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex gap-2 items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={
            parentId ? "New sub-folder name…" : "New subfolder name…"
          }
          className="input flex-1 text-sm"
        />
        <button
          onClick={submit}
          disabled={pending || !name.trim()}
          className="btn btn-primary btn-sm disabled:opacity-50 shrink-0"
        >
          {pending ? "Adding…" : "+ Add"}
        </button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Folder upload modal ───────────────────────────────────────────────────────

type FolderGroup = {
  subfolderName: string | null;       // null = top-level file
  parentSubfolderName: string | null; // null = root subfolder
  files: File[];
};

function groupFilesBySubfolder(files: FileList): FolderGroup[] {
  const map = new Map<string, FolderGroup>();

  for (const file of Array.from(files)) {
    const parts = file.webkitRelativePath.split("/");
    // parts[0] = root folder (the selected folder itself)
    // depth 2: parts = [root, filename]           → top-level
    // depth 3: parts = [root, sub, filename]      → one subfolder
    // depth 4: parts = [root, sub, subsub, file]  → nested subfolder

    let key: string;
    let subfolderName: string | null;
    let parentSubfolderName: string | null;

    if (parts.length <= 2) {
      key = "__root__";
      subfolderName = null;
      parentSubfolderName = null;
    } else if (parts.length === 3) {
      key = parts[1];
      subfolderName = parts[1];
      parentSubfolderName = null;
    } else {
      // depth >= 4: use first two levels only (cap at two levels)
      key = `${parts[1]}/${parts[2]}`;
      subfolderName = parts[2];
      parentSubfolderName = parts[1];
    }

    if (!map.has(key)) {
      map.set(key, { subfolderName, parentSubfolderName, files: [] });
    }
    map.get(key)!.files.push(file);
  }

  // Order: top-level files first, root subfolders next, nested last (alphabetical within each tier)
  return Array.from(map.values()).sort((a, b) => {
    if (a.subfolderName === null) return -1;
    if (b.subfolderName === null) return 1;
    if (a.parentSubfolderName === null && b.parentSubfolderName !== null) return -1;
    if (a.parentSubfolderName !== null && b.parentSubfolderName === null) return 1;
    return (
      (a.parentSubfolderName ?? "").localeCompare(b.parentSubfolderName ?? "") ||
      a.subfolderName.localeCompare(b.subfolderName)
    );
  });
}

function FolderUploadModal({
  field,
  onClose,
}: {
  field: FieldWithResources;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [phase, setPhase] = useState<"pick" | "preview" | "uploading" | "done" | "error">("pick");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setGroups(groupFilesBySubfolder(files));
    setPhase("preview");
  }

  async function startUpload() {
    setPhase("uploading");
    const total = groups.reduce((n, g) => n + g.files.length, 0);
    setProgress({ done: 0, total });

    // Seed map with existing subfolders (case-insensitive key = "name" or "parentname/name")
    const subfolderIdMap = new Map<string, string>();
    const existingSubfolders = field.recruitment_subfolders ?? [];
    const idToName = new Map(existingSubfolders.map((sf) => [sf.id, sf.name.toLowerCase()]));
    for (const sf of existingSubfolders) {
      subfolderIdMap.set(sf.name.toLowerCase(), sf.id);
      if (sf.parent_id) {
        const parentName = idToName.get(sf.parent_id);
        if (parentName) {
          subfolderIdMap.set(`${parentName}/${sf.name.toLowerCase()}`, sf.id);
        }
      }
    }

    let nextRootOrder =
      (field.recruitment_subfolders ?? []).filter((s) => !s.parent_id).length > 0
        ? Math.max(
            ...(field.recruitment_subfolders ?? [])
              .filter((s) => !s.parent_id)
              .map((s) => s.sort_order)
          ) + 10
        : 10;
    let nextChildOrder = 10;

    let done = 0;

    for (const group of groups) {
      let subfolderId: string | null = null;

      if (group.subfolderName !== null) {
        if (group.parentSubfolderName !== null) {
          // Nested subfolder — ensure root exists first
          const rootKey = group.parentSubfolderName.toLowerCase();
          let rootId = subfolderIdMap.get(rootKey);
          if (!rootId) {
            const r = await upsertSubfolder({
              field_id: field.id,
              parent_id: null,
              name: group.parentSubfolderName,
              sort_order: nextRootOrder,
            });
            if (r.error) { setErrorMsg(`Failed to create folder "${group.parentSubfolderName}": ${r.error}`); setPhase("error"); return; }
            rootId = r.id!;
            subfolderIdMap.set(rootKey, rootId);
            nextRootOrder += 10;
          }

          // Now upsert the child subfolder
          const childKey = `${rootKey}/${group.subfolderName.toLowerCase()}`;
          let childId = subfolderIdMap.get(childKey);
          if (!childId) {
            const r = await upsertSubfolder({
              field_id: field.id,
              parent_id: rootId,
              name: group.subfolderName,
              sort_order: nextChildOrder,
            });
            if (r.error) { setErrorMsg(`Failed to create folder "${group.subfolderName}": ${r.error}`); setPhase("error"); return; }
            childId = r.id!;
            subfolderIdMap.set(childKey, childId);
            nextChildOrder += 10;
          }
          subfolderId = childId;
        } else {
          // Root subfolder
          const rootKey = group.subfolderName.toLowerCase();
          let rootId = subfolderIdMap.get(rootKey);
          if (!rootId) {
            const r = await upsertSubfolder({
              field_id: field.id,
              parent_id: null,
              name: group.subfolderName,
              sort_order: nextRootOrder,
            });
            if (r.error) { setErrorMsg(`Failed to create folder "${group.subfolderName}": ${r.error}`); setPhase("error"); return; }
            rootId = r.id!;
            subfolderIdMap.set(rootKey, rootId);
            nextRootOrder += 10;
          }
          subfolderId = rootId;
        }
      }

      // Upload files in this group
      for (const file of group.files) {
        const ext = file.name.split(".").pop() ?? "";
        const base = safeName(file.name.replace(/\.[^.]+$/, ""));
        const subfolderSlug = group.subfolderName
          ? group.subfolderName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
          : null;
        const parentSlug = group.parentSubfolderName
          ? group.parentSubfolderName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
          : null;
        const storagePath = subfolderSlug
          ? parentSlug
            ? `${field.slug}/${parentSlug}/${subfolderSlug}/${Date.now()}-${base}${ext ? "." + ext : ""}`
            : `${field.slug}/${subfolderSlug}/${Date.now()}-${base}${ext ? "." + ext : ""}`
          : `${field.slug}/${Date.now()}-${base}${ext ? "." + ext : ""}`;

        const urlResult = await getSignedUploadUrl(storagePath);
        if ("error" in urlResult) { setErrorMsg(`Upload failed for "${file.name}": ${urlResult.error}`); setPhase("error"); return; }

        const res = await fetch(urlResult.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!res.ok) { setErrorMsg(`Upload failed for "${file.name}": ${res.statusText}`); setPhase("error"); return; }

        const saveResult = await upsertResource({
          field_id: field.id,
          subfolder_id: subfolderId,
          title: file.name.replace(/\.[^.]+$/, ""),
          resource_type: "file",
          file_path: storagePath,
          file_mime: file.type || null,
        });
        if (saveResult.error) { setErrorMsg(`Failed to save "${file.name}": ${saveResult.error}`); setPhase("error"); return; }

        done++;
        setProgress({ done, total });
      }
    }

    setPhase("done");
    setTimeout(onClose, 1000);
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
        style={{ background: "var(--s-0)", border: "1px solid var(--b-default)", boxShadow: "var(--shadow-xl)" }}
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
            Upload Folder — {field.name}
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

        <div className="p-6">
          {phase === "pick" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm" style={{ color: "var(--t-secondary)" }}>
                Select a folder from your computer. Sub-folders inside it become subfolder sections.
                Files at the root become top-level resources.
              </p>
              <label
                className="flex flex-col items-center justify-center gap-3 px-4 py-10 rounded-xl cursor-pointer border-2 border-dashed transition-colors"
                style={{ borderColor: "var(--b-default)" }}
              >
                <input
                  type="file"
                  className="sr-only"
                  // @ts-expect-error — webkitdirectory is non-standard but widely supported
                  webkitdirectory=""
                  multiple
                  onChange={onFilesSelected}
                />
                <svg width="28" height="28" fill="none" stroke="var(--t-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                  Click to select a folder
                </p>
                <p className="text-xs" style={{ color: "var(--t-muted)" }}>
                  Sub-folders are detected automatically
                </p>
              </label>
            </div>
          )}

          {phase === "preview" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                Detected structure:
              </p>
              <div
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{ background: "var(--s-1)", border: "1px solid var(--b-default)" }}
              >
                {groups.map((g) => (
                  <div
                    key={g.subfolderName ?? "__top__"}
                    className="flex items-center gap-3"
                    style={{ paddingLeft: g.parentSubfolderName ? "1.25rem" : "0" }}
                  >
                    <span className="text-sm" style={{ color: "var(--t-muted)" }}>
                      {g.subfolderName
                        ? g.parentSubfolderName
                          ? "  📂"
                          : "📁"
                        : "📄"}
                    </span>
                    <span
                      className="text-sm flex-1"
                      style={{ color: "var(--t-primary)" }}
                    >
                      {g.subfolderName ?? "(top-level files)"}
                    </span>
                    <span className="badge badge-neutral text-[11px]">
                      {g.files.length} file{g.files.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--t-muted)" }}>
                {groups.reduce((n, g) => n + g.files.length, 0)} files total
              </p>
              <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--b-subtle)" }}>
                <button onClick={() => setPhase("pick")} className="btn btn-ghost btn-sm">
                  Back
                </button>
                <button onClick={startUpload} className="btn btn-primary btn-sm">
                  Upload All
                </button>
              </div>
            </div>
          )}

          {phase === "uploading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <span
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--akp-navy)", borderTopColor: "transparent" }}
              />
              <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                Uploading {progress.done} of {progress.total} files…
              </p>
              <div className="w-full rounded-full h-1.5" style={{ background: "var(--b-default)" }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    background: "var(--akp-gold)",
                    width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
              >
                ✓
              </div>
              <p className="font-semibold" style={{ color: "var(--t-primary)" }}>
                {progress.total} file{progress.total !== 1 ? "s" : ""} uploaded.
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm" style={{ color: "#dc2626" }}>
                {errorMsg}
              </p>
              <p className="text-xs" style={{ color: "var(--t-muted)" }}>
                Files uploaded before the error were saved. You can retry the remaining files manually.
              </p>
              <div className="flex justify-end">
                <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Field card ────────────────────────────────────────────────────────────────

function FieldCard({
  field,
  fields,
  isFirst,
  isLast,
  onEdit,
  onAddResource,
}: {
  field: FieldWithResources;
  fields: FieldWithResources[];
  isFirst: boolean;
  isLast: boolean;
  onEdit: (f: FieldWithResources) => void;
  onAddResource: (fieldId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [editingResource, setEditingResource] = useState<RecruitmentResource | null>(null);
  const [showFolderUpload, setShowFolderUpload] = useState(false);

  const resources = field.recruitment_resources ?? [];

  return (
    <div
      id={field.slug}
      className="rounded-2xl overflow-hidden transition-opacity scroll-mt-8"
      style={{
        background: "var(--s-0)",
        border: "1px solid var(--b-default)",
        boxShadow: "var(--shadow-sm)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {/* Field header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Icon */}
        <span className="text-xl shrink-0 w-8 text-center">
          {field.icon ?? "📁"}
        </span>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
              {field.name}
            </p>
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={
                field.is_published
                  ? { background: "rgba(22,163,74,0.1)", color: "#16a34a" }
                  : { background: "var(--s-1)", color: "var(--t-muted)" }
              }
            >
              {field.is_published ? "Published" : "Hidden"}
            </span>
          </div>
          <p className="text-xs truncate" style={{ color: "var(--t-muted)" }}>
            /{field.slug} · order {field.sort_order}
          </p>
        </div>

        {/* Resource count + expand */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
          style={{
            background: expanded ? "var(--s-1)" : "var(--s-1)",
            color: "var(--t-secondary)",
            border: `1px solid ${expanded ? "var(--b-strong)" : "var(--b-default)"}`,
          }}
        >
          {resources.length} resource{resources.length !== 1 ? "s" : ""}{" "}
          {expanded ? "▲" : "▼"}
        </button>

        {/* Upload Folder */}
        <button
          onClick={() => setShowFolderUpload(true)}
          title="Upload a folder"
          className="shrink-0 btn btn-ghost btn-sm"
        >
          📁 Upload Folder
        </button>

        {/* Reorder */}
        <div className="flex gap-0.5 shrink-0">
          <button
            disabled={isFirst || pending}
            onClick={() =>
              startTransition(async () => {
                await moveField(field.id, "up");
              })
            }
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm disabled:opacity-20 transition-colors"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => !isFirst && ((e.currentTarget as HTMLElement).style.background = "var(--s-1)")}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
            title="Move up"
          >
            ↑
          </button>
          <button
            disabled={isLast || pending}
            onClick={() =>
              startTransition(async () => {
                await moveField(field.id, "down");
              })
            }
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm disabled:opacity-20 transition-colors"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => !isLast && ((e.currentTarget as HTMLElement).style.background = "var(--s-1)")}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
            title="Move down"
          >
            ↓
          </button>
        </div>

        {/* Publish toggle */}
        <button
          onClick={() =>
            startTransition(async () => {
              await toggleFieldPublished(field.id, !field.is_published);
            })
          }
          title={field.is_published ? "Unpublish" : "Publish"}
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: field.is_published ? "#16a34a" : "var(--t-muted)" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--s-1)"}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
        >
          {field.is_published ? (
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          ) : (
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>
            </svg>
          )}
        </button>

        {/* Edit */}
        <button
          onClick={() => onEdit(field)}
          className="btn btn-ghost btn-sm shrink-0"
        >
          Edit
        </button>

        {/* Delete */}
        <button
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                `Delete "${field.name}" and all ${resources.length} resources?`
              )
            )
              return;
            startTransition(async () => {
              await deleteField(field.id);
            });
          }}
          className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30"
          style={{ color: "#dc2626" }}
        >
          Delete
        </button>
      </div>

      {/* Expanded: subfolders + resources */}
      {expanded && (
        <div
          className="px-4 pb-4 flex flex-col gap-4"
          style={{ borderTop: "1px solid var(--b-subtle)" }}
        >
          {/* ── Subfolders section ── */}
          <div className="pt-3">
            <div className="flex items-center justify-between pb-2">
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--t-muted)" }}
              >
                Subfolders
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {(field.recruitment_subfolders ?? []).length === 0 ? (
                <p className="text-xs" style={{ color: "var(--t-faint)" }}>
                  No subfolders yet — add one to group resources.
                </p>
              ) : (
                <SubfolderTreeAdmin
                  nodes={buildSubfolderTree(field.recruitment_subfolders ?? [])}
                />
              )}
              <AddSubfolderForm
                fieldId={field.id}
                parentId={null}
                nextSortOrder={
                  (field.recruitment_subfolders ?? []).filter((s) => !s.parent_id)
                    .length > 0
                    ? Math.max(
                        ...(field.recruitment_subfolders ?? [])
                          .filter((s) => !s.parent_id)
                          .map((s) => s.sort_order)
                      ) + 10
                    : 10
                }
              />
            </div>
          </div>

          {/* ── Resources section ── */}
          <div style={{ borderTop: "1px solid var(--b-subtle)", paddingTop: "1rem" }}>
            <div className="flex items-center justify-between pb-2">
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--t-muted)" }}
              >
                Resources
              </p>
              <button
                onClick={() => onAddResource(field.id)}
                className="btn btn-primary btn-sm"
              >
                + Add Resource
              </button>
            </div>

            {(field.recruitment_resources ?? []).length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--t-muted)" }}>
                No resources yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {(field.recruitment_resources ?? []).map((r, i, arr) => (
                  <ResourceRow
                    key={r.id}
                    resource={r}
                    subfolder={
                      (field.recruitment_subfolders ?? []).find(
                        (sf) => sf.id === r.subfolder_id
                      ) ?? null
                    }
                    fields={fields}
                    isFirst={i === 0}
                    isLast={i === arr.length - 1}
                    onEdit={(res) => setEditingResource(res)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editingResource && (
        <ResourceModal
          fields={fields}
          resource={editingResource}
          defaultFieldId={field.id}
          onClose={() => setEditingResource(null)}
        />
      )}

      {showFolderUpload && (
        <FolderUploadModal
          field={field}
          onClose={() => setShowFolderUpload(false)}
        />
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RecruitmentAdminClient({
  fields,
}: {
  fields: FieldWithResources[];
}) {
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<FieldWithResources | null>(null);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceFieldId, setResourceFieldId] = useState<string>("");

  function openAddField() {
    setEditingField(null);
    setShowFieldModal(true);
  }

  function openEditField(f: FieldWithResources) {
    setEditingField(f);
    setShowFieldModal(true);
  }

  function openAddResource(fieldId: string) {
    setResourceFieldId(fieldId);
    setShowResourceModal(true);
  }

  const totalResources = fields.reduce(
    (n, f) => n + (f.recruitment_resources?.length ?? 0),
    0
  );
  const nextSortOrder =
    fields.length > 0
      ? Math.max(...fields.map((f) => f.sort_order)) + 10
      : 10;

  return (
    <>
      {/* Stats strip */}
      <div className="flex gap-8 mb-8 pb-6" style={{ borderBottom: "1px solid var(--b-subtle)" }}>
        <div className="stat-item">
          <span className="stat-value">{fields.length}</span>
          <span className="stat-label">Fields</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{totalResources}</span>
          <span className="stat-label">Resources</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{fields.filter((f) => f.is_published).length}</span>
          <span className="stat-label">Published</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <p className="text-sm" style={{ color: "var(--t-secondary)" }}>
          Click a field&apos;s resource count to expand and manage its resources.
        </p>
        <div className="flex gap-2">
          {fields.length > 0 && (
            <button
              onClick={() =>
                openAddResource(resourceFieldId || fields[0]?.id || "")
              }
              className="btn btn-ghost btn-sm"
            >
              + Add Resource
            </button>
          )}
          <button
            onClick={openAddField}
            className="btn btn-primary btn-sm"
          >
            + Add Field
          </button>
        </div>
      </div>

      {/* Field list */}
      <div className="flex flex-col gap-3">
        {fields.length === 0 ? (
          <div
            className="rounded-2xl px-8 py-16 text-center"
            style={{
              background: "var(--s-0)",
              border: "1px dashed var(--b-default)",
            }}
          >
            <p className="text-sm font-medium mb-4" style={{ color: "var(--t-muted)" }}>
              No fields yet.
            </p>
            <button
              onClick={openAddField}
              className="btn btn-primary btn-sm"
            >
              Add your first field
            </button>
          </div>
        ) : (
          fields.map((field, i) => (
            <FieldCard
              key={field.id}
              field={field}
              fields={fields}
              isFirst={i === 0}
              isLast={i === fields.length - 1}
              onEdit={openEditField}
              onAddResource={openAddResource}
            />
          ))
        )}
      </div>

      {/* Field modal */}
      {showFieldModal && (
        <FieldModal
          field={editingField}
          nextSortOrder={nextSortOrder}
          onClose={() => setShowFieldModal(false)}
        />
      )}

      {/* Resource modal */}
      {showResourceModal && fields.length > 0 && (
        <ResourceModal
          fields={fields}
          resource={null}
          defaultFieldId={resourceFieldId || fields[0].id}
          onClose={() => setShowResourceModal(false)}
        />
      )}
    </>
  );
}
