import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function Index() {
  const router = useRouter();
  const { loading, checkAuth } = useAuthStore();

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      // Always redirect to home, no auth required for browsing
      router.replace("/(tabs)");
    };

    init();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
});
