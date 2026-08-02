-- ============================================================
-- AKPD · Migration 008 — class_reviews table
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).
-- ============================================================

create table if not exists public.class_reviews (
  id               uuid primary key default gen_random_uuid(),
  course_code      text not null,
  course_name      text not null,
  department       text not null,
  professor        text not null,
  semester_taken   text not null,
  overall_rating   int  not null check (overall_rating   between 1 and 5),
  difficulty_rating int not null check (difficulty_rating between 1 and 5),
  workload         text not null check (workload in ('light', 'medium', 'heavy')),
  would_recommend  boolean not null,
  grade_received   text,
  focus_areas      text[] not null default '{}',
  review_text      text not null,
  posted_by        uuid not null references auth.users(id) on delete cascade,
  posted_by_name   text not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Row-level security
alter table public.class_reviews enable row level security;

-- Authenticated users can read all active reviews
create policy "Authenticated users can read active class reviews"
  on public.class_reviews for select
  to authenticated
  using (is_active = true);

-- Members can insert their own reviews
create policy "Members can insert class reviews"
  on public.class_reviews for insert
  to authenticated
  with check (auth.uid() = posted_by);

-- Members can soft-delete their own reviews (set is_active = false)
create policy "Members can deactivate own class reviews"
  on public.class_reviews for update
  to authenticated
  using (auth.uid() = posted_by);
