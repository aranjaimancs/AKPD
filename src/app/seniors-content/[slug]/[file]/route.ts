import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; file: string }> }
) {
  const { slug, file } = await params;

  // Sanitize: no path traversal
  if (slug.includes("..") || file.includes("..")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filePath = path.join(
    process.cwd(),
    "content",
    "seniors",
    slug,
    file
  );

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  const contentType = MIME[ext] ?? "application/octet-stream";
  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400" },
  });
}
