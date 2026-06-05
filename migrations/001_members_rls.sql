-- ============================================================
-- AKPD · Migration 001 — members table + role helpers + RLS
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE / IF EXISTS).
-- ============================================================

-- ── 1. members allowlist ────────────────────────────────────

create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  email        text unique not null,          -- always lowercase
  full_name    text,
  position     text,                          -- e.g. 'Professional Development', 'President'
  role         text not null default 'member'
                 check (role in ('admin', 'member')),
  auth_user_id uuid references auth.users(id) -- linked on first successful sign-in
                 on delete set null,
  created_at   timestamptz default now() not null
);

-- Normalise email to lowercase on every insert/update
create or replace function public.normalize_member_email()
returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists trg_normalize_member_email on public.members;
create trigger trg_normalize_member_email
  before insert or update on public.members
  for each row execute function public.normalize_member_email();

-- ── 2. Seed first admin ─────────────────────────────────────
-- Replace these values with your real details before running.
-- After you sign in once via Google the auth_user_id column
-- will be filled in automatically by the auth callback.
--
-- To add more admins or plain members later just insert more rows,
-- or use the /admin/members UI once it's built.

insert into public.members (email, full_name, position, role)
values
  ('aranjaiman@gmail.com', 'Aran Jaiman',   'President',                  'admin')
on conflict (email) do nothing;

-- Placeholder admin seats — update emails when you know them:
-- insert into public.members (email, full_name, position, role) values
--   ('pd-chair@unc.edu',  'PD Chair Name',  'Professional Development', 'admin'),
--   ('vp-admin@unc.edu',  'VP Admin Name',  'VP Admin',                 'admin'),
--   ('vp-out@unc.edu',    'VP Out Name',    'VP Outreach',              'admin');

-- ── 3. Role helper functions ────────────────────────────────
-- These are SECURITY DEFINER so they can read the members table
-- without triggering RLS recursion. They are called inside
-- RLS policies on every other table.

-- Returns the caller's role ('admin', 'member') or NULL if not in members.
create or replace function public.current_member_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from   public.members
  where  email = lower(auth.jwt() ->> 'email')
  limit  1;
$$;

-- TRUE if the caller is an admin.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_member_role() = 'admin';
$$;

-- TRUE if the caller exists in members at all (any role).
create or replace function public.is_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_member_role() is not null;
$$;

-- ── 4. RLS — members table ──────────────────────────────────

alter table public.members enable row level security;

-- Drop old policies if they exist so re-runs are safe
drop policy if exists "members can read members"    on public.members;
drop policy if exists "admins can insert members"   on public.members;
drop policy if exists "admins can update members"   on public.members;
drop policy if exists "admins can delete members"   on public.members;

create policy "members can read members"
  on public.members for select
  using (public.is_member());

create policy "admins can insert members"
  on public.members for insert
  with check (public.is_admin());

create policy "admins can update members"
  on public.members for update
  using  (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete members"
  on public.members for delete
  using (public.is_admin());

-- ── 5. RLS — opportunities table ────────────────────────────
-- Drop the previous per-user policies from supabase-opportunities.sql
-- and replace with the member/admin split.

alter table public.opportunities enable row level security;

drop policy if exists "members_select"  on public.opportunities;
drop policy if exists "members_insert"  on public.opportunities;
drop policy if exists "poster_update"   on public.opportunities;
drop policy if exists "poster_delete"   on public.opportunities;

create policy "members can read opportunities"
  on public.opportunities for select
  using (public.is_member());

-- Any authenticated member may post their own opportunity.
-- If you want admin-only posting, change is_member() → is_admin().
create policy "members can insert opportunities"
  on public.opportunities for insert
  with check (public.is_member() and auth.uid() = posted_by);

-- Only the poster or an admin can update their own listing.
create policy "poster or admin can update opportunities"
  on public.opportunities for update
  using  (auth.uid() = posted_by or public.is_admin())
  with check (auth.uid() = posted_by or public.is_admin());

-- Only the poster or an admin can delete.
create policy "poster or admin can delete opportunities"
  on public.opportunities for delete
  using (auth.uid() = posted_by or public.is_admin());

-- ── 6. RLS — profiles table ─────────────────────────────────
-- Any member can read all profiles (needed for People page).
-- Each user writes only their own row; admins can write any.

alter table public.profiles enable row level security;

drop policy if exists "users_select_own"  on public.profiles;
drop policy if exists "users_insert_own"  on public.profiles;
drop policy if exists "users_update_own"  on public.profiles;

create policy "members can read all profiles"
  on public.profiles for select
  using (public.is_member());

create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id and public.is_member());

create policy "users can update own profile"
  on public.profiles for update
  using  (auth.uid() = id and public.is_member())
  with check (auth.uid() = id and public.is_member());

create policy "admins can update any profile"
  on public.profiles for update
  using  (public.is_admin())
  with check (public.is_admin());

-- ── 7. (Optional) Migrate old allowed_emails rows ───────────
-- If you already have rows in allowed_emails from the previous
-- setup, uncomment to copy them into members before dropping.
--
-- insert into public.members (email, role)
-- select lower(email), role
-- from   public.allowed_emails
-- on conflict (email) do nothing;
--
-- drop table if exists public.allowed_emails;

-- ── Done ─────────────────────────────────────────────────────
-- Next steps (done for you in code, just run this SQL):
--   • Step 3 → Google OAuth config + callback route
--   • Step 4 → getCurrentMember() util + gate logic
