-- ================================================
-- FIX CONVERSATIONS TABLE - updated_at NOT NULL
-- ================================================

-- Make updated_at nullable or add default value
ALTER TABLE conversations 
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows that have NULL updated_at
UPDATE conversations 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Verify the fix
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'conversations'
    AND column_name IN ('created_at', 'updated_at', 'last_message_at')
ORDER BY 
    ordinal_position;

SELECT 'Conversations updated_at fixed!' AS status;
