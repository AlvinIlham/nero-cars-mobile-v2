import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

interface Car {
  id: number;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuel_type: string;
  transmission: string;
  images: string[];
  is_draft: boolean;
  created_at: string;
}

export default function MyCarsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cars, setCars] = useState<Car[]>([]);

  useEffect(() => {
    fetchMyCars();
  }, []);

  const fetchMyCars = async () => {
    try {
      if (!user?.id) {
        Alert.alert("Error", "User tidak ditemukan");
        return;
      }

      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCars(data || []);
    } catch (error: any) {
      console.error("Error fetching cars:", error);
      Alert.alert("Error", "Gagal memuat mobil Anda");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyCars();
  };

  const parseImages = (images: any): string[] => {
    if (!images) return [];
    if (typeof images === "string") {
      try {
        const parsed = JSON.parse(images);
        return Array.isArray(parsed)
          ? parsed.filter((img) => img && img.startsWith("http"))
          : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(images)
      ? images.filter((img) => img && img.startsWith("http"))
      : [];
  };

  const getFirstImage = (images: string[]): string => {
    const validImages = parseImages(images);
    if (validImages.length > 0) {
      return validImages[0];
    }
    // Base64 1x1 gray placeholder
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mM8+R8AAp8BzdNtlUkAAAAASUVORK5CYII=";
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleDeleteCar = (carId: number, carName: string) => {
    Alert.alert(
      "Hapus Mobil",
      `Apakah Anda yakin ingin menghapus ${carName}?`,
      [
        {
          text: "Batal",
          style: "cancel",
        },
        {
          text: "Hapus",
          style: "destructive",
          onPress: () => deleteCar(carId),
        },
      ]
    );
  };

  const deleteCar = async (carId: number) => {
    try {
      const { error } = await supabase.from("cars").delete().eq("id", carId);

      if (error) throw error;

      Alert.alert("Sukses", "Mobil berhasil dihapus");
      fetchMyCars(); // Refresh list
    } catch (error: any) {
      console.error("Error deleting car:", error);
      Alert.alert("Error", "Gagal menghapus mobil");
    }
  };

  const handleEditCar = (carId: number) => {
    router.push(`/my-cars/${carId}/edit`);
  };

  const renderCarItem = ({ item }: { item: Car }) => (
    <View style={styles.carCard}>
      <Image
        source={{ uri: getFirstImage(item.images) }}
        style={styles.carImage}
        resizeMode="cover"
      />

      {/* Status Badge */}
      <View
        style={[
          styles.statusBadge,
          item.is_draft ? styles.draftBadge : styles.publishedBadge,
        ]}>
        <Text style={styles.statusText}>
          {item.is_draft ? "Draft" : "Dipublikasikan"}
        </Text>
      </View>

      <View style={styles.carInfo}>
        <Text style={styles.carTitle}>
          {item.brand} {item.model}
        </Text>
        <Text style={styles.carYear}>{item.year}</Text>

        <View style={styles.carDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="speedometer-outline" size={16} color="#94a3b8" />
            <Text style={styles.detailText}>
              {item.mileage.toLocaleString()} km
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="water-outline" size={16} color="#94a3b8" />
            <Text style={styles.detailText}>{item.fuel_type}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="settings-outline" size={16} color="#94a3b8" />
            <Text style={styles.detailText}>{item.transmission}</Text>
          </View>
        </View>

        <Text style={styles.carPrice}>{formatPrice(item.price)}</Text>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEditCar(item.id)}>
            <Ionicons name="pencil-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() =>
              handleDeleteCar(item.id, `${item.brand} ${item.model}`)
            }>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Hapus</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="car-outline" size={80} color="#475569" />
      <Text style={styles.emptyTitle}>Belum Ada Mobil</Text>
      <Text style={styles.emptyText}>
        Anda belum memiliki mobil yang dijual. Mulai jual mobil Anda sekarang!
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/(tabs)/sell-car")}>
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Jual Mobil</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: "Mobil Saya",
            headerShown: true,
            headerStyle: {
              backgroundColor: "#1e293b",
            },
            headerTintColor: "#fff",
          }}
        />
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat mobil Anda...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Mobil Saya",
          headerShown: true,
          headerStyle: {
            backgroundColor: "#1e293b",
          },
          headerTintColor: "#fff",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/sell-car")}
              style={styles.headerButton}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        data={cars}
        renderItem={renderCarItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={
          cars.length === 0 ? styles.emptyList : styles.list
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
  carCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155",
  },
  carImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#334155",
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  draftBadge: {
    backgroundColor: "#64748b",
  },
  publishedBadge: {
    backgroundColor: "#10b981",
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  carInfo: {
    padding: 16,
  },
  carTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  carYear: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 12,
  },
  carDetails: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  carPrice: {
    color: "#f59e0b",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  editButton: {
    backgroundColor: "#3b82f6",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
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
    marginBottom: 24,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
