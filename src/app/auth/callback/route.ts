import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/seniors";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", siteUrl));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("Auth callback error:", error?.message);
    return NextResponse.redirect(new URL("/login?error=auth_failed", siteUrl));
  }

  const email = data.user.email?.toLowerCase().trim();

  if (!email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=no_email", siteUrl));
  }

  // Re-check allow-list (defence in depth — covers any edge cases)
  const admin = createAdminClient();
  const { data: record } = await admin
    .from("allowed_emails")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  if (!record) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=unauthorized", siteUrl)
    );
  }

  // Stamp role into user metadata so the middleware can read it from the JWT
  // without hitting the database on every request.
  await admin.auth.admin.updateUserById(data.user.id, {
    user_metadata: { role: record.role },
  });

  return NextResponse.redirect(new URL(next, siteUrl));
}
