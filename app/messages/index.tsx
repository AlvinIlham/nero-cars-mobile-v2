import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  conversation_id: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

interface ChatConversation {
  userId: string;
  userName: string;
  userAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export default function MessagesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Refresh on screen focus
  useFocusEffect(
    React.useCallback(() => {
      fetchConversations();
    }, [user?.id])
  );

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to new messages for real-time updates
    const subscription = supabase
      .channel(`messages-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("New message received:", payload);
          // Refresh conversations when new message arrives
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const fetchConversations = async () => {
    try {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      // Fetch all messages - website structure (no receiver_id)
      const { data: messages, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.log("Messages table not available:", error.message);
        setConversations([]);
        setLoading(false);
        return;
      }

      if (!messages || messages.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      console.log("Sample message structure:", messages[0]);

      // Get unique senders who are not the current user
      const uniqueSenders = Array.from(
        new Set(
          messages
            .map((msg: any) => msg.sender_id)
            .filter((id: string) => id !== user.id)
        )
      );

      if (uniqueSenders.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", uniqueSenders);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Group messages by sender
      const conversationMap = new Map<string, ChatConversation>();

      messages.forEach((msg: any) => {
        // Skip current user's own messages for listing
        if (msg.sender_id === user.id) return;

        const partnerId = msg.sender_id;
        const partnerProfile = profileMap.get(partnerId);

        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            userId: partnerId,
            userName: partnerProfile?.full_name || "Unknown User",
            userAvatar: partnerProfile?.avatar_url,
            lastMessage: msg.content || "",
            lastMessageTime: msg.created_at,
            unreadCount: !msg.is_read ? 1 : 0,
          });
        } else {
          // Update if this message is newer
          const existing = conversationMap.get(partnerId)!;
          if (new Date(msg.created_at) > new Date(existing.lastMessageTime)) {
            existing.lastMessage = msg.content || "";
            existing.lastMessageTime = msg.created_at;
          }
          if (!msg.is_read) {
            existing.unreadCount += 1;
          }
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string): string => {
    // Parse UTC time and add 7 hours for WIB (UTC+7)
    const utcDate = new Date(timestamp);
    const wibDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000); // +7 jam
    const now = new Date();
    const diffInHours = (now.getTime() - utcDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24 && wibDate.getDate() === now.getDate()) {
      const hours = wibDate.getHours().toString().padStart(2, "0");
      const minutes = wibDate.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    } else if (diffInHours < 48) {
      return "Kemarin";
    } else {
      const day = wibDate.getDate();
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
    }
  };

  const truncateMessage = (message: string, maxLength: number = 50): string => {
    return message.length > maxLength
      ? message.substring(0, maxLength) + "..."
      : message;
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderConversationItem = ({ item }: { item: ChatConversation }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() => {
        router.push({
          pathname: "/chat/[userId]",
          params: {
            userId: item.userId,
            userName: item.userName,
          },
        });
      }}>
      <View style={styles.avatarContainer}>
        {item.userAvatar ? (
          <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color="#94a3b8" />
          </View>
        )}
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={styles.userName}>{item.userName}</Text>
          <Text style={styles.timeText}>
            {formatTime(item.lastMessageTime)}
          </Text>
        </View>
        <Text
          style={[
            styles.lastMessage,
            item.unreadCount > 0 && styles.unreadMessage,
          ]}>
          {truncateMessage(item.lastMessage)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={80} color="#475569" />
      <Text style={styles.emptyTitle}>Belum Ada Pesan</Text>
      <Text style={styles.emptyText}>
        Anda belum memiliki percakapan. Mulai chat dengan penjual mobil atau
        pembeli yang tertarik!
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: "Pesan",
            headerShown: true,
            headerStyle: {
              backgroundColor: "#1e293b",
            },
            headerTintColor: "#fff",
          }}
        />
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat pesan...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Pesan",
          headerShown: true,
          headerStyle: {
            backgroundColor: "#1e293b",
          },
          headerTintColor: "#fff",
        }}
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari percakapan..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredConversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={
          filteredConversations.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
  },
  list: {
    paddingHorizontal: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  conversationCard: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  conversationInfo: {
    flex: 1,
    justifyContent: "center",
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  userName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  timeText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  lastMessage: {
    color: "#94a3b8",
    fontSize: 14,
  },
  unreadMessage: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
  },
});
