"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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

export async function completeOnboarding(
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const fullName = (formData.get("full_name") as string | null)?.trim() || null;
  const headline = (formData.get("headline") as string | null)?.trim().slice(0, 160) || null;
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
  // Avatar is uploaded client-side directly to Supabase Storage; we only
  // receive the resulting public URL here to avoid the 1 MB action body limit.
  const avatarUrlRaw = (formData.get("avatar_url") as string | null)?.trim() || null;
  const avatarUrl: string | undefined = avatarUrlRaw ?? undefined;

  // ── Geocode location ─────────────────────────────────────────────────────────
  let lat: number | null = null;
  let lng: number | null = null;
  if (locationLabel) {
    const coords = await geocode(locationLabel);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  // ── Upsert profile ───────────────────────────────────────────────────────────
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email!,
      full_name: fullName,
      headline,
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

  if (profileErr) {
    console.error("Profile upsert error:", profileErr.message);
    return { error: "Failed to save profile. Try again." };
  }

  // ── Sync to people table (creates a new entry for this member) ───────────────
  const { data: existingPerson } = await admin
    .from("people")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existingPerson) {
    await admin
      .from("people")
      .update({
        full_name: fullName || undefined,
        headline,
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
    await admin.from("people").insert({
      auth_user_id: user.id,
      full_name: fullName,
      headline,
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

  // ── Mark onboarding complete in user metadata ─────────────────────────────────
  // This lets the client refresh the session to get the updated JWT, which is
  // used by middleware (if any) to skip the onboarding redirect on future visits.
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      onboarding_complete: true,
    },
  });

  revalidatePath("/people");
  revalidatePath("/settings");

  return { success: true };
}
