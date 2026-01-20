-- FIX MANAGER ACCESS
-- The custom authentication system does not create Supabase Auth sessions.
-- Therefore, RLS policies that rely on auth.uid() or auth.role() will fail for the Manager Dashboard.
-- To fix this, we need to temporarily disable RLS on the 'shifts' table, just like we did for 'users'.

-- 1. Disable RLS on shifts table
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;

-- 2. Verify settings
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'shifts';

-- Note: In a production environment with real auth, you would re-enable this 
-- and ensure all users authenticate via Supabase Auth.
