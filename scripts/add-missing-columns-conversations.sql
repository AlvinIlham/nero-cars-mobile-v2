-- ================================================
-- ADD MISSING COLUMNS TO CONVERSATIONS TABLE
-- ================================================

-- Add last_message_at column
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Add last_message column (optional, for preview)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS last_message TEXT;

-- Update existing rows to have last_message_at = created_at
UPDATE conversations 
SET last_message_at = created_at 
WHERE last_message_at IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at 
ON conversations(last_message_at DESC);

-- Create index for buyer_id and seller_id
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id 
ON conversations(buyer_id);

CREATE INDEX IF NOT EXISTS idx_conversations_seller_id 
ON conversations(seller_id);

-- Verify structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'conversations'
ORDER BY 
    ordinal_position;

SELECT 'Missing columns added to conversations table!' AS status;
