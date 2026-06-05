import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    const ROOT = process.cwd();
    const seniorDir = path.join(ROOT, "content", "seniors", slug);

    if (!fs.existsSync(seniorDir)) {
      return NextResponse.json({ error: "Senior not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const dataStr = formData.get("data") as string | null;
    const headshotFile = formData.get("headshot") as File | null;

    if (!dataStr) {
      return NextResponse.json({ error: "Missing profile data" }, { status: 400 });
    }

    const profileData = JSON.parse(dataStr);

    if (!profileData.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Read existing profile to preserve fields not in the form (e.g. flags)
    const existingProfilePath = path.join(seniorDir, "profile.generated.json");
    const existing = fs.existsSync(existingProfilePath)
      ? (JSON.parse(fs.readFileSync(existingProfilePath, "utf8")) as { headshot?: string; flags?: string[] })
      : {};

    // Handle headshot: use new upload if provided, otherwise keep existing
    let headshotFilename: string = existing.headshot ?? "headshot.jpg";
    if (headshotFile && headshotFile.size > 0) {
      const ext = headshotFile.name.split(".").pop()?.toLowerCase() || "jpg";
      headshotFilename = `headshot.${ext}`;
      const bytes = await headshotFile.arrayBuffer();
      fs.writeFileSync(path.join(seniorDir, headshotFilename), Buffer.from(bytes));
    }

    const gradYear = parseInt(profileData.gradYear) || new Date().getFullYear();

    // Update meta.json
    const meta = {
      name: profileData.name.trim(),
      headshot: headshotFilename,
      gradYear,
      pledgeClass: profileData.pledgeClass?.trim() || "",
      destinationTitle: profileData.destinationTitle?.trim() || "",
      destinationCompany: profileData.destinationCompany?.trim() || "",
      visible: true,
    };
    fs.writeFileSync(path.join(seniorDir, "meta.json"), JSON.stringify(meta, null, 2));

    // Write updated profile.generated.json
    const profile = {
      slug,
      name: meta.name,
      headshot: headshotFilename,
      hometown: profileData.hometown?.trim() || null,
      majors: (profileData.majors as string[]).filter(Boolean),
      minors: (profileData.minors as string[]).filter(Boolean),
      pledgeClass: meta.pledgeClass,
      gradYear,
      destinationTitle: meta.destinationTitle,
      destinationCompany: meta.destinationCompany,
      tags: (profileData.tags as string[]).filter(Boolean),
      summary: profileData.summary?.trim() || "",
      timeline: (profileData.timeline as { term: string; highlights: string[] }[]).filter(
        (e) => e.term?.trim()
      ),
      programs: (profileData.programs as string[]).filter(Boolean),
      recruiting: (profileData.recruiting as string[]).filter(Boolean),
      advice: (profileData.advice as string[]).filter(Boolean),
      // Preserve existing flags from prior compile
      flags: existing.flags ?? [],
      ...(profileData.linkedIn?.trim() ? { linkedIn: profileData.linkedIn.trim() } : {}),
      ...(profileData.email?.trim() ? { email: profileData.email.trim() } : {}),
      ...(profileData.website?.trim() ? { website: profileData.website.trim() } : {}),
    };
    fs.writeFileSync(existingProfilePath, JSON.stringify(profile, null, 2));

    // Update seniors.json index
    const indexPath = path.join(ROOT, "src", "data", "seniors.json");
    let index: { slug: string; gradYear: number; name: string }[] = [];
    if (fs.existsSync(indexPath)) {
      try {
        index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      } catch {
        index = [];
      }
    }

    const indexEntry = {
      slug,
      name: profile.name,
      headshot: headshotFilename,
      majors: profile.majors,
      minors: profile.minors,
      pledgeClass: profile.pledgeClass,
      gradYear: profile.gradYear,
      destinationTitle: profile.destinationTitle,
      destinationCompany: profile.destinationCompany,
      summary: profile.summary,
      tags: profile.tags,
      ...(profile.linkedIn ? { linkedIn: profile.linkedIn } : {}),
      ...(profile.email ? { email: profile.email } : {}),
      ...(profile.website ? { website: profile.website } : {}),
    };

    const existingIdx = index.findIndex((s) => s.slug === slug);
    if (existingIdx >= 0) {
      index[existingIdx] = indexEntry as never;
    } else {
      index.push(indexEntry as never);
    }

    index.sort((a, b) => {
      if (b.gradYear !== a.gradYear) return b.gradYear - a.gradYear;
      return a.name.localeCompare(b.name);
    });

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    return NextResponse.json({ success: true, slug });
  } catch (err) {
    console.error("Error updating senior:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
