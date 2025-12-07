-- Setup User Presence Tracking - TANPA RLS
-- Run this in Supabase SQL Editor

-- 1. Drop table if exists to start fresh
DROP TABLE IF EXISTS public.user_presence CASCADE;

-- 2. Create user_presence table (simple, no FK, no RLS)
CREATE TABLE public.user_presence (
  user_id UUID PRIMARY KEY,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. GRANT ALL ACCESS to authenticated and anon users
GRANT ALL ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO anon;
GRANT ALL ON public.user_presence TO service_role;

-- 4. Make sure RLS is DISABLED
ALTER TABLE public.user_presence DISABLE ROW LEVEL SECURITY;

-- 5. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for updated_at
DROP TRIGGER IF EXISTS user_presence_updated_at ON public.user_presence;
CREATE TRIGGER user_presence_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION update_user_presence_timestamp();

-- 7. Enable Realtime for user_presence table
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Table already in publication
END $$;

-- 8. Create function to automatically set user offline after inactivity
-- Very aggressive timeout for real realtime updates (30 seconds)
-- Users update every 10 seconds, so 30 seconds timeout is reasonable
CREATE OR REPLACE FUNCTION mark_inactive_users_offline()
RETURNS void AS $$
BEGIN
  UPDATE public.user_presence
  SET is_online = false
  WHERE is_online = true
  AND updated_at < NOW() - INTERVAL '30 seconds';
END;
$$ LANGUAGE plpgsql;

-- 9. Optional: Set up a cron job to run cleanup every minute
-- Note: Requires pg_cron extension
-- SELECT cron.schedule('cleanup-offline-users', '* * * * *', 'SELECT mark_inactive_users_offline();');

-- 10. Create index for better performance on realtime queries
CREATE INDEX IF NOT EXISTS idx_user_presence_online 
  ON public.user_presence(user_id) 
  WHERE is_online = true;

CREATE INDEX IF NOT EXISTS idx_user_presence_updated 
  ON public.user_presence(updated_at) 
  WHERE is_online = true;

-- 11. Verify setup
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  cmd
FROM pg_policies
WHERE tablename = 'user_presence';

-- 12. Verify realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'user_presence';
