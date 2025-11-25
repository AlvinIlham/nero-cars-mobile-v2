-- ================================================
-- FIX RECEIVER_ID IN MESSAGES TABLE
-- ================================================

-- Update existing messages to have correct receiver_id
-- If sender is buyer, receiver is seller
-- If sender is seller, receiver is buyer

UPDATE messages m
SET receiver_id = CASE 
    WHEN m.sender_id = c.buyer_id THEN c.seller_id
    WHEN m.sender_id = c.seller_id THEN c.buyer_id
    ELSE NULL
END
FROM conversations c
WHERE m.conversation_id = c.id
AND m.receiver_id IS NULL;

-- Verify the fix
SELECT 
    m.id,
    m.conversation_id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.created_at,
    c.buyer_id,
    c.seller_id
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
ORDER BY m.created_at DESC
LIMIT 10;

SELECT 'Messages receiver_id fixed!' AS status;
