-- Debug: Check all messages in conversation
SELECT 
    m.id,
    m.content,
    m.sender_id,
    m.receiver_id,
    m.conversation_id,
    m.created_at,
    m.is_read
FROM messages m
WHERE m.conversation_id = '9e5e9845-eed8-4a6e-a36f-f5b9d569325a'
ORDER BY m.created_at DESC;

-- Check if "Halooo" message exists and has receiver_id
SELECT 
    m.id,
    m.content,
    m.sender_id,
    m.receiver_id,
    m.conversation_id,
    m.created_at
FROM messages m
WHERE m.content ILIKE '%Halooo%'
ORDER BY m.created_at DESC;

-- Show user IDs in this conversation
SELECT DISTINCT
    'User IDs in conversation:' as info,
    sender_id,
    receiver_id
FROM messages
WHERE conversation_id = '9e5e9845-eed8-4a6e-a36f-f5b9d569325a';
