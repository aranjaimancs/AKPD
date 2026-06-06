"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { upsertPerson, deletePerson } from "@/lib/actions/people";
import type { PersonFormState } from "@/lib/actions/people";

export type PersonRow = {
  id: string;
  full_name: string;
  headshot_url: string | null;
  title: string | null;
  company: string | null;
  industry: string | null;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  grad_year: number | null;
  member_type: string | null;
  pledge_class: string | null;
  linkedin_url: string | null;
  bio: string | null;
  major: string | null;
};

// ── Field components ──────────────────────────────────────────────────────────

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | null;
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
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        step={type === "number" ? "any" : undefined}
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

function TextArea({
  label,
  name,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={name}
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--akp-gray-600)" }}
      >
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-xl px-3.5 py-2 text-sm outline-none resize-none"
        style={{
          background: "var(--akp-off-white)",
          border: "1px solid var(--akp-gray-200)",
          color: "var(--akp-gray-800)",
        }}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  required,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
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
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-xl px-3.5 py-2 text-sm outline-none"
        style={{
          background: "var(--akp-off-white)",
          border: "1px solid var(--akp-gray-200)",
          color: "var(--akp-gray-800)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

function PersonModal({
  person,
  onClose,
}: {
  person: PersonRow | null; // null = add mode
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<PersonFormState, FormData>(
    upsertPerson,
    {}
  );
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showCoords, setShowCoords] = useState(
    person?.latitude != null || person?.longitude != null
  );

  useEffect(() => {
    if (state.success) setTimeout(onClose, 600);
  }, [state.success, onClose]);

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
        className="w-full max-w-2xl my-8 rounded-2xl flex flex-col"
        style={{
          background: "var(--akp-white)",
          boxShadow: "0 8px 48px rgba(10,34,64,0.2)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--akp-gray-200)" }}
        >
          <h2
            className="text-lg font-extrabold"
            style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
          >
            {person ? "Edit Person" : "Add Person"}
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
          <div
            className="flex flex-col items-center gap-3 py-12 px-6"
            style={{ color: "var(--akp-navy)" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
              style={{ background: "rgba(201,168,76,0.15)" }}
            >
              ✓
            </div>
            <p className="font-semibold">
              {person ? "Saved." : "Person added."}
            </p>
            {state.geocoded && (
              <p className="text-sm text-center" style={{ color: "var(--akp-gray-600)" }}>
                Location was automatically geocoded and pinned on the map.
              </p>
            )}
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-0">
            {person && (
              <input type="hidden" name="id" value={person.id} />
            )}

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Core */}
              <div className="sm:col-span-2">
                <Field
                  label="Full Name"
                  name="full_name"
                  required
                  placeholder="Jane Smith"
                  defaultValue={person?.full_name}
                />
              </div>

              <SelectField
                label="Member Type"
                name="member_type"
                required
                defaultValue={person?.member_type ?? "alumni"}
                options={[
                  { value: "alumni", label: "Alumni" },
                  { value: "current", label: "Current member" },
                ]}
              />

              <Field
                label="Graduation Year"
                name="grad_year"
                type="number"
                placeholder="2024"
                defaultValue={person?.grad_year}
              />

              <Field
                label="Pledge Class"
                name="pledge_class"
                placeholder="e.g. Delta 2021"
                defaultValue={person?.pledge_class}
              />

              <Field
                label="Major"
                name="major"
                placeholder="e.g. Business Administration"
                defaultValue={person?.major}
              />

              {/* Professional */}
              <div
                className="sm:col-span-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--akp-gold)" }}
              >
                Professional
              </div>

              <Field
                label="Title / Role"
                name="title"
                placeholder="e.g. Software Engineer"
                defaultValue={person?.title}
              />

              <Field
                label="Company"
                name="company"
                placeholder="e.g. Goldman Sachs"
                defaultValue={person?.company}
              />

              <Field
                label="Industry"
                name="industry"
                placeholder="e.g. Finance"
                defaultValue={person?.industry}
              />

              <Field
                label="LinkedIn URL"
                name="linkedin_url"
                type="url"
                placeholder="https://linkedin.com/in/…"
                defaultValue={person?.linkedin_url}
              />

              {/* Location */}
              <div
                className="sm:col-span-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--akp-gold)" }}
              >
                Location
              </div>

              <div className="sm:col-span-2">
                <Field
                  label="Location Label"
                  name="location_label"
                  placeholder="e.g. New York, NY"
                  defaultValue={person?.location_label}
                  hint={
                    showCoords
                      ? undefined
                      : "Leave lat/lng blank to auto-geocode from this label."
                  }
                />
              </div>

              {/* Manual coordinates toggle */}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowCoords((v) => !v)}
                  className="text-xs font-semibold"
                  style={{ color: "var(--akp-gold)" }}
                >
                  {showCoords ? "▼ Hide" : "▶ Override"} lat/lng manually
                </button>
              </div>

              {showCoords && (
                <>
                  <Field
                    label="Latitude"
                    name="latitude"
                    type="number"
                    placeholder="35.9132"
                    defaultValue={person?.latitude ?? undefined}
                    hint="Overrides auto-geocoding when set."
                  />
                  <Field
                    label="Longitude"
                    name="longitude"
                    type="number"
                    placeholder="-79.0558"
                    defaultValue={person?.longitude ?? undefined}
                  />
                </>
              )}

              {/* If coords hidden, render hidden inputs so the server sees empty strings */}
              {!showCoords && (
                <>
                  <input type="hidden" name="latitude" value="" />
                  <input type="hidden" name="longitude" value="" />
                </>
              )}

              {/* Extra */}
              <div
                className="sm:col-span-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--akp-gold)" }}
              >
                Profile
              </div>

              <div className="sm:col-span-2">
                <Field
                  label="Headshot URL"
                  name="headshot_url"
                  type="url"
                  placeholder="https://…"
                  defaultValue={person?.headshot_url}
                />
              </div>

              <div className="sm:col-span-2">
                <TextArea
                  label="Bio"
                  name="bio"
                  placeholder="Short bio…"
                  defaultValue={person?.bio}
                />
              </div>
            </div>

            {state.error && (
              <div className="px-6 pb-2">
                <p className="text-sm" style={{ color: "#dc2626" }}>
                  {state.error}
                </p>
              </div>
            )}

            {/* Footer */}
            <div
              className="flex justify-end gap-3 px-6 py-4"
              style={{ borderTop: "1px solid var(--akp-gray-200)" }}
            >
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
                {pending ? "Saving…" : person ? "Save Changes" : "Add Person"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function PersonTableRow({
  person,
  onEdit,
}: {
  person: PersonRow;
  onEdit: (p: PersonRow) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [removing, setRemoving] = useState(false);

  function remove() {
    if (!confirm(`Remove ${person.full_name} from the directory?`)) return;
    setRemoving(true);
    startTransition(async () => {
      await deletePerson(person.id);
    });
  }

  const hasPin = person.latitude != null && person.longitude != null;

  return (
    <tr
      className="border-t transition-opacity"
      style={{
        borderColor: "var(--akp-gray-200)",
        opacity: isPending || removing ? 0.4 : 1,
      }}
    >
      {/* Name + role */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          {person.headshot_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.headshot_url}
              alt=""
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
            >
              {person.full_name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--akp-navy)" }}>
              {person.full_name}
            </p>
            {person.pledge_class && (
              <p className="text-xs truncate" style={{ color: "var(--akp-gray-400)" }}>
                {person.pledge_class}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Job */}
      <td className="py-3 px-4 hidden sm:table-cell">
        <p className="text-sm truncate" style={{ color: "var(--akp-gray-600)" }}>
          {[person.title, person.company].filter(Boolean).join(" · ") || "—"}
        </p>
        {person.industry && (
          <p className="text-xs" style={{ color: "var(--akp-gray-400)" }}>
            {person.industry}
          </p>
        )}
      </td>

      {/* Location */}
      <td className="py-3 px-4 hidden md:table-cell">
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: hasPin ? "#22c55e" : "var(--akp-gray-300)" }}
            title={hasPin ? "On map" : "No coordinates"}
          />
          <p className="text-sm truncate" style={{ color: "var(--akp-gray-600)" }}>
            {person.location_label ?? "—"}
          </p>
        </div>
      </td>

      {/* Type + year */}
      <td className="py-3 px-4 hidden sm:table-cell">
        <div className="flex flex-col gap-0.5">
          {person.member_type && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded w-fit"
              style={
                person.member_type === "alumni"
                  ? { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }
                  : { background: "rgba(10,34,64,0.08)", color: "var(--akp-navy)" }
              }
            >
              {person.member_type === "alumni" ? "Alumni" : "Current"}
            </span>
          )}
          {person.grad_year && (
            <p className="text-xs" style={{ color: "var(--akp-gray-400)" }}>
              {person.grad_year}
            </p>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(person)}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: "var(--akp-navy)", background: "var(--akp-gray-100)" }}
          >
            Edit
          </button>
          <button
            onClick={remove}
            disabled={isPending}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-red-50 disabled:opacity-30"
            style={{ color: "#dc2626" }}
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PeopleAdminClient({ people }: { people: PersonRow[] }) {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<PersonRow | null>(null);
  const [query, setQuery] = useState("");

  const filtered = people.filter((p) => {
    const q = query.toLowerCase();
    return (
      !q ||
      p.full_name.toLowerCase().includes(q) ||
      p.company?.toLowerCase().includes(q) ||
      p.location_label?.toLowerCase().includes(q) ||
      p.industry?.toLowerCase().includes(q)
    );
  });

  function openAdd() {
    setEditTarget(null);
    setShowModal(true);
  }

  function openEdit(p: PersonRow) {
    setEditTarget(p);
    setShowModal(true);
  }

  const onMapCount = people.filter((p) => p.latitude != null).length;

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total", value: people.length },
          { label: "On Map", value: onMapCount },
          {
            label: "Alumni",
            value: people.filter((p) => p.member_type === "alumni").length,
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
            <p className="text-xs font-semibold uppercase tracking-wide mt-0.5" style={{ color: "var(--akp-gray-400)" }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="w-full max-w-xs rounded-xl px-3.5 py-2 text-sm outline-none"
          style={{
            background: "var(--akp-white)",
            border: "1px solid var(--akp-gray-200)",
            color: "var(--akp-gray-800)",
          }}
        />
        <button
          onClick={openAdd}
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
          style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
        >
          + Add Person
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
                Person
              </th>
              <th className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3 hidden sm:table-cell" style={{ color: "var(--akp-gray-400)" }}>
                Job
              </th>
              <th className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3 hidden md:table-cell" style={{ color: "var(--akp-gray-400)" }}>
                Location
              </th>
              <th className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3 hidden sm:table-cell" style={{ color: "var(--akp-gray-400)" }}>
                Type
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-12 text-sm"
                  style={{ color: "var(--akp-gray-400)" }}
                >
                  {people.length === 0
                    ? "No people yet. Add someone to get started."
                    : "No results."}
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <PersonTableRow key={p.id} person={p} onEdit={openEdit} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Geocoding note */}
      <p className="mt-4 text-xs text-center" style={{ color: "var(--akp-gray-400)" }}>
        Location labels are geocoded via{" "}
        <a
          href="https://nominatim.openstreetmap.org"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--akp-gold)" }}
        >
          Nominatim / OpenStreetMap
        </a>{" "}
        when you save without manual coordinates.
      </p>

      {showModal && (
        <PersonModal
          person={editTarget}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
