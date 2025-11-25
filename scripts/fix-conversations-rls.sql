-- ================================================
-- ADD CONVERSATIONS TABLE TO DATABASE SETUP
-- ================================================

-- Enable RLS on conversations table
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;

-- Users can view conversations where they are buyer or seller
CREATE POLICY "Users can view their conversations"
ON conversations FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Authenticated users can create conversations
CREATE POLICY "Users can create conversations"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Users can update their conversations (mark as read, etc)
CREATE POLICY "Users can update their conversations"
ON conversations FOR UPDATE
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Grant permissions
GRANT ALL ON conversations TO authenticated;

-- Test: Count accessible conversations for current user
SELECT COUNT(*) as my_conversations 
FROM conversations 
WHERE buyer_id = auth.uid() OR seller_id = auth.uid();

SELECT 'Conversations policies setup completed!' AS status;
