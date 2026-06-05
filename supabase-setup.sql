-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Allowed emails table
--    Controls who can log in and what role they have.
CREATE TABLE IF NOT EXISTS allowed_emails (
  email  text PRIMARY KEY,
  role   text NOT NULL DEFAULT 'member'
             CHECK (role IN ('member', 'admin')),
  added_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- 3. Allow the service role (used server-side) to read/write freely.
--    The anon key on the client cannot touch this table at all.
CREATE POLICY "service_role_all" ON allowed_emails
  USING (true)
  WITH CHECK (true);

-- 4. Seed the first admin
INSERT INTO allowed_emails (email, role)
VALUES ('aranjaiman@gmail.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- To add more members later:
--   INSERT INTO allowed_emails (email, role)
--   VALUES ('newmember@email.com', 'member');
--
-- To grant admin to someone:
--   UPDATE allowed_emails SET role = 'admin'
--   WHERE email = 'someone@email.com';
--
-- To revoke access:
--   DELETE FROM allowed_emails WHERE email = 'someone@email.com';
--   -- Also delete them from Supabase Auth → Users in the dashboard
--   -- so their existing session stops working on next refresh.
-- ============================================================
