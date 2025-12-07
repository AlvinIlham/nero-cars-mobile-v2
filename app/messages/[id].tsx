import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  TextInput,
  AppState,
  Modal,
  Alert,
  Image,
  Linking,
  ScrollView,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase";
import {
  getConversationMessages,
  sendMessage,
  markConversationMessagesAsRead,
  subscribeToConversationMessages,
  type Message,
} from "@/lib/chatService";

export default function ChatRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const conversationId = params.id as string;
  const otherPersonName = params.otherPersonName as string;
  const carInfo = params.carInfo as string;

  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedBy, setBlockedBy] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [otherUserAvatar, setOtherUserAvatar] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const channelRef = useRef<any>(null);
  const blockChannelRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const userRef = useRef<any>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Update user presence
  useEffect(() => {
    if (user?.id) {
      updateUserPresence(true);

      // Update presence every 10 seconds while in chat room
      const interval = setInterval(() => {
        updateUserPresence(true);
      }, 10000);

      // Track app state changes
      const subscription = AppState.addEventListener(
        "change",
        (nextAppState) => {
          if (nextAppState === "active") {
            updateUserPresence(true);
          } else if (nextAppState === "background") {
            updateUserPresence(false);
          }
        }
      );

      return () => {
        clearInterval(interval);
        subscription.remove();
        updateUserPresence(false);
      };
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      loadMessages();
      setupRealtimeSubscription();
      checkBlockStatus();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (blockChannelRef.current) {
        supabase.removeChannel(blockChannelRef.current);
      }
    };
  }, [user]);

  // Subscribe to other user's presence
  useEffect(() => {
    if (otherUserId) {
      loadOtherUserPresence();
      subscribeToOtherUserPresence();
    }
  }, [otherUserId]);

  // Auto mark as read when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        // Mark messages as read when user views the chat
        setTimeout(() => {
          markConversationMessagesAsRead(conversationId, user.id);
        }, 500);
      }
    }, [user, conversationId])
  );

  // Also mark as read when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && user?.id) {
        setTimeout(() => {
          markConversationMessagesAsRead(conversationId, user.id);
        }, 300);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user, conversationId]);

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

  const loadOtherUserPresence = async () => {
    if (!otherUserId) return;

    try {
      // Fetch presence
      const { data, error } = await supabase
        .from("user_presence")
        .select("is_online")
        .eq("user_id", otherUserId)
        .single();

      // Fetch avatar
      const { data: profileData } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", otherUserId)
        .single();

      if (profileData?.avatar_url) {
        setOtherUserAvatar(profileData.avatar_url);
      }

      if (data) {
        setIsOtherUserOnline(data.is_online);
      }
    } catch (error) {
      console.error("Error loading other user presence:", error);
    }
  };

  const subscribeToOtherUserPresence = () => {
    if (!otherUserId) return;

    const channel = supabase
      .channel(`presence-${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
          filter: `user_id=eq.${otherUserId}`,
        },
        (payload) => {
          const presence = payload.new as any;
          if (presence) {
            console.log(
              "[MOBILE CHAT] Other user presence:",
              presence.is_online ? "ONLINE" : "OFFLINE"
            );
            setIsOtherUserOnline(presence.is_online);
          }
        }
      )
      .subscribe();

    return channel;
  };

  const checkBlockStatus = async () => {
    const currentUser = userRef.current || user;
    if (!currentUser?.id || !conversationId) {
      console.log(
        "[MOBILE] Cannot check block status - missing user or conversationId"
      );
      return;
    }

    try {
      console.log(
        "[MOBILE] Checking block status for conversation:",
        conversationId
      );

      // Get conversation to find other user
      const { data: conversation } = await supabase
        .from("conversations")
        .select("buyer_id, seller_id")
        .eq("id", conversationId)
        .single();

      if (!conversation) {
        console.log("[MOBILE] No conversation found");
        return;
      }

      const otherId =
        conversation.buyer_id === currentUser.id
          ? conversation.seller_id
          : conversation.buyer_id;

      console.log("[MOBILE] Other user ID:", otherId);
      setOtherUserId(otherId);

      // Check if blocked (use limit to handle potential duplicates)
      const { data: blockData, error: blockError } = await supabase
        .from("blocked_users")
        .select("id, blocker_id")
        .or(
          `and(blocker_id.eq.${currentUser.id},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${currentUser.id})`
        )
        .limit(1);

      const blockCheck =
        blockData && blockData.length > 0 ? blockData[0] : null;

      console.log("[MOBILE] Block check result:", blockCheck);
      console.log("[MOBILE] Block check error:", blockError);

      if (blockCheck) {
        console.log("[MOBILE] BLOCKED! Blocker ID:", blockCheck.blocker_id);
        setIsBlocked(true);
        setBlockedBy(blockCheck.blocker_id);
      } else {
        console.log("[MOBILE] NOT BLOCKED");
        setIsBlocked(false);
        setBlockedBy(null);
      }
    } catch (error) {
      // No block found
      console.log("[MOBILE] Error checking block status:", error);
      setIsBlocked(false);
      setBlockedBy(null);
    }
  };

  const loadMessages = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Mark messages as read
      await markConversationMessagesAsRead(conversationId, user.id);

      // Load messages
      const msgs = await getConversationMessages(conversationId);
      setMessages(msgs);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);

          // Scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);

          // Mark as read immediately if it's from other person and user is in the chat
          if (newMessage.sender_id !== user.id) {
            setTimeout(() => {
              markConversationMessagesAsRead(conversationId, user.id);
            }, 200);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            )
          );
        }
      )
      .subscribe((status) => {
        console.log("[MOBILE] Messages subscription status:", status);
      });

    channelRef.current = channel;

    // Separate subscription for blocked_users changes
    // Use a stable channel name (without timestamp) to avoid re-subscribing
    const blockChannel = supabase
      .channel(`block-updates-global-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blocked_users",
        },
        (payload) => {
          console.log("[MOBILE] ========================================");
          console.log("[MOBILE] Block event received!");
          console.log("[MOBILE] Event type:", payload.eventType);
          console.log(
            "[MOBILE] Event data:",
            JSON.stringify(payload.new || payload.old, null, 2)
          );
          console.log("[MOBILE] Current user ID:", user.id);
          console.log("[MOBILE] Conversation ID:", conversationId);
          console.log("[MOBILE] ========================================");

          // Always refresh block status when any change happens
          // The checkBlockStatus function will determine if it's relevant
          setTimeout(() => {
            console.log("[MOBILE] Refreshing block status after event...");
            checkBlockStatus();
          }, 100);
        }
      )
      .subscribe((status) => {
        console.log("[MOBILE] Block subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log(
            "[MOBILE] ✅ Block subscription is now ACTIVE and listening!"
          );
        }
      });

    blockChannelRef.current = blockChannel;
  };

  const handlePickImage = async () => {
    if (isBlocked || uploadingFile) return;

    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Izinkan akses ke galeri untuk mengirim foto"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        await handleUploadFile(result.assets[0].uri, "image");
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Gagal memilih foto");
    }
  };

  const handlePickDocument = async () => {
    if (isBlocked || uploadingFile) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await handleUploadFile(
          result.assets[0].uri,
          "file",
          result.assets[0].name
        );
      }
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert("Error", "Gagal memilih file");
    }
  };

  const handleUploadFile = async (
    fileUri: string,
    type: "image" | "file",
    fileName?: string
  ) => {
    if (!user?.id || isBlocked) return;

    setUploadingFile(true);
    try {
      // Read file as ArrayBuffer
      const response = await fetch(fileUri);
      const arrayBuffer = await response.arrayBuffer();

      // Validate file size (max 10MB)
      if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
        Alert.alert("Error", "Ukuran file terlalu besar. Maksimal 10MB");
        return;
      }

      // Create file name
      const fileExt = fileName
        ? fileName.split(".").pop()?.toLowerCase()
        : type === "image"
        ? "jpg"
        : "pdf";
      const filePath = `chat-files/${user.id}-${Date.now()}.${fileExt}`;

      // Determine MIME type based on extension
      const getMimeType = (ext: string | undefined): string => {
        if (!ext) return "application/pdf";

        const mimeTypes: Record<string, string> = {
          // Images
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
          // Documents
          pdf: "application/pdf",
          doc: "application/msword",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          xls: "application/vnd.ms-excel",
          xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ppt: "application/vnd.ms-powerpoint",
          pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          // Text
          txt: "text/plain",
          csv: "text/csv",
          // Archives
          zip: "application/zip",
          rar: "application/x-rar-compressed",
        };

        return mimeTypes[ext] || "application/pdf";
      };

      const contentType = getMimeType(fileExt);

      // Convert ArrayBuffer to Uint8Array for upload
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, uint8Array, {
          contentType: contentType,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("attachments")
        .getPublicUrl(filePath);

      // Send message with file URL
      const messageContent =
        type === "image"
          ? `[IMAGE]${urlData.publicUrl}`
          : `[FILE]${fileName || "file"}|${urlData.publicUrl}`;

      await sendMessage(conversationId, user.id, messageContent);

      Alert.alert("Sukses", "File berhasil dikirim");
    } catch (error) {
      console.error("Error uploading file:", error);
      Alert.alert("Error", "Gagal mengupload file");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      Alert.alert("Downloading", "Sedang mengunduh file...");

      // Download file to cache directory
      const destination = new FileSystem.File(FileSystem.Paths.cache, fileName);
      const downloadedFile = await FileSystem.File.downloadFileAsync(
        fileUrl,
        destination,
        { idempotent: true }
      );

      // Share/save the downloaded file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadedFile.uri, {
          UTI: "public.item",
          mimeType: "*/*",
        });
        Alert.alert("Sukses", "File berhasil diunduh!");
      } else {
        Alert.alert("Sukses", `File disimpan di: ${downloadedFile.uri}`);
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      Alert.alert("Error", "Gagal mengunduh file. Silakan coba lagi.");
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user?.id) return;

    // Check block status before sending
    if (isBlocked) {
      Alert.alert(
        "Tidak dapat mengirim pesan",
        blockedBy === user.id
          ? "Anda telah memblokir kontak ini. Buka blokir terlebih dahulu untuk mengirim pesan."
          : "Anda diblokir oleh kontak ini dan tidak dapat mengirim pesan."
      );
      return;
    }

    try {
      await sendMessage(conversationId, user.id, inputText.trim());
      setInputText("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Gagal mengirim pesan. Silakan coba lagi.");
    }
  };

  const formatMessageTime = (date: string) => {
    const utcDate = new Date(date);
    const wibDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000); // +7 jam untuk WIB
    const hours = wibDate.getHours();
    const minutes = wibDate.getMinutes();
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  };

  const handleDeleteChat = async () => {
    Alert.alert("Hapus Chat", "Apakah Anda yakin ingin menghapus chat ini?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            // Delete all messages in conversation
            await supabase
              .from("messages")
              .delete()
              .eq("conversation_id", conversationId);

            // Delete conversation
            await supabase
              .from("conversations")
              .delete()
              .eq("id", conversationId);

            setShowMenu(false);
            Alert.alert("Sukses", "Chat berhasil dihapus");
            router.back();
          } catch (error) {
            console.error("Error deleting chat:", error);
            Alert.alert("Error", "Gagal menghapus chat");
          }
        },
      },
    ]);
  };

  const handleClearChat = async () => {
    Alert.alert("Hapus Semua Pesan", "Hapus semua pesan dari chat ini?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase
              .from("messages")
              .delete()
              .eq("conversation_id", conversationId);

            setMessages([]);
            setShowMenu(false);
            Alert.alert("Sukses", "Pesan berhasil dihapus");
          } catch (error) {
            console.error("Error clearing chat:", error);
            Alert.alert("Error", "Gagal menghapus pesan");
          }
        },
      },
    ]);
  };

  const handleBlockUser = async () => {
    if (!otherUserId || !user?.id) return;

    if (isBlocked) {
      // Unblock user
      Alert.alert("Buka Blokir", `Buka blokir ${otherPersonName}?`, [
        { text: "Batal", style: "cancel" },
        {
          text: "Buka Blokir",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("blocked_users")
                .delete()
                .or(
                  `and(blocker_id.eq.${user.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${user.id})`
                );

              if (error) throw error;

              setIsBlocked(false);
              setBlockedBy(null);
              setShowMenu(false);
              // Auto refresh block status
              setTimeout(() => checkBlockStatus(), 500);
              Alert.alert("Sukses", "User berhasil dibuka blokirnya");
            } catch (error) {
              console.error("Error unblocking user:", error);
              Alert.alert("Error", "Gagal membuka blokir user");
            }
          },
        },
      ]);
    } else {
      // Block user
      Alert.alert("Blokir User", `Blokir ${otherPersonName}?`, [
        { text: "Batal", style: "cancel" },
        {
          text: "Blokir",
          style: "destructive",
          onPress: async () => {
            try {
              // Use upsert to handle if block already exists
              const { error } = await supabase.from("blocked_users").upsert(
                {
                  blocker_id: user.id,
                  blocked_id: otherUserId,
                },
                {
                  onConflict: "blocker_id,blocked_id",
                }
              );

              if (error) throw error;

              setIsBlocked(true);
              setBlockedBy(user.id);
              setShowMenu(false);
              // Auto refresh block status
              setTimeout(() => checkBlockStatus(), 500);
              Alert.alert("Sukses", "User berhasil diblokir");
            } catch (error) {
              console.error("Error blocking user:", error);
              Alert.alert(
                "Error",
                "Gagal memblokir user: " + (error as any).message
              );
            }
          },
        },
      ]);
    }
  };

  const getMessageStatus = (message: Message) => {
    if (message.sender_id !== user?.id) return null; // Only show status for sent messages

    if (message.is_read) {
      return "read";
    } else if (message.is_delivered) {
      return "delivered";
    } else {
      return "sent";
    }
  };

  const renderMessageContent = (content: string, isSent: boolean) => {
    // Check if message contains image
    if (content.startsWith("[IMAGE]")) {
      const imageUrl = content.replace("[IMAGE]", "");
      return (
        <TouchableOpacity
          onPress={() => {
            setSelectedImage(imageUrl);
            setImageModalVisible(true);
          }}
          activeOpacity={0.8}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.messageImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }

    // Check if message contains file
    if (content.startsWith("[FILE]")) {
      const [fileName, fileUrl] = content.replace("[FILE]", "").split("|");
      const fileExt = fileName.split(".").pop()?.toLowerCase() || "";

      // Determine icon based on file extension
      const getFileIcon = (ext: string) => {
        if (["pdf"].includes(ext)) return "document-text";
        if (["doc", "docx"].includes(ext)) return "document";
        if (["xls", "xlsx", "csv"].includes(ext)) return "stats-chart";
        if (["ppt", "pptx"].includes(ext)) return "easel";
        if (["zip", "rar"].includes(ext)) return "archive";
        if (["txt"].includes(ext)) return "document-text-outline";
        return "document-attach";
      };

      return (
        <TouchableOpacity
          onPress={() => handleDownloadFile(fileUrl, fileName)}
          style={[
            styles.fileContainer,
            isSent ? styles.fileContainerSent : styles.fileContainerReceived,
          ]}
          activeOpacity={0.7}>
          <View
            style={[
              styles.fileIconContainer,
              isSent ? styles.fileIconSent : styles.fileIconReceived,
            ]}>
            <Ionicons
              name={getFileIcon(fileExt) as any}
              size={28}
              color={isSent ? "#3b82f6" : "#f59e0b"}
            />
          </View>
          <View style={styles.fileInfo}>
            <Text
              style={[
                styles.fileName,
                isSent ? styles.sentText : styles.receivedText,
              ]}
              numberOfLines={2}>
              {fileName}
            </Text>
            <View style={styles.fileFooter}>
              <Ionicons
                name="download-outline"
                size={12}
                color={isSent ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"}
              />
              <Text
                style={[
                  styles.fileAction,
                  isSent ? styles.sentText : styles.receivedText,
                ]}>
                Tap to download
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Regular text message
    return (
      <Text
        style={[
          styles.messageText,
          isSent ? styles.sentText : styles.receivedText,
        ]}>
        {content}
      </Text>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isSent = item.sender_id === user?.id;
    const status = getMessageStatus(item);

    return (
      <View
        style={[
          styles.messageContainer,
          isSent ? styles.sentMessage : styles.receivedMessage,
        ]}>
        <View
          style={[
            styles.messageBubble,
            isSent ? styles.sentBubble : styles.receivedBubble,
          ]}>
          {renderMessageContent(item.content, isSent)}
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.timeText,
                isSent ? styles.sentTime : styles.receivedTime,
              ]}>
              {formatMessageTime(item.created_at)}
            </Text>
            {isSent && status && (
              <View style={styles.statusContainer}>
                {status === "read" && (
                  <Text style={styles.statusRead}>Read</Text>
                )}
                {status === "delivered" && (
                  <Ionicons
                    name="checkmark-done"
                    size={14}
                    color="rgba(255, 255, 255, 0.7)"
                  />
                )}
                {status === "sent" && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="rgba(255, 255, 255, 0.7)"
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Memuat chat...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerAvatar}>
          {otherUserAvatar ? (
            <Image
              source={{ uri: otherUserAvatar }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {otherPersonName?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {otherPersonName}
          </Text>
          {carInfo && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {carInfo}
            </Text>
          )}
          <Text
            style={[
              styles.onlineStatus,
              isOtherUserOnline && styles.onlineStatusActive,
            ]}>
            {isOtherUserOnline ? "Online" : "Offline"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={handleClearChat}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={styles.menuText}>Hapus Pesan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDeleteChat}>
              <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
              <Text style={styles.menuText}>Hapus Chat</Text>
            </TouchableOpacity>

            {(!isBlocked || blockedBy === user?.id) && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleBlockUser}>
                <Ionicons
                  name={isBlocked ? "checkmark-circle-outline" : "ban-outline"}
                  size={20}
                  color={isBlocked ? "#10b981" : "#ef4444"}
                />
                <Text
                  style={[styles.menuText, isBlocked && { color: "#10b981" }]}>
                  {isBlocked ? "Buka Blokir" : "Blokir User"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Chat Messages */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}>
        {isBlocked && (
          <View style={styles.blockedBanner}>
            <Ionicons name="ban" size={16} color="#ef4444" />
            <Text style={styles.blockedText}>
              {blockedBy === user?.id
                ? "Anda memblokir kontak ini. Klik menu untuk membuka blokir."
                : "Anda diblokir kontak ini."}
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handlePickDocument}
            disabled={isBlocked || uploadingFile}>
            <Ionicons
              name="attach"
              size={24}
              color={isBlocked || uploadingFile ? "#94a3b8" : "#64748b"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handlePickImage}
            disabled={isBlocked || uploadingFile}>
            <Ionicons
              name="image"
              size={24}
              color={isBlocked || uploadingFile ? "#94a3b8" : "#64748b"}
            />
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, isBlocked && styles.textInputDisabled]}
            placeholder={
              uploadingFile
                ? "Mengupload..."
                : isBlocked
                ? "Tidak dapat mengirim pesan"
                : "Ketik pesan..."
            }
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isBlocked && !uploadingFile}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isBlocked || uploadingFile) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isBlocked || uploadingFile}>
            <Ionicons
              name="send"
              size={20}
              color={
                inputText.trim() && !isBlocked && !uploadingFile
                  ? "#ffffff"
                  : "#94a3b8"
              }
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Image Lightbox Modal with Zoom */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setImageModalVisible(false);
          setImageScale(1);
        }}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => {
              setImageModalVisible(false);
              setImageScale(1);
            }}>
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>

          {selectedImage && (
            <ScrollView
              contentContainerStyle={styles.imageScrollContainer}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}>
              <View style={styles.imageViewerContainer}>
                <Image
                  source={{ uri: selectedImage }}
                  style={[
                    styles.fullscreenImage,
                    { transform: [{ scale: imageScale }] },
                  ]}
                  resizeMode="contain"
                />
              </View>
            </ScrollView>
          )}

          {/* Zoom Controls */}
          <View style={styles.zoomControls}>
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={() => setImageScale((prev) => Math.min(prev + 0.5, 3))}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.zoomText}>{Math.round(imageScale * 100)}%</Text>
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={() => setImageScale((prev) => Math.max(prev - 0.5, 1))}>
              <Ionicons name="remove" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Download Button */}
          {selectedImage && (
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => Linking.openURL(selectedImage)}>
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.downloadButtonText}>Download</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f59e0b",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#60a5fa",
    marginTop: 2,
  },
  onlineStatus: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  onlineStatusActive: {
    color: "#22c55e",
  },
  moreButton: {
    padding: 4,
    marginLeft: 12,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  messagesContainer: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: "80%",
  },
  sentMessage: {
    alignSelf: "flex-end",
  },
  receivedMessage: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sentBubble: {
    backgroundColor: "#3b82f6",
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: "#1e293b",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  sentText: {
    color: "#ffffff",
  },
  receivedText: {
    color: "#e2e8f0",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
  },
  sentTime: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  receivedTime: {
    color: "#94a3b8",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 4,
  },
  statusRead: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.7)",
    fontStyle: "italic",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#334155",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#ffffff",
    maxHeight: 100,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
    minWidth: 220,
    maxWidth: 280,
  },
  fileContainerSent: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  fileContainerReceived: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  fileIconSent: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  fileIconReceived: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    lineHeight: 18,
  },
  fileFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fileAction: {
    fontSize: 11,
    opacity: 0.6,
    fontStyle: "italic",
  },
  sendButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 24,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#334155",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    gap: 12,
  },
  menuText: {
    color: "#ef4444",
    fontSize: 15,
    fontWeight: "500",
  },
  blockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  blockedText: {
    flex: 1,
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "500",
  },
  textInputDisabled: {
    backgroundColor: "#1e293b",
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imageScrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerContainer: {
    flex: 1,
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height - 200,
  },
  zoomControls: {
    position: "absolute",
    top: 50,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 8,
    borderRadius: 20,
  },
  zoomButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(59, 130, 246, 0.8)",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  zoomText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    minWidth: 50,
    textAlign: "center",
  },
  imageActions: {
    position: "absolute",
    bottom: 30,
    right: 20,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  downloadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
