-- ============================================================
-- AKPD · Migration 009 — add email column to people table
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).
--
-- Why: allows admin-added people rows to be matched by email
-- when a member first signs in, so their profile picture and
-- location sync correctly to their existing map pin instead of
-- creating a duplicate row.
-- ============================================================

alter table public.people
  add column if not exists email text;

-- Optional index for the fallback lookup in profile/onboarding actions.
create index if not exists people_email_idx
  on public.people (lower(email));
