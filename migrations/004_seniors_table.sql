-- ============================================================
-- AKPD · Migration 004 — seniors table + RLS + storage bucket
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE / IF EXISTS).
-- ============================================================

-- ── 1. seniors table ─────────────────────────────────────────

create table if not exists public.seniors (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,        -- url-safe name, e.g. "jane-smith"
  name                text not null,
  headshot_url        text,                        -- Supabase Storage public URL
  hometown            text,
  majors              text[] not null default '{}',
  minors              text[] not null default '{}',
  pledge_class        text not null default '',
  grad_year           int not null,
  destination_title   text not null default '',
  destination_company text not null default '',
  tags                text[] not null default '{}',
  summary             text not null default '',
  timeline            jsonb not null default '[]', -- [{term: string, highlights: string[]}]
  programs            text[] not null default '{}',
  recruiting          text[] not null default '{}',
  advice              text[] not null default '{}',
  flags               text[] not null default '{}',
  linkedin_url        text,
  email               text,
  website             text,
  visible             boolean not null default true,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);

-- auto-update updated_at on every write
create or replace function public.set_seniors_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_seniors_updated_at on public.seniors;
create trigger trg_seniors_updated_at
  before update on public.seniors
  for each row execute function public.set_seniors_updated_at();

-- ── 2. RLS ───────────────────────────────────────────────────
-- The /seniors page is publicly accessible (no login required),
-- so visible seniors are readable by anyone including anon.
-- Only admins can write.

alter table public.seniors enable row level security;

drop policy if exists "public can read visible seniors" on public.seniors;
drop policy if exists "admins can insert seniors"       on public.seniors;
drop policy if exists "admins can update seniors"       on public.seniors;
drop policy if exists "admins can delete seniors"       on public.seniors;

create policy "public can read visible seniors"
  on public.seniors for select
  using (visible = true);

create policy "admins can insert seniors"
  on public.seniors for insert
  with check (public.is_admin());

create policy "admins can update seniors"
  on public.seniors for update
  using  (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete seniors"
  on public.seniors for delete
  using (public.is_admin());

-- ── 3. Storage bucket — senior-headshots ─────────────────────
-- Public bucket: images served without signed URLs.
-- Admins upload/delete; anyone can read (same as the seniors page).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'senior-headshots',
  'senior-headshots',
  true,
  5242880,   -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "admins can upload senior headshots" on storage.objects;
drop policy if exists "admins can update senior headshots" on storage.objects;
drop policy if exists "admins can delete senior headshots" on storage.objects;

create policy "admins can upload senior headshots"
  on storage.objects for insert
  with check (
    bucket_id = 'senior-headshots'
    and public.is_admin()
  );

create policy "admins can update senior headshots"
  on storage.objects for update
  using (
    bucket_id = 'senior-headshots'
    and public.is_admin()
  );

create policy "admins can delete senior headshots"
  on storage.objects for delete
  using (
    bucket_id = 'senior-headshots'
    and public.is_admin()
  );

-- ── 4. Migrate existing file-based seniors (if any) ──────────
-- If you have profiles in content/seniors/ already, insert them
-- here before removing the old files. Example for one senior:
--
-- insert into public.seniors (
--   slug, name, headshot_url, pledge_class, grad_year,
--   destination_title, destination_company, tags, summary,
--   majors, minors, timeline, programs, recruiting, advice
-- ) values (
--   'jane-smith', 'Jane Smith', null, 'Alpha', 2026,
--   'Incoming Analyst', 'Goldman Sachs', array['Finance','IB'],
--   'Jane is a Finance major...', array['Finance'], array[]::text[],
--   '[]'::jsonb, array[]::text[], array[]::text[], array[]::text[]
-- ) on conflict (slug) do nothing;

-- ── Done ─────────────────────────────────────────────────────
