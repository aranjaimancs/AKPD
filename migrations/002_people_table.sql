-- ============================================================
-- AKPD · Migration 002 — people table (Alumni Network Map)
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (IF NOT EXISTS throughout).
-- Depends on: 001_members_rls.sql (is_member / is_admin functions)
-- ============================================================

-- ── 1. Table ────────────────────────────────────────────────
-- Intentionally separate from auth.users / profiles so alumni
-- without portal accounts can still appear on the map.

create table if not exists public.people (
  id             uuid primary key default gen_random_uuid(),

  -- Identity
  full_name      text not null,
  headshot_url   text,
  bio            text,
  pledge_class   text,
  grad_year      int,
  major          text,
  linkedin_url   text,

  -- Map-page fields
  member_type    text not null default 'current'
                   check (member_type in ('alumni', 'current')),
  title          text,       -- job title / role
  company        text,
  industry       text,       -- track for filtering, e.g. 'Investment Banking', 'SWE'

  -- Location (geocoded from location_label on admin save)
  location_label text,       -- human-readable, e.g. "Charlotte, NC"
  latitude       double precision,   -- null = no pin; person still shows in list
  longitude      double precision,

  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

-- ── 2. Auto-update updated_at ────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_people_updated_at on public.people;
create trigger trg_people_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();

-- ── 3. RLS ──────────────────────────────────────────────────
alter table public.people enable row level security;

drop policy if exists "members can read people"    on public.people;
drop policy if exists "admins can insert people"   on public.people;
drop policy if exists "admins can update people"   on public.people;
drop policy if exists "admins can delete people"   on public.people;

create policy "members can read people"
  on public.people for select
  using (public.is_member());

create policy "admins can insert people"
  on public.people for insert
  with check (public.is_admin());

create policy "admins can update people"
  on public.people for update
  using  (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete people"
  on public.people for delete
  using (public.is_admin());

-- ── 4. Sample rows (edit / delete freely) ───────────────────
-- A handful of placeholder pins so the map has something to
-- show before you've entered real alumni data. Remove any time.

insert into public.people
  (full_name, member_type, title, company, industry, location_label, latitude, longitude, grad_year)
values
  ('Chapel Hill (HQ)',  'current', 'Student',          'UNC Chapel Hill', 'University',       'Chapel Hill, NC',     35.9132, -79.0558, 2025),
  ('Sample Alum — NYC', 'alumni',  'Analyst',           'Goldman Sachs',   'Investment Banking','New York, NY',       40.7128, -74.0060, 2023),
  ('Sample Alum — DC',  'alumni',  'Consultant',        'McKinsey & Co.',  'Consulting',       'Washington, DC',     38.9072, -77.0369, 2022),
  ('Sample Alum — SF',  'alumni',  'Software Engineer', 'Google',          'Software Engineering','San Francisco, CA',37.7749,-122.4194, 2021),
  ('Sample Alum — CHI', 'alumni',  'Associate',         'JP Morgan',       'Investment Banking','Chicago, IL',        41.8781, -87.6298, 2022),
  ('Sample Alum — ATL', 'alumni',  'Analyst',           'Deloitte',        'Consulting',       'Atlanta, GA',        33.7490, -84.3880, 2023),
  ('Sample Alum — CLT', 'alumni',  'Financial Analyst', 'Bank of America', 'Corporate Finance','Charlotte, NC',      35.2271, -80.8431, 2024),
  ('Sample Alum — RDU', 'alumni',  'PM',                'Red Hat',         'Product Management','Raleigh, NC',       35.7796, -78.6382, 2023)
on conflict do nothing;
