import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  conversation_id: string;
  is_read: boolean;
  created_at: string;
}

export default function ChatDetailScreen() {
  const { userId, userName, carId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user) {
      Alert.alert("Login Required", "Please login to chat", [
        { text: "OK", onPress: () => router.back() },
      ]);
      return;
    }

    fetchMessages();

    // Subscribe to new messages - simple check using receiver_id and sender_id
    const subscription = supabase
      .channel(`chat-${user.id}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("New message received in chat:", payload.new);
          const newMessage = payload.new as any;

          // Check if this message is between current user and the other user
          const isSentByMe =
            newMessage.sender_id === user.id &&
            newMessage.receiver_id === userId;
          const isSentToMe =
            newMessage.receiver_id === user.id &&
            newMessage.sender_id === userId;

          if (isSentByMe || isSentToMe) {
            console.log("✅ Message is for this conversation, adding to UI");
            setMessages((prev) => [newMessage, ...prev]);
            scrollToBottom();
          } else {
            console.log("❌ Message not for this conversation, ignoring");
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId, user]);

  const fetchMessages = async () => {
    try {
      if (!user?.id) return;

      console.log("=== FETCH MESSAGES DEBUG ===");
      console.log("Current user ID:", user.id);
      console.log("Other user ID (userId param):", userId);

      // Fetch messages between current user and the other user directly
      // Messages where: (I'm sender AND they're receiver) OR (they're sender AND I'm receiver)
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching messages:", error);
        setMessages([]);
        setLoading(false);
        return;
      }

      console.log(`Found ${data?.length || 0} messages for conversation`);
      if (data && data.length > 0) {
        console.log("Latest message:", data[0]);
        console.log(
          "All messages content:",
          data.map((m) => m.content)
        );
      }

      setMessages(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !user?.id || sending) return;

    const messageText = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    try {
      // First, try to find existing conversation between these two specific users
      const { data: allMessages } = await supabase
        .from("messages")
        .select("conversation_id, sender_id")
        .or(`sender_id.eq.${user.id},sender_id.eq.${userId}`);

      let conversationId;

      if (allMessages && allMessages.length > 0) {
        // Find a conversation_id that has messages from BOTH users
        const conversationMap = new Map<string, Set<string>>();

        allMessages.forEach((msg: any) => {
          if (!conversationMap.has(msg.conversation_id)) {
            conversationMap.set(msg.conversation_id, new Set());
          }
          conversationMap.get(msg.conversation_id)!.add(msg.sender_id);
        });

        // Find conversation that has both user IDs
        for (const [convId, senderIds] of conversationMap) {
          if (senderIds.has(user.id) && senderIds.has(userId as string)) {
            conversationId = convId;
            break;
          }
        }
      }

      // If no existing conversation found, create new one
      if (!conversationId) {
        conversationId = carId || crypto.randomUUID();
      }

      // Insert message - using website structure with receiver_id
      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: userId as string, // Add receiver_id
          content: messageText,
          conversation_id: conversationId,
          is_read: false,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Create notification for receiver
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: userId as string,
          type: "message",
          title: "Pesan Baru",
          message: `${
            user.full_name || user.email?.split("@")[0] || "Seseorang"
          } mengirim pesan: ${messageText.substring(0, 50)}${
            messageText.length > 50 ? "..." : ""
          }`,
          link: `/messages/conversation-${conversationId}`,
          is_read: false,
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
      } else {
        console.log("✅ Notification created for user:", userId);
      }

      setMessages((prev) => [messageData, ...prev]);
      scrollToBottom();
    } catch (error: any) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
      setInputMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    // Parse UTC time and add 7 hours for WIB (UTC+7)
    const utcDate = new Date(dateString);
    const wibDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000); // +7 jam
    const now = new Date();
    const diffMs = now.getTime() - utcDate.getTime();
    const diffHours = Math.floor(diffMs / 3600000);

    // Jika hari ini, tampilkan jam:menit dalam WIB
    if (diffHours < 24 && wibDate.getDate() === now.getDate()) {
      const hours = wibDate.getHours().toString().padStart(2, "0");
      const minutes = wibDate.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    }

    // Jika kemarin
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      wibDate.getDate() === yesterday.getDate() &&
      wibDate.getMonth() === yesterday.getMonth() &&
      wibDate.getFullYear() === yesterday.getFullYear()
    ) {
      return "Kemarin";
    }

    // Jika lebih dari 2 hari, tampilkan tanggal
    const day = wibDate.getDate().toString().padStart(2, "0");
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Ags",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    const month = monthNames[wibDate.getMonth()];
    return `${day} ${month}`;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isMine ? styles.myMessage : styles.theirMessage,
        ]}>
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myBubble : styles.theirBubble,
          ]}>
          <Text
            style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.theirMessageText,
            ]}>
            {item.content}
          </Text>
          <Text
            style={[
              styles.timeText,
              isMine ? styles.myTimeText : styles.theirTimeText,
            ]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: (userName as string) || "Chat",
          headerStyle: { backgroundColor: "#1e293b" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "600" },
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          inverted
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#475569" />
              <Text style={styles.emptyText}>Belum ada pesan</Text>
              <Text style={styles.emptySubtext}>
                Mulai percakapan dengan mengirim pesan
              </Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputMessage}
            onChangeText={setInputMessage}
            placeholder="Tulis pesan..."
            placeholderTextColor="#64748b"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputMessage.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputMessage.trim() || sending}>
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: "80%",
  },
  myMessage: {
    alignSelf: "flex-end",
  },
  theirMessage: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: "#f59e0b",
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: "#1e293b",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  myMessageText: {
    color: "#fff",
  },
  theirMessageText: {
    color: "#e2e8f0",
  },
  timeText: {
    fontSize: 11,
    marginTop: 2,
  },
  myTimeText: {
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "right",
  },
  theirTimeText: {
    color: "#64748b",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    color: "#fff",
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f59e0b",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
