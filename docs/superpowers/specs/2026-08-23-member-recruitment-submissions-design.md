# Member Recruitment Submissions — Design Spec

**Date:** 2026-08-23  
**Status:** Approved  
**Scope:** Allow any active member (non-alumni) to propose recruitment fields and contribute resource batches, both subject to admin approval before going live.

---

## Problem

Admins are the sole gatekeepers for all recruitment content. Brothers cannot contribute their own materials (resume guides, interview decks, links) without an admin manually adding everything. This creates a bottleneck and means useful brother-contributed content never makes it to the page.

## Goal

Any member can:
1. Propose a new recruitment field (e.g. "Restructuring") → admin approves
2. Add files, links, and folders to any live field as a batch → admin approves the batch before it goes live

---

## Data Model

**Migration:** `014_member_recruitment_submissions.sql`

### `recruitment_fields` — 2 new columns

| Column | Type | Notes |
|--------|------|-------|
| `status` | `text not null default 'live'` | `'live' \| 'pending' \| 'rejected'`. Existing rows backfilled to `'live'`. |
| `proposed_by` | `uuid references auth.users(id)` | Nullable. Null for admin-created fields. |

Check constraint: `status in ('live', 'pending', 'rejected')`

### New `recruitment_batches` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid pk` | |
| `field_id` | `uuid not null → recruitment_fields(id) on delete cascade` | |
| `submitted_by` | `uuid not null → auth.users(id) on delete cascade` | auth user id |
| `submitted_by_name` | `text not null` | Denormalized for display without extra joins |
| `status` | `text not null default 'draft'` | `'draft' \| 'pending_review' \| 'approved' \| 'rejected'` |
| `rejection_reason` | `text` | Nullable. Set on rejection. |
| `reviewed_at` | `timestamptz` | Nullable. |
| `created_at` | `timestamptz not null default now()` | |

Check constraint: `status in ('draft', 'pending_review', 'approved', 'rejected')`

### `recruitment_resources` — 2 new columns

| Column | Type | Notes |
|--------|------|-------|
| `batch_id` | `uuid → recruitment_batches(id) on delete cascade` | Nullable. Null for admin-added resources. |
| `status` | `text not null default 'live'` | `'live' \| 'pending' \| 'rejected'`. Existing rows backfilled to `'live'`. |

### `recruitment_subfolders` — same 2 new columns

Same `batch_id` and `status` columns as resources.

### RLS / Authorization Strategy

**No RLS policy changes.** All server actions continue to use `createAdminClient()` (service role, bypasses RLS) and perform authorization checks in application code via `getCurrentMember()`. The pattern:

- Admin actions: `if (member.role !== 'admin') return { error: 'admin_required' }`
- Member actions: `if (!member || member.role === 'alumni') return { error: 'not_authorized' }`
- Ownership checks: verify `submitted_by === member.auth_user_id` before allowing edits/deletes on pending content

### Filtering

The `/recruitment` page query gains explicit status filters:
- Fields: `.eq("status", "live")` alongside existing `.eq("is_published", true)`
- Resources: `.eq("status", "live")`  
- Subfolders: `.eq("status", "live")`

Member's own pending content is fetched in a separate query and passed separately to the client.

---

## Member-Facing UI

### Propose a Field

- A **"Propose a Field"** button appears in the `/recruitment` page header (hidden from alumni)
- Opens a modal: name, slug (auto-derived), description, icon emoji
- On submit → `recruitment_fields` row with `status='pending'`, `proposed_by=auth_user_id`
- The member's pending proposals appear below the live field list with:
  - Gold "Pending Review" badge
  - Edit button (opens same modal pre-filled)
  - Cancel button (deletes the proposal)
- On admin approval → field appears in the live list; proposal section clears
- On rejection → proposal shows "Rejected" state; member can delete it

### Contribute Resources to a Live Field

- A **"Contribute"** button appears on each live field accordion header (hidden from alumni)
- Clicking it opens a **Batch Editor modal**:
  - If a `draft` batch already exists for this member + field, it opens that batch
  - Otherwise, a new draft batch is created automatically
  - Inside: same file upload, link, and folder upload UX as the admin `ResourceModal` + `FolderUploadModal` — but saves go into the batch with `status='pending'`
  - All items in the batch are listed with individual delete controls (member can remove items before submitting)
  - **"Submit for Review"** button (disabled if batch is empty) → `status → 'pending_review'`, locks the batch
  - Locked batch shows **"Withdraw"** button → pulls it back to `'draft'` for further editing

### Status Visibility

The "Contribute" button on each live field reflects the member's current batch state:
- No batch → "Contribute"
- Draft batch → "Draft · N items"
- Pending review → "Under Review"
- Approved → "Approved ✓" (clears after a few seconds / next page load)
- Rejected → "See Feedback" (opens a read-only view of the rejection reason)

Member's own pending field proposals are shown below live fields in a collapsible "Your Proposals" section.

### Access Constraints

- Alumni see no contribution UI anywhere (same redirect/role check pattern as today)
- Members cannot edit or delete live (admin-approved) resources
- Members can only edit/delete their own pending content

---

## Admin-Facing UI

### Pending Review Section (`/admin/recruitment`)

A **"Pending"** count badge appears in the page header when there is work to review. The pending section appears above the existing field list and has two subsections:

#### Field Proposals

One card per pending field showing: proposer name, field name, description, icon, creation date.

Actions:
- **Approve** → `status = 'live'`, `is_published = true`. Field immediately appears on `/recruitment`.
- **Reject** → `status = 'rejected'`. No rejection reason required for fields (keeps it simple).

#### Resource Batches

One card per `pending_review` batch, grouped by field. Shows: submitter name, field name, item count, and an expandable list of all files/links/subfolders in the batch.

Actions:
- **Approve** → all resources and subfolders in batch set to `status = 'live'`, batch → `'approved'`. Content immediately appears on `/recruitment`.
- **Reject** → inline text input for rejection reason → batch → `'rejected'`, storage files for uploaded resources are deleted, rejection reason is stored and surfaced to the member.

### Existing Admin UI

Unchanged. All current CRUD (add field, add/edit/delete resource, subfolders, reorder, publish toggle) works exactly as today. Approved member content appears in the field cards like any other resource.

---

## New Server Actions (`src/lib/actions/recruitment.ts`)

### Member actions (any non-alumni member)

| Action | Description |
|--------|-------------|
| `proposeMemberField(input)` | Create pending field |
| `updateMemberFieldProposal(id, input)` | Edit own pending field |
| `deleteMemberFieldProposal(id)` | Cancel own pending field |
| `getOrCreateDraftBatch(fieldId)` | Get existing draft or create new one; returns batch id |
| `addResourceToBatch(batchId, resource)` | Add file or link to draft batch |
| `removeResourceFromBatch(resourceId)` | Remove own pending resource |
| `addSubfolderToBatch(batchId, input)` | Add subfolder to draft batch |
| `removeSubfolderFromBatch(subfolderId)` | Remove own pending subfolder |
| `submitBatchForReview(batchId)` | Draft → pending_review |
| `withdrawBatch(batchId)` | Pending_review → draft |
| `getMemberSubmissions()` | Fetch own field proposals + batches |
| `getSignedUploadUrl(filePath, batchId?)` | Extended to allow member uploads for their own draft batches |

### Admin actions (existing + new)

| Action | Description |
|--------|-------------|
| `approveFieldProposal(id)` | Pending field → live |
| `rejectFieldProposal(id)` | Pending field → rejected |
| `approveBatch(id)` | All batch resources/subfolders → live, batch → approved |
| `rejectBatch(id, reason)` | Batch → rejected, storage cleanup, reason stored |
| `getPendingSubmissions()` | All pending field proposals + pending_review batches |

---

## Files Changed

| File | Change |
|------|--------|
| `migrations/014_member_recruitment_submissions.sql` | New migration |
| `src/lib/actions/recruitment.ts` | Add all new member + admin actions; update `getSignedUploadUrl`; update type exports |
| `src/app/recruitment/page.tsx` | Add status filter to queries; load member's own submissions; pass to client |
| `src/app/recruitment/RecruitmentClient.tsx` | Add propose-field button, contribute button, status indicators, pending proposals section |
| `src/app/recruitment/ProposeFieldModal.tsx` | New — modal for members to propose a field |
| `src/app/recruitment/ContributeBatchEditor.tsx` | New — batch editor modal (add/remove resources, submit/withdraw) |
| `src/app/admin/recruitment/page.tsx` | Load pending data; pass pending count to client |
| `src/app/admin/recruitment/RecruitmentAdminClient.tsx` | Add pending section with field proposal cards and batch review cards |

---

## Non-Goals

- Members cannot reorder approved resources (admin controls sort order)
- Members cannot edit approved content after it goes live
- No email notifications for approval/rejection (out of scope; could be added later)
- No per-resource granularity in batch review — admin approves or rejects the whole batch
