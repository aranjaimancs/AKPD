"use server";

import { getCurrentMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ── Constants ─────────────────────────────────────────────────────────────────

const BUCKET = "recruitment-resources";
const SIGNED_URL_TTL_SECONDS = 60;

// ── Public types ──────────────────────────────────────────────────────────────

export type RecruitmentField = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_published: boolean;
  status: "live" | "pending" | "rejected";
  proposed_by: string | null;
};

export type RecruitmentResource = {
  id: string;
  field_id: string;
  subfolder_id: string | null;
  title: string;
  description: string | null;
  resource_type: "file" | "link";
  file_path: string | null;
  file_mime: string | null;
  external_url: string | null;
  sort_order: number;
  batch_id: string | null;
  status: "live" | "pending" | "rejected";
};

export type RecruitmentSubfolder = {
  id: string;
  field_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  batch_id: string | null;
  status: "live" | "pending" | "rejected";
};

export type MemberBatch = {
  id: string;
  field_id: string;
  submitted_by: string;
  submitted_by_name: string;
  status: "draft" | "pending_review" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type BatchWithItems = MemberBatch & {
  recruitment_resources: RecruitmentResource[];
  recruitment_subfolders: RecruitmentSubfolder[];
};

export type MemberSubmissions = {
  fieldProposals: RecruitmentField[];
  batches: BatchWithItems[];
};

export type FieldProposalInput = {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
};

export type SubfolderWithResources = RecruitmentSubfolder & {
  recruitment_resources: RecruitmentResource[];
};

export type FieldWithResources = RecruitmentField & {
  recruitment_subfolders: SubfolderWithResources[];
  // All resources for this field (filter subfolder_id === null for top-level only)
  recruitment_resources: RecruitmentResource[];
};

// ── Signed-URL download ───────────────────────────────────────────────────────
//
// Security model:
//  1. getCurrentMember() re-validates the JWT against the DB — not a local decode.
//  2. Only after that check do we call the admin client (bypasses RLS).
//  3. The URL itself expires after SIGNED_URL_TTL_SECONDS.
//  4. The storage SELECT policy is a secondary defense.

export async function getSignedDownloadUrl(
  filePath: string
): Promise<{ url: string } | { error: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "not_authorized" };
  if (!filePath || filePath.includes("..")) return { error: "invalid_path" };

  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return { error: error?.message ?? "Could not generate download URL." };
  }
  return { url: data.signedUrl };
}

// ── Admin: signed upload URL ──────────────────────────────────────────────────

export async function getSignedUploadUrl(
  filePath: string,
  batchId?: string
): Promise<{ signedUrl: string; token: string; path: string } | { error: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "not_authorized" };
  if (!filePath || filePath.includes("..")) return { error: "invalid_path" };

  if (member.role !== "admin") {
    // Non-admins must supply a batchId they own and that is in draft state
    if (!batchId) return { error: "admin_required" };
    const { data: batch } = await createAdminClient()
      .from("recruitment_batches")
      .select("submitted_by, status")
      .eq("id", batchId)
      .maybeSingle();
    if (!batch) return { error: "Batch not found." };
    if (batch.submitted_by !== member.auth_user_id) return { error: "not_authorized" };
    if (batch.status !== "draft") return { error: "Batch is not in draft status." };
  }

  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUploadUrl(filePath);

  if (error || !data) {
    return { error: error?.message ?? "Could not generate upload URL." };
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

// ── Admin: delete storage object ──────────────────────────────────────────────

export async function deleteStorageObject(
  filePath: string
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { error: "not_authorized" };
  if (member.role !== "admin") return { error: "admin_required" };
  if (!filePath || filePath.includes("..")) return { error: "invalid_path" };

  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .remove([filePath]);

  if (error) return { error: error.message };
  return {};
}

// ── Admin: field CRUD ─────────────────────────────────────────────────────────

export type FieldInput = {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  is_published?: boolean;
};

export async function upsertField(
  input: FieldInput
): Promise<{ error?: string; success?: boolean }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const row = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase().replace(/\s+/g, "-"),
    description: input.description?.trim() || null,
    icon: input.icon?.trim() || null,
    sort_order: input.sort_order ?? 0,
    is_published: input.is_published ?? true,
  };

  const supabase = createAdminClient();
  const { error } = input.id
    ? await supabase.from("recruitment_fields").update(row).eq("id", input.id)
    : await supabase.from("recruitment_fields").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return { success: true };
}

export async function deleteField(id: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();

  // Collect file paths to clean up from storage (resources cascade-delete, but
  // storage objects do not — we have to remove them manually first).
  const { data: resources } = await supabase
    .from("recruitment_resources")
    .select("file_path")
    .eq("field_id", id)
    .not("file_path", "is", null);

  const paths = (resources ?? [])
    .map((r) => r.file_path)
    .filter(Boolean) as string[];

  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("recruitment_fields")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function toggleFieldPublished(
  id: string,
  published: boolean
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const { error } = await createAdminClient()
    .from("recruitment_fields")
    .update({ is_published: published })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function moveField(
  id: string,
  direction: "up" | "down"
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();
  const { data: fields } = await supabase
    .from("recruitment_fields")
    .select("id, sort_order")
    .order("sort_order");

  if (!fields) return { error: "Could not load fields." };

  const idx = fields.findIndex((f) => f.id === id);
  if (idx === -1) return { error: "Field not found." };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= fields.length) return {};

  const a = fields[idx];
  const b = fields[swapIdx];

  await Promise.all([
    supabase
      .from("recruitment_fields")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id),
    supabase
      .from("recruitment_fields")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id),
  ]);

  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

// ── Admin: resource CRUD ──────────────────────────────────────────────────────

export type ResourceInput = {
  id?: string;
  field_id: string;
  subfolder_id?: string | null;
  title: string;
  description?: string;
  resource_type: "file" | "link";
  file_path?: string | null;
  file_mime?: string | null;
  external_url?: string | null;
  sort_order?: number;
};

export async function upsertResource(
  input: ResourceInput
): Promise<{ error?: string; success?: boolean }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const row = {
    field_id: input.field_id,
    subfolder_id: input.subfolder_id ?? null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    resource_type: input.resource_type,
    file_path: input.file_path ?? null,
    file_mime: input.file_mime ?? null,
    external_url: input.external_url?.trim() || null,
    sort_order: input.sort_order ?? 0,
    created_by: member.auth_user_id,
  };

  const supabase = createAdminClient();
  const { error } = input.id
    ? await supabase
        .from("recruitment_resources")
        .update(row)
        .eq("id", input.id)
    : await supabase.from("recruitment_resources").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return { success: true };
}

export async function deleteResource(
  id: string
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();

  // Fetch the resource to find any stored file to clean up.
  const { data: resource } = await supabase
    .from("recruitment_resources")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  if (resource?.file_path) {
    await supabase.storage.from(BUCKET).remove([resource.file_path]);
  }

  const { error } = await supabase
    .from("recruitment_resources")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function moveResource(
  id: string,
  direction: "up" | "down"
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();

  // Get the field_id first so we only reorder within the same field.
  const { data: resource } = await supabase
    .from("recruitment_resources")
    .select("id, field_id, sort_order")
    .eq("id", id)
    .maybeSingle();

  if (!resource) return { error: "Resource not found." };

  const { data: siblings } = await supabase
    .from("recruitment_resources")
    .select("id, sort_order")
    .eq("field_id", resource.field_id)
    .order("sort_order");

  if (!siblings) return {};

  const idx = siblings.findIndex((r) => r.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return {};

  const a = siblings[idx];
  const b = siblings[swapIdx];

  await Promise.all([
    supabase
      .from("recruitment_resources")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id),
    supabase
      .from("recruitment_resources")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id),
  ]);

  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

// ── Admin: subfolder CRUD ─────────────────────────────────────────────────────

export type SubfolderInput = {
  id?: string;
  field_id: string;
  parent_id?: string | null;
  name: string;
  sort_order?: number;
};

export async function upsertSubfolder(
  input: SubfolderInput
): Promise<{ error?: string; id?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();

  if (input.id) {
    const { error } = await supabase
      .from("recruitment_subfolders")
      .update({ name: input.name.trim(), sort_order: input.sort_order ?? 0 })
      .eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePath("/recruitment");
    revalidatePath("/admin/recruitment");
    return {};
  } else {
    const { data, error } = await supabase
      .from("recruitment_subfolders")
      .insert({
        field_id: input.field_id,
        parent_id: input.parent_id ?? null,
        name: input.name.trim(),
        sort_order: input.sort_order ?? 0,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/recruitment");
    revalidatePath("/admin/recruitment");
    return { id: data.id };
  }
}

export async function deleteSubfolder(
  id: string
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  // ON DELETE SET NULL on subfolder_id means resources survive, unlinked
  const { error } = await createAdminClient()
    .from("recruitment_subfolders")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function moveSubfolder(
  id: string,
  direction: "up" | "down"
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role !== "admin") return { error: "admin_required" };

  const supabase = createAdminClient();

  const { data: subfolder } = await supabase
    .from("recruitment_subfolders")
    .select("id, field_id, parent_id, sort_order")
    .eq("id", id)
    .maybeSingle();

  if (!subfolder) return { error: "Subfolder not found." };
  if (subfolder.id === undefined) return { error: "Subfolder not found." };

  // Scope siblings to same parent level
  const baseQuery = supabase
    .from("recruitment_subfolders")
    .select("id, sort_order")
    .eq("field_id", subfolder.field_id)
    .order("sort_order");

  const { data: siblings } = await (
    subfolder.parent_id
      ? baseQuery.eq("parent_id", subfolder.parent_id)
      : baseQuery.is("parent_id", null)
  );

  if (!siblings) return {};

  const idx = siblings.findIndex((s) => s.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return {};

  const a = siblings[idx];
  const b = siblings[swapIdx];

  await Promise.all([
    supabase
      .from("recruitment_subfolders")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id),
    supabase
      .from("recruitment_subfolders")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id),
  ]);

  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

// ── Member: field proposals ───────────────────────────────────────────────────

export async function proposeMemberField(
  input: FieldProposalInput
): Promise<{ error?: string; id?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const row = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase().replace(/\s+/g, "-"),
    description: input.description?.trim() || null,
    icon: input.icon?.trim() || null,
    sort_order: 0,
    is_published: false,
    status: "pending",
    proposed_by: member.auth_user_id,
  };

  const { data, error } = await createAdminClient()
    .from("recruitment_fields")
    .insert(row)
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return { id: data.id };
}

export async function updateMemberFieldProposal(
  id: string,
  input: FieldProposalInput
): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();
  const { data: field } = await supabase
    .from("recruitment_fields")
    .select("proposed_by, status")
    .eq("id", id)
    .maybeSingle();

  if (!field) return { error: "Not found." };
  if (field.proposed_by !== member.auth_user_id) return { error: "not_authorized" };
  if (field.status !== "pending") return { error: "Cannot edit a field that is no longer pending." };

  const { error } = await supabase
    .from("recruitment_fields")
    .update({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      description: input.description?.trim() || null,
      icon: input.icon?.trim() || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  return {};
}

export async function deleteMemberFieldProposal(id: string): Promise<{ error?: string }> {
  const member = await getCurrentMember();
  if (!member || member.role === "alumni") return { error: "not_authorized" };

  const supabase = createAdminClient();
  const { data: field } = await supabase
    .from("recruitment_fields")
    .select("proposed_by, status")
    .eq("id", id)
    .maybeSingle();

  if (!field) return { error: "Not found." };
  if (field.proposed_by !== member.auth_user_id) return { error: "not_authorized" };
  if (field.status === "live") return { error: "Cannot delete a live field." };

  const { error } = await supabase.from("recruitment_fields").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/recruitment");
  revalidatePath("/admin/recruitment");
  return {};
}

export async function getMemberSubmissions(): Promise<MemberSubmissions> {
  const member = await getCurrentMember();
  if (!member) return { fieldProposals: [], batches: [] };

  const supabase = createAdminClient();

  const { data: proposals } = await supabase
    .from("recruitment_fields")
    .select("*")
    .eq("proposed_by", member.auth_user_id)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false });

  const { data: batches } = await supabase
    .from("recruitment_batches")
    .select(
      `*, recruitment_resources (
        id, field_id, subfolder_id, title, description, resource_type,
        file_path, file_mime, external_url, sort_order, batch_id, status
      ), recruitment_subfolders (
        id, field_id, parent_id, name, sort_order, batch_id, status
      )`
    )
    .eq("submitted_by", member.auth_user_id)
    .not("status", "eq", "approved")
    .order("created_at", { ascending: false });

  return {
    fieldProposals: (proposals ?? []) as RecruitmentField[],
    batches: (batches ?? []) as BatchWithItems[],
  };
}
