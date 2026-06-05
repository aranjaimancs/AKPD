import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/auth";
import MembersClient from "./MembersClient";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  // Authoritative admin check — redirects to /seniors if not admin
  await requireAdmin();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data } = await admin
    .from("members")
    .select("id, email, full_name, position, role, auth_user_id, created_at")
    .order("role", { ascending: true })   // admin first
    .order("full_name", { ascending: true });

  const members = (data ?? []) as Member[];

  return (
    <main className="flex-1">
      {/* ── Hero ── */}
      <div className="navy-texture relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--akp-gold) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-8" style={{ background: "var(--akp-gold)" }} />
            <span
              className="text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: "var(--akp-gold)" }}
            >
              Alpha Kappa Psi · Admin
            </span>
          </div>

          <h1
            className="text-5xl sm:text-6xl font-extrabold leading-[1.05] text-white mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Member
            <br />
            <span style={{ color: "var(--akp-gold)" }}>Access.</span>
          </h1>
          <p className="text-blue-200 text-lg max-w-lg leading-relaxed">
            Manage who can sign in and what they can do. Adding someone here
            is what unlocks their access — Google login alone isn't enough.
          </p>
        </div>

        {/* Stats */}
        <div className="border-t" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
          <div className="max-w-6xl mx-auto px-6 py-5 flex gap-8">
            <div>
              <p className="text-2xl font-extrabold text-white">{members.length}</p>
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--akp-gold)" }}>Total</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-white">
                {members.filter((m) => m.role === "admin").length}
              </p>
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--akp-gold)" }}>Admins</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-white">
                {members.filter((m) => m.auth_user_id).length}
              </p>
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--akp-gold)" }}>Signed in</p>
            </div>
          </div>
        </div>

        <div className="h-[3px]" style={{ background: "var(--akp-gold)" }} />
      </div>

      {/* ── Table ── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Info callout */}
        <div
          className="rounded-xl px-5 py-4 mb-8 text-sm flex gap-3 items-start"
          style={{
            background: "rgba(201,168,76,0.06)",
            border: "1px solid rgba(201,168,76,0.2)",
          }}
        >
          <svg
            className="shrink-0 mt-0.5"
            width="16"
            height="16"
            fill="none"
            stroke="var(--akp-gold)"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ color: "var(--akp-gray-700)" }}>
            <strong style={{ color: "var(--akp-navy)" }}>Role rules:</strong> Admins can add/edit/delete seniors,
            manage opportunities, and access this page. Members can read everything but cannot write.
            The{" "}
            <span className="font-semibold" style={{ color: "var(--akp-navy)" }}>Linked</span>{" "}
            dot turns green once someone has signed in at least once via Google.
          </div>
        </div>

        <MembersClient members={members} currentEmail={user?.email ?? ""} />
      </div>
    </main>
  );
}
