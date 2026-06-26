"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { completeOnboarding } from "@/lib/actions/onboarding";
import type { OnboardingProfile } from "./page";

// ── Step metadata ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: "identity",
    eyebrow: "Step 1 of 4",
    title: "Welcome to AKΨ Delta",
    subtitle: "Let's start with your photo and name — this is how brothers will recognize you.",
  },
  {
    id: "about",
    eyebrow: "Step 2 of 4",
    title: "Tell us about yourself",
    subtitle: "This fills out your alumni directory card.",
  },
  {
    id: "world",
    eyebrow: "Step 3 of 4",
    title: "Where are you in the world?",
    subtitle: "We'll pin you on the brothers map.",
  },
  {
    id: "connect",
    eyebrow: "Step 4 of 4",
    title: "Stay connected",
    subtitle: "Add your LinkedIn so brothers can reach out.",
  },
] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuenow={step + 1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="rounded-full transition-all duration-400"
            style={{
              width: i === step ? "28px" : "8px",
              height: "8px",
              background: i <= step ? "var(--akp-gold)" : "var(--b-strong)",
              opacity: i < step ? 0.5 : 1,
            }}
          />
          {i < total - 1 && (
            <div
              className="h-px w-6 transition-all duration-400"
              style={{ background: i < step ? "var(--akp-gold)" : "var(--b-default)", opacity: i < step ? 0.5 : 1 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function InputField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  required,
  autoFocus,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="input-label">
        {label}
        {required && <span style={{ color: "var(--akp-gold)", marginLeft: "3px" }}>*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {hint && (
        <p className="text-[11px]" style={{ color: "var(--t-muted)" }}>{hint}</p>
      )}
    </div>
  );
}

function InterestTags({ raw }: { raw: string }) {
  const tags = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {tags.map((tag) => (
        <span key={tag} className="pill">
          {tag}
        </span>
      ))}
    </div>
  );
}

// ── Step panels ───────────────────────────────────────────────────────────────

function StepIdentity({
  fullName, setFullName,
  headline, setHeadline,
  avatar, setAvatar,
  avatarPreview, setAvatarPreview,
  email,
}: {
  fullName: string; setFullName: (v: string) => void;
  headline: string; setHeadline: (v: string) => void;
  avatar: File | null; setAvatar: (f: File | null) => void;
  avatarPreview: string | null; setAvatarPreview: (v: string | null) => void;
  email: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (() => {
    const src = fullName.trim() || email;
    const parts = src.split(/[\s@.]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0]?.substring(0, 2) ?? "??").toUpperCase();
  })();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatar(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Avatar upload */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative group"
          title="Upload profile photo"
        >
          <div
            className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
            style={{
              border: "2.5px solid var(--b-default)",
              background: avatarPreview ? "transparent" : "var(--akp-navy)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            {avatarPreview ? (
              <Image src={avatarPreview} alt="Preview" fill className="object-cover" sizes="96px" />
            ) : (
              <span className="text-xl font-bold" style={{ color: "var(--akp-gold)" }}>
                {initials}
              </span>
            )}
          </div>

          {/* Camera overlay on hover */}
          <div
            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: "rgba(10,34,64,0.55)" }}
          >
            <svg width="22" height="22" fill="none" stroke="white" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          {/* Upload badge */}
          <div
            className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "var(--akp-gold)", boxShadow: "var(--shadow-sm)" }}
          >
            <svg width="12" height="12" fill="none" stroke="var(--akp-navy)" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        <p className="text-[12px]" style={{ color: "var(--t-muted)" }}>
          {avatarPreview ? "Click to change photo" : "Click to add a profile photo"}
        </p>
      </div>

      {/* Full name + headline */}
      <InputField
        label="Full name"
        name="full_name"
        value={fullName}
        onChange={setFullName}
        placeholder="Jane Smith"
        required
        autoFocus
      />
      <InputField
        label="Headline"
        name="headline"
        value={headline}
        onChange={setHeadline}
        placeholder="e.g. Finance + Stats at UNC  ·  Founder at Acme"
        hint="How you want to be introduced — shows on the map and your directory card."
      />
    </div>
  );
}

function StepAbout({
  pledgeClass, setPledgeClass,
  gradYear, setGradYear,
  major, setMajor,
  bio, setBio,
}: {
  pledgeClass: string; setPledgeClass: (v: string) => void;
  gradYear: string; setGradYear: (v: string) => void;
  major: string; setMajor: (v: string) => void;
  bio: string; setBio: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Pledge class"
          name="pledge_class"
          value={pledgeClass}
          onChange={setPledgeClass}
          placeholder="e.g. Alpha, Beta"
          autoFocus
        />
        <InputField
          label="Graduation year"
          name="grad_year"
          type="number"
          value={gradYear}
          onChange={setGradYear}
          placeholder="2026"
        />
      </div>
      <InputField
        label="Major(s)"
        name="major"
        value={major}
        onChange={setMajor}
        placeholder="e.g. Finance & Statistics"
      />
      <div className="flex flex-col gap-1.5">
        <label className="input-label">Bio</label>
        <textarea
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="A short intro — what you're into, where you're headed…"
          className="input resize-none"
        />
        <p className="text-[11px]" style={{ color: "var(--t-muted)" }}>
          Shown on your profile in the alumni directory.
        </p>
      </div>
    </div>
  );
}

function StepWorld({
  location, setLocation,
  interests, setInterests,
}: {
  location: string; setLocation: (v: string) => void;
  interests: string; setInterests: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <InputField
        label="City / Location"
        name="location_label"
        value={location}
        onChange={setLocation}
        placeholder="e.g. New York, NY"
        hint="We'll geocode this and pin you on the brothers map."
        autoFocus
      />
      <div className="flex flex-col gap-1.5">
        <label className="input-label">Interests</label>
        <input
          type="text"
          name="interests"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="Finance, Consulting, Data Science, Real Estate…"
          className="input"
        />
        <p className="text-[11px]" style={{ color: "var(--t-muted)" }}>
          Comma-separated. Used for filtering on the alumni map.
        </p>
        <InterestTags raw={interests} />
      </div>
    </div>
  );
}

function StepConnect({
  linkedin, setLinkedin,
}: {
  linkedin: string; setLinkedin: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <InputField
        label="LinkedIn URL"
        name="linkedin_url"
        value={linkedin}
        onChange={setLinkedin}
        placeholder="linkedin.com/in/yourname"
        hint="Optional — makes it easy for brothers to find and connect with you."
        autoFocus
      />

      {/* Preview card */}
      {linkedin.trim() && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: "var(--s-1)", border: "1px solid var(--b-default)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "#0077b5" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
              <circle cx="4" cy="4" r="2" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium truncate" style={{ color: "var(--t-primary)" }}>
              LinkedIn profile linked
            </p>
            <p className="text-[11px] truncate" style={{ color: "var(--t-muted)" }}>
              {linkedin.trim()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Completion screen ─────────────────────────────────────────────────────────

function CompletionScreen({ firstName, onEnter }: { firstName: string; onEnter: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-4">
      {/* Animated checkmark */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-7 animate-scaleIn"
        style={{ background: "var(--akp-navy)", boxShadow: "var(--shadow-lg)" }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--akp-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h2
        className="text-3xl font-bold mb-3"
        style={{ fontFamily: "var(--font-display)", color: "var(--t-primary)", letterSpacing: "-0.02em" }}
      >
        {firstName ? `You're all set, ${firstName}!` : "You're all set!"}
      </h2>
      <p
        className="text-[15px] mb-8 max-w-xs"
        style={{ color: "var(--t-secondary)", lineHeight: 1.6 }}
      >
        Your profile is live. Brothers can now find you on the map and see your interests.
      </p>

      <button
        onClick={onEnter}
        className="btn btn-primary"
        style={{ fontSize: "15px", padding: "12px 32px" }}
      >
        Enter the portal →
      </button>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

type Props = { email: string; initialData: OnboardingProfile };

export default function OnboardingWizard({ email, initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Step state
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — accumulated across all steps
  const [fullName, setFullName] = useState(initialData.full_name ?? "");
  const [headline, setHeadline] = useState(initialData.headline ?? "");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialData.avatar_url ?? null);
  const [pledgeClass, setPledgeClass] = useState(initialData.pledge_class ?? "");
  const [gradYear, setGradYear] = useState(initialData.grad_year?.toString() ?? "");
  const [major, setMajor] = useState(initialData.major ?? "");
  const [bio, setBio] = useState(initialData.bio ?? "");
  const [location, setLocation] = useState(initialData.location_label ?? "");
  const [interests, setInterests] = useState((initialData.interests ?? []).join(", "));
  const [linkedin, setLinkedin] = useState(initialData.linkedin_url ?? "");

  const totalSteps = STEPS.length;
  const isLast = step === totalSteps - 1;
  const canContinue = step !== 0 || fullName.trim().length > 0;

  const handleNext = () => {
    if (!canContinue) return;
    setError(null);
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    // Last step → submit
    handleSubmit();
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => s - 1);
  };

  const handleSubmit = () => {
    startTransition(async () => {
      // Upload avatar directly from the browser to Supabase Storage so the
      // file binary never goes through the Server Action body (1 MB limit).
      let uploadedAvatarUrl: string | null = null;
      if (avatar) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Session expired. Please refresh and try again.");
          return;
        }
        const ext = avatar.name.split(".").pop()?.toLowerCase() || "jpg";
        const storagePath = `${user.id}/avatar.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("avatars")
          .upload(storagePath, avatar, { contentType: avatar.type || "image/jpeg", upsert: true });
        if (uploadErr) {
          setError("Failed to upload photo. Try again.");
          return;
        }
        uploadedAvatarUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${storagePath}`;
      }

      const fd = new FormData();
      fd.append("full_name", fullName.trim());
      fd.append("headline", headline.trim());
      fd.append("bio", bio.trim());
      fd.append("pledge_class", pledgeClass.trim());
      fd.append("grad_year", gradYear);
      fd.append("major", major.trim());
      fd.append("location_label", location.trim());
      fd.append("interests", interests);
      fd.append("linkedin_url", linkedin.trim());
      if (uploadedAvatarUrl) fd.append("avatar_url", uploadedAvatarUrl);

      const result = await completeOnboarding(fd);
      if (result.success) {
        setDone(true);
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  };

  const handleEnterPortal = () => {
    // Refresh the Supabase session so the updated user_metadata (onboarding_complete)
    // is reflected in the JWT used by any middleware on the next navigation.
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
    );
    supabase.auth.refreshSession().finally(() => {
      router.push("/people?welcome=1");
    });
  };

  return (
    /* Full-screen overlay — covers navbar (z-50) and everything else */
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "var(--s-page)" }}
    >
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-8 py-5 shrink-0"
        style={{ borderBottom: "1px solid var(--b-subtle)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <Image src="/aklogo.png" alt="AKΨ" width={36} height={36} />
          <span
            className="text-[12px] font-extrabold uppercase tracking-[0.1em]"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            AKPD
          </span>
        </div>

        {/* Progress dots */}
        {!done && <ProgressBar step={step} total={totalSteps} />}

        {/* Step label */}
        {!done && (
          <p className="text-[12px] font-medium" style={{ color: "var(--t-muted)" }}>
            {step + 1} of {totalSteps}
          </p>
        )}
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-md">

          {done ? (
            <CompletionScreen
              firstName={fullName.trim().split(" ")[0]}
              onEnter={handleEnterPortal}
            />
          ) : (
            <>
              {/* Step heading */}
              <div className="mb-8 animate-fadeIn">
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.12em] mb-2"
                  style={{ color: "var(--akp-gold)" }}
                >
                  {STEPS[step].eyebrow}
                </p>
                <h1
                  className="text-[28px] font-bold mb-2"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--t-primary)",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                  }}
                >
                  {STEPS[step].title}
                </h1>
                <p className="text-[14px]" style={{ color: "var(--t-secondary)", lineHeight: 1.6 }}>
                  {STEPS[step].subtitle}
                </p>
              </div>

              {/* Step fields — re-mount on step change triggers the animation */}
              <div key={step} className="animate-fadeUp">
                {step === 0 && (
                  <StepIdentity
                    fullName={fullName} setFullName={setFullName}
                    headline={headline} setHeadline={setHeadline}
                    avatar={avatar} setAvatar={setAvatar}
                    avatarPreview={avatarPreview} setAvatarPreview={setAvatarPreview}
                    email={email}
                  />
                )}
                {step === 1 && (
                  <StepAbout
                    pledgeClass={pledgeClass} setPledgeClass={setPledgeClass}
                    gradYear={gradYear} setGradYear={setGradYear}
                    major={major} setMajor={setMajor}
                    bio={bio} setBio={setBio}
                  />
                )}
                {step === 2 && (
                  <StepWorld
                    location={location} setLocation={setLocation}
                    interests={interests} setInterests={setInterests}
                  />
                )}
                {step === 3 && (
                  <StepConnect
                    linkedin={linkedin} setLinkedin={setLinkedin}
                  />
                )}
              </div>

              {/* Error message */}
              {error && (
                <div
                  className="mt-5 rounded-xl px-4 py-3 text-[13px]"
                  style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}
                >
                  {error}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={isPending}
                    className="btn btn-ghost"
                  >
                    ← Back
                  </button>
                ) : (
                  /* Skip entire onboarding — lands them on /people with incomplete profile */
                  <button
                    type="button"
                    onClick={() => router.push("/people")}
                    className="text-[13px]"
                    style={{ color: "var(--t-muted)" }}
                  >
                    Skip for now
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isPending || !canContinue}
                  className="btn btn-primary"
                  style={{ opacity: (!canContinue && !isPending) ? 0.5 : 1, minWidth: "130px" }}
                >
                  {isPending
                    ? "Saving…"
                    : isLast
                      ? "Finish setup"
                      : "Continue →"}
                </button>
              </div>

              {/* Skip step hint on optional steps */}
              {step > 0 && (
                <p
                  className="text-center text-[12px] mt-4"
                  style={{ color: "var(--t-faint)" }}
                >
                  {isLast ? "You can always update this later in Settings." : "You can skip any step — fill in more later."}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Bottom ambient gradient ─────────────────────────────────────────── */}
      <div
        className="shrink-0 h-1"
        style={{ background: "linear-gradient(90deg, var(--akp-navy) 0%, var(--akp-gold) 100%)" }}
      />
    </div>
  );
}
