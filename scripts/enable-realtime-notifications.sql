-- Enable Realtime for notifications and messages tables
-- Run this in Supabase SQL Editor

-- Enable realtime on notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable realtime on messages table  
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Verify realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('notifications', 'messages');
