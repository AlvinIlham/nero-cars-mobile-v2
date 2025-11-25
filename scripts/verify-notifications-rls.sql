-- Verify current RLS policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- Test insert notification manually (replace with actual user IDs)
-- Get some user IDs first
SELECT id, email FROM profiles LIMIT 5;

-- Try manual insert (replace USER_ID_HERE with actual ID from above query)
-- INSERT INTO notifications (user_id, type, title, message, is_read)
-- VALUES ('USER_ID_HERE', 'test', 'Test Notification', 'This is a test', false);

-- Check if any notifications exist
SELECT COUNT(*) as total_notifications FROM notifications;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'notifications';
