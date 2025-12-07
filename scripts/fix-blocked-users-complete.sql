-- Fix blocked_users table issues
-- Run this in Supabase SQL Editor

-- 1. First, let's clean up any duplicate or reverse blocks
-- Delete reverse blocks (keep only one direction)
DELETE FROM public.blocked_users b1
WHERE EXISTS (
  SELECT 1 FROM public.blocked_users b2
  WHERE b1.blocker_id = b2.blocked_id
  AND b1.blocked_id = b2.blocker_id
  AND b1.id > b2.id
);

-- 2. Re-check and fix RLS policies to allow both SELECT and INSERT properly
DROP POLICY IF EXISTS "Users can view blocks involving them" ON public.blocked_users;
DROP POLICY IF EXISTS "Users can block others" ON public.blocked_users;
DROP POLICY IF EXISTS "Users can unblock others" ON public.blocked_users;

-- Allow users to view blocks where they are involved
CREATE POLICY "Users can view blocks involving them"
  ON public.blocked_users
  FOR SELECT
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

-- Allow users to block others (fixed: removed unnecessary conditions)
CREATE POLICY "Users can block others"
  ON public.blocked_users
  FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Allow users to unblock (delete their own blocks only)
CREATE POLICY "Users can unblock others"
  ON public.blocked_users
  FOR DELETE
  USING (auth.uid() = blocker_id);

-- 3. Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'blocked_users';

-- 4. Verify realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'blocked_users';
