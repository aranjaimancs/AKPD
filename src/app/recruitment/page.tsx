import { requireMember } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMemberSubmissions,
  type FieldWithResources,
  type MemberSubmissions,
} from "@/lib/actions/recruitment";
import RecruitmentClient from "./RecruitmentClient";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const member = await requireMember();
  if (member.role === "alumni") redirect("/opportunities");
  const isAdmin = member.role === "admin";

  const { data: raw } = await createAdminClient()
    .from("recruitment_fields")
    .select(
      `*,
       recruitment_subfolders (
         id, field_id, parent_id, name, sort_order, batch_id, status,
         recruitment_resources (
           id, field_id, subfolder_id, title, description, resource_type,
           file_path, file_mime, external_url, sort_order, batch_id, status
         )
       ),
       recruitment_resources (
         id, field_id, subfolder_id, title, description, resource_type,
         file_path, file_mime, external_url, sort_order, batch_id, status
       )`
    )
    .eq("is_published", true)
    .eq("status", "live")
    .order("sort_order")
    .order("sort_order", { referencedTable: "recruitment_subfolders" })
    .order("sort_order", { referencedTable: "recruitment_resources" });

  // Filter pending/rejected content from nested resources and subfolders
  const fields: FieldWithResources[] = (raw ?? []).map((f) => ({
    ...f,
    recruitment_subfolders: (f.recruitment_subfolders ?? [])
      .filter((sf: { status: string }) => sf.status === "live")
      .map((sf: { recruitment_resources?: { status: string }[] }) => ({
        ...sf,
        recruitment_resources: (sf.recruitment_resources ?? []).filter(
          (r: { status: string }) => r.status === "live"
        ),
      })),
    recruitment_resources: (f.recruitment_resources ?? []).filter(
      (r: { status: string }) => r.status === "live"
    ),
  })) as FieldWithResources[];

  const fieldsWithContent = fields.filter(
    (f) =>
      (f.recruitment_subfolders ?? []).length > 0 ||
      (f.recruitment_resources ?? []).length > 0
  );

  const memberSubmissions: MemberSubmissions = await getMemberSubmissions();

  return (
    <main className="flex-1">
      {/* ── Title bar ── */}
      <div
        style={{
          background: "var(--s-0)",
          borderBottom: "1px solid var(--b-default)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 pt-4 pb-3">
          <h1
            className="text-[17px] font-bold mb-3"
            style={{
              color: "var(--t-primary)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.01em",
            }}
          >
            Recruiting Resources
          </h1>
          {fieldsWithContent.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {fieldsWithContent.map((f) => (
                <a key={f.id} href={`#${f.slug}`} className="pill text-[12px]">
                  {f.icon && <span className="mr-1">{f.icon}</span>}
                  {f.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {fields.length === 0 && memberSubmissions.fieldProposals.length === 0 ? (
          <div className="rounded-2xl px-8 py-16 text-center card">
            <p
              className="text-base font-bold mb-2"
              style={{ color: "var(--t-primary)" }}
            >
              No fields yet.
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--t-muted)" }}>
              Recruitment resources will appear here once they&apos;re added.
            </p>
            {isAdmin && (
              <a
                href="/admin/recruitment"
                className="text-sm font-bold"
                style={{ color: "var(--akp-gold)" }}
              >
                Add a field →
              </a>
            )}
          </div>
        ) : (
          <RecruitmentClient
            fields={fields}
            isAdmin={isAdmin}
            memberSubmissions={memberSubmissions}
          />
        )}
      </div>
    </main>
  );
}
