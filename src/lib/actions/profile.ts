"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ── Nominatim geocoding ───────────────────────────────────────────────────────

async function geocode(
  locationLabel: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationLabel)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "AKPD-Alumni-Directory/1.0", "Accept-Language": "en" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

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
  const locationLabel = (formData.get("location_label") as string | null)?.trim() || null;
  const interestsRaw = (formData.get("interests") as string | null)?.trim() || "";
  const interests = interestsRaw
    ? interestsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
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

  // ── Geocode location if provided ───────────────────────────────────────────
  let lat: number | null = null;
  let lng: number | null = null;
  if (locationLabel) {
    const coords = await geocode(locationLabel);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  // ── Upsert profiles ────────────────────────────────────────────────────────
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
      location_label: locationLabel,
      latitude: lat,
      longitude: lng,
      interests,
      updated_at: new Date().toISOString(),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
    },
    { onConflict: "id" }
  );

  if (upsertErr) {
    console.error("Profile upsert error:", upsertErr.message);
    return { error: "Failed to save profile. Try again." };
  }

  // ── Sync to people table so location appears on the map ────────────────────
  // Only sync fields the user controls; admins keep title/company/etc editable.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("people")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) {
    await admin
      .from("people")
      .update({
        full_name: fullName || undefined,
        location_label: locationLabel,
        latitude: lat,
        longitude: lng,
        interests,
        linkedin_url: linkedinUrl || undefined,
        bio: bio || undefined,
        major: major || undefined,
        grad_year: gradYear || undefined,
        pledge_class: pledgeClass || undefined,
        ...(avatarUrl !== undefined ? { headshot_url: avatarUrl } : {}),
      })
      .eq("auth_user_id", user.id);
  } else if (fullName) {
    // Create a new people entry linked to this user
    await admin.from("people").insert({
      auth_user_id: user.id,
      full_name: fullName,
      member_type: "current",
      location_label: locationLabel,
      latitude: lat,
      longitude: lng,
      interests,
      linkedin_url: linkedinUrl || null,
      bio: bio || null,
      major: major || null,
      grad_year: gradYear || null,
      pledge_class: pledgeClass || null,
      ...(avatarUrl !== undefined ? { headshot_url: avatarUrl } : {}),
    });
  }

  revalidatePath("/settings");
  revalidatePath("/people");

  return { success: true };
}
