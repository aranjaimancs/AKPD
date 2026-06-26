-- ============================================================
-- AKPD · Migration 005 — alumni role + opportunity audience
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run.
-- ============================================================

-- ── 1. Add 'alumni' as a valid member role ────────────────────
-- PostgreSQL auto-names inline CHECK constraints as <table>_<col>_check.
-- We drop it by that name and replace it with the expanded version.

alter table public.members
  drop constraint if exists members_role_check;

alter table public.members
  add constraint members_role_check
  check (role in ('admin', 'member', 'alumni'));

-- ── 2. Add audience column to opportunities ───────────────────
-- 'all'      → visible to everyone (students + alumni)
-- 'students' → visible to current members only
-- 'alumni'   → visible to alumni only
-- Admins always see everything.

alter table public.opportunities
  add column if not exists audience text not null default 'all'
  check (audience in ('all', 'students', 'alumni'));

-- ── Done ─────────────────────────────────────────────────────
