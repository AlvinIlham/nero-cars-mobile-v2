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
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

interface FavoriteCar {
  id: number;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuel_type: string;
  transmission: string;
  images: any; // Can be string or array
  location: string;
  favorite_id: number;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteCar[]>([]);

  useEffect(() => {
    fetchFavorites();
  }, []);

  // Refresh favorites when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchFavorites();
    }, [user?.id])
  );

  const fetchFavorites = async () => {
    try {
      if (!user?.id) {
        console.log("No user logged in");
        setLoading(false);
        return;
      }

      console.log("Fetching favorites for user:", user.id);

      const { data, error } = await supabase
        .from("favorites")
        .select(
          `
          id,
          car_id,
          cars (
            id,
            brand,
            model,
            year,
            price,
            mileage,
            fuel_type,
            transmission,
            images,
            location
          )
        `
        )
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching favorites:", error);
        setFavorites([]);
        return;
      }

      console.log("Favorites data received:", data);

      // Transform the data
      const favoriteCars: FavoriteCar[] = (data || [])
        .filter((item: any) => item.cars) // Only include items with valid car data
        .map((item: any) => ({
          ...item.cars,
          favorite_id: item.id,
        }));

      console.log("Transformed favorite cars:", favoriteCars);
      setFavorites(favoriteCars);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      setFavorites([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFavorites();
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
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mM8+R8AAp8BzdNtlUkAAAAASUVORK5CYII=";
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const removeFavorite = async (favoriteId: number, carName: string) => {
    Alert.alert("Hapus Favorit", `Hapus ${carName} dari favorit?`, [
      {
        text: "Batal",
        style: "cancel",
      },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("favorites")
              .delete()
              .eq("id", favoriteId);

            if (error) throw error;

            Alert.alert("Sukses", "Berhasil dihapus dari favorit");
            fetchFavorites(); // Refresh list
          } catch (error: any) {
            console.error("Error removing favorite:", error);
            Alert.alert("Error", "Gagal menghapus dari favorit");
          }
        },
      },
    ]);
  };

  const renderCarItem = ({ item }: { item: FavoriteCar }) => (
    <TouchableOpacity
      style={styles.carCard}
      onPress={() => router.push(`/cars/${item.id}`)}
      activeOpacity={0.8}>
      <Image
        source={{ uri: getFirstImage(item.images) }}
        style={styles.carImage}
        resizeMode="cover"
      />

      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={() =>
          removeFavorite(item.favorite_id, `${item.brand} ${item.model}`)
        }>
        <Ionicons name="heart" size={24} color="#ef4444" />
      </TouchableOpacity>

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

        {item.location && (
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={14} color="#94a3b8" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        )}

        <Text style={styles.carPrice}>{formatPrice(item.price)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="heart-outline" size={80} color="#475569" />
      <Text style={styles.emptyText}>Belum Ada Favorit</Text>
      <Text style={styles.emptySubtext}>
        Jelajahi mobil dan tambahkan ke favorit Anda
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => router.push("/(tabs)")}>
        <Ionicons name="search" size={20} color="#fff" />
        <Text style={styles.browseButtonText}>Jelajahi Mobil</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat favorit...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        renderItem={renderCarItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={
          favorites.length === 0 ? styles.emptyList : styles.list
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
  favoriteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    padding: 8,
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
    marginBottom: 8,
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
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  locationText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  carPrice: {
    color: "#f59e0b",
    fontSize: 20,
    fontWeight: "bold",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 24,
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  browseButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
