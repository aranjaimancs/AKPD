"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* ── Types ── */
export type ClassResource = {
  id: string;
  course_code: string;
  course_name: string;
  department: string;
  title: string;
  description: string | null;
  resource_type: "file" | "link";
  file_path: string | null;
  file_mime: string | null;
  file_size: number | null;
  external_url: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
};

export type ClassResourceFormState = {
  error?: string;
  success?: boolean;
};

export type CourseLookup = Record<string, { course_name: string; department: string }>;

/* ── Helpers ── */
function normalizeCourseCode(raw: string): string {
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "");
  return upper.replace(/^([A-Z]+)(\d.*)$/, "$1 $2");
}

function deriveDepartment(code: string): string {
  return code.split(" ")[0];
}

/* ── Upload resource (file or link) ── */
export async function uploadClassResource(
  _prev: ClassResourceFormState,
  formData: FormData
): Promise<ClassResourceFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const rawCode     = (formData.get("course_code")    as string)?.trim() ?? "";
  const course_code = normalizeCourseCode(rawCode);
  const course_name = (formData.get("course_name")    as string)?.trim() ?? "";
  const title       = (formData.get("title")          as string)?.trim() ?? "";
  const description = (formData.get("description")    as string)?.trim() || null;
  const resource_type = formData.get("resource_type") as string;
  const external_url  = (formData.get("external_url") as string)?.trim() || null;
  const file = formData.get("file") as File | null;

  if (!course_code)   return { error: "Course code is required." };
  if (!course_name)   return { error: "Course name is required." };
  if (!title)         return { error: "Title is required." };
  if (!["file", "link"].includes(resource_type))
    return { error: "Resource type is required." };
  if (resource_type === "link" && !external_url)
    return { error: "URL is required." };
  if (resource_type === "file" && (!file || file.size === 0))
    return { error: "File is required." };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const uploaded_by_name = profile?.full_name || profile?.email || "Member";
  const department = deriveDepartment(course_code);

  let file_path: string | null = null;
  let file_mime: string | null = null;
  let file_size: number | null = null;

  if (resource_type === "file" && file && file.size > 0) {
    const originalName = file.name;
    const ext = originalName.includes(".")
      ? originalName.slice(originalName.lastIndexOf("."))
      : "";
    const storagePath = `${course_code.replace(/\s+/g, "-")}/${crypto.randomUUID()}${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: storageError } = await admin.storage
      .from("class-resources")
      .upload(storagePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (storageError) {
      console.error("class-resources upload error:", storageError.message);
      return { error: "Failed to upload file. Please try again." };
    }

    file_path = storagePath;
    file_mime = file.type || null;
    file_size = file.size;
  }

  const { error } = await admin.from("class_resources").insert({
    course_code,
    course_name,
    department,
    title,
    description,
    resource_type,
    file_path,
    file_mime,
    file_size,
    external_url: resource_type === "link" ? external_url : null,
    uploaded_by: user.id,
    uploaded_by_name,
    is_active: true,
  });

  if (error) {
    console.error("uploadClassResource DB error:", error.message);
    return { error: "Failed to save resource. Please try again." };
  }

  revalidatePath("/classes");
  return { success: true };
}

/* ── Soft-delete resource ── */
export async function removeClassResource(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("members")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isAdmin = member?.role === "admin";
  const query = admin
    .from("class_resources")
    .update({ is_active: false })
    .eq("id", id);

  const { error } = isAdmin ? await query : await query.eq("uploaded_by", user.id);

  if (error) return { error: "Could not remove resource." };

  revalidatePath("/classes");
  return {};
}

/* ── Generate signed download URL (60s TTL) ── */
export async function getClassResourceSignedUrl(
  filePath: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("class-resources")
    .createSignedUrl(filePath, 60);

  if (error || !data) return { error: "Could not generate download link." };
  return { url: data.signedUrl };
}
