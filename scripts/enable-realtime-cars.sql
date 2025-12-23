-- Enable Realtime for cars table
-- Run this in Supabase SQL Editor

-- Enable realtime on cars table
ALTER PUBLICATION supabase_realtime ADD TABLE cars;

-- Verify realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename = 'cars';
