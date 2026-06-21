"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import { updateProfile } from "@/lib/actions/profile";
import { useTheme } from "@/components/ThemeProvider";

type Profile = {
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  pledge_class: string | null;
  grad_year: number | null;
  major: string | null;
  linkedin_url: string | null;
  location_label: string | null;
  interests: string[] | null;
};

type Props = { initialData: Profile; email: string };

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="input-label">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="input"
      />
      {hint && (
        <p className="text-[11px]" style={{ color: "var(--t-muted)" }}>{hint}</p>
      )}
    </div>
  );
}

export default function SettingsForm({ initialData, email }: Props) {
  const [result, action, pending] = useActionState(updateProfile, null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialData.avatar_url);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const initials = (() => {
    const name = initialData.full_name || email;
    const parts = name.split(/[\s@.]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0]?.substring(0, 2) ?? "??").toUpperCase();
  })();

  return (
    <form action={action} className="space-y-8">

      {/* ── Avatar section ── */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] mb-4" style={{ color: "var(--t-muted)" }}>
          Photo
        </h2>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative shrink-0 group"
            title="Change photo"
          >
            <div
              className="w-16 h-16 rounded-full overflow-hidden"
              style={{
                border: "2px solid var(--b-default)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {preview ? (
                <Image src={preview} alt="Avatar" fill className="object-cover" sizes="64px" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-base font-bold"
                  style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
                >
                  {initials}
                </div>
              )}
            </div>
            {/* Camera overlay */}
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{ background: "rgba(20,18,16,0.45)" }}
            >
              <svg width="16" height="16" fill="none" stroke="white" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </button>

          <input ref={fileRef} type="file" name="avatar" accept="image/*" className="hidden" onChange={handleFileChange} />

          <div>
            <p className="text-[13px] font-medium" style={{ color: "var(--t-primary)" }}>
              Profile photo
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>
              Click to upload. JPG or PNG, max 5MB.
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--t-faint)" }}>
              {email}
            </p>
          </div>
        </div>
      </section>

      <div style={{ borderBottom: "1px solid var(--b-subtle)" }} />

      {/* ── Personal info ── */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] mb-5" style={{ color: "var(--t-muted)" }}>
          Personal info
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Full name" name="full_name" defaultValue={initialData.full_name} placeholder="Jane Smith" />
          <Field label="Pledge class" name="pledge_class" defaultValue={initialData.pledge_class} placeholder="e.g. Alpha, Beta" />
          <Field label="Graduation year" name="grad_year" type="number" defaultValue={initialData.grad_year} placeholder="2026" />
          <Field label="Major" name="major" defaultValue={initialData.major} placeholder="e.g. Finance & Statistics" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="input-label">Bio</label>
          <textarea
            name="bio"
            defaultValue={initialData.bio ?? ""}
            rows={3}
            placeholder="A short bio — what you're into, where you're headed…"
            className="input resize-none"
          />
        </div>
      </section>

      <div style={{ borderBottom: "1px solid var(--b-subtle)" }} />

      {/* ── Location ── */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] mb-5" style={{ color: "var(--t-muted)" }}>
          Location
        </h2>
        <Field
          label="City / Location"
          name="location_label"
          defaultValue={initialData.location_label}
          placeholder="e.g. New York, NY"
          hint="This will be geocoded and pinned on the alumni map."
        />
      </section>

      <div style={{ borderBottom: "1px solid var(--b-subtle)" }} />

      {/* ── Interests ── */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] mb-5" style={{ color: "var(--t-muted)" }}>
          Interests
        </h2>
        <div className="flex flex-col gap-1.5">
          <label className="input-label">Interests</label>
          <input
            type="text"
            name="interests"
            defaultValue={(initialData.interests ?? []).join(", ")}
            placeholder="e.g. Finance, Consulting, Data Science, Real Estate"
            className="input"
          />
          <p className="text-[11px]" style={{ color: "var(--t-muted)" }}>
            Comma-separated. Used for filtering on the alumni map.
          </p>
        </div>
      </section>

      <div style={{ borderBottom: "1px solid var(--b-subtle)" }} />

      {/* ── Links ── */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] mb-5" style={{ color: "var(--t-muted)" }}>
          Links
        </h2>
        <Field
          label="LinkedIn URL"
          name="linkedin_url"
          defaultValue={initialData.linkedin_url}
          placeholder="linkedin.com/in/yourname"
        />
      </section>

      {/* ── Feedback ── */}
      {result?.error && (
        <div
          className="rounded-xl p-4 text-[13px]"
          style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b" }}
        >
          {result.error}
        </div>
      )}
      {result?.success && (
        <div
          className="rounded-xl p-4 text-[13px]"
          style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#166534" }}
        >
          Profile saved successfully.
        </div>
      )}

      {/* ── Submit ── */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-[12px]" style={{ color: "var(--t-muted)" }}>
          Changes are saved to your account immediately.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
          style={{ opacity: pending ? 0.6 : 1 }}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
