-- ============================================================
-- AKPD · Migration 014 — Member recruitment submissions
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (IF NOT EXISTS / IF NOT EXISTS column guards).
-- ============================================================

-- ── 1. Add status + proposed_by to recruitment_fields ───────

alter table public.recruitment_fields
  add column if not exists status text not null default 'live',
  add column if not exists proposed_by uuid references auth.users(id) on delete set null;

-- Add check constraint (drop first so re-runs don't fail)
alter table public.recruitment_fields
  drop constraint if exists chk_recruitment_fields_status;

alter table public.recruitment_fields
  add constraint chk_recruitment_fields_status
  check (status in ('live', 'pending', 'rejected'));

-- Backfill all existing admin-created fields
update public.recruitment_fields set status = 'live' where status != 'pending' and status != 'rejected';

-- ── 2. Create recruitment_batches ────────────────────────────

create table if not exists public.recruitment_batches (
  id                uuid        primary key default gen_random_uuid(),
  field_id          uuid        not null
                                  references public.recruitment_fields(id) on delete cascade,
  submitted_by      uuid        not null references auth.users(id) on delete cascade,
  submitted_by_name text        not null,
  status            text        not null default 'draft'
                                  check (status in ('draft', 'pending_review', 'approved', 'rejected')),
  rejection_reason  text,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_recruitment_batches_field_id
  on public.recruitment_batches(field_id);
create index if not exists idx_recruitment_batches_submitted_by
  on public.recruitment_batches(submitted_by);

-- RLS (admin client bypasses, but set up for completeness)
alter table public.recruitment_batches enable row level security;

drop policy if exists "members can read own batches"    on public.recruitment_batches;
drop policy if exists "admins can read all batches"     on public.recruitment_batches;
drop policy if exists "members can insert own batches"  on public.recruitment_batches;
drop policy if exists "members can update own batches"  on public.recruitment_batches;

create policy "members can read own batches"
  on public.recruitment_batches for select
  using (public.is_member() and submitted_by = auth.uid());

create policy "admins can read all batches"
  on public.recruitment_batches for select
  using (public.is_admin());

create policy "members can insert own batches"
  on public.recruitment_batches for insert
  with check (public.is_member() and submitted_by = auth.uid());

create policy "members can update own batches"
  on public.recruitment_batches for update
  using (public.is_member() and submitted_by = auth.uid());

-- ── 3. Add batch_id + status to recruitment_resources ────────

alter table public.recruitment_resources
  add column if not exists batch_id uuid
    references public.recruitment_batches(id) on delete cascade,
  add column if not exists status text not null default 'live';

alter table public.recruitment_resources
  drop constraint if exists chk_recruitment_resources_status;

alter table public.recruitment_resources
  add constraint chk_recruitment_resources_status
  check (status in ('live', 'pending', 'rejected'));

-- Backfill: existing admin resources have no batch, mark live
update public.recruitment_resources set status = 'live' where batch_id is null;

create index if not exists idx_recruitment_resources_batch_id
  on public.recruitment_resources(batch_id);

-- ── 4. Add batch_id + status to recruitment_subfolders ───────

alter table public.recruitment_subfolders
  add column if not exists batch_id uuid
    references public.recruitment_batches(id) on delete cascade,
  add column if not exists status text not null default 'live';

alter table public.recruitment_subfolders
  drop constraint if exists chk_recruitment_subfolders_status;

alter table public.recruitment_subfolders
  add constraint chk_recruitment_subfolders_status
  check (status in ('live', 'pending', 'rejected'));

-- Backfill
update public.recruitment_subfolders set status = 'live' where batch_id is null;

create index if not exists idx_recruitment_subfolders_batch_id
  on public.recruitment_subfolders(batch_id);
