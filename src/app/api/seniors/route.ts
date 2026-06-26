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

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function POST(req: Request) {
  // ── Auth guard — admin only ────────────────────────────────
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (member.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
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

    const slug = toSlug(profileData.name);
    if (!slug) {
      return NextResponse.json({ error: "Could not generate a valid slug from name" }, { status: 400 });
    }

    const admin = createAdminClient();

    // ── Upload headshot to Supabase Storage ────────────────────
    let headshotUrl: string | null = null;
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

    // ── Insert senior row ──────────────────────────────────────
    const gradYear = parseInt(profileData.gradYear) || new Date().getFullYear();

    const { error: insertErr } = await admin.from("seniors").insert({
      slug,
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
      flags: [],
      linkedin_url: profileData.linkedIn?.trim() || null,
      email: profileData.email?.trim() || null,
      website: profileData.website?.trim() || null,
      visible: true,
    });

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ error: `A senior with slug "${slug}" already exists.` }, { status: 409 });
      }
      console.error("Senior insert error:", insertErr.message);
      return NextResponse.json({ error: "Failed to save senior profile." }, { status: 500 });
    }

    return NextResponse.json({ success: true, slug });
  } catch (err) {
    console.error("Error creating senior:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
