-- Add receiver_id column to existing messages table if it doesn't exist
-- This is a safe migration that won't delete existing data

DO $$ 
BEGIN
    -- Check if receiver_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'receiver_id'
    ) THEN
        -- Add receiver_id column
        ALTER TABLE messages 
        ADD COLUMN receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Column receiver_id added to messages table';
        
        -- If there's a to_user_id column, copy data from it
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            AND column_name = 'to_user_id'
        ) THEN
            UPDATE messages SET receiver_id = to_user_id WHERE receiver_id IS NULL;
            RAISE NOTICE 'Data copied from to_user_id to receiver_id';
        END IF;
        
        -- If there's a recipient_id column, copy data from it
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            AND column_name = 'recipient_id'
        ) THEN
            UPDATE messages SET receiver_id = recipient_id WHERE receiver_id IS NULL;
            RAISE NOTICE 'Data copied from recipient_id to receiver_id';
        END IF;
    ELSE
        RAISE NOTICE 'Column receiver_id already exists';
    END IF;
END $$;

-- Create index for receiver_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Check current table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'messages'
ORDER BY 
    ordinal_position;
