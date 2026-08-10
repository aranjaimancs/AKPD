"use client";

import { useActionState } from "react";
import { submitInviteRequest, type InviteFormState } from "@/lib/actions/invites";

export default function InviteForm({ token }: { token: string }) {
  const boundAction = submitInviteRequest.bind(null, token);
  const [state, action, pending] = useActionState<InviteFormState, FormData>(
    boundAction,
    {}
  );

  if (state.success) {
    return (
      <div className="text-center py-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl mx-auto mb-4"
          style={{
            background: "rgba(201,168,76,0.15)",
            color: "var(--akp-gold)",
          }}
        >
          ✓
        </div>
        <p
          className="text-base font-semibold mb-2"
          style={{ color: "var(--t-primary)" }}
        >
          You&apos;re on the list!
        </p>
        <p className="text-sm" style={{ color: "var(--t-muted)" }}>
          You&apos;ll receive an email once an admin approves your request.
          Check your spam folder if you don&apos;t see it within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <p className="text-sm" style={{ color: "var(--t-muted)" }}>
        Fill in your info below. An admin will review and send you an email
        to finish setting up your account.
      </p>

      {/* Full name */}
      <div className="flex flex-col gap-1.5">
        <label className="input-label">Full name *</label>
        <input
          name="full_name"
          type="text"
          required
          placeholder="Jane Smith"
          className="input"
          autoFocus
        />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label className="input-label">Email *</label>
        <input
          name="email"
          type="email"
          required
          placeholder="jane@unc.edu"
          className="input"
        />
      </div>

      {/* Role */}
      <div className="flex flex-col gap-1.5">
        <label className="input-label">I am a… *</label>
        <select name="role" required defaultValue="" className="input">
          <option value="" disabled>Select one</option>
          <option value="member">Current Member</option>
          <option value="alumni">Alumni</option>
        </select>
      </div>

      {/* Position */}
      <div className="flex flex-col gap-1.5">
        <label className="input-label">Position / title</label>
        <input
          name="position"
          type="text"
          placeholder="e.g. VP of Recruitment"
          className="input"
        />
      </div>

      {state.error && (
        <p className="text-sm" style={{ color: "#dc2626" }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Request Access"}
      </button>
    </form>
  );
}
