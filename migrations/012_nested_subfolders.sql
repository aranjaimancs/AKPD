-- ============================================================
-- AKPD · Migration 012 — Nested subfolders (parent_id)
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (ADD COLUMN IF NOT EXISTS)
-- ============================================================

alter table public.recruitment_subfolders
  add column if not exists parent_id uuid
  references public.recruitment_subfolders(id)
  on delete cascade;

create index if not exists idx_recruitment_subfolders_parent_id
  on public.recruitment_subfolders(parent_id);
