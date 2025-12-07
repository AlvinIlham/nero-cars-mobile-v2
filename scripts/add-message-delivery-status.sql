-- Add delivery status to messages table
-- This allows tracking if message was delivered (receiver online) vs just sent

-- Add is_delivered column
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT false;

-- Update existing messages to be marked as delivered
UPDATE messages SET is_delivered = true WHERE is_read = true;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_delivery_status 
ON messages(sender_id, is_delivered, is_read);

-- Add comment
COMMENT ON COLUMN messages.is_delivered IS 'True if message was delivered to online receiver, false if sent to offline receiver';
