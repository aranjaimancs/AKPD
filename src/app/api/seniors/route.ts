import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function POST(req: Request) {
  try {
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

    const slug = toSlug(profileData.name);
    const ROOT = process.cwd();
    const seniorDir = path.join(ROOT, "content", "seniors", slug);

    // Sanitize slug
    if (slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    fs.mkdirSync(seniorDir, { recursive: true });

    // Save headshot
    let headshotFilename = "headshot.jpg";
    if (headshotFile && headshotFile.size > 0) {
      const ext = headshotFile.name.split(".").pop()?.toLowerCase() || "jpg";
      headshotFilename = `headshot.${ext}`;
      const bytes = await headshotFile.arrayBuffer();
      fs.writeFileSync(path.join(seniorDir, headshotFilename), Buffer.from(bytes));
    }

    const gradYear = parseInt(profileData.gradYear) || new Date().getFullYear();

    // Write meta.json
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

    // Write notes.md placeholder (so compile script can pick it up later if needed)
    const notesPath = path.join(seniorDir, "notes.md");
    if (!fs.existsSync(notesPath)) {
      fs.writeFileSync(notesPath, `# ${meta.name}\n\nProfile added via admin panel.\n`);
    }

    // Write profile.generated.json
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
      flags: [],
      ...(profileData.linkedIn?.trim() ? { linkedIn: profileData.linkedIn.trim() } : {}),
      ...(profileData.email?.trim() ? { email: profileData.email.trim() } : {}),
      ...(profileData.website?.trim() ? { website: profileData.website.trim() } : {}),
    };
    fs.writeFileSync(
      path.join(seniorDir, "profile.generated.json"),
      JSON.stringify(profile, null, 2)
    );

    // Update src/data/seniors.json index
    const indexPath = path.join(ROOT, "src", "data", "seniors.json");
    let index: typeof profile[] = [];
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

    // Sort by gradYear desc, then name
    index.sort((a, b) => {
      if (b.gradYear !== a.gradYear) return b.gradYear - a.gradYear;
      return a.name.localeCompare(b.name);
    });

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    return NextResponse.json({ success: true, slug });
  } catch (err) {
    console.error("Error creating senior:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
