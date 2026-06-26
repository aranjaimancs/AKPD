-- ============================================================
-- AKPD · Migration 006 — add missing columns to profiles + people
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (ADD COLUMN IF NOT EXISTS throughout).
--
-- Why: the original supabase-profiles.sql schema predates the
-- location/interests/headline fields added to settings + onboarding.
-- The people table similarly predates auth_user_id linking and the
-- headline/interests fields used for map filtering.
-- ============================================================

-- ── 1. profiles table ────────────────────────────────────────

alter table public.profiles
  add column if not exists headline       text,
  add column if not exists location_label text,
  add column if not exists latitude       double precision,
  add column if not exists longitude      double precision,
  add column if not exists interests      text[];

-- ── 2. people table ──────────────────────────────────────────

-- Link to the auth user who "owns" this people row (set during onboarding
-- and settings saves so profile edits sync to the map pin).
alter table public.people
  add column if not exists auth_user_id uuid references auth.users(id)
    on delete set null,
  add column if not exists headline      text,
  add column if not exists interests     text[];

-- Index so the onboarding/settings sync lookup (eq auth_user_id) is fast.
create index if not exists people_auth_user_id_idx
  on public.people (auth_user_id);

-- ── Done ─────────────────────────────────────────────────────
