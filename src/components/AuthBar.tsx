import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import Link from "next/link";

export default async function AuthBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const isAdmin = user.user_metadata?.role === "admin";

  return (
    <div
      className="flex items-center justify-between px-5 py-1.5 text-xs"
      style={{
        background: "rgba(10,34,64,0.97)",
        borderBottom: "1px solid rgba(201,168,76,0.15)",
      }}
    >
      {/* Left: identity */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
          style={{ background: "var(--akp-gold)", color: "var(--akp-navy)" }}
        >
          {user.email?.[0]?.toUpperCase()}
        </div>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{user.email}</span>
        {isAdmin && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase"
            style={{ background: "rgba(201,168,76,0.15)", color: "var(--akp-gold)" }}
          >
            Admin
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-4">
        {isAdmin && (
          <Link
            href="/admin/add-senior"
            className="transition-opacity hover:opacity-80"
            style={{ color: "var(--akp-gold)" }}
          >
            + Add Senior
          </Link>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
