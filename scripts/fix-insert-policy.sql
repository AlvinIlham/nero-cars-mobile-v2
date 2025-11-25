-- ================================================
-- FIX INSERT POLICY - Use auth.uid() instead of auth.role()
-- ================================================

-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

-- Create new INSERT policy that checks if user is logged in (has auth.uid())
-- This allows any authenticated user to insert notifications for ANY user
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Verify the fix
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'notifications' AND cmd = 'INSERT';
