-- Enable Realtime for blocked_users table
-- Run this in Supabase SQL Editor

-- Enable realtime replication for blocked_users table
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;

-- Verify it's enabled (should return one row with blocked_users)
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'blocked_users';
