import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_id?: number;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    if (user?.id) {
      const subscription = supabase
        .channel(`notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotif = payload.new as Notification;
            setNotifications((prev) => [newNotif, ...prev]);
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        // Table might not exist yet, show empty state
        console.log("Notifications table not available:", error.message);
        setNotifications([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!user?.id) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, is_read: true }))
      );
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;

      // Update local state
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notificationId)
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

    if (diffInMinutes < 1) {
      return "Baru saja";
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)} menit yang lalu`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} jam yang lalu`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} hari yang lalu`;
    }
  };

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case "message":
        return "chatbubble";
      case "favorite":
        return "heart";
      case "car_sold":
        return "checkmark-circle";
      case "car_approved":
        return "checkmark-done";
      case "car_rejected":
        return "close-circle";
      case "price_drop":
        return "trending-down";
      default:
        return "notifications";
    }
  };

  const getNotificationColor = (type: string): string => {
    switch (type) {
      case "message":
        return "#3b82f6";
      case "favorite":
        return "#ef4444";
      case "car_sold":
        return "#10b981";
      case "car_approved":
        return "#10b981";
      case "car_rejected":
        return "#ef4444";
      case "price_drop":
        return "#f59e0b";
      default:
        return "#64748b";
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);

    // Navigate based on notification type
    switch (notification.type) {
      case "message":
        router.push("/messages");
        break;
      case "favorite":
      case "car_sold":
      case "car_approved":
      case "car_rejected":
        if (notification.related_id) {
          router.push(`/cars/${notification.related_id}`);
        }
        break;
      default:
        break;
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: getNotificationColor(item.type) + "20" },
        ]}>
        <Ionicons
          name={getNotificationIcon(item.type) as any}
          size={24}
          color={getNotificationColor(item.type)}
        />
      </View>

      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
      </View>

      {!item.is_read && <View style={styles.unreadDot} />}

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteNotification(item.id)}>
        <Ionicons name="close" size={20} color="#64748b" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={80} color="#475569" />
      <Text style={styles.emptyTitle}>Tidak Ada Notifikasi</Text>
      <Text style={styles.emptyText}>
        Anda belum memiliki notifikasi. Notifikasi akan muncul di sini ketika
        ada aktivitas baru.
      </Text>
    </View>
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: "Notifikasi",
            headerShown: true,
            headerStyle: {
              backgroundColor: "#1e293b",
            },
            headerTintColor: "#fff",
          }}
        />
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat notifikasi...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Notifikasi",
          headerShown: true,
          headerStyle: {
            backgroundColor: "#1e293b",
          },
          headerTintColor: "#fff",
          headerRight: () =>
            unreadCount > 0 ? (
              <TouchableOpacity
                onPress={markAllAsRead}
                style={styles.headerButton}>
                <Text style={styles.markAllReadText}>Tandai Semua</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Ionicons name="notifications" size={20} color="#f59e0b" />
          <Text style={styles.unreadBannerText}>
            {unreadCount} notifikasi belum dibaca
          </Text>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f59e0b"
            colors={["#f59e0b"]}
          />
        }
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
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  headerButton: {
    marginRight: 16,
  },
  markAllReadText: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "600",
  },
  unreadBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  unreadBannerText: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "600",
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "flex-start",
  },
  unreadCard: {
    backgroundColor: "#1e293b",
    borderColor: "#f59e0b",
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  notificationMessage: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  timeText: {
    color: "#64748b",
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f59e0b",
    marginLeft: 8,
    marginTop: 6,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 4,
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
