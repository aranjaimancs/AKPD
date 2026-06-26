import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Member = {
  id: string;
  email: string;
  full_name: string | null;
  position: string | null;
  role: "admin" | "member" | "alumni";
  auth_user_id: string | null;
};

/**
 * Returns the current authenticated member, or null if:
 *  - the user is not signed in, OR
 *  - their email is not in the members allowlist.
 *
 * This is the AUTHORITATIVE server-side check. Never rely only on
 * middleware or user_metadata for access decisions — both can be
 * bypassed. This queries the database on every call.
 */
export async function getCurrentMember(): Promise<Member | null> {
  const supabase = await createClient();

  // getUser() validates the JWT with Supabase's auth server (not just local decode).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  // Check the members allowlist using the admin client so we always get a
  // result regardless of what RLS policies are in effect (RLS itself calls
  // is_member(), which would recurse if we used the user client here).
  const admin = createAdminClient();
  const { data } = await admin
    .from("members")
    .select("id, email, full_name, position, role, auth_user_id")
    .eq("email", user.email.toLowerCase().trim())
    .maybeSingle();

  return data as Member | null;
}

/**
 * Like getCurrentMember() but redirects to /login if not authenticated
 * and to /not-authorized if authenticated but not in the allowlist.
 * Use this in page Server Components that require a signed-in member.
 */
export async function requireMember(): Promise<Member> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const member = await getCurrentMember();
  if (!member) redirect("/not-authorized");

  return member;
}

/**
 * Like requireMember() but also enforces admin role.
 * Use this in admin page Server Components.
 */
export async function requireAdmin(): Promise<Member> {
  const member = await requireMember();
  if (member.role !== "admin") redirect("/people");
  return member;
}
