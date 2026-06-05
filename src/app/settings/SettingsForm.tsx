"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import { updateProfile } from "@/lib/actions/profile";

type Profile = {
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  pledge_class: string | null;
  grad_year: number | null;
  major: string | null;
  linkedin_url: string | null;
};

type Props = { initialData: Profile; email: string };

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--akp-gray-600)" }}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{
          borderColor: "var(--akp-gray-200)",
          color: "var(--akp-gray-800)",
          background: "var(--akp-off-white)",
        }}
      />
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
    <form action={action} className="space-y-6">
      {/* ── Avatar ── */}
      <div
        className="rounded-2xl p-6 flex items-center gap-6"
        style={{ background: "var(--akp-white)", border: "1px solid var(--akp-gray-200)" }}
      >
        {/* Clickable avatar */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative shrink-0 group"
          title="Change photo"
        >
          <div
            className="w-20 h-20 rounded-full overflow-hidden"
            style={{ boxShadow: "0 0 0 3px var(--akp-gold)" }}
          >
            {preview ? (
              <Image src={preview} alt="Avatar" fill className="object-cover" sizes="80px" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-xl font-extrabold"
                style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
              >
                {initials}
              </div>
            )}
          </div>
          {/* Camera overlay */}
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: "rgba(10,34,64,0.55)" }}
          >
            <svg width="20" height="20" fill="none" stroke="white" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </button>

        <input
          ref={fileRef}
          type="file"
          name="avatar"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--akp-navy)" }}>
            Profile Photo
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--akp-gray-400)" }}>
            Click the photo to upload a new one. JPG or PNG, max 5MB.
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--akp-gray-400)" }}>
            {email}
          </p>
        </div>
      </div>

      {/* ── Personal info ── */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--akp-white)", border: "1px solid var(--akp-gray-200)" }}
      >
        <h2
          className="text-sm font-bold mb-5 pb-3"
          style={{
            color: "var(--akp-navy)",
            fontFamily: "var(--font-display)",
            borderBottom: "1px solid var(--akp-gray-200)",
          }}
        >
          Personal Info
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Full Name" name="full_name" defaultValue={initialData.full_name} placeholder="Jane Smith" />
          <Field label="Pledge Class" name="pledge_class" defaultValue={initialData.pledge_class} placeholder="e.g. Alpha, Beta" />
          <Field label="Graduation Year" name="grad_year" type="number" defaultValue={initialData.grad_year} placeholder="2026" />
          <Field label="Major" name="major" defaultValue={initialData.major} placeholder="e.g. Finance & Statistics" />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--akp-gray-600)" }}>
            Bio
          </label>
          <textarea
            name="bio"
            defaultValue={initialData.bio ?? ""}
            rows={3}
            placeholder="A short bio about yourself — what you're into, where you're headed…"
            className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
            style={{
              borderColor: "var(--akp-gray-200)",
              color: "var(--akp-gray-800)",
              background: "var(--akp-off-white)",
            }}
          />
        </div>
      </div>

      {/* ── Links ── */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--akp-white)", border: "1px solid var(--akp-gray-200)" }}
      >
        <h2
          className="text-sm font-bold mb-5 pb-3"
          style={{
            color: "var(--akp-navy)",
            fontFamily: "var(--font-display)",
            borderBottom: "1px solid var(--akp-gray-200)",
          }}
        >
          Links
        </h2>
        <Field
          label="LinkedIn URL"
          name="linkedin_url"
          defaultValue={initialData.linkedin_url}
          placeholder="linkedin.com/in/yourname"
        />
      </div>

      {/* Feedback */}
      {result?.error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b" }}
        >
          {result.error}
        </div>
      )}
      {result?.success && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#166534" }}
        >
          Profile saved successfully.
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="px-8 py-3 rounded-full text-sm font-bold transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 disabled:opacity-50"
          style={{
            background: "var(--akp-navy)",
            color: "var(--akp-gold)",
            boxShadow: "0 4px 16px rgba(10,34,64,0.2)",
          }}
        >
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
