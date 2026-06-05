"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Sign the current user out and redirect to /login. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
