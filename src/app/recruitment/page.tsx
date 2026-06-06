import { requireMember, getCurrentMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FieldWithResources, RecruitmentResource } from "@/lib/actions/recruitment";
import DownloadButton from "./DownloadButton";

export const dynamic = "force-dynamic";

// ── MIME → visual label ───────────────────────────────────────────────────────

function mimeLabel(mime: string | null): string {
  if (!mime) return "File";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("document")) return "Word";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "Slides";
  if (mime.includes("sheet") || mime.includes("excel")) return "Excel";
  return "File";
}

// ── Resource card ─────────────────────────────────────────────────────────────

function ResourceCard({ resource }: { resource: RecruitmentResource }) {
  const isFile = resource.resource_type === "file";

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl transition-shadow"
      style={{
        background: "var(--akp-white)",
        border: "1px solid var(--akp-gray-200)",
        boxShadow: "0 1px 4px rgba(10,34,64,0.04)",
      }}
    >
      {/* Type badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={
            isFile
              ? { background: "rgba(10,34,64,0.06)", color: "var(--akp-navy)" }
              : {
                  background: "rgba(201,168,76,0.1)",
                  color: "var(--akp-gold)",
                }
          }
        >
          {isFile ? mimeLabel(resource.file_mime) : "Link"}
        </span>
      </div>

      {/* Title */}
      <p
        className="text-sm font-bold leading-snug"
        style={{ color: "var(--akp-navy)" }}
      >
        {resource.title}
      </p>

      {/* Description */}
      {resource.description && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--akp-gray-600)" }}>
          {resource.description}
        </p>
      )}

      {/* Action */}
      <div className="mt-auto pt-1">
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
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-75"
            style={{
              background: "rgba(201,168,76,0.1)",
              color: "var(--akp-gold)",
            }}
          >
            <svg
              width="14"
              height="14"
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

// ── Field section ─────────────────────────────────────────────────────────────

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
    <section id={field.slug} className="scroll-mt-24">
      {/* Field header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          {field.icon && (
            <span className="text-2xl leading-none" aria-hidden>
              {field.icon}
            </span>
          )}
          <div>
            <h2
              className="text-xl font-extrabold"
              style={{ color: "var(--akp-navy)", fontFamily: "var(--font-display)" }}
            >
              {field.name}
            </h2>
            {field.description && (
              <p className="text-sm mt-0.5" style={{ color: "var(--akp-gray-600)" }}>
                {field.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={
              hasResources
                ? { background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }
                : { background: "var(--akp-gray-100)", color: "var(--akp-gray-400)" }
            }
          >
            {hasResources ? `${resources.length} resource${resources.length !== 1 ? "s" : ""}` : "Coming soon"}
          </span>
          {isAdmin && (
            <a
              href={`/admin/recruitment#${field.slug}`}
              className="text-[11px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--akp-gold)" }}
            >
              + Add
            </a>
          )}
        </div>
      </div>

      {/* Resources grid */}
      {hasResources ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl px-6 py-8 text-center text-sm"
          style={{
            background: "var(--akp-off-white)",
            border: "1px dashed var(--akp-gray-200)",
            color: "var(--akp-gray-400)",
          }}
        >
          Resources for this track are being added.
          {isAdmin && (
            <span>
              {" "}
              <a
                href={`/admin/recruitment`}
                style={{ color: "var(--akp-gold)", fontWeight: 600 }}
              >
                Add the first one →
              </a>
            </span>
          )}
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RecruitmentPage() {
  await requireMember();
  const member = await getCurrentMember();
  const isAdmin = member?.role === "admin";

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

  // ── Field anchor nav (quick-jump sidebar or horizontal) ───────────────────
  const fieldsWithContent = fields.filter(
    (f) => (f.recruitment_resources ?? []).length > 0
  );

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
              Alpha Kappa Psi · AKPD
            </span>
          </div>

          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] text-white mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Recruiting
            <br />
            <span style={{ color: "var(--akp-gold)" }}>Resources.</span>
          </h1>
          <p className="text-blue-200 text-lg max-w-lg leading-relaxed">
            Guides, prep docs, timelines, and templates — organized by career
            track and uploaded directly by chapter members.
          </p>
        </div>

        {/* Quick-jump links */}
        {fieldsWithContent.length > 0 && (
          <div
            className="border-t"
            style={{ borderColor: "rgba(201,168,76,0.2)" }}
          >
            <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap gap-x-5 gap-y-2">
              {fieldsWithContent.map((f) => (
                <a
                  key={f.id}
                  href={`#${f.slug}`}
                  className="text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{ color: "rgba(201,168,76,0.8)" }}
                >
                  {f.icon && <span className="mr-1">{f.icon}</span>}
                  {f.name}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="h-[3px]" style={{ background: "var(--akp-gold)" }} />
      </div>

      {/* ── Admin bar ── */}
      {isAdmin && (
        <div
          className="sticky top-0 z-10 border-b"
          style={{
            background: "rgba(10,34,64,0.97)",
            backdropFilter: "blur(8px)",
            borderColor: "rgba(201,168,76,0.2)",
          }}
        >
          <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
            <p className="text-xs font-semibold" style={{ color: "rgba(201,168,76,0.7)" }}>
              Admin view
            </p>
            <a
              href="/admin/recruitment"
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: "rgba(201,168,76,0.12)", color: "var(--akp-gold)" }}
            >
              Manage Fields &amp; Resources →
            </a>
          </div>
        </div>
      )}

      {/* ── Fields ── */}
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col gap-14">
        {fields.length === 0 ? (
          <div
            className="rounded-2xl px-8 py-16 text-center"
            style={{
              background: "var(--akp-white)",
              border: "1px dashed var(--akp-gray-200)",
            }}
          >
            <p className="text-lg font-bold mb-2" style={{ color: "var(--akp-navy)" }}>
              No fields yet.
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--akp-gray-400)" }}>
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
          fields.map((field) => (
            <FieldSection key={field.id} field={field} isAdmin={isAdmin} />
          ))
        )}
      </div>
    </main>
  );
}
