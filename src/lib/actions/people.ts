"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Nominatim geocoding ───────────────────────────────────────────────────────

async function geocode(
  locationLabel: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      locationLabel
    )}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        // Nominatim requires a descriptive User-Agent; requests without one may be blocked.
        "User-Agent": "AKPD-Alumni-Directory/1.0",
        "Accept-Language": "en",
      },
      // Don't let Next.js cache geocoding calls — location data must always be fresh.
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

// ── Shared state type ─────────────────────────────────────────────────────────

export type PersonFormState = {
  error?: string;
  success?: boolean;
  geocoded?: boolean; // true when coords were auto-resolved
};

// ── Upsert (create or update) ─────────────────────────────────────────────────

export async function upsertPerson(
  _prev: PersonFormState,
  formData: FormData
): Promise<PersonFormState> {
  await requireAdmin();

  const id = (formData.get("id") as string) || null;
  const locationLabel = (formData.get("location_label") as string).trim().slice(0, 256);
  const latRaw = (formData.get("latitude") as string).trim();
  const lngRaw = (formData.get("longitude") as string).trim();

  let lat: number | null = latRaw ? parseFloat(latRaw) : null;
  let lng: number | null = lngRaw ? parseFloat(lngRaw) : null;
  let geocoded = false;

  // Auto-geocode when a location label is given but no manual coords
  if (locationLabel && lat === null && lng === null) {
    const coords = await geocode(locationLabel);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      geocoded = true;
    }
  }

  const gradYearRaw = (formData.get("grad_year") as string).trim();
  const interestsRaw = (formData.get("interests") as string).trim();
  const interests = interestsRaw
    ? interestsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const row = {
    full_name: (formData.get("full_name") as string).trim(),
    member_type: formData.get("member_type") as string,
    location_label: locationLabel || null,
    latitude: lat,
    longitude: lng,
    title: (formData.get("title") as string).trim() || null,
    company: (formData.get("company") as string).trim() || null,
    industry: (formData.get("industry") as string).trim() || null,
    grad_year: gradYearRaw ? parseInt(gradYearRaw) : null,
    pledge_class: (formData.get("pledge_class") as string).trim() || null,
    headshot_url: (formData.get("headshot_url") as string).trim() || null,
    linkedin_url: (formData.get("linkedin_url") as string).trim() || null,
    bio: (formData.get("bio") as string).trim() || null,
    major: (formData.get("major") as string).trim() || null,
    interests,
  };

  const supabase = createAdminClient();
  const { error } = id
    ? await supabase.from("people").update(row).eq("id", id)
    : await supabase.from("people").insert(row);

  if (error) return { error: error.message };

  revalidatePath("/people");
  revalidatePath("/admin/people");
  return { success: true, geocoded };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deletePerson(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  const { error } = await createAdminClient()
    .from("people")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/people");
  revalidatePath("/admin/people");
  return {};
}
