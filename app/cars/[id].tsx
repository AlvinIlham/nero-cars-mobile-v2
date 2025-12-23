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
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCarStore } from "@/store/carStore";
import { useAuthStore } from "@/store/authStore";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import type { Car } from "@/types";
import { getOrCreateConversation } from "@/lib/chatService";
import { supabase } from "@/lib/supabase";

const { width } = Dimensions.get("window");

export default function CarDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
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

  const handleContactSeller = async () => {
    console.log("=== HUBUNGI PENJUAL CLICKED ===");
    console.log("User:", user);
    console.log("Car:", car);

    if (!user) {
      console.log("ERROR: User not logged in");
      Alert.alert("Login Required", "Please login to contact the seller", [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.push("/auth/login") },
      ]);
      return;
    }

    if (!car?.user_id) {
      console.log("ERROR: Car user_id not available");
      Alert.alert("Error", "Seller information not available");
      return;
    }

    if (car.user_id === user.id) {
      console.log("ERROR: User trying to contact themselves");
      Alert.alert("Info", "This is your own car listing");
      return;
    }

    try {
      console.log("STEP 1: Creating conversation...");
      console.log("Params:", {
        carId: car.id,
        buyerId: user.id,
        sellerId: car.user_id,
      });

      const { data: conversation, error: convError } =
        await getOrCreateConversation(car.id, user.id, car.user_id);

      console.log("STEP 2: Conversation result:", {
        conversation,
        error: convError,
      });

      if (convError || !conversation) {
        console.error("ERROR: Failed to create conversation:", convError);
        Alert.alert(
          "Error",
          "Failed to create conversation. Please try again."
        );
        return;
      }

      console.log("SUCCESS: Conversation ID:", conversation.id);

      console.log("STEP 3: Getting seller profile...");
      const { data: sellerProfile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", car.user_id)
        .single();

      console.log("Seller profile result:", {
        sellerProfile,
        error: profileError,
      });

      const chatParams = {
        id: conversation.id,
        otherPersonName: sellerProfile?.full_name || "Seller",
        carInfo: `${car.brand} ${car.model} ${car.year}`,
      };

      console.log("STEP 4: Navigation params:", chatParams);
      console.log("STEP 5: Attempting navigation to /messages/[id]");

      // Try different navigation approaches
      const navigationPath = "/messages/" + conversation.id;
      console.log("Navigation path:", navigationPath);

      // Navigate to chat room
      router.push({
        pathname: "/messages/[id]" as any,
        params: chatParams,
      } as any);

      console.log("STEP 6: Navigation called successfully");
    } catch (error) {
      console.error("ERROR: Exception caught:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      Alert.alert("Error", "Failed to open chat. Please try again.");
    }
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingBottom: Math.max(insets.bottom, 20) + 80, // Add extra padding for button
      }}>
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

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContactSeller}
            activeOpacity={0.8}>
            <Ionicons
              name="chatbubble-ellipses"
              size={20}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.contactButtonText}>Hubungi Penjual</Text>
          </TouchableOpacity>
        </View>
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
  buttonContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  contactButton: {
    flexDirection: "row",
    backgroundColor: "#f59e0b",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#f59e0b",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contactButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
