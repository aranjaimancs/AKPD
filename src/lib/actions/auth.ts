"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

/** Send a magic-link OTP. Returns an error string or null on success. */
export async function sendMagicLink(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const email = (formData.get("email") as string | null)?.toLowerCase().trim();

  if (!email) return "Please enter your email.";

  // Check allow-list before sending any OTP
  const admin = createAdminClient();
  const { data: record, error: dbErr } = await admin
    .from("allowed_emails")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  if (dbErr) {
    console.error("allow-list lookup error:", dbErr.message);
    return "Something went wrong. Please try again.";
  }

  if (!record) {
    // Deliberately vague — don't confirm whether the email exists
    return "This email address doesn't have access to the site.";
  }

  const supabase = await createClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) return error.message;

  // Signal success by returning this sentinel (caught in the login page)
  return "CHECK_EMAIL";
}

/** Sign the current user out and redirect to /login. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
