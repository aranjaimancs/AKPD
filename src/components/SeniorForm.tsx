"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Profile } from "@/types/profile";

// ── Types ──────────────────────────────────────────────────────────────────────

type TimelineEntry = { term: string; highlights: string[] };

export type FormState = {
  name: string;
  pledgeClass: string;
  gradYear: string;
  hometown: string;
  majors: string[];
  minors: string[];
  destinationTitle: string;
  destinationCompany: string;
  tags: string[];
  summary: string;
  timeline: TimelineEntry[];
  programs: string[];
  recruiting: string[];
  advice: string[];
  linkedIn: string;
  email: string;
  website: string;
};

const BLANK: FormState = {
  name: "",
  pledgeClass: "",
  gradYear: String(new Date().getFullYear()),
  hometown: "",
  majors: [""],
  minors: [""],
  destinationTitle: "",
  destinationCompany: "",
  tags: [""],
  summary: "",
  timeline: [{ term: "", highlights: [""] }],
  programs: [""],
  recruiting: [""],
  advice: [""],
  linkedIn: "",
  email: "",
  website: "",
};

export function profileToFormState(p: Profile): FormState {
  return {
    name: p.name,
    pledgeClass: p.pledgeClass,
    gradYear: String(p.gradYear),
    hometown: p.hometown ?? "",
    majors: p.majors.length ? p.majors : [""],
    minors: p.minors.length ? p.minors : [""],
    destinationTitle: p.destinationTitle,
    destinationCompany: p.destinationCompany,
    tags: p.tags.length ? p.tags : [""],
    summary: p.summary,
    timeline: p.timeline.length
      ? p.timeline.map((e) => ({
          term: e.term,
          highlights: e.highlights.length ? e.highlights : [""],
        }))
      : [{ term: "", highlights: [""] }],
    programs: p.programs.length ? p.programs : [""],
    recruiting: p.recruiting.length ? p.recruiting : [""],
    advice: p.advice.length ? p.advice : [""],
    linkedIn: p.linkedIn ?? "",
    email: p.email ?? "",
    website: p.website ?? "",
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function updateArr(arr: string[], i: number, val: string): string[] {
  const next = [...arr];
  next[i] = val;
  return next;
}

function removeArr(arr: string[], i: number): string[] {
  return arr.filter((_, idx) => idx !== i);
}

// ── Shared UI pieces ───────────────────────────────────────────────────────────

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="section-label mb-5">
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="input-label">
      {children}
      {required && <span style={{ color: "#ef4444" }}> *</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input"
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="input resize-none"
    />
  );
}

function AddButton({ onClick, label = "Add" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 text-[13px] font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-70"
      style={{ color: "var(--t-secondary)" }}
    >
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px]"
        style={{ background: "var(--t-muted)" }}
      >
        +
      </span>
      {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors"
      style={{ color: "var(--t-muted)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "#fef2f2";
        (e.currentTarget as HTMLElement).style.color = "#dc2626";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--t-muted)";
      }}
      title="Remove"
    >
      ×
    </button>
  );
}

function StringArrayField({
  label,
  values,
  onChange,
  placeholder,
  addLabel,
}: {
  label: string;
  values: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={v}
              onChange={(val) => onChange(updateArr(values, i, val))}
              placeholder={placeholder}
            />
            {values.length > 1 && (
              <RemoveButton onClick={() => onChange(removeArr(values, i))} />
            )}
          </div>
        ))}
      </div>
      <AddButton onClick={() => onChange([...values, ""])} label={addLabel ?? `Add ${label}`} />
    </div>
  );
}

function TimelineBuilder({
  timeline,
  onChange,
}: {
  timeline: TimelineEntry[];
  onChange: (t: TimelineEntry[]) => void;
}) {
  const updateEntry = (i: number, patch: Partial<TimelineEntry>) => {
    const next = [...timeline];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const removeEntry = (i: number) => onChange(timeline.filter((_, idx) => idx !== i));

  const addHighlight = (i: number) => {
    const next = [...timeline];
    next[i] = { ...next[i], highlights: [...next[i].highlights, ""] };
    onChange(next);
  };

  const updateHighlight = (ei: number, hi: number, val: string) => {
    const next = [...timeline];
    const hl = [...next[ei].highlights];
    hl[hi] = val;
    next[ei] = { ...next[ei], highlights: hl };
    onChange(next);
  };

  const removeHighlight = (ei: number, hi: number) => {
    const next = [...timeline];
    next[ei] = {
      ...next[ei],
      highlights: next[ei].highlights.filter((_, idx) => idx !== hi),
    };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px]" style={{ color: "var(--t-muted)" }}>
        Entries are grouped by year automatically. Use terms like{" "}
        <span className="font-semibold">Sem 1</span>,{" "}
        <span className="font-semibold">Sem 2</span>,{" "}
        <span className="font-semibold">Summer after freshman year</span>, etc. for automatic year grouping.
      </p>

      {timeline.map((entry, i) => (
        <div
          key={i}
          className="rounded-xl p-4"
          style={{ background: "var(--s-1)", border: "1px solid var(--b-subtle)" }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <Label>Semester / Term</Label>
              <Input
                value={entry.term}
                onChange={(val) => updateEntry(i, { term: val })}
                placeholder="e.g. Sem 1, Fall 2022, Summer after sophomore year"
              />
            </div>
            {timeline.length > 1 && (
              <div className="pt-5">
                <RemoveButton onClick={() => removeEntry(i)} />
              </div>
            )}
          </div>

          <div>
            <Label>Highlights</Label>
            <div className="space-y-2">
              {entry.highlights.map((h, hi) => (
                <div key={hi} className="flex items-center gap-2">
                  <Input
                    value={h}
                    onChange={(val) => updateHighlight(i, hi, val)}
                    placeholder="What happened this semester?"
                  />
                  {entry.highlights.length > 1 && (
                    <RemoveButton onClick={() => removeHighlight(i, hi)} />
                  )}
                </div>
              ))}
            </div>
            <AddButton onClick={() => addHighlight(i)} label="Add highlight" />
          </div>
        </div>
      ))}

      <AddButton
        onClick={() => onChange([...timeline, { term: "", highlights: [""] }])}
        label="Add semester entry"
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
  mode: "add" | "edit";
  initialData?: Profile;
  /** existing headshot URL for preview when editing */
  existingHeadshotUrl?: string;
};

export default function SeniorForm({ mode, initialData, existingHeadshotUrl }: Props) {
  const router = useRouter();
  const slug = initialData?.slug;

  const [form, setForm] = useState<FormState>(
    initialData ? profileToFormState(initialData) : BLANK
  );
  const [headshot, setHeadshot] = useState<File | null>(null);
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(
    existingHeadshotUrl ?? null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleHeadshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeadshot(file);
    const reader = new FileReader();
    reader.onload = (ev) => setHeadshotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify(form));
      if (headshot) fd.append("headshot", headshot);

      const url = mode === "edit" ? `/api/seniors/${slug}` : "/api/seniors";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, { method, body: fd });
      const json = await res.json();

      if (!res.ok || json.error) throw new Error(json.error || "Something went wrong");

      router.push("/admin/seniors");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isEdit = mode === "edit";

  return (
    <main className="flex-1" style={{ background: "var(--s-page)", minHeight: "100vh" }}>
      {/* ── Breadcrumb bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-2">
          <Link href="/admin" className="text-[13px] transition-opacity hover:opacity-70" style={{ color: "var(--t-muted)" }}>Admin</Link>
          <span style={{ color: "var(--b-strong)" }}>/</span>
          <Link href="/admin/seniors" className="text-[13px] transition-opacity hover:opacity-70" style={{ color: "var(--t-muted)" }}>Senior Profiles</Link>
          <span style={{ color: "var(--b-strong)" }}>/</span>
          <span className="text-[13px] font-semibold" style={{ color: "var(--t-primary)" }}>
            {isEdit ? initialData?.name ?? "Edit Senior" : "Add Senior"}
          </span>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <form onSubmit={handleSubmit}>

          {/* Basic Info */}
          <SectionCard title="Basic Info">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label required>Full Name</Label>
                <Input value={form.name} onChange={(v) => set("name", v)} placeholder="Jane Smith" />
              </div>
              <div>
                <Label required>Pledge Class</Label>
                <Input value={form.pledgeClass} onChange={(v) => set("pledgeClass", v)} placeholder="e.g. Alpha, Beta, Founding Exec" />
              </div>
              <div>
                <Label required>Graduation Year</Label>
                <Input type="number" value={form.gradYear} onChange={(v) => set("gradYear", v)} placeholder="2026" />
              </div>
              <div>
                <Label>Hometown</Label>
                <Input value={form.hometown} onChange={(v) => set("hometown", v)} placeholder="City, State" />
              </div>
            </div>
          </SectionCard>

          {/* Headshot */}
          <SectionCard title="Headshot">
            <div className="flex items-start gap-6">
              <div
                className="shrink-0 rounded-xl overflow-hidden"
                style={{
                  width: 100, height: 125,
                  background: "var(--s-1)",
                  border: "1px solid var(--b-default)",
                }}
              >
                {headshotPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={headshotPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-center px-2" style={{ color: "var(--t-faint)" }}>
                    No photo yet
                  </div>
                )}
              </div>
              <div className="flex-1">
                <Label>{isEdit ? "Replace Photo" : "Upload Photo"}</Label>
                <p className="text-[12px] mb-3" style={{ color: "var(--t-muted)" }}>
                  JPG, PNG, or WebP. Portrait orientation works best.
                  {isEdit && !headshot && " Leave blank to keep the current photo."}
                </p>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleHeadshotChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn btn-ghost btn-sm"
                >
                  {headshot ? "Change Photo" : isEdit ? "Replace Photo" : "Choose Photo"}
                </button>
                {headshot && (
                  <p className="mt-2 text-[12px]" style={{ color: "var(--t-muted)" }}>{headshot.name}</p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Academics */}
          <SectionCard title="Academics">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <StringArrayField label="Majors" values={form.majors} onChange={(v) => set("majors", v)} placeholder="e.g. Finance" addLabel="Add major" />
              <StringArrayField label="Minors" values={form.minors} onChange={(v) => set("minors", v)} placeholder="e.g. Data Science" addLabel="Add minor" />
            </div>
          </SectionCard>

          {/* Destination */}
          <SectionCard title="Post-Grad Destination">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Job Title</Label>
                <Input value={form.destinationTitle} onChange={(v) => set("destinationTitle", v)} placeholder="e.g. Incoming Analyst" />
              </div>
              <div>
                <Label>Company</Label>
                <Input value={form.destinationCompany} onChange={(v) => set("destinationCompany", v)} placeholder="e.g. Goldman Sachs — IBD" />
              </div>
            </div>
          </SectionCard>

          {/* Profile */}
          <SectionCard title="Profile">
            <div className="mb-5">
              <StringArrayField label="Tracks / Tags" values={form.tags} onChange={(v) => set("tags", v)} placeholder="e.g. Finance, Consulting, Sales & Trading" addLabel="Add tag" />
            </div>
            <div>
              <Label>Summary</Label>
              <Textarea value={form.summary} onChange={(v) => set("summary", v)} placeholder="1–2 sentence profile summary for the card. Write in third person." rows={3} />
            </div>
          </SectionCard>

          {/* Contact */}
          <SectionCard title="Contact">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>LinkedIn URL</Label>
                <Input value={form.linkedIn} onChange={(v) => set("linkedIn", v)} placeholder="linkedin.com/in/…" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="jane@email.com" />
              </div>
              <div>
                <Label>Website</Label>
                <Input value={form.website} onChange={(v) => set("website", v)} placeholder="janesmith.com" />
              </div>
            </div>
          </SectionCard>

          {/* Timeline */}
          <SectionCard title="Timeline">
            <TimelineBuilder timeline={form.timeline} onChange={(t) => set("timeline", t)} />
          </SectionCard>

          {/* Programs + Recruiting */}
          <SectionCard title="Programs & Recruiting">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <StringArrayField label="Programs" values={form.programs} onChange={(v) => set("programs", v)} placeholder="e.g. Girls Who Invest, SEO" addLabel="Add program" />
              <div>
                <Label>Recruiting Notes</Label>
                <div className="space-y-2">
                  {form.recruiting.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Textarea value={r} onChange={(val) => set("recruiting", updateArr(form.recruiting, i, val))} placeholder="Recruiting timeline, process details, offer timing…" rows={2} />
                      {form.recruiting.length > 1 && (
                        <div className="pt-1">
                          <RemoveButton onClick={() => set("recruiting", removeArr(form.recruiting, i))} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <AddButton onClick={() => set("recruiting", [...form.recruiting, ""])} label="Add note" />
              </div>
            </div>
          </SectionCard>

          {/* Advice */}
          <SectionCard title="Advice for Younger Members">
            <div className="space-y-2">
              {form.advice.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Textarea value={a} onChange={(val) => set("advice", updateArr(form.advice, i, val))} placeholder="A piece of advice for underclassmen…" rows={2} />
                  {form.advice.length > 1 && (
                    <div className="pt-1">
                      <RemoveButton onClick={() => set("advice", removeArr(form.advice, i))} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <AddButton onClick={() => set("advice", [...form.advice, ""])} label="Add advice" />
          </SectionCard>

          {/* Error */}
          {error && (
            <div className="rounded-xl p-4 text-sm mb-6" style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b" }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-4 pt-2 pb-8">
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Save Senior Profile"}
            </button>
            <Link
              href="/admin/seniors"
              className="text-[14px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--t-secondary)" }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
