import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import {
  getUserConversations,
  getConversationUnreadCount,
  subscribeToUserConversations,
  type Conversation,
} from "@/lib/chatService";

interface ConversationItem extends Conversation {
  otherPerson: any;
  carInfo: string;
  unreadCount: number;
  timeAgo: string;
  isOnline?: boolean;
}

export default function MessagesScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userPresence, setUserPresence] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchUser();
  }, []);

  // Update user presence
  useEffect(() => {
    if (user?.id) {
      updateUserPresence(true);

      // Update presence every 10 seconds for highly responsive online status
      const interval = setInterval(() => {
        updateUserPresence(true);
      }, 10000);

      return () => {
        clearInterval(interval);
        updateUserPresence(false);
      };
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      loadConversations();
      subscribeToPresence();

      // Subscribe to realtime updates for conversations
      const conversationChannel = subscribeToUserConversations(user.id, () => {
        loadConversations();
      });

      // Subscribe to messages changes (for unread count updates)
      const messagesChannel = supabase
        .channel(`user-messages:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
          },
          () => {
            // Reload conversations to update unread counts
            loadConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(conversationChannel);
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [user]);

  const fetchUser = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        setUser(profile || session.user);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const updateUserPresence = async (isOnline: boolean) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.from("user_presence").upsert(
        {
          user_id: user.id,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) console.error("Error updating presence:", error);
    } catch (error) {
      console.error("Error updating presence:", error);
    }
  };

  const subscribeToPresence = () => {
    if (!user?.id) return;

    const channel = supabase
      .channel("user-presence-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
        },
        (payload) => {
          const presence = payload.new as any;
          if (presence) {
            console.log(
              "[MOBILE] Presence update:",
              presence.user_id,
              presence.is_online ? "ONLINE" : "OFFLINE"
            );
            setUserPresence((prev) => ({
              ...prev,
              [presence.user_id]: presence.is_online,
            }));

            // Update conversations online status
            setConversations((prev) =>
              prev.map((conv) => {
                const isUserBuyer = conv.buyer_id === user.id;
                const otherUserId = isUserBuyer
                  ? conv.seller_id
                  : conv.buyer_id;
                if (otherUserId === presence.user_id) {
                  return { ...conv, isOnline: presence.is_online };
                }
                return conv;
              })
            );
          }
        }
      )
      .subscribe();

    return channel;
  };

  const loadUserPresence = async (userIds: string[]) => {
    if (userIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from("user_presence")
        .select("user_id, is_online")
        .in("user_id", userIds);

      if (data) {
        const presenceMap: Record<string, boolean> = {};
        data.forEach((p) => {
          presenceMap[p.user_id] = p.is_online;
        });
        setUserPresence(presenceMap);
      }
    } catch (error) {
      console.error("Error loading user presence:", error);
    }
  };

  const loadConversations = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const convs = await getUserConversations(user.id);

      // Collect all other user IDs
      const otherUserIds: string[] = [];

      const items: ConversationItem[] = await Promise.all(
        convs.map(async (conv) => {
          // Determine who is the other person
          const isUserBuyer = conv.buyer_id === user.id;
          const otherPerson = isUserBuyer ? conv.seller : conv.buyer;
          const otherUserId = isUserBuyer ? conv.seller_id : conv.buyer_id;

          if (otherUserId) {
            otherUserIds.push(otherUserId);
          }

          // Get car info
          const carInfo = conv.car
            ? `${conv.car.brand} ${conv.car.model} ${conv.car.year}`
            : "Mobil";

          // Get unread count
          const unreadCount = await getConversationUnreadCount(
            conv.id,
            user.id
          );

          // Format time
          const timeAgo = formatTimeAgo(conv.last_message_at);

          return {
            ...conv,
            otherPerson,
            carInfo,
            unreadCount,
            timeAgo,
            isOnline: false,
          };
        })
      );

      setConversations(items);

      // Load presence for all other users
      if (otherUserIds.length > 0) {
        await loadUserPresence(otherUserIds);

        // Update conversations with loaded presence
        setConversations((prev) =>
          prev.map((conv) => {
            const isUserBuyer = conv.buyer_id === user.id;
            const otherUserId = isUserBuyer ? conv.seller_id : conv.buyer_id;
            return {
              ...conv,
              isOnline: userPresence[otherUserId] || false,
            };
          })
        );
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const formatTimeAgo = (dateString: string): string => {
    const utcDate = new Date(dateString);
    const wibDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000); // +7 jam untuk WIB
    const now = new Date();
    const diffInMs = now.getTime() - utcDate.getTime();
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMinutes < 1) return "Baru saja";
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) {
      // Tampilkan jam
      const hours = wibDate.getHours();
      const minutes = wibDate.getMinutes();
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
    }
    if (diffInDays === 1) return "Kemarin";
    if (diffInDays < 7) return `${diffInDays}h`;
    return wibDate.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    });
  };

  const getMessagePreview = (
    message: string
  ): { icon: string; text: string } => {
    // Check if message contains image
    if (message.startsWith("[IMAGE]")) {
      return { icon: "image", text: "Foto" };
    }

    // Check if message contains file
    if (message.startsWith("[FILE]")) {
      const [fileName] = message.replace("[FILE]", "").split("|");
      return { icon: "document-attach", text: fileName };
    }

    // Regular text message
    return { icon: "", text: message };
  };

  const handleConversationPress = (conversation: ConversationItem) => {
    router.push({
      pathname: "/messages/[id]",
      params: {
        id: conversation.id,
        otherPersonName: conversation.otherPerson?.full_name || "User",
        carInfo: conversation.carInfo,
      },
    });
  };

  const renderConversationItem = ({ item }: { item: ConversationItem }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => handleConversationPress(item)}
      activeOpacity={0.7}>
      <View style={styles.avatarContainer}>
        {item.otherPerson?.avatar_url ? (
          <Image
            source={{ uri: item.otherPerson.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color="#94a3b8" />
          </View>
        )}
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.personName} numberOfLines={1}>
            {item.otherPerson?.full_name || "User"}
          </Text>
          <Text style={styles.timeAgo}>{item.timeAgo}</Text>
        </View>

        <Text style={styles.carInfo} numberOfLines={1}>
          {item.carInfo}
        </Text>

        <View style={styles.lastMessageRow}>
          {(() => {
            const preview = getMessagePreview(item.last_message || "");
            return (
              <View style={styles.lastMessageContent}>
                {preview.icon && (
                  <Ionicons
                    name={preview.icon as any}
                    size={14}
                    color={item.unreadCount > 0 ? "#ffffff" : "#64748b"}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text
                  style={[
                    styles.lastMessage,
                    item.unreadCount > 0 && styles.lastMessageUnread,
                  ]}
                  numberOfLines={1}>
                  {preview.text || "Tidak ada pesan"}
                </Text>
              </View>
            );
          })()}
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Memuat percakapan...</Text>
      </View>
    );
  }

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.otherPerson.full_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      conv.carInfo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/(tabs)")}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pesan</Text>
        </View>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#64748b"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari percakapan..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>
            {searchQuery ? "Tidak ditemukan" : "Belum ada percakapan"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? "Coba kata kunci lain"
              : "Mulai chat dengan penjual mobil"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3b82f6"]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#94a3b8",
  },
  header: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
    color: "#94a3b8",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#ffffff",
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#1e293b",
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  personName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  timeAgo: {
    fontSize: 12,
    color: "#64748b",
    marginLeft: 8,
  },
  carInfo: {
    fontSize: 13,
    color: "#60a5fa",
    marginBottom: 4,
  },
  lastMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastMessageContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: "#94a3b8",
  },
  lastMessageUnread: {
    color: "#e2e8f0",
    fontWeight: "500",
  },
  unreadBadge: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#e2e8f0",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
});
