-- ============================================================
-- AKPD · Migration 007 — opportunities approval workflow
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).
--
-- Why: members can now submit opportunities for review; admins
-- must approve before they appear on the board.
-- ============================================================

alter table public.opportunities
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

-- Grandfather in all previously-active posts as approved
-- (they were posted before moderation existed).
update public.opportunities
  set status = 'approved'
  where is_active = true and status = 'pending';
