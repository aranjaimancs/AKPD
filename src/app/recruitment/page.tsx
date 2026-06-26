import { requireMember, getCurrentMember } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FieldWithResources, RecruitmentResource } from "@/lib/actions/recruitment";
import DownloadButton from "./DownloadButton";

export const dynamic = "force-dynamic";

function mimeLabel(mime: string | null): string {
  if (!mime) return "File";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("document")) return "Word";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "Slides";
  if (mime.includes("sheet") || mime.includes("excel")) return "Excel";
  return "File";
}

function mimeDot(mime: string | null): string {
  if (!mime) return "#8a8278";
  if (mime.includes("pdf")) return "#e53e3e";
  if (mime.includes("word") || mime.includes("document")) return "#3182ce";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "#dd6b20";
  if (mime.includes("sheet") || mime.includes("excel")) return "#38a169";
  return "#8a8278";
}

function ResourceCard({ resource }: { resource: RecruitmentResource }) {
  const isFile = resource.resource_type === "file";
  const dot = isFile ? mimeDot(resource.file_mime) : "#c9a84c";
  const label = isFile ? mimeLabel(resource.file_mime) : "Link";

  return (
    <div className="card card-interactive p-4 flex flex-col gap-3 h-full">
      {/* Badge row */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: dot }}
        />
        <span
          className="text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "var(--t-muted)" }}
        >
          {label}
        </span>
      </div>

      {/* Title */}
      <p
        className="text-[13px] font-semibold leading-snug flex-1"
        style={{ color: "var(--t-primary)" }}
      >
        {resource.title}
      </p>

      {/* Description */}
      {resource.description && (
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--t-secondary)" }}>
          {resource.description}
        </p>
      )}

      {/* Action */}
      <div className="mt-auto pt-2" style={{ borderTop: "1px solid var(--b-subtle)" }}>
        {isFile && resource.file_path ? (
          <DownloadButton
            filePath={resource.file_path}
            title={resource.title}
            mime={resource.file_mime}
          />
        ) : resource.external_url ? (
          <a
            href={resource.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm w-full justify-center"
          >
            <svg
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              className="shrink-0"
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open link
          </a>
        ) : null}
      </div>
    </div>
  );
}

function FieldSection({
  field,
  isAdmin,
}: {
  field: FieldWithResources;
  isAdmin: boolean;
}) {
  const resources = field.recruitment_resources ?? [];
  const hasResources = resources.length > 0;

  return (
    <section id={field.slug} className="scroll-mt-20">
      {/* Field header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          {field.icon && (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
              style={{ background: "var(--s-1)", border: "1px solid var(--b-default)" }}
              aria-hidden
            >
              {field.icon}
            </div>
          )}
          <div>
            <h2
              className="text-base font-bold"
              style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)" }}
            >
              {field.name}
            </h2>
            {field.description && (
              <p className="text-[12px] mt-0.5" style={{ color: "var(--t-muted)" }}>
                {field.description}
              </p>
            )}
          </div>
        </div>

        <span
          className={`badge shrink-0 ${hasResources ? "badge-navy" : "badge-neutral"}`}
        >
          {hasResources ? `${resources.length} resource${resources.length !== 1 ? "s" : ""}` : "Coming soon"}
        </span>
      </div>

      {/* Resources */}
      {hasResources ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl px-6 py-7 text-center text-[13px]"
          style={{
            background: "var(--s-1)",
            border: "1px dashed var(--b-default)",
            color: "var(--t-muted)",
          }}
        >
          Resources for this track are being added.
          {isAdmin && (
            <>
              {" "}
              <a href="/admin/recruitment" style={{ color: "var(--akp-gold)", fontWeight: 600 }}>
                Add the first one →
              </a>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default async function RecruitmentPage() {
  const member = await requireMember();
  // Alumni don't need recruiting resources — send them to opportunities instead
  if (member.role === "alumni") redirect("/opportunities");
  const isAdmin = member.role === "admin";

  const { data: raw } = await createAdminClient()
    .from("recruitment_fields")
    .select(
      `*, recruitment_resources (
        id, field_id, title, description, resource_type,
        file_path, file_mime, external_url, sort_order
       )`
    )
    .eq("is_published", true)
    .order("sort_order")
    .order("sort_order", { referencedTable: "recruitment_resources" });

  const fields = (raw ?? []) as FieldWithResources[];
  const fieldsWithContent = fields.filter((f) => (f.recruitment_resources ?? []).length > 0);

  return (
    <main className="flex-1">
      {/* ── Title bar ── */}
      <div style={{ background: "var(--s-0)", borderBottom: "1px solid var(--b-default)" }}>
        <div className="max-w-6xl mx-auto px-6 pt-4 pb-3">
          <h1
            className="text-[17px] font-bold mb-3"
            style={{ color: "var(--t-primary)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
          >
            Recruiting Resources
          </h1>
          {/* Field quick-jump */}
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
      <div className="max-w-6xl mx-auto px-6 py-12">
        {fields.length === 0 ? (
          <div
            className="rounded-2xl px-8 py-16 text-center card"
          >
            <p className="text-base font-bold mb-2" style={{ color: "var(--t-primary)" }}>
              No fields yet.
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--t-muted)" }}>
              Recruitment resources will appear here once they&apos;re added.
            </p>
            {isAdmin && (
              <a href="/admin/recruitment" className="text-sm font-bold" style={{ color: "var(--akp-gold)" }}>
                Add a field →
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-12">
            {fields.map((field, i) => (
              <div key={field.id}>
                <FieldSection field={field} isAdmin={isAdmin} />
                {i < fields.length - 1 && (
                  <div className="mt-12" style={{ borderBottom: "1px solid var(--b-subtle)" }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
