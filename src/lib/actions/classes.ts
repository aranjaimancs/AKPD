"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClassReviewFormState = {
  error?: string;
  success?: boolean;
};

/** Normalize raw course code input: "comp550" → "COMP 550", "BUSI  101" → "BUSI 101" */
function normalizeCourseCode(raw: string): string {
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "");
  // Insert a single space between the letter prefix and the digit suffix
  return upper.replace(/^([A-Z]+)(\d.*)$/, "$1 $2");
}

/** Derive department from normalized code: "COMP 550" → "COMP" */
function deriveDepartment(code: string): string {
  return code.split(" ")[0];
}

export async function postClassReview(
  _prev: ClassReviewFormState,
  formData: FormData
): Promise<ClassReviewFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const rawCode        = (formData.get("course_code")    as string)?.trim() ?? "";
  const course_code    = normalizeCourseCode(rawCode);
  const course_name    = (formData.get("course_name")    as string)?.trim() ?? "";
  const professor      = (formData.get("professor")      as string)?.trim() ?? "";
  const semester_taken = (formData.get("semester_taken") as string)?.trim() ?? "";
  const overall_rating    = parseInt(formData.get("overall_rating")    as string, 10);
  const difficulty_rating = parseInt(formData.get("difficulty_rating") as string, 10);
  const workload          = (formData.get("workload")        as string) ?? "";
  const would_recommend   = formData.get("would_recommend") === "true";
  const grade_received    = (formData.get("grade_received") as string) || null;
  const focus_areas       = formData.getAll("focus_areas") as string[];
  const review_text       = (formData.get("review_text")   as string)?.trim() ?? "";

  if (!course_code)    return { error: "Course code is required." };
  if (!course_name)    return { error: "Course name is required." };
  if (!professor)      return { error: "Professor name is required." };
  if (!semester_taken) return { error: "Semester is required." };
  if (!overall_rating || overall_rating < 1 || overall_rating > 5)
    return { error: "Overall rating (1–5) is required." };
  if (!difficulty_rating || difficulty_rating < 1 || difficulty_rating > 5)
    return { error: "Difficulty rating (1–5) is required." };
  if (!["light", "medium", "heavy"].includes(workload))
    return { error: "Workload is required." };
  if (formData.get("would_recommend") === null || formData.get("would_recommend") === "")
    return { error: "Please indicate whether you'd recommend this class." };
  if (!review_text) return { error: "Review text is required." };

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const posted_by_name = profile?.full_name || profile?.email || "Member";
  const department = deriveDepartment(course_code);

  const { error } = await admin.from("class_reviews").insert({
    course_code,
    course_name,
    department,
    professor,
    semester_taken,
    overall_rating,
    difficulty_rating,
    workload,
    would_recommend,
    grade_received,
    focus_areas: focus_areas.length > 0 ? focus_areas : [],
    review_text,
    posted_by: user.id,
    posted_by_name,
    is_active: true,
  });

  if (error) {
    console.error("postClassReview error:", error.message);
    return { error: "Failed to post review. Please try again." };
  }

  revalidatePath("/classes");
  return { success: true };
}

export async function removeClassReview(
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

  // Admins can remove any review; members can only remove their own
  const query = admin
    .from("class_reviews")
    .update({ is_active: false })
    .eq("id", id);

  const { error } = isAdmin ? await query : await query.eq("posted_by", user.id);

  if (error) return { error: "Could not remove review." };

  revalidatePath("/classes");
  return {};
}
