-- ================================================
-- CHECK CONVERSATIONS TABLE STRUCTURE
-- ================================================

-- 1. Check if conversations table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'conversations';

-- 2. Get conversations table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
    AND table_name = 'conversations'
ORDER BY 
    ordinal_position;

-- 3. View all data in conversations table
SELECT * FROM conversations ORDER BY created_at DESC;

-- 4. Count records
SELECT COUNT(*) as total_conversations FROM conversations;

-- 5. Check RLS policies on conversations
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'conversations';

-- 6. Test if you can access conversations (as current user)
SELECT 
    id,
    car_id,
    buyer_id,
    seller_id,
    created_at
FROM conversations
LIMIT 10;
