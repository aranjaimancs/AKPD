"use server";

import { getCurrentMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Constants ─────────────────────────────────────────────────────────────────

const BUCKET = "recruitment-resources";

// Signed URLs are valid for 60 seconds — long enough to start a download,
// short enough that a leaked URL is useless.
const SIGNED_URL_TTL_SECONDS = 60;

// ── Signed-URL download ───────────────────────────────────────────────────────

/**
 * Returns a short-lived signed URL for a private storage object.
 *
 * Security model:
 *  1. getCurrentMember() re-validates the session JWT against the DB (not just
 *     a local decode), so a revoked or expired session gets a null back.
 *  2. Only after that check do we call the admin client, which bypasses RLS.
 *     The admin client is never exposed to the browser.
 *  3. The signed URL itself expires after SIGNED_URL_TTL_SECONDS, so
 *     a previously seen URL cannot be replayed after expiry.
 *
 * The storage SELECT policy (in migration 003) is a secondary defence layer —
 * even if someone called createSignedUrl directly with user credentials, the
 * policy would reject non-members.
 */
export async function getSignedDownloadUrl(
  filePath: string
): Promise<{ url: string } | { error: string }> {
  // ── Auth gate ─────────────────────────────────────────────
  const member = await getCurrentMember();
  if (!member) return { error: "not_authorized" };

  // ── Sanitise input ────────────────────────────────────────
  // Prevent path-traversal: reject anything with ../ sequences.
  if (!filePath || filePath.includes("..")) {
    return { error: "invalid_path" };
  }

  // ── Generate URL via admin client ─────────────────────────
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return { error: error?.message ?? "Could not generate download URL." };
  }

  return { url: data.signedUrl };
}

// ── Admin: upload a file to the bucket ───────────────────────────────────────

/**
 * Generates a short-lived upload URL so the browser can PUT a file
 * directly to Supabase Storage without routing through Next.js.
 *
 * Only admins may call this — any other caller gets an error.
 */
export async function getSignedUploadUrl(
  filePath: string
): Promise<{ signedUrl: string; token: string; path: string } | { error: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "not_authorized" };
  if (member.role !== "admin") return { error: "admin_required" };

  if (!filePath || filePath.includes("..")) return { error: "invalid_path" };

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(filePath);

  if (error || !data) {
    return { error: error?.message ?? "Could not generate upload URL." };
  }

  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

// ── Admin: delete a stored object ────────────────────────────────────────────

export async function deleteStorageObject(
  filePath: string
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "not_authorized" };
  if (member.role !== "admin") return { error: "admin_required" };

  if (!filePath || filePath.includes("..")) return { error: "invalid_path" };

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
  if (error) return { error: error.message };
  return {};
}
