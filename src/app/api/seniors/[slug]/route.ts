import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_HEADSHOT_EXTS = ["jpg", "jpeg", "png", "webp"];
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // ── Auth guard — admin only ────────────────────────────────
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (member.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { slug } = await params;

    if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Confirm the senior exists before updating
    const { data: existing, error: fetchErr } = await admin
      .from("seniors")
      .select("id, headshot_url")
      .eq("slug", slug)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Senior not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const dataStr = formData.get("data") as string | null;
    const headshotFile = formData.get("headshot") as File | null;

    if (!dataStr) {
      return NextResponse.json({ error: "Missing profile data" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let profileData: any;
    try {
      profileData = JSON.parse(dataStr);
    } catch {
      return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });
    }

    if (!profileData.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // ── Upload new headshot if provided ────────────────────────
    let headshotUrl: string | null = existing.headshot_url ?? null;
    if (headshotFile && headshotFile.size > 0) {
      const ext = headshotFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      if (!ALLOWED_HEADSHOT_EXTS.includes(ext)) {
        return NextResponse.json({ error: "Invalid image format. Use JPG, PNG, or WebP." }, { status: 400 });
      }
      const storagePath = `${slug}/headshot.${ext}`;
      const bytes = await headshotFile.arrayBuffer();

      const { error: uploadErr } = await admin.storage
        .from("senior-headshots")
        .upload(storagePath, Buffer.from(bytes), {
          contentType: MIME[ext] ?? "image/jpeg",
          upsert: true,
        });

      if (uploadErr) {
        console.error("Headshot upload error:", uploadErr.message);
        return NextResponse.json({ error: "Failed to upload headshot. Try again." }, { status: 500 });
      }

      headshotUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/senior-headshots/${storagePath}`;
    }

    // ── Update senior row ──────────────────────────────────────
    const gradYear = parseInt(profileData.gradYear) || new Date().getFullYear();

    const { error: updateErr } = await admin
      .from("seniors")
      .update({
        name: profileData.name.trim(),
        headshot_url: headshotUrl,
        hometown: profileData.hometown?.trim() || null,
        majors: (profileData.majors as string[]).filter(Boolean),
        minors: (profileData.minors as string[]).filter(Boolean),
        pledge_class: profileData.pledgeClass?.trim() || "",
        grad_year: gradYear,
        destination_title: profileData.destinationTitle?.trim() || "",
        destination_company: profileData.destinationCompany?.trim() || "",
        tags: (profileData.tags as string[]).filter(Boolean),
        summary: profileData.summary?.trim() || "",
        timeline: (profileData.timeline as { term: string; highlights: string[] }[]).filter(
          (e) => e.term?.trim()
        ),
        programs: (profileData.programs as string[]).filter(Boolean),
        recruiting: (profileData.recruiting as string[]).filter(Boolean),
        advice: (profileData.advice as string[]).filter(Boolean),
        linkedin_url: profileData.linkedIn?.trim() || null,
        email: profileData.email?.trim() || null,
        website: profileData.website?.trim() || null,
      })
      .eq("slug", slug);

    if (updateErr) {
      console.error("Senior update error:", updateErr.message);
      return NextResponse.json({ error: "Failed to update senior profile." }, { status: 500 });
    }

    return NextResponse.json({ success: true, slug });
  } catch (err) {
    console.error("Error updating senior:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
