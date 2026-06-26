-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  organization  text NOT NULL,
  type          text NOT NULL CHECK (type IN ('internship','full-time','club','research','other')),
  description   text,
  deadline      date,
  link          text,
  posted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_by_name text,
  is_active     boolean DEFAULT true NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active opportunities
CREATE POLICY "members_select" ON opportunities
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Any authenticated user can insert their own opportunity
CREATE POLICY "members_insert" ON opportunities
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = posted_by);

-- Poster can update their own; admins can update any (handled server-side via service role)
CREATE POLICY "poster_update" ON opportunities
  FOR UPDATE USING (auth.uid() = posted_by);

-- Poster can delete their own
CREATE POLICY "poster_delete" ON opportunities
  FOR DELETE USING (auth.uid() = posted_by);

-- ============================================================
-- Migration: approval workflow (run after initial schema)
-- ============================================================

-- Add status column for moderation state
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Mark all previously-active rows as approved (they were posted pre-moderation)
UPDATE opportunities SET status = 'approved' WHERE is_active = true;
