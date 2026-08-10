import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/auth";
import type { InviteLink, InviteRequest } from "@/lib/actions/invites";
import MembersClient from "./MembersClient";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const [{ data: members }, { data: linkData }, { data: requestData }] =
    await Promise.all([
      admin
        .from("members")
        .select("id, email, full_name, position, role, auth_user_id, created_at")
        .order("role", { ascending: true })
        .order("full_name", { ascending: true }),
      admin
        .from("invite_links")
        .select("id, token, created_by, expires_at, is_active, created_at")
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("invite_requests")
        .select("id, link_id, full_name, email, role, position, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
    ]);

  return (
    <main className="flex-1" style={{ background: "var(--s-page)", minHeight: "100vh" }}>
      {/* ── Breadcrumb bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-2">
          <a href="/admin" className="text-[13px] transition-opacity hover:opacity-70" style={{ color: "var(--t-muted)" }}>Admin</a>
          <span style={{ color: "var(--b-strong)" }}>/</span>
          <span className="text-[13px] font-semibold" style={{ color: "var(--t-primary)" }}>Members</span>
          <span className="ml-auto text-[12px]" style={{ color: "var(--t-faint)" }}>
            {(members ?? []).length} total · {(members ?? []).filter((m) => m.role === "member").length} students · {(members ?? []).filter((m) => m.role === "alumni").length} alumni · {(members ?? []).filter((m) => m.role === "admin").length} admin{(members ?? []).filter((m) => m.role === "admin").length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <MembersClient
          members={(members ?? []) as Member[]}
          currentEmail={user?.email ?? ""}
          activeLink={(linkData as InviteLink | null) ?? null}
          pendingRequests={(requestData ?? []) as InviteRequest[]}
        />
      </div>
    </main>
  );
}
