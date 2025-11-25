-- Check RLS policies for notifications table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'notifications';

-- Check if notifications table exists and its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'notifications'
ORDER BY ordinal_position;

-- Check existing notifications
SELECT 
    id,
    user_id,
    type,
    title,
    message,
    link,
    is_read,
    created_at
FROM notifications 
ORDER BY created_at DESC 
LIMIT 10;
