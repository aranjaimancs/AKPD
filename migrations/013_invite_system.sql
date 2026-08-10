-- ============================================================
-- AKPD · Migration 013 — Invite system
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (IF NOT EXISTS guards throughout)
-- ============================================================

-- ── 1. invite_links ─────────────────────────────────────────

create table if not exists public.invite_links (
  id          uuid        primary key default gen_random_uuid(),
  token       uuid        not null unique default gen_random_uuid(),
  created_by  uuid        references auth.users(id) on delete set null,
  expires_at  timestamptz not null,
  is_active   bool        not null default true,
  created_at  timestamptz not null default now()
);

-- ── 2. invite_requests ──────────────────────────────────────

create table if not exists public.invite_requests (
  id          uuid        primary key default gen_random_uuid(),
  link_id     uuid        references public.invite_links(id) on delete cascade,
  full_name   text        not null,
  email       text        not null,
  role        text        not null check (role in ('member', 'alumni')),
  position    text,
  status      text        not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now()
);

create unique index if not exists invite_requests_email_unique
  on public.invite_requests(lower(email));

create index if not exists idx_invite_requests_link_id
  on public.invite_requests(link_id);

create index if not exists idx_invite_requests_status
  on public.invite_requests(status);

-- ── 3. RLS ──────────────────────────────────────────────────
-- Both tables are accessed exclusively via createAdminClient()
-- server-side. RLS is enabled as a safety net with no user
-- policies — no authenticated user can query these tables
-- directly from the browser.

alter table public.invite_links    enable row level security;
alter table public.invite_requests enable row level security;
