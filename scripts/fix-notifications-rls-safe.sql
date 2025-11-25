-- ================================================
-- FIX NOTIFICATIONS RLS POLICIES - SAFE VERSION
-- ================================================

-- Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (menggunakan DO block untuk handle errors)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'notifications') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON notifications';
    END LOOP;
END $$;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Authenticated users can insert notifications for ANY user
-- This is CRITICAL: allows User A to create notifications for User B
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Verify policies - should show 4 policies including INSERT
SELECT 
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;
