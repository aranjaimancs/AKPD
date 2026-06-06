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
} from "@/lib/actions/recruitment";
import type {
  FieldWithResources,
  RecruitmentResource,
  FieldInput,
} from "@/lib/actions/recruitment";

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
      <label
        htmlFor={name}
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--akp-gray-600)" }}
      >
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
        className="w-full rounded-xl px-3.5 py-2 text-sm outline-none"
        style={{
          background: "var(--akp-off-white)",
          border: "1px solid var(--akp-gray-200)",
          color: "var(--akp-gray-800)",
        }}
      />
      {hint && (
        <p className="text-[11px]" style={{ color: "var(--akp-gray-400)" }}>
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
      style={{ background: "rgba(10,34,64,0.6)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-lg my-8 rounded-2xl flex flex-col"
        style={{
          background: "var(--akp-white)",
          boxShadow: "0 8px 48px rgba(10,34,64,0.2)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--akp-gray-200)" }}
        >
          <h2
            className="text-lg font-extrabold"
            style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            style={{ color: "var(--akp-gray-400)" }}
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
            style={{ background: "rgba(201,168,76,0.15)" }}
          >
            ✓
          </div>
          <p className="font-semibold" style={{ color: "var(--akp-navy)" }}>
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isPublished}
              onClick={() => setIsPublished((v) => !v)}
              className="w-10 h-5 rounded-full transition-colors relative"
              style={{
                background: isPublished
                  ? "var(--akp-gold)"
                  : "var(--akp-gray-200)",
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
            <span className="text-sm" style={{ color: "var(--akp-gray-600)" }}>
              {isPublished ? "Published" : "Hidden from members"}
            </span>
          </div>

          {error && (
            <p className="text-sm" style={{ color: "#dc2626" }}>
              {error}
            </p>
          )}

          <div
            className="flex justify-end gap-3 pt-2"
            style={{ borderTop: "1px solid var(--akp-gray-200)", paddingTop: "1rem" }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--akp-gray-100)", color: "var(--akp-gray-600)" }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={pending || !name.trim() || !slug.trim()}
              className="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
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

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // For multi-file: track which files have been saved
  const [savedCount, setSavedCount] = useState(0);

  const isMulti = selectedFiles.length > 1;
  const isEditing = resource !== null;

  const selectedField = fields.find((f) => f.id === fieldId);

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
            style={{ background: "rgba(201,168,76,0.15)" }}
          >
            ✓
          </div>
          <p className="font-semibold" style={{ color: "var(--akp-navy)" }}>
            {isMulti ? `${savedCount} resources added.` : resource ? "Saved." : "Resource added."}
          </p>
        </div>
      ) : (
        <div className="p-6 flex flex-col gap-4">
          {/* Field selector */}
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: "var(--akp-gray-600)" }}
            >
              Field *
            </label>
            <select
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2 text-sm outline-none"
              style={{
                background: "var(--akp-off-white)",
                border: "1px solid var(--akp-gray-200)",
                color: "var(--akp-gray-800)",
              }}
            >
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icon ? `${f.icon} ` : ""}{f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type toggle */}
          {!isEditing && (
            <div className="flex gap-2">
              {(["file", "link"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setResourceType(t)}
                  className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
                  style={
                    resourceType === t
                      ? { background: "var(--akp-navy)", color: "var(--akp-gold)" }
                      : { background: "var(--akp-gray-100)", color: "var(--akp-gray-600)" }
                  }
                >
                  {t === "file" ? "📄 Upload file" : "🔗 External link"}
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
                    background: "var(--akp-off-white)",
                    color: "var(--akp-gray-600)",
                  }}
                >
                  Current file:{" "}
                  <span className="font-semibold">
                    {resource.file_path?.split("/").pop()}
                  </span>
                  <span className="ml-2 text-[10px]" style={{ color: "var(--akp-gray-400)" }}>
                    (to replace, delete and re-add)
                  </span>
                </p>
              ) : (
                <>
                  <label
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: "var(--akp-gray-600)" }}
                  >
                    File{!isEditing && " *"}
                  </label>
                  <label
                    className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl cursor-pointer border-2 border-dashed transition-colors"
                    style={{ borderColor: "var(--akp-gray-200)" }}
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
                            <p className="text-sm font-semibold" style={{ color: "var(--akp-navy)" }}>
                              {selectedFiles[0].name}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--akp-gray-400)" }}>
                              {(selectedFiles[0].size / 1024).toFixed(0)} KB
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold" style={{ color: "var(--akp-navy)" }}>
                              {selectedFiles.length} files selected
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--akp-gray-400)" }}>
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
                          stroke="var(--akp-gray-400)"
                          strokeWidth="1.5"
                          viewBox="0 0 24 24"
                        >
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        <p className="text-sm" style={{ color: "var(--akp-gray-400)" }}>
                          Click or drag files here
                        </p>
                        <p className="text-xs" style={{ color: "var(--akp-gray-400)" }}>
                          Drop multiple PDFs/docs to bulk-add
                        </p>
                      </>
                    )}
                  </label>
                </>
              )}

              {uploadStatus === "uploading" && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--akp-gray-600)" }}>
                  <span
                    className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--akp-gold)", borderTopColor: "transparent" }}
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
              <label
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: "var(--akp-gray-600)" }}
              >
                URL *
              </label>
              <input
                type="url"
                placeholder="https://…"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2 text-sm outline-none"
                style={{
                  background: "var(--akp-off-white)",
                  border: "1px solid var(--akp-gray-200)",
                  color: "var(--akp-gray-800)",
                }}
              />
            </div>
          )}

          {/* Title (hidden for multi-file) */}
          {(!isMulti || resourceType === "link") && (
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: "var(--akp-gray-600)" }}
              >
                Title
                {resourceType === "file" && (
                  <span
                    className="ml-1 font-normal normal-case"
                    style={{ color: "var(--akp-gray-400)" }}
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
                className="w-full rounded-xl px-3.5 py-2 text-sm outline-none"
                style={{
                  background: "var(--akp-off-white)",
                  border: "1px solid var(--akp-gray-200)",
                  color: "var(--akp-gray-800)",
                }}
              />
            </div>
          )}

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: "var(--akp-gray-600)" }}
            >
              Description{" "}
              <span className="font-normal normal-case" style={{ color: "var(--akp-gray-400)" }}>
                (optional)
              </span>
            </label>
            <textarea
              rows={2}
              placeholder="Short description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2 text-sm outline-none resize-none"
              style={{
                background: "var(--akp-off-white)",
                border: "1px solid var(--akp-gray-200)",
                color: "var(--akp-gray-800)",
              }}
            />
          </div>

          {saveError && (
            <p className="text-sm" style={{ color: "#dc2626" }}>
              {saveError}
            </p>
          )}

          <div
            className="flex justify-end gap-3 pt-2"
            style={{ borderTop: "1px solid var(--akp-gray-200)", paddingTop: "1rem" }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "var(--akp-gray-100)", color: "var(--akp-gray-600)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
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
  fields,
  isFirst,
  isLast,
  onEdit,
}: {
  resource: RecruitmentResource;
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
        background: "var(--akp-off-white)",
        opacity: pending ? 0.4 : 1,
      }}
    >
      {/* Type badge */}
      <span
        className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
        style={
          resource.resource_type === "file"
            ? { background: "rgba(10,34,64,0.08)", color: "var(--akp-navy)" }
            : { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }
        }
      >
        {resource.resource_type === "file"
          ? mimeLabel(resource.file_mime)
          : "Link"}
      </span>

      {/* Title */}
      <p
        className="flex-1 text-sm font-semibold truncate"
        style={{ color: "var(--akp-navy)" }}
      >
        {resource.title}
      </p>
      {resource.description && (
        <p
          className="text-xs truncate max-w-[160px] hidden sm:block"
          style={{ color: "var(--akp-gray-400)" }}
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
          className="w-6 h-6 rounded flex items-center justify-center text-xs disabled:opacity-20 hover:bg-white transition-colors"
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
          className="w-6 h-6 rounded flex items-center justify-center text-xs disabled:opacity-20 hover:bg-white transition-colors"
          title="Move down"
        >
          ↓
        </button>
      </div>

      {/* Edit */}
      <button
        onClick={() => onEdit(resource)}
        className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
        style={{ color: "var(--akp-navy)", background: "var(--akp-gray-100)" }}
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

  const resources = field.recruitment_resources ?? [];

  return (
    <div
      id={field.slug}
      className="rounded-2xl overflow-hidden transition-opacity scroll-mt-8"
      style={{
        background: "var(--akp-white)",
        border: "1px solid var(--akp-gray-200)",
        boxShadow: "0 1px 4px rgba(10,34,64,0.04)",
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
            <p
              className="text-sm font-bold"
              style={{ color: "var(--akp-navy)" }}
            >
              {field.name}
            </p>
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={
                field.is_published
                  ? {
                      background: "rgba(22,163,74,0.1)",
                      color: "#16a34a",
                    }
                  : {
                      background: "var(--akp-gray-100)",
                      color: "var(--akp-gray-400)",
                    }
              }
            >
              {field.is_published ? "Published" : "Hidden"}
            </span>
          </div>
          <p className="text-xs truncate" style={{ color: "var(--akp-gray-400)" }}>
            /{field.slug} · order {field.sort_order}
          </p>
        </div>

        {/* Resource count + expand */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
          style={{
            background: expanded
              ? "rgba(10,34,64,0.08)"
              : "var(--akp-off-white)",
            color: "var(--akp-navy)",
          }}
        >
          {resources.length} resource{resources.length !== 1 ? "s" : ""}{" "}
          {expanded ? "▲" : "▼"}
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
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm disabled:opacity-20 hover:bg-gray-100 transition-colors"
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
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm disabled:opacity-20 hover:bg-gray-100 transition-colors"
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
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
          style={{ color: field.is_published ? "#16a34a" : "var(--akp-gray-400)" }}
        >
          {field.is_published ? "👁" : "🙈"}
        </button>

        {/* Edit */}
        <button
          onClick={() => onEdit(field)}
          className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--akp-navy)", background: "var(--akp-gray-100)" }}
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

      {/* Expanded resources */}
      {expanded && (
        <div
          className="px-4 pb-4 flex flex-col gap-2"
          style={{ borderTop: "1px solid var(--akp-gray-200)" }}
        >
          <div className="flex items-center justify-between pt-3 pb-1">
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--akp-gray-400)" }}
            >
              Resources
            </p>
            <button
              onClick={() => onAddResource(field.id)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
            >
              + Add Resource
            </button>
          </div>

          {resources.length === 0 ? (
            <p
              className="text-xs text-center py-4"
              style={{ color: "var(--akp-gray-400)" }}
            >
              No resources yet.
            </p>
          ) : (
            resources.map((r, i) => (
              <ResourceRow
                key={r.id}
                resource={r}
                fields={fields}
                isFirst={i === 0}
                isLast={i === resources.length - 1}
                onEdit={(res) => setEditingResource(res)}
              />
            ))
          )}
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
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Fields", value: fields.length },
          { label: "Resources", value: totalResources },
          {
            label: "Published",
            value: fields.filter((f) => f.is_published).length,
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl px-5 py-4"
            style={{
              background: "var(--akp-white)",
              border: "1px solid var(--akp-gray-200)",
            }}
          >
            <p
              className="text-2xl font-extrabold"
              style={{ color: "var(--akp-navy)" }}
            >
              {value}
            </p>
            <p
              className="text-xs font-semibold uppercase tracking-wide mt-0.5"
              style={{ color: "var(--akp-gray-400)" }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <p className="text-sm" style={{ color: "var(--akp-gray-600)" }}>
          Click a field&apos;s resource count to expand and manage its
          resources.
        </p>
        <div className="flex gap-2">
          {fields.length > 0 && (
            <button
              onClick={() =>
                openAddResource(resourceFieldId || fields[0]?.id || "")
              }
              className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
              style={{
                background: "rgba(201,168,76,0.12)",
                color: "var(--akp-gold)",
              }}
            >
              + Add Resource
            </button>
          )}
          <button
            onClick={openAddField}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
            style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
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
              background: "var(--akp-white)",
              border: "1px dashed var(--akp-gray-200)",
            }}
          >
            <p className="text-sm font-medium mb-4" style={{ color: "var(--akp-gray-400)" }}>
              No fields yet.
            </p>
            <button
              onClick={openAddField}
              className="px-5 py-2 rounded-xl text-sm font-bold"
              style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
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
