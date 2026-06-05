"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateProfile(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const fullName = (formData.get("full_name") as string | null)?.trim() || null;
  const bio = (formData.get("bio") as string | null)?.trim() || null;
  const pledgeClass = (formData.get("pledge_class") as string | null)?.trim() || null;
  const gradYearRaw = formData.get("grad_year") as string | null;
  const gradYear = gradYearRaw ? parseInt(gradYearRaw) || null : null;
  const major = (formData.get("major") as string | null)?.trim() || null;
  const linkedinUrl = (formData.get("linkedin_url") as string | null)?.trim() || null;
  const avatarFile = formData.get("avatar") as File | null;

  let avatarUrl: string | undefined;

  // ── Avatar upload ──────────────────────────────────────────────────────────
  if (avatarFile && avatarFile.size > 0) {
    const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `${user.id}/avatar.${ext}`;
    const bytes = await avatarFile.arrayBuffer();

    const admin = createAdminClient();
    const { error: uploadErr } = await admin.storage
      .from("avatars")
      .upload(storagePath, Buffer.from(bytes), {
        contentType: avatarFile.type || "image/jpeg",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Avatar upload error:", uploadErr.message);
      return { error: "Failed to upload photo. Try again." };
    }

    avatarUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${storagePath}`;
  }

  // ── Upsert profile ──────────────────────────────────────────────────────────
  const { error: upsertErr } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email!,
      full_name: fullName,
      bio,
      pledge_class: pledgeClass,
      grad_year: gradYear,
      major,
      linkedin_url: linkedinUrl,
      updated_at: new Date().toISOString(),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
    },
    { onConflict: "id" }
  );

  if (upsertErr) {
    console.error("Profile upsert error:", upsertErr.message);
    return { error: "Failed to save profile. Try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/");

  return { success: true };
}
