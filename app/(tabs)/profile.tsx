import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { Feather } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchAvatar();
    }
  }, [user]);

  const fetchAvatar = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user?.id)
        .single();

      if (error) {
        console.error("Error fetching avatar:", error);
        return;
      }

      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert("Success", "Logged out successfully");
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.authPrompt}>
          <Feather name="user" color="#94a3b8" size={64} />
          <Text style={styles.authTitle}>Not Logged In</Text>
          <Text style={styles.authSubtext}>
            Login to access your profile and save favorites
          </Text>
          <Link href="/auth/login" asChild>
            <TouchableOpacity style={styles.loginButton}>
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/auth/register" asChild>
            <TouchableOpacity style={styles.registerButton}>
              <Text style={styles.registerButtonText}>Create Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Feather name="user" color="#f59e0b" size={48} />
            )}
          </View>
          <Text style={styles.name}>{user.full_name || "User"}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        <View style={styles.menu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/profile/edit")}>
            <View style={styles.menuIconContainer}>
              <Feather name="user" color="#f59e0b" size={20} />
            </View>
            <Text style={styles.menuText}>Edit Profile</Text>
            <Feather name="chevron-right" color="#64748b" size={20} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/messages")}>
            <View style={styles.menuIconContainer}>
              <Feather name="message-circle" color="#f59e0b" size={20} />
            </View>
            <Text style={styles.menuText}>Chat</Text>
            <Feather name="chevron-right" color="#64748b" size={20} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/notifications")}>
            <View style={styles.menuIconContainer}>
              <Feather name="bell" color="#f59e0b" size={20} />
            </View>
            <Text style={styles.menuText}>Notifikasi</Text>
            <Feather name="chevron-right" color="#64748b" size={20} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(tabs)/favorites")}>
            <View style={styles.menuIconContainer}>
              <Feather name="heart" color="#f59e0b" size={20} />
            </View>
            <Text style={styles.menuText}>Favorite</Text>
            <Feather name="chevron-right" color="#64748b" size={20} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/my-cars")}>
            <View style={styles.menuIconContainer}>
              <Feather name="truck" color="#f59e0b" size={20} />
            </View>
            <Text style={styles.menuText}>Mobil Saya</Text>
            <Feather name="chevron-right" color="#64748b" size={20} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <View
              style={[
                styles.menuIconContainer,
                { backgroundColor: "#fef2f2" },
              ]}>
              <Feather name="log-out" color="#ef4444" size={20} />
            </View>
            <Text style={[styles.menuText, { color: "#ef4444", flex: 1 }]}>
              Keluar
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  authPrompt: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  authSubtext: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    width: "100%",
    alignItems: "center",
  },
  loginButtonText: {
    color: "#0f172a",
    fontWeight: "bold",
    fontSize: 16,
  },
  registerButton: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  registerButtonText: {
    color: "#f59e0b",
    fontWeight: "bold",
    fontSize: 16,
  },
  profileHeader: {
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#94a3b8",
  },
  menu: {
    padding: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    marginBottom: 8,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff5e6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    color: "#fff",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#334155",
    marginVertical: 12,
  },
});
