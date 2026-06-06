-- ============================================================
-- AKPD · Migration 003 — Recruitment fields + resources + storage
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (all DDL uses IF NOT EXISTS / OR REPLACE / IF EXISTS
-- and all INSERTs use ON CONFLICT DO NOTHING).
-- ============================================================

-- ── 1. Tables ───────────────────────────────────────────────

create table if not exists public.recruitment_fields (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  slug         text        unique not null,
  description  text,
  icon         text,                    -- emoji or icon key
  sort_order   int         not null default 0,
  is_published boolean     not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.recruitment_resources (
  id            uuid        primary key default gen_random_uuid(),
  field_id      uuid        not null
                              references public.recruitment_fields(id)
                              on delete cascade,
  title         text        not null,
  description   text,
  resource_type text        not null
                              check (resource_type in ('file', 'link')),
  file_path     text,        -- storage object path, used when resource_type = 'file'
  file_mime     text,        -- e.g. 'application/pdf' — drives icon selection
  external_url  text,        -- used when resource_type = 'link'
  sort_order    int         not null default 0,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint chk_resource_type_fields check (
    (resource_type = 'file' and file_path    is not null) or
    (resource_type = 'link' and external_url is not null)
  )
);

-- ── 2. Indexes ───────────────────────────────────────────────

create index if not exists idx_recruitment_resources_field_id
  on public.recruitment_resources(field_id);

create index if not exists idx_recruitment_fields_sort_order
  on public.recruitment_fields(sort_order);

-- ── 3. RLS — recruitment_fields ─────────────────────────────

alter table public.recruitment_fields enable row level security;

drop policy if exists "members can read recruitment fields"   on public.recruitment_fields;
drop policy if exists "admins can insert recruitment fields"  on public.recruitment_fields;
drop policy if exists "admins can update recruitment fields"  on public.recruitment_fields;
drop policy if exists "admins can delete recruitment fields"  on public.recruitment_fields;

create policy "members can read recruitment fields"
  on public.recruitment_fields for select
  using (public.is_member());

create policy "admins can insert recruitment fields"
  on public.recruitment_fields for insert
  with check (public.is_admin());

create policy "admins can update recruitment fields"
  on public.recruitment_fields for update
  using  (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete recruitment fields"
  on public.recruitment_fields for delete
  using (public.is_admin());

-- ── 4. RLS — recruitment_resources ──────────────────────────

alter table public.recruitment_resources enable row level security;

drop policy if exists "members can read recruitment resources"   on public.recruitment_resources;
drop policy if exists "admins can insert recruitment resources"  on public.recruitment_resources;
drop policy if exists "admins can update recruitment resources"  on public.recruitment_resources;
drop policy if exists "admins can delete recruitment resources"  on public.recruitment_resources;

create policy "members can read recruitment resources"
  on public.recruitment_resources for select
  using (public.is_member());

create policy "admins can insert recruitment resources"
  on public.recruitment_resources for insert
  with check (public.is_admin());

create policy "admins can update recruitment resources"
  on public.recruitment_resources for update
  using  (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete recruitment resources"
  on public.recruitment_resources for delete
  using (public.is_admin());

-- ── 5. Private storage bucket ────────────────────────────────
-- Creates the bucket if it does not exist.
-- public = false → all objects are private; access requires a signed URL.
-- file_size_limit = 52428800 (50 MB) — keeps large videos out; add them as links.

insert into storage.buckets (id, name, public, file_size_limit)
values ('recruitment-resources', 'recruitment-resources', false, 52428800)
on conflict (id) do nothing;

-- ── 6. Storage policies ──────────────────────────────────────
-- Mirror the same member/admin split used on the data tables.
-- is_member() / is_admin() already exist from migration 001.

-- Remove old policies if this script is re-run
drop policy if exists "members can read recruitment storage"   on storage.objects;
drop policy if exists "admins can upload recruitment files"    on storage.objects;
drop policy if exists "admins can update recruitment files"    on storage.objects;
drop policy if exists "admins can delete recruitment files"    on storage.objects;

-- Authenticated members can SELECT (list objects, generate signed URLs).
create policy "members can read recruitment storage"
  on storage.objects for select
  using (
    bucket_id = 'recruitment-resources'
    and public.is_member()
  );

-- Only admins can INSERT (upload).
create policy "admins can upload recruitment files"
  on storage.objects for insert
  with check (
    bucket_id = 'recruitment-resources'
    and public.is_admin()
  );

-- Only admins can UPDATE object metadata.
create policy "admins can update recruitment files"
  on storage.objects for update
  using (
    bucket_id = 'recruitment-resources'
    and public.is_admin()
  );

-- Only admins can DELETE objects.
create policy "admins can delete recruitment files"
  on storage.objects for delete
  using (
    bucket_id = 'recruitment-resources'
    and public.is_admin()
  );

-- ── 7. Seed: bootstrap fields from the existing tracks list ──
-- Admins will fill in resources later.  All marked published.
-- ON CONFLICT DO NOTHING — safe to re-run.

insert into public.recruitment_fields (name, slug, description, icon, sort_order)
values
  ('Investment Banking',      'investment-banking',  'M&A advisory, capital markets, and corporate finance. Bulge bracket, elite boutique, and middle market.',                                                      '🏦', 10),
  ('Management Consulting',   'consulting',          'Strategy, operations, and transformation work across MBB, Big 4, and boutique advisory firms.',                                                                '📊', 20),
  ('Sales & Trading',         'sales-trading',       'Equities, fixed income, FX, and derivatives desks at bulge brackets and prop trading shops.',                                                                  '📈', 30),
  ('Asset Management',        'asset-management',    'Long-only funds, hedge funds, and multi-asset platforms. Fundamental and quantitative strategies.',                                                             '💰', 40),
  ('Private Equity',          'private-equity',      'LBO, growth equity, and venture. Typically recruited post-IB, but some direct undergrad paths exist.',                                                         '🏢', 50),
  ('Software Engineering',    'software-engineering','Full-stack, backend, infrastructure, and ML engineering roles across tech, fintech, and finance.',                                                              '💻', 60),
  ('Product Management',      'product-management',  'Defining and shipping products at tech companies, fintech startups, and large financial institutions.',                                                         '🗂️', 70),
  ('Accounting & Audit',      'accounting',          'Public accounting, Big 4 audit/tax/advisory, and corporate finance & accounting roles.',                                                                        '📑', 80),
  ('Corporate Finance / FP&A','corporate-finance',   'Internal finance roles at corporations — FP&A, treasury, strategy, and rotational programs.',                                                                  '📋', 90),
  ('Real Estate',             'real-estate',         'REPE, REITs, brokerage, and real estate investment management and development tracks.',                                                                         '🏗️',100),
  ('Marketing',               'marketing',           'Brand, growth, product marketing, and digital roles at consumer, B2B, and tech companies.',                                                                    '📣',110)
on conflict (slug) do nothing;

-- ── Done ─────────────────────────────────────────────────────
-- Next steps:
--   • Step 2 → signed-URL download server action (src/lib/actions/recruitment.ts)
--   • Step 3 → /recruitment page
--   • Steps 4-5 → /admin/recruitment management UI
