-- ============================================================
-- AKPD · Migration 011 — Recruitment subfolders
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (IF NOT EXISTS / IF NOT EXISTS column guard)
-- ============================================================

-- ── 1. New table ────────────────────────────────────────────

create table if not exists public.recruitment_subfolders (
  id         uuid        primary key default gen_random_uuid(),
  field_id   uuid        not null
               references public.recruitment_fields(id)
               on delete cascade,
  name       text        not null,
  sort_order int         not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_recruitment_subfolders_field_id
  on public.recruitment_subfolders(field_id);

-- ── 2. Add subfolder_id to resources ───────────────────────

alter table public.recruitment_resources
  add column if not exists subfolder_id uuid
  references public.recruitment_subfolders(id)
  on delete set null;

create index if not exists idx_recruitment_resources_subfolder_id
  on public.recruitment_resources(subfolder_id);

-- ── 3. RLS — recruitment_subfolders ────────────────────────

alter table public.recruitment_subfolders enable row level security;

drop policy if exists "members can read recruitment subfolders"  on public.recruitment_subfolders;
drop policy if exists "admins can insert recruitment subfolders" on public.recruitment_subfolders;
drop policy if exists "admins can update recruitment subfolders" on public.recruitment_subfolders;
drop policy if exists "admins can delete recruitment subfolders" on public.recruitment_subfolders;

create policy "members can read recruitment subfolders"
  on public.recruitment_subfolders for select
  using (public.is_member());

create policy "admins can insert recruitment subfolders"
  on public.recruitment_subfolders for insert
  with check (public.is_admin());

create policy "admins can update recruitment subfolders"
  on public.recruitment_subfolders for update
  using  (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete recruitment subfolders"
  on public.recruitment_subfolders for delete
  using (public.is_admin());

-- ── Done ────────────────────────────────────────────────────
