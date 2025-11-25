-- Check current RLS policies after fix
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- Try manual insert to test RLS (replace with actual user IDs)
-- First get some user IDs
SELECT id, email, full_name FROM profiles LIMIT 5;

-- Then try insert (uncomment and replace USER_ID)
-- INSERT INTO notifications (user_id, type, title, message, is_read)
-- VALUES ('cca71d08-54ad-47fb-b806-3980dbbfdbcb', 'test', 'Test Notif', 'Testing RLS', false)
-- RETURNING *;

-- Check if any notifications were created
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;
