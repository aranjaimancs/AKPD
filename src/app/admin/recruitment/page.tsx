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

  return (
    <div
      className="min-h-screen px-4 py-10 sm:px-8"
      style={{ background: "var(--akp-off-white)" }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: "var(--akp-gold)" }}
            >
              Admin
            </p>
            <h1
              className="text-3xl font-extrabold"
              style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
            >
              Recruitment Resources
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--akp-gray-600)" }}>
              {fields.length} field{fields.length !== 1 ? "s" : ""},{" "}
              {fields.reduce(
                (n, f) => n + (f.recruitment_resources?.length ?? 0),
                0
              )}{" "}
              resource{fields.reduce((n, f) => n + (f.recruitment_resources?.length ?? 0), 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <a
            href="/recruitment"
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: "var(--akp-navy)", color: "var(--akp-gold)" }}
          >
            ← View Page
          </a>
        </div>

        <RecruitmentAdminClient fields={fields} />
      </div>
    </div>
  );
}
