import { createAdminClient } from "@/lib/supabase/admin";
import InviteForm from "./InviteForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const db = createAdminClient();

  const { data: link } = await db
    .from("invite_links")
    .select("id")
    .eq("token", token)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--s-page)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl"
        style={{
          background: "var(--s-0)",
          border: "1px solid var(--b-default)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {/* Header */}
        <div
          className="px-8 py-6"
          style={{
            background: "var(--akp-navy)",
            borderRadius: "1rem 1rem 0 0",
          }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-1"
            style={{ color: "var(--akp-gold)" }}
          >
            Alpha Kappa Psi · Delta Chapter
          </p>
          <h1
            className="text-xl font-bold"
            style={{ color: "#fff", fontFamily: "var(--font-display)" }}
          >
            Join the Member Portal
          </h1>
        </div>

        {/* Body */}
        <div className="p-8">
          {!link ? (
            <div className="text-center py-4">
              <p
                className="text-base font-semibold mb-2"
                style={{ color: "var(--t-primary)" }}
              >
                This link has expired.
              </p>
              <p className="text-sm" style={{ color: "var(--t-muted)" }}>
                Ask your chapter admin to generate a new invite link.
              </p>
            </div>
          ) : (
            <InviteForm token={token} />
          )}
        </div>
      </div>
    </main>
  );
}
