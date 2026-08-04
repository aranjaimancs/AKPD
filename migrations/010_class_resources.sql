-- ============================================================
-- AKPD · Migration 010 — class_resources table
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).
-- ============================================================

create table if not exists public.class_resources (
  id               uuid primary key default gen_random_uuid(),
  course_code      text not null,
  course_name      text not null,
  department       text not null,
  title            text not null,
  description      text,
  resource_type    text not null check (resource_type in ('file', 'link')),
  file_path        text,
  file_mime        text,
  file_size        bigint,
  external_url     text,
  uploaded_by      uuid not null references auth.users(id) on delete cascade,
  uploaded_by_name text not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Row-level security
alter table public.class_resources enable row level security;

-- Authenticated users can read all active resources
create policy "Authenticated users can read active class resources"
  on public.class_resources for select
  to authenticated
  using (is_active = true);

-- Members can insert their own resources
create policy "Members can insert class resources"
  on public.class_resources for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

-- Members can soft-delete their own resources (set is_active = false)
-- Admins are handled via the service-role admin client in the app
create policy "Members can deactivate own class resources"
  on public.class_resources for update
  to authenticated
  using (auth.uid() = uploaded_by);

-- ============================================================
-- Storage bucket: class-resources (private — signed URLs only)
-- Run these after the table migration.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('class-resources', 'class-resources', false, 52428800)  -- 50 MB
on conflict (id) do nothing;

-- Authenticated users can read (download via signed URL)
create policy "Authenticated can read class-resources"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'class-resources');

-- Authenticated users can upload
create policy "Authenticated can upload class-resources"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'class-resources');

-- Authenticated users can delete their own uploads
create policy "Authenticated can delete own class-resources"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'class-resources');
