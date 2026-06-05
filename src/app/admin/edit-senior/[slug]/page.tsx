import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { Profile } from "@/types/profile";
import SeniorForm from "@/components/SeniorForm";

function getProfile(slug: string): Profile | null {
  if (slug.includes("..")) return null;
  const filePath = path.join(process.cwd(), "content", "seniors", slug, "profile.generated.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Profile;
}

export default async function EditSeniorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = getProfile(slug);
  if (!profile) notFound();

  const existingHeadshotUrl = `/seniors-content/${slug}/${profile.headshot}`;

  return (
    <SeniorForm
      mode="edit"
      initialData={profile}
      existingHeadshotUrl={existingHeadshotUrl}
    />
  );
}
