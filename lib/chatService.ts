import { supabase } from "./supabase";

export interface Conversation {
  id: string;
  car_id: string | null;
  buyer_id: string;
  seller_id: string;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
  car?: any;
  buyer?: any;
  seller?: any;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  is_delivered: boolean;
  created_at: string;
}

/**
 * Get or create a conversation between buyer and seller for a specific car
 */
export async function getOrCreateConversation(
  carId: string,
  buyerId: string,
  sellerId: string
): Promise<{ data: Conversation | null; error: any }> {
  try {
    // Check if conversation already exists
    const { data: existing, error: findError } = await supabase
      .from("conversations")
      .select(
        `
        *,
        car:cars(*),
        buyer:profiles!conversations_buyer_id_fkey(*),
        seller:profiles!conversations_seller_id_fkey(*)
      `
      )
      .eq("car_id", carId)
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .maybeSingle();

    if (findError) {
      console.error("Error finding conversation:", findError);
      return { data: null, error: findError };
    }

    if (existing) {
      return { data: existing, error: null };
    }

    // Create new conversation
    const { data: newConversation, error: createError } = await supabase
      .from("conversations")
      .insert([
        {
          car_id: carId,
          buyer_id: buyerId,
          seller_id: sellerId,
          last_message_at: new Date().toISOString(),
        },
      ])
      .select(
        `
        *,
        car:cars(*),
        buyer:profiles!conversations_buyer_id_fkey(*),
        seller:profiles!conversations_seller_id_fkey(*)
      `
      )
      .single();

    if (createError) {
      console.error("Error creating conversation:", createError);
      return { data: null, error: createError };
    }

    return { data: newConversation, error: null };
  } catch (error) {
    console.error("Error in getOrCreateConversation:", error);
    return { data: null, error };
  }
}

/**
 * Get all conversations for a user
 */
export async function getUserConversations(
  userId: string
): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select(
        `
        *,
        car:cars(*),
        buyer:profiles!conversations_buyer_id_fkey(*),
        seller:profiles!conversations_seller_id_fkey(*)
      `
      )
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getUserConversations:", error);
    return [];
  }
}

/**
 * Get all messages in a conversation
 */
export async function getConversationMessages(
  conversationId: string
): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getConversationMessages:", error);
    return [];
  }
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<{ data: Message | null; error: any }> {
  try {
    // Get conversation details to know receiver
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("buyer_id, seller_id")
      .eq("id", conversationId)
      .single();

    if (convError) {
      console.error("Error fetching conversation:", convError);
      return { data: null, error: convError };
    }

    // Determine receiver (the other person in conversation)
    const receiverId =
      conversation.buyer_id === senderId
        ? conversation.seller_id
        : conversation.buyer_id;

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert([
        {
          conversation_id: conversationId,
          sender_id: senderId,
          receiver_id: receiverId,
          content,
          is_read: false,
          is_delivered: true, // Will be updated by realtime if receiver is online
        },
      ])
      .select()
      .single();

    if (messageError) {
      console.error("Error sending message:", messageError);
      return { data: null, error: messageError };
    }

    return { data: message, error: null };
  } catch (error) {
    console.error("Error in sendMessage:", error);
    return { data: null, error };
  }
}

/**
 * Mark all messages in a conversation as read
 */
export async function markConversationMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("messages")
      .update({ is_read: true, is_delivered: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("Error marking messages as read:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in markConversationMessagesAsRead:", error);
    return false;
  }
}

/**
 * Get unread message count for a conversation
 */
export async function getConversationUnreadCount(
  conversationId: string,
  userId: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("is_read", false)
      .neq("sender_id", userId);

    if (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error("Error in getConversationUnreadCount:", error);
    return 0;
  }
}

/**
 * Get total unread message count for user
 */
export async function getTotalUnreadCount(userId: string): Promise<number> {
  try {
    const conversations = await getUserConversations(userId);
    let totalUnread = 0;

    for (const conv of conversations) {
      const unread = await getConversationUnreadCount(conv.id, userId);
      totalUnread += unread;
    }

    return totalUnread;
  } catch (error) {
    console.error("Error in getTotalUnreadCount:", error);
    return 0;
  }
}

/**
 * Subscribe to new messages in a conversation
 */
export function subscribeToConversationMessages(
  conversationId: string,
  callback: (message: Message) => void
) {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to all user conversations
 */
export function subscribeToUserConversations(
  userId: string,
  callback: () => void
) {
  const channel = supabase
    .channel(`user-conversations:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversations",
      },
      () => {
        callback();
      }
    )
    .subscribe();

  return channel;
}
