import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FieldWithResources } from "@/lib/actions/recruitment";
import RecruitmentAdminClient from "./RecruitmentAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminRecruitmentPage() {
  await requireAdmin();

  const { data: raw } = await createAdminClient()
    .from("recruitment_fields")
    .select(
      `*, recruitment_resources (
        id, field_id, title, description, resource_type,
        file_path, file_mime, external_url, sort_order
       )`
    )
    .order("sort_order")
    .order("sort_order", { referencedTable: "recruitment_resources" });

  const fields = (raw ?? []) as FieldWithResources[];
  const totalResources = fields.reduce(
    (n, f) => n + (f.recruitment_resources?.length ?? 0),
    0
  );

  return (
    <main className="flex-1" style={{ background: "var(--s-page)", minHeight: "100vh" }}>
      {/* ── Breadcrumb bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2">
          <a href="/admin" className="text-[13px] transition-opacity hover:opacity-70" style={{ color: "var(--t-muted)" }}>Admin</a>
          <span style={{ color: "var(--b-strong)" }}>/</span>
          <span className="text-[13px] font-semibold" style={{ color: "var(--t-primary)" }}>Recruitment Resources</span>
          <span className="ml-auto text-[12px]" style={{ color: "var(--t-faint)" }}>
            {fields.length} field{fields.length !== 1 ? "s" : ""} · {totalResources} resource{totalResources !== 1 ? "s" : ""}
          </span>
          <a href="/recruitment" className="btn btn-ghost btn-sm">View Page</a>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <RecruitmentAdminClient fields={fields} />
      </div>
    </main>
  );
}
