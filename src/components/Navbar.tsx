import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/auth";
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

  const member = await getCurrentMember();
  if (!member) return null;

  let profile: { full_name: string | null; avatar_url: string | null } | null = null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  } catch {}

  const displayName =
    profile?.full_name || member.full_name || user.email!.split("@")[0];
  const initials = getInitials(
    profile?.full_name || member.full_name || user.email || ""
  );

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "var(--s-0)",
        borderBottom: "1px solid var(--b-default)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-[56px] flex items-center gap-6">

        {/* ── Logo ── */}
        <Link
          href="/people"
          className="flex items-center gap-2.5 shrink-0 group"
          aria-label="AKPD home"
        >
          <Image
            src="/aklogo.png"
            alt="AKΨ UNC"
            width={56}
            height={56}
            className="transition-all duration-200 group-hover:scale-105"
          />
          <span
            className="text-[13px] font-extrabold tracking-[0.08em] uppercase"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
          >
            AKPD
          </span>
        </Link>

        {/* ── Divider ── */}
        <div
          className="h-4 w-px shrink-0"
          style={{ background: "var(--b-default)" }}
        />

        {/* ── Nav links ── */}
        <NavLinks isAdmin={member.role === "admin"} />

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Profile dropdown ── */}
        <ProfileDropdown
          email={user.email!}
          displayName={displayName}
          avatarUrl={profile?.avatar_url ?? null}
          initials={initials}
          isAdmin={member.role === "admin"}
        />
      </div>
    </header>
  );
}
