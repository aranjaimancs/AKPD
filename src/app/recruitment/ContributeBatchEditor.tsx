"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  getOrCreateDraftBatch,
  addResourceToBatch,
  removeResourceFromBatch,
  addSubfolderToBatch,
  removeSubfolderFromBatch,
  submitBatchForReview,
  withdrawBatch,
  getSignedUploadUrl,
  type FieldWithResources,
  type BatchWithItems,
  type RecruitmentResource,
  type RecruitmentSubfolder,
} from "@/lib/actions/recruitment";

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

export default function ContributeBatchEditor({
  field,
  existingBatch,
  onClose,
}: {
  field: FieldWithResources;
  existingBatch: BatchWithItems | null;
  onClose: () => void;
}) {
  const [batchId, setBatchId] = useState<string | null>(existingBatch?.id ?? null);
  const [batchStatus, setBatchStatus] = useState<BatchWithItems["status"]>(
    existingBatch?.status ?? "draft"
  );
  const [resources, setResources] = useState<RecruitmentResource[]>(
    existingBatch?.recruitment_resources ?? []
  );
  const [subfolders, setSubfolders] = useState<RecruitmentSubfolder[]>(
    existingBatch?.recruitment_subfolders ?? []
  );
  const [initError, setInitError] = useState<string | null>(null);
  const [initDone, setInitDone] = useState(existingBatch !== null);

  const [addMode, setAddMode] = useState<"file" | "link" | "folder" | null>(null);

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Link state
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");

  // Folder (subfolder) state
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);
  const [submitPending, startSubmitTransition] = useTransition();
  const overlayRef = useRef<HTMLDivElement>(null);

  const isDraft = batchStatus === "draft";

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // On mount: create/get draft batch if none exists
  useEffect(() => {
    if (initDone) return;
    getOrCreateDraftBatch(field.id).then((result) => {
      if ("error" in result) {
        setInitError(result.error);
      } else {
        setBatchId(result.id);
        setInitDone(true);
      }
    });
  }, [field.id, initDone]);

  async function uploadFiles() {
    if (!batchId || selectedFiles.length === 0) return;
    setUploadStatus("uploading");
    setUploadError(null);
    setUploadedCount(0);
    let count = 0;

    for (const file of selectedFiles) {
      const ext = file.name.split(".").pop() ?? "";
      const base = safeName(file.name.replace(/\.[^.]+$/, ""));
      const path = `${field.slug}/${Date.now()}-${base}${ext ? "." + ext : ""}`;

      const urlResult = await getSignedUploadUrl(path, batchId);
      if ("error" in urlResult) {
        setUploadError(urlResult.error);
        setUploadStatus("error");
        return;
      }

      const res = await fetch(urlResult.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) {
        setUploadError(`Upload failed: ${res.statusText}`);
        setUploadStatus("error");
        return;
      }

      const saveResult = await addResourceToBatch(batchId, {
        field_id: field.id,
        title: file.name.replace(/\.[^.]+$/, ""),
        resource_type: "file",
        file_path: path,
        file_mime: file.type || null,
        sort_order: resources.length + count,
      });
      if (saveResult.error) {
        setUploadError(saveResult.error);
        setUploadStatus("error");
        return;
      }

      // Add to local state optimistically
      setResources((prev) => [
        ...prev,
        {
          id: saveResult.id ?? "",
          field_id: field.id,
          subfolder_id: null,
          title: file.name.replace(/\.[^.]+$/, ""),
          description: null,
          resource_type: "file",
          file_path: path,
          file_mime: file.type || null,
          external_url: null,
          sort_order: prev.length,
          batch_id: batchId,
          status: "pending",
        } as RecruitmentResource,
      ]);
      count++;
      setUploadedCount(count);
    }

    setUploadStatus("done");
    setSelectedFiles([]);
    setAddMode(null);
  }

  async function addLink() {
    if (!batchId || !linkUrl.trim()) {
      setLinkError("URL is required.");
      return;
    }
    setLinkError("");
    const result = await addResourceToBatch(batchId, {
      field_id: field.id,
      title: linkTitle.trim() || linkUrl.trim(),
      resource_type: "link",
      external_url: linkUrl.trim(),
      sort_order: resources.length,
    });
    if (result.error) {
      setLinkError(result.error);
      return;
    }
    setResources((prev) => [
      ...prev,
      {
        id: result.id ?? "",
        field_id: field.id,
        subfolder_id: null,
        title: linkTitle.trim() || linkUrl.trim(),
        description: null,
        resource_type: "link",
        file_path: null,
        file_mime: null,
        external_url: linkUrl.trim(),
        sort_order: prev.length,
        batch_id: batchId,
        status: "pending",
      } as RecruitmentResource,
    ]);
    setLinkTitle("");
    setLinkUrl("");
    setAddMode(null);
  }

  async function addFolder() {
    if (!batchId || !folderName.trim()) {
      setFolderError("Folder name is required.");
      return;
    }
    setFolderError("");
    const result = await addSubfolderToBatch(batchId, {
      field_id: field.id,
      name: folderName.trim(),
      sort_order: subfolders.length,
    });
    if (result.error) {
      setFolderError(result.error);
      return;
    }
    setSubfolders((prev) => [
      ...prev,
      {
        id: result.id ?? "",
        field_id: field.id,
        parent_id: null,
        name: folderName.trim(),
        sort_order: prev.length,
        batch_id: batchId,
        status: "pending",
      } as RecruitmentSubfolder,
    ]);
    setFolderName("");
    setAddMode(null);
  }

  async function removeResource(id: string) {
    const result = await removeResourceFromBatch(id);
    if (result.error) { setActionError(result.error); return; }
    setResources((prev) => prev.filter((r) => r.id !== id));
  }

  async function removeSubfolder(id: string) {
    const result = await removeSubfolderFromBatch(id);
    if (result.error) { setActionError(result.error); return; }
    setSubfolders((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSubmit() {
    if (!batchId) return;
    setActionError(null);
    startSubmitTransition(async () => {
      const result = await submitBatchForReview(batchId);
      if (result.error) {
        setActionError(result.error);
      } else {
        setBatchStatus("pending_review");
      }
    });
  }

  function handleWithdraw() {
    if (!batchId) return;
    setActionError(null);
    startSubmitTransition(async () => {
      const result = await withdrawBatch(batchId);
      if (result.error) {
        setActionError(result.error);
      } else {
        setBatchStatus("draft");
      }
    });
  }

  const totalItems = resources.length + subfolders.length;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(20,18,16,0.5)", backdropFilter: "blur(4px)" }}
      onPointerDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-xl my-8 rounded-2xl flex flex-col animate-scale-in"
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
              Contribute to {field.icon ? `${field.icon} ` : ""}{field.name}
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>
              {batchStatus === "draft"
                ? "Add resources to your batch, then submit for admin review."
                : batchStatus === "pending_review"
                ? "Your batch is under review. Withdraw to make changes."
                : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
            style={{ color: "var(--t-muted)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--s-1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Init error */}
          {initError && (
            <p className="text-sm text-center py-4" style={{ color: "#dc2626" }}>
              {initError}
            </p>
          )}

          {/* Loading state */}
          {!initDone && !initError && (
            <div className="flex justify-center py-8">
              <span
                className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--akp-navy)", borderTopColor: "transparent" }}
              />
            </div>
          )}

          {initDone && (
            <>
              {/* Current batch items */}
              {totalItems === 0 ? (
                <div
                  className="rounded-xl px-4 py-8 text-center"
                  style={{ background: "var(--s-1)", border: "1px dashed var(--b-default)" }}
                >
                  <p className="text-sm" style={{ color: "var(--t-muted)" }}>
                    No items yet. Add files, links, or folders below.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Subfolders */}
                  {subfolders.map((sf) => (
                    <div
                      key={sf.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "var(--s-1)", border: "1px solid var(--b-subtle)" }}
                    >
                      <span className="text-sm" style={{ color: "var(--t-muted)" }}>📁</span>
                      <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--t-primary)" }}>
                        {sf.name}
                      </span>
                      <span className="badge badge-neutral text-[10px]">Folder</span>
                      {isDraft && (
                        <button
                          onClick={() => removeSubfolder(sf.id)}
                          className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                          style={{ color: "#dc2626" }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Resources */}
                  {resources.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "var(--s-1)", border: "1px solid var(--b-subtle)" }}
                    >
                      <span
                        className="badge text-[10px] shrink-0"
                        style={
                          r.resource_type === "file"
                            ? { background: "rgba(10,34,64,0.07)", color: "var(--t-secondary)" }
                            : { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }
                        }
                      >
                        {r.resource_type === "file" ? mimeLabel(r.file_mime) : "Link"}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--t-primary)" }}>
                        {r.title}
                      </span>
                      {isDraft && (
                        <button
                          onClick={() => removeResource(r.id)}
                          className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                          style={{ color: "#dc2626" }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add controls (only in draft mode) */}
              {isDraft && (
                <div
                  className="flex flex-col gap-3 pt-3"
                  style={{ borderTop: "1px solid var(--b-subtle)" }}
                >
                  {/* Add type selector */}
                  {addMode === null && (
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => setAddMode("file")} className="btn btn-ghost btn-sm">
                        + Upload files
                      </button>
                      <button onClick={() => setAddMode("link")} className="btn btn-ghost btn-sm">
                        + Add link
                      </button>
                      <button onClick={() => setAddMode("folder")} className="btn btn-ghost btn-sm">
                        + Add folder
                      </button>
                    </div>
                  )}

                  {/* File upload */}
                  {addMode === "file" && (
                    <div className="flex flex-col gap-3">
                      <label
                        className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl cursor-pointer border-2 border-dashed transition-colors"
                        style={{ borderColor: "var(--b-default)" }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          setSelectedFiles(Array.from(e.dataTransfer.files));
                        }}
                      >
                        <input
                          type="file"
                          className="sr-only"
                          multiple
                          onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
                        />
                        {selectedFiles.length > 0 ? (
                          <p className="text-sm font-semibold" style={{ color: "var(--t-primary)" }}>
                            {selectedFiles.length === 1
                              ? selectedFiles[0].name
                              : `${selectedFiles.length} files selected`}
                          </p>
                        ) : (
                          <>
                            <svg width="22" height="22" fill="none" stroke="var(--t-muted)" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                            </svg>
                            <p className="text-sm" style={{ color: "var(--t-secondary)" }}>
                              Click or drag files here
                            </p>
                          </>
                        )}
                      </label>
                      {uploadStatus === "uploading" && (
                        <p className="text-xs text-center" style={{ color: "var(--t-muted)" }}>
                          Uploading {uploadedCount + 1} of {selectedFiles.length}…
                        </p>
                      )}
                      {uploadError && (
                        <p className="text-xs" style={{ color: "#dc2626" }}>{uploadError}</p>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setAddMode(null); setSelectedFiles([]); }} className="btn btn-ghost btn-sm">
                          Cancel
                        </button>
                        <button
                          onClick={uploadFiles}
                          disabled={selectedFiles.length === 0 || uploadStatus === "uploading"}
                          className="btn btn-primary btn-sm disabled:opacity-50"
                        >
                          {uploadStatus === "uploading" ? "Uploading…" : `Upload ${selectedFiles.length > 0 ? selectedFiles.length + " " : ""}file${selectedFiles.length !== 1 ? "s" : ""}`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Link */}
                  {addMode === "link" && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="input-label">URL *</label>
                        <input
                          type="url"
                          placeholder="https://…"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          className="input"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="input-label">
                          Title{" "}
                          <span className="font-normal normal-case" style={{ color: "var(--t-muted)" }}>
                            (optional — defaults to URL)
                          </span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Bloomberg Terminal Guide"
                          value={linkTitle}
                          onChange={(e) => setLinkTitle(e.target.value)}
                          className="input"
                        />
                      </div>
                      {linkError && <p className="text-xs" style={{ color: "#dc2626" }}>{linkError}</p>}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setAddMode(null); setLinkTitle(""); setLinkUrl(""); }} className="btn btn-ghost btn-sm">
                          Cancel
                        </button>
                        <button onClick={addLink} className="btn btn-primary btn-sm">
                          Add Link
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Folder */}
                  {addMode === "folder" && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="input-label">Folder name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Interview Prep"
                          value={folderName}
                          onChange={(e) => setFolderName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addFolder(); }}
                          className="input"
                        />
                      </div>
                      {folderError && <p className="text-xs" style={{ color: "#dc2626" }}>{folderError}</p>}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setAddMode(null); setFolderName(""); }} className="btn btn-ghost btn-sm">
                          Cancel
                        </button>
                        <button onClick={addFolder} className="btn btn-primary btn-sm">
                          Add Folder
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action error */}
              {actionError && (
                <p className="text-sm" style={{ color: "#dc2626" }}>
                  {actionError}
                </p>
              )}

              {/* Footer actions */}
              <div
                className="flex justify-between items-center pt-2"
                style={{ borderTop: "1px solid var(--b-subtle)" }}
              >
                <button onClick={onClose} className="btn btn-ghost btn-sm">
                  Close
                </button>
                <div className="flex gap-2">
                  {batchStatus === "draft" && (
                    <button
                      onClick={handleSubmit}
                      disabled={submitPending || totalItems === 0}
                      className="btn btn-primary btn-sm disabled:opacity-50"
                    >
                      {submitPending ? "Submitting…" : `Submit for Review (${totalItems} item${totalItems !== 1 ? "s" : ""})`}
                    </button>
                  )}
                  {batchStatus === "pending_review" && (
                    <button
                      onClick={handleWithdraw}
                      disabled={submitPending}
                      className="btn btn-ghost btn-sm disabled:opacity-50"
                    >
                      {submitPending ? "Withdrawing…" : "Withdraw"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
