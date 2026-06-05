import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NavLinks from "./NavLinks";
import ProfileDropdown from "./ProfileDropdown";

function getInitials(str: string): string {
  const parts = str.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.substring(0, 2) ?? "??").toUpperCase();
}

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Gracefully handle case where profiles table isn't set up yet
  let profile: { full_name: string | null; avatar_url: string | null } | null = null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  } catch {}

  const displayName = profile?.full_name || user.email!.split("@")[0];
  const initials = getInitials(profile?.full_name || user.email || "");
  const isAdmin = user.user_metadata?.role === "admin";

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "var(--akp-navy)",
        borderBottom: "2px solid var(--akp-gold)",
        boxShadow: "0 2px 20px rgba(0,0,0,0.25)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">
        {/* ── Logo ── */}
        <Link
          href="/seniors"
          className="flex items-center gap-2.5 shrink-0 group"
          aria-label="AKPD home"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold transition-transform group-hover:scale-105"
            style={{ background: "var(--akp-gold)", color: "var(--akp-navy)" }}
          >
            AK
          </div>
          <span
            className="text-sm font-extrabold text-white tracking-[0.12em] uppercase"
            style={{ fontFamily: "var(--font-display)" }}
          >
            AKPD
          </span>
        </Link>

        {/* ── Divider ── */}
        <div className="h-5 w-px shrink-0" style={{ background: "rgba(201,168,76,0.25)" }} />

        {/* ── Nav links (client — needs usePathname) ── */}
        <NavLinks />

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Profile dropdown (client) ── */}
        <ProfileDropdown
          email={user.email!}
          displayName={displayName}
          avatarUrl={profile?.avatar_url ?? null}
          initials={initials}
          isAdmin={isAdmin}
        />
      </div>
    </header>
  );
}
