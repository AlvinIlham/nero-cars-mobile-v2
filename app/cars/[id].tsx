import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCarStore } from "@/store/carStore";
import { useAuthStore } from "@/store/authStore";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import type { Car } from "@/types";

const { width } = Dimensions.get("window");

export default function CarDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const fetchCarById = useCarStore((state) => state.fetchCarById);
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    loadCar();
  }, [id]);

  const loadCar = async () => {
    if (typeof id === "string") {
      const data = await fetchCarById(id);
      setCar(data);
      setLoading(false);
    }
  };

  const parseImages = (images: any): string[] => {
    if (!images) return [];
    if (typeof images === "string") {
      try {
        const parsed = JSON.parse(images);
        return Array.isArray(parsed)
          ? parsed.filter((img: string) => img && img.startsWith("http"))
          : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(images)
      ? images.filter((img: string) => img && img.startsWith("http"))
      : [];
  };

  const getCarImages = (): string[] => {
    if (!car) return [];
    const images = parseImages(car.images);
    return images.length > 0 ? images : ["https://via.placeholder.com/400"];
  };

  const handleContactSeller = () => {
    if (!user) {
      Alert.alert("Login Required", "Please login to contact the seller", [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.push("/login") },
      ]);
      return;
    }

    if (!car?.user_id) {
      Alert.alert("Error", "Seller information not available");
      return;
    }

    if (car.user_id === user.id) {
      Alert.alert("Info", "This is your own car listing");
      return;
    }

    // Navigate to chat with seller
    router.push({
      pathname: "/chat/[userId]",
      params: {
        userId: car.user_id,
        userName: `Seller of ${car.brand} ${car.model}`,
        carId: car.id,
      },
    });
  };

  const formatPrice = (price: number) => {
    return `Rp ${price.toLocaleString("id-ID")}`;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!car) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Car not found</Text>
      </View>
    );
  }

  const carImages = getCarImages();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={{
            uri:
              carImages[currentImageIndex] || "https://via.placeholder.com/400",
          }}
          style={styles.mainImage}
          resizeMode="cover"
        />
        {carImages.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageThumbnails}>
            {carImages.map((image, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setCurrentImageIndex(index)}>
                <Image
                  source={{ uri: image }}
                  style={[
                    styles.thumbnail,
                    currentImageIndex === index && styles.thumbnailActive,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={styles.brand}>{car.brand}</Text>
            <Text style={styles.model}>{car.model}</Text>
            <Text style={styles.year}>{car.year}</Text>
          </View>
          <TouchableOpacity style={styles.favoriteButton}>
            <Feather name="heart" color="#f59e0b" size={24} />
          </TouchableOpacity>
        </View>

        <Text style={styles.price}>{formatPrice(car.price)}</Text>

        <View style={styles.specs}>
          <View style={styles.specItem}>
            <Feather name="map-pin" color="#94a3b8" size={20} />
            <Text style={styles.specText}>{car.location}</Text>
          </View>
          <View style={styles.specItem}>
            <MaterialCommunityIcons
              name="speedometer"
              color="#94a3b8"
              size={20}
            />
            <Text style={styles.specText}>
              {car.mileage.toLocaleString()} km
            </Text>
          </View>
          <View style={styles.specItem}>
            <MaterialCommunityIcons
              name="gas-station"
              color="#94a3b8"
              size={20}
            />
            <Text style={styles.specText}>{car.fuel_type}</Text>
          </View>
          <View style={styles.specItem}>
            <Feather name="credit-card" color="#94a3b8" size={20} />
            <Text style={styles.specText}>{car.transmission}</Text>
          </View>
        </View>

        {car.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{car.description}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Color</Text>
              <Text style={styles.detailValue}>{car.color}</Text>
            </View>
            {car.condition && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Condition</Text>
                <Text style={styles.detailValue}>{car.condition}</Text>
              </View>
            )}
            {car.engine_capacity && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Engine</Text>
                <Text style={styles.detailValue}>{car.engine_capacity}</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.contactButton}
          onPress={handleContactSeller}>
          <Ionicons
            name="chatbubble-ellipses"
            size={20}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.contactButtonText}>Hubungi Penjual</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
  },
  imageContainer: {
    backgroundColor: "#1e293b",
  },
  mainImage: {
    width: width,
    height: width * 0.75,
  },
  imageThumbnails: {
    padding: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    opacity: 0.6,
  },
  thumbnailActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: "#f59e0b",
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  titleSection: {
    flex: 1,
  },
  brand: {
    fontSize: 14,
    color: "#f59e0b",
    fontWeight: "600",
  },
  model: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 4,
  },
  year: {
    fontSize: 16,
    color: "#94a3b8",
    marginTop: 4,
  },
  favoriteButton: {
    padding: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
  },
  specs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  specItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "45%",
  },
  specText: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  description: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 22,
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  detailLabel: {
    color: "#94a3b8",
    fontSize: 14,
  },
  detailValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  contactButton: {
    flexDirection: "row",
    backgroundColor: "#f59e0b",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  contactButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
