import { requireMember } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ClassesClient, { type ClassReview } from "./ClassesClient";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const member = await requireMember();
  // Alumni don't need class recommendations — send them to opportunities
  if (member.role === "alumni") redirect("/opportunities");

  const isAdmin = member.role === "admin";

  const { data } = await createAdminClient()
    .from("class_reviews")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const reviews = (data ?? []) as ClassReview[];

  return (
    <main className="flex-1">
      {/* ── Page header ── */}
      <div className="page-banner">
        <div className="max-w-6xl mx-auto px-6">
          <p className="page-eyebrow">AKΨ · UNC Chapel Hill</p>
          <h1 className="page-title page-title-md">
            Rate My <em>Class</em>
          </h1>
          <p className="page-subtitle">
            Brothers rate what&apos;s worth taking — difficulty, workload, professor, and which Gen Ed requirements it covers.
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <ClassesClient
          initialReviews={reviews}
          currentUserId={member.auth_user_id ?? ""}
          isAdmin={isAdmin}
        />
      </div>
    </main>
  );
}
