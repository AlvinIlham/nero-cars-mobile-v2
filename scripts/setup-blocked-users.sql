-- Drop existing table if exists (for clean setup)
DROP TABLE IF EXISTS public.blocked_users CASCADE;

-- Create blocked_users table
CREATE TABLE public.blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_block UNIQUE(blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

-- Add indexes for better performance
CREATE INDEX idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked ON public.blocked_users(blocked_id);

-- Grant permissions
GRANT ALL ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;

-- Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their blocked users" ON public.blocked_users;
DROP POLICY IF EXISTS "Users can view blocks involving them" ON public.blocked_users;
DROP POLICY IF EXISTS "Users can block others" ON public.blocked_users;
DROP POLICY IF EXISTS "Users can unblock others" ON public.blocked_users;

-- RLS Policies
-- Users can view blocks where they are the blocker or blocked
CREATE POLICY "Users can view blocks involving them"
  ON public.blocked_users
  FOR SELECT
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

-- Users can block others
CREATE POLICY "Users can block others"
  ON public.blocked_users
  FOR INSERT
  WITH CHECK (
    auth.uid() = blocker_id 
    AND auth.uid() != blocked_id
  );

-- Users can unblock others (only their own blocks)
CREATE POLICY "Users can unblock others"
  ON public.blocked_users
  FOR DELETE
  USING (auth.uid() = blocker_id);

-- Add function to check if users are blocked (helper function)
CREATE OR REPLACE FUNCTION is_user_blocked(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = user1_id AND blocked_id = user2_id)
       OR (blocker_id = user2_id AND blocked_id = user1_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Users that are blocked will still appear in conversations list
-- but cannot send messages. Dropdown menu will show "Buka Blokir" option.
