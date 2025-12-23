import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useCarStore } from "@/store/carStore";
import { Feather, Ionicons } from "@expo/vector-icons";
import type { Car } from "@/types";
import { supabase } from "@/lib/supabase";
import { getOrCreateConversation } from "@/lib/chatService";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 40;

type FilterState = {
  brand: string;
  transmission: string;
  fuelType: string;
  location: string;
  minPrice: number;
  maxPrice: number;
  minYear: number;
  maxYear: number;
};

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { cars, fetchCars, loading } = useCarStore();
  const [featuredCars, setFeaturedCars] = useState<Car[]>([]);
  const [brandCars, setBrandCars] = useState<Car[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [imageIndexes, setImageIndexes] = useState<{ [key: string]: number }>(
    {}
  );
  const [filters, setFilters] = useState<FilterState>({
    brand: "",
    transmission: "",
    fuelType: "",
    location: "",
    minPrice: 0,
    maxPrice: 0,
    minYear: 0,
    maxYear: 0,
  });
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // State untuk filter options dari database
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [availableTransmissions, setAvailableTransmissions] = useState<
    string[]
  >([]);
  const [availableFuelTypes, setAvailableFuelTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchCars();
    fetchFilterOptions();
    if (user?.id) {
      fetchFavorites();
      fetchUnreadNotifications();
      fetchUnreadMessages();
    }

    // Subscribe to realtime changes on cars table
    const carsChannel = supabase
      .channel("home-cars-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cars",
        },
        (payload) => {
          console.log("🔄 Cars realtime update:", payload.eventType);
          // Refresh cars data when changes occur
          fetchCars();
        }
      )
      .subscribe();

    // Subscribe to realtime changes on notifications table
    const notificationsChannel = user?.id
      ? supabase
          .channel(`home-notifications-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              console.log(
                "🔔 Notification realtime update:",
                payload.eventType,
                payload
              );
              // Refresh unread count when notifications change
              fetchUnreadNotifications();
            }
          )
          .subscribe((status) => {
            console.log("🔔 Notifications subscription status:", status);
          })
      : null;

    // Subscribe to realtime changes on messages table
    const messagesChannel = user?.id
      ? supabase
          .channel(`home-messages-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
            },
            (payload) => {
              console.log(
                "💬 Message realtime update:",
                payload.eventType,
                payload
              );
              // Refresh unread count when messages change
              fetchUnreadMessages();
            }
          )
          .subscribe((status) => {
            console.log("💬 Messages subscription status:", status);
          })
      : null;

    return () => {
      supabase.removeChannel(carsChannel);
      if (notificationsChannel) {
        supabase.removeChannel(notificationsChannel);
      }
      if (messagesChannel) {
        supabase.removeChannel(messagesChannel);
      }
    };
  }, [user]);

  // Refresh unread notifications when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        console.log(
          "🔄 Screen focused - refreshing notifications and messages"
        );
        fetchUnreadNotifications();
        fetchUnreadMessages();
      }
    }, [user])
  );

  const resetFilters = () => {
    setFilters({
      brand: "",
      transmission: "",
      fuelType: "",
      location: "",
      minPrice: 0,
      maxPrice: 0,
      minYear: 0,
      maxYear: 0,
    });
  };

  const fetchFavorites = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from("favorites")
        .select("car_id")
        .eq("user_id", user.id);

      if (error) {
        console.log("Error fetching favorites:", error.message);
        return;
      }

      const favSet = new Set(data?.map((f) => f.car_id) || []);
      setFavorites(favSet);
    } catch (error) {
      console.log("Error in fetchFavorites:", error);
    }
  };

  const fetchUnreadNotifications = async () => {
    try {
      if (!user?.id) {
        console.log("⚠️ No user ID, skipping notification fetch");
        return;
      }

      console.log("🔔 Fetching unread notifications for user:", user.id);

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.log("❌ Error fetching unread notifications:", error.message);
        return;
      }

      console.log("✅ Unread notifications count:", count);
      setUnreadNotifCount(count || 0);
    } catch (error) {
      console.log("❌ Error in fetchUnreadNotifications:", error);
    }
  };

  const fetchUnreadMessages = async () => {
    try {
      if (!user?.id) {
        console.log("⚠️ No user ID, skipping messages fetch");
        return;
      }

      console.log("💬 Fetching unread messages for user:", user.id);

      // Get conversation IDs in single query
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (convError) {
        console.log("❌ Error fetching conversations:", convError.message);
        return;
      }

      if (!conversations || conversations.length === 0) {
        console.log("✅ No conversations found");
        setUnreadMessagesCount(0);
        return;
      }

      // Count all unread messages in ONE query using .in()
      const conversationIds = conversations.map((c) => c.id);
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", conversationIds)
        .eq("is_read", false)
        .neq("sender_id", user.id);

      if (error) {
        console.log("❌ Error counting unread messages:", error.message);
        return;
      }

      console.log("✅ Unread messages count:", count || 0);
      setUnreadMessagesCount(count || 0);
    } catch (error) {
      console.log("❌ Error in fetchUnreadMessages:", error);
    }
  };
  const fetchFilterOptions = async () => {
    try {
      const defaultBrands = [
        "Toyota",
        "Honda",
        "Daihatsu",
        "Suzuki",
        "Mitsubishi",
        "Nissan",
        "Mazda",
        "BMW",
        "Mercedes-Benz",
        "Audi",
        "Volkswagen",
        "Hyundai",
        "KIA",
        "Ford",
        "Chevrolet",
        "Wuling",
        "DFSK",
        "MG",
        "Lexus",
        "Isuzu",
        "Subaru",
        "Peugeot",
        "Renault",
        "Porsche",
        "Tesla",
      ].sort();

      const defaultLocations = [
        "Jakarta",
        "Surabaya",
        "Bandung",
        "Medan",
        "Semarang",
        "Makassar",
        "Palembang",
        "Tangerang",
        "Depok",
        "Bekasi",
        "Bogor",
        "Batam",
        "Pekanbaru",
        "Bandar Lampung",
        "Padang",
        "Malang",
        "Denpasar",
        "Samarinda",
        "Balikpapan",
        "Pontianak",
        "Manado",
        "Yogyakarta",
        "Solo",
        "Cirebon",
        "Serang",
      ].sort();

      const defaultTransmissions = [
        "Manual",
        "Automatic",
        "CVT",
        "DCT",
        "Semi-Automatic",
        "AMT",
        "Dual Clutch",
        "Tiptronic",
      ];

      const defaultFuelTypes = [
        "Bensin",
        "Diesel",
        "Electric",
        "Hybrid",
        "Plug-in Hybrid",
        "CNG",
        "LPG",
        "Flex Fuel",
        "Hydrogen",
        "Biodiesel",
      ];

      const { data: brandsData } = await supabase
        .from("brands")
        .select("name")
        .order("name");

      const { data: locationsData } = await supabase
        .from("locations")
        .select("city")
        .order("city");

      const { data: carsData } = await supabase
        .from("cars")
        .select("brand, location, transmission, fuel_type");

      if (brandsData && brandsData.length > 0) {
        setAvailableBrands(brandsData.map((b) => b.name).sort());
      } else if (carsData && carsData.length > 0) {
        const carBrands = [
          ...new Set(carsData.map((car) => car.brand).filter(Boolean)),
        ];
        setAvailableBrands(
          [...new Set([...carBrands, ...defaultBrands])].sort()
        );
      } else {
        setAvailableBrands(defaultBrands);
      }

      if (locationsData && locationsData.length > 0) {
        setAvailableLocations(locationsData.map((l) => l.city).sort());
      } else if (carsData && carsData.length > 0) {
        const carLocations = [
          ...new Set(carsData.map((car) => car.location).filter(Boolean)),
        ];
        setAvailableLocations(
          [...new Set([...carLocations, ...defaultLocations])].sort()
        );
      } else {
        setAvailableLocations(defaultLocations);
      }

      if (carsData && carsData.length > 0) {
        const carTransmissions = [
          ...new Set(carsData.map((car) => car.transmission).filter(Boolean)),
        ];
        setAvailableTransmissions(
          [...new Set([...carTransmissions, ...defaultTransmissions])].sort()
        );

        const carFuelTypes = [
          ...new Set(carsData.map((car) => car.fuel_type).filter(Boolean)),
        ];
        setAvailableFuelTypes(
          [...new Set([...carFuelTypes, ...defaultFuelTypes])].sort()
        );
      } else {
        setAvailableTransmissions(defaultTransmissions.sort());
        setAvailableFuelTypes(defaultFuelTypes.sort());
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const toggleFavorite = async (carId: string) => {
    console.log("❤️ toggleFavorite called with carId:", carId);
    console.log("👤 Current user:", user ? user.email : "Not logged in");

    if (!user) {
      console.log("⚠️ User not logged in, showing alert");
      Alert.alert("Login Required", "Please login to save favorites", [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.push("/login") },
      ]);
      return;
    }

    try {
      const isFavorited = favorites.has(carId);
      console.log("💝 Is currently favorited:", isFavorited);

      if (isFavorited) {
        console.log("🗑️ Removing from favorites...");
        // Remove from favorites
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("car_id", carId);

        if (error) throw error;

        setFavorites((prev) => {
          const newSet = new Set(prev);
          newSet.delete(carId);
          return newSet;
        });
        console.log("✅ Successfully removed from favorites");
      } else {
        console.log("➕ Adding to favorites...");
        // Add to favorites
        const { error: favoriteError } = await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            car_id: carId,
          });

        if (favoriteError) throw favoriteError;

        // Get car details to send notification
        const car = cars.find((c) => c.id === carId);

        console.log("🚗 Car found:", car ? "Yes" : "No");
        console.log("🚗 Car user_id:", car?.user_id);
        console.log("👤 Current user id:", user.id);
        console.log("🎯 Same user?", car?.user_id === user.id);

        if (car && car.user_id && car.user_id !== user.id) {
          console.log("📤 Attempting to create notification for car owner...");

          // Send notification to car owner
          const { data: notifData, error: notifError } = await supabase
            .from("notifications")
            .insert({
              user_id: car.user_id,
              type: "favorite",
              title: "Mobil Difavoritkan",
              message: `${
                user.full_name || user.email?.split("@")[0] || "Seseorang"
              } menyukai ${car.brand} ${car.model} Anda`,
              link: `/cars/${carId}`,
              is_read: false,
            })
            .select();

          if (notifError) {
            console.error(
              "❌ Error creating favorite notification:",
              notifError
            );
            console.error(
              "❌ Error details:",
              JSON.stringify(notifError, null, 2)
            );
          } else {
            console.log("✅ Notification created successfully!");
            console.log("✅ Notification data:", notifData);
          }
        } else if (!car) {
          console.log("⚠️ Car not found in cars array");
        } else if (!car.user_id) {
          console.log("⚠️ Car has no user_id");
        } else if (car.user_id === user.id) {
          console.log(
            "ℹ️ Skipping notification - user favorited their own car"
          );
        }

        setFavorites((prev) => new Set([...prev, carId]));
      }
    } catch (error: any) {
      console.error("Error toggling favorite:", error);
      Alert.alert("Error", "Failed to update favorite");
    }
  };

  const navigateImage = (
    carId: string,
    direction: "prev" | "next",
    item: Car
  ) => {
    const images = parseImages(item.images);
    if (images.length <= 1) return;

    const currentIndex = imageIndexes[carId] || 0;
    let newIndex = currentIndex;

    if (direction === "next") {
      newIndex = (currentIndex + 1) % images.length;
    } else {
      newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    }

    setImageIndexes((prev) => ({ ...prev, [carId]: newIndex }));
  };

  const handleContactSeller = async (car: Car) => {
    console.log("=== HUBUNGI PENJUAL CLICKED (HOME) ===");
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

  const getBrands = () => {
    return availableBrands;
  };

  const getLocations = () => {
    return availableLocations;
  };

  // Helper function to parse images - handle string, JSON string, or array
  const parseImages = (images: any): string[] => {
    if (!images) return [];

    // If it's already an array
    if (Array.isArray(images)) {
      return images
        .filter((img) => img && typeof img === "string")
        .filter((img) => img.startsWith("http")); // Only keep full URLs for React Native
    }

    // If it's a string, try to parse as JSON
    if (typeof images === "string") {
      try {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((img) => img && typeof img === "string")
            .filter((img) => img.startsWith("http")); // Only keep full URLs for React Native
        }
        // Single URL string - check if it's a full URL
        return images.startsWith("http") ? [images] : [];
      } catch (e) {
        // Not JSON, treat as single URL - check if it's a full URL
        return images.startsWith("http") ? [images] : [];
      }
    }

    return [];
  };

  // Helper to get first image
  const getFirstImage = (car: Car): string => {
    const images = parseImages(car.images);
    // Use a simple gray data URI as fallback instead of external placeholder
    const fallbackImage =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mM8+R8AAp8BzdNtlUkAAAAASUVORK5CYII=";
    const firstImage = images[0] || fallbackImage;

    console.log(`🖼️ Car ${car.id} (${car.brand} ${car.model}):`, {
      raw_images: car.images,
      parsed_count: images.length,
      first_image_full: firstImage,
      is_placeholder: !images[0],
    });

    return firstImage;
  };

  useEffect(() => {
    console.log("Total cars from database:", cars.length);
    if (cars.length > 0) {
      console.log("Sample car data:", cars[0]);
      // Get first 5 cars as featured
      let result = cars;

      // Apply filters
      if (filters.brand) {
        result = result.filter((car) => car.brand === filters.brand);
      }
      if (filters.transmission) {
        result = result.filter(
          (car) => car.transmission === filters.transmission
        );
      }
      if (filters.fuelType) {
        result = result.filter((car) => car.fuel_type === filters.fuelType);
      }
      if (filters.location) {
        result = result.filter((car) => car.location === filters.location);
      }
      if (filters.minPrice > 0) {
        result = result.filter((car) => car.price >= filters.minPrice);
      }
      if (filters.maxPrice > 0) {
        result = result.filter((car) => car.price <= filters.maxPrice);
      }
      if (filters.minYear > 0) {
        result = result.filter((car) => car.year >= filters.minYear);
      }
      if (filters.maxYear > 0) {
        result = result.filter((car) => car.year <= filters.maxYear);
      }

      console.log("✅ Setting featured cars:", result.slice(0, 5).length);
      setFeaturedCars(result.slice(0, 5));

      // Count active filters
      let count = 0;
      if (filters.brand) count++;
      if (filters.transmission) count++;
      if (filters.fuelType) count++;
      if (filters.location) count++;
      if (filters.minPrice > 0 || filters.maxPrice > 0) count++;
      if (filters.minYear > 0 || filters.maxYear > 0) count++;
      setActiveFilterCount(count);
    } else {
      console.log("⚠️ No cars to display - setting empty arrays");
      setFeaturedCars([]);
    }
  }, [cars, filters]);

  // Filter cars by brand for brand section
  useEffect(() => {
    console.log("Brand filter changed to:", filters.brand);
    console.log("Total cars available:", cars.length);

    if (cars.length > 0) {
      if (filters.brand) {
        // Case-insensitive filtering
        const filtered = cars.filter(
          (car) => car.brand.toUpperCase() === filters.brand.toUpperCase()
        );
        console.log(`Found ${filtered.length} cars for brand ${filters.brand}`);
        if (filtered.length > 0) {
          console.log("Sample car:", filtered[0]);
        }
        setBrandCars(filtered.slice(0, 10)); // Show max 10 cars per brand
      } else {
        console.log("Showing all cars (first 10)");
        setBrandCars(cars.slice(0, 10)); // Show first 10 cars when ALL selected
      }
    } else {
      console.log("No cars in database");
      setBrandCars([]);
    }
  }, [cars, filters.brand]);

  const renderFeaturedCar = ({ item }: { item: Car }) => {
    const images = parseImages(item.images);
    const currentIndex = imageIndexes[item.id] || 0;
    const currentImage =
      images.length > 0 ? images[currentIndex] : getFirstImage(item);
    const isFavorited = favorites.has(item.id);

    return (
      <TouchableOpacity
        style={styles.featuredCard}
        onPress={() => router.push(`/cars/${item.id}`)}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: currentImage }}
            style={styles.featuredImage}
            resizeMode="cover"
            onError={(e) => {
              console.log(
                `❌ Image load failed for ${item.brand} ${item.model}:`,
                currentImage
              );
            }}
          />

          {/* Image Navigation Arrows */}
          {images.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.imageNavButton, styles.imageNavLeft]}
                onPress={(e) => {
                  e.stopPropagation();
                  navigateImage(item.id, "prev", item);
                }}>
                <Feather name="chevron-left" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageNavButton, styles.imageNavRight]}
                onPress={(e) => {
                  e.stopPropagation();
                  navigateImage(item.id, "next", item);
                }}>
                <Feather name="chevron-right" size={24} color="#fff" />
              </TouchableOpacity>

              {/* Image Counter */}
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentIndex + 1} / {images.length}
                </Text>
              </View>
            </>
          )}

          {/* Favorite Button */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}>
            <Feather
              name={isFavorited ? "heart" : "heart"}
              size={24}
              color={isFavorited ? "#ef4444" : "#fff"}
              fill={isFavorited ? "#ef4444" : "transparent"}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.featuredContent}>
          <Text style={styles.featuredTitle} numberOfLines={1}>
            {item.brand} {item.model} {item.year}
          </Text>

          <View style={styles.featuredDetails}>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={14} color="#94a3b8" />
              <Text style={styles.detailText}>{item.location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="activity" size={14} color="#94a3b8" />
              <Text style={styles.detailText}>
                {item.mileage?.toLocaleString()} Km
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="settings" size={14} color="#94a3b8" />
              <Text style={styles.detailText}>{item.transmission}</Text>
            </View>
          </View>

          <Text style={styles.featuredPrice}>
            Rp {item.price.toLocaleString("id-ID")}
          </Text>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.detailButton}
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/cars/${item.id}`);
              }}>
              <Text style={styles.detailButtonText}>Lihat Detail</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={(e) => {
                e.stopPropagation();
                handleContactSeller(item);
              }}>
              <Text style={styles.contactButtonText}>Hubungi Penjual</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderBrandCar = ({ item }: { item: Car }) => {
    const images = parseImages(item.images);
    const currentIndex = imageIndexes[item.id] || 0;
    const currentImage =
      images.length > 0 ? images[currentIndex] : getFirstImage(item);
    const isFavorited = favorites.has(item.id);

    return (
      <TouchableOpacity
        style={styles.brandCarCard}
        onPress={() => router.push(`/cars/${item.id}`)}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: currentImage }}
            style={styles.brandCarImage}
            resizeMode="cover"
            onLoad={() => {
              console.log(
                `✅ Brand car image loaded for ${item.brand} ${item.model}`
              );
            }}
            onError={(e) => {
              console.log(
                `❌ Brand car image failed for ${item.brand} ${item.model}:`,
                currentImage,
                e.nativeEvent.error
              );
            }}
          />

          {/* Image Navigation Arrows */}
          {images.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.imageNavButton, styles.imageNavLeft]}
                onPress={(e) => {
                  e.stopPropagation();
                  navigateImage(item.id, "prev", item);
                }}>
                <Feather name="chevron-left" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageNavButton, styles.imageNavRight]}
                onPress={(e) => {
                  e.stopPropagation();
                  navigateImage(item.id, "next", item);
                }}>
                <Feather name="chevron-right" size={20} color="#fff" />
              </TouchableOpacity>

              {/* Image Counter */}
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentIndex + 1} / {images.length}
                </Text>
              </View>
            </>
          )}

          {/* Favorite Button */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}>
            <Feather
              name={isFavorited ? "heart" : "heart"}
              size={20}
              color={isFavorited ? "#ef4444" : "#fff"}
              fill={isFavorited ? "#ef4444" : "transparent"}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.brandCarContent}>
          <Text style={styles.brandCarTitle} numberOfLines={1}>
            {item.brand} {item.model} {item.year}
          </Text>

          <View style={styles.brandCarDetails}>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={12} color="#94a3b8" />
              <Text style={styles.brandCarDetailText}>{item.location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="activity" size={12} color="#94a3b8" />
              <Text style={styles.brandCarDetailText}>
                {item.mileage?.toLocaleString()} Km
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="settings" size={12} color="#94a3b8" />
              <Text style={styles.brandCarDetailText}>{item.transmission}</Text>
            </View>
          </View>

          <Text style={styles.brandCarPrice}>
            Rp {item.price.toLocaleString("id-ID")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroTitle}>Nero Cars</Text>
            <Text style={styles.heroSubtitle}>Find Your Dream Car</Text>
          </View>

          {/* Quick Action Icons */}
          {user && (
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => router.push("/notifications")}>
                <Ionicons name="notifications-outline" size={24} color="#fff" />
                {unreadNotifCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => router.push("/messages")}>
                <Ionicons name="chatbubble-outline" size={24} color="#fff" />
                {unreadMessagesCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.heroDescription}>
          Explore our collection of premium vehicles
        </Text>

        {!user && (
          <TouchableOpacity
            style={styles.heroButton}
            onPress={() => router.push("/auth/login")}>
            <Text style={styles.heroButtonText}>Get Started</Text>
            <Feather name="arrow-right" color="#fff" size={20} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Feather name="search" color="#94a3b8" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari mobil, merek, model..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (searchQuery.trim()) {
                router.push(
                  `/(tabs)/cars?search=${encodeURIComponent(
                    searchQuery.trim()
                  )}`
                );
              }
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" color="#94a3b8" size={20} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Featured Cars */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>REKOMENDASI MOBIL</Text>
          <TouchableOpacity onPress={() => router.push("/cars")}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Memuat mobil...</Text>
          </View>
        ) : featuredCars.length > 0 ? (
          <>
            <Text style={styles.carCount}>
              Menampilkan {featuredCars.length} dari {cars.length} mobil
            </Text>
            <FlatList
              horizontal
              data={featuredCars}
              renderItem={renderFeaturedCar}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
              snapToInterval={CARD_WIDTH + 20}
              decelerationRate="fast"
            />
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="inbox" color="#64748b" size={48} />
            <Text style={styles.emptyText}>
              {cars.length === 0
                ? "Belum ada mobil di database"
                : "Tidak ada mobil yang sesuai filter"}
            </Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity
                onPress={resetFilters}
                style={styles.resetEmptyButton}>
                <Text style={styles.resetEmptyText}>Reset Filter</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/cars")}>
            <View style={styles.actionIconContainer}>
              <Feather name="search" color="#f59e0b" size={28} />
            </View>
            <Text style={styles.actionTitle}>Browse Cars</Text>
            <Text style={styles.actionDescription}>Explore all vehicles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/favorites")}>
            <View style={styles.actionIconContainer}>
              <Feather name="heart" color="#ef4444" size={28} />
            </View>
            <Text style={styles.actionTitle}>Favorites</Text>
            <Text style={styles.actionDescription}>Your saved cars</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Popular Brands */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            BELI MOBIL DI NEROCARS SEKARANG
          </Text>
          {filters.brand && (
            <Text style={styles.brandCount}>{brandCars.length} mobil</Text>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.brandScrollContainer}>
          <TouchableOpacity
            style={[styles.brandChip, !filters.brand && styles.brandChipActive]}
            onPress={() => {
              console.log("ALL brand clicked");
              setFilters({ ...filters, brand: "" });
            }}>
            <Text
              style={[
                styles.brandChipText,
                !filters.brand && styles.brandChipTextActive,
              ]}>
              ALL
            </Text>
          </TouchableOpacity>
          {[
            "Honda",
            "Toyota",
            "Daihatsu",
            "Suzuki",
            "Mitsubishi",
            "Nissan",
            "Mazda",
            "Hyundai",
          ].map((brand) => (
            <TouchableOpacity
              key={brand}
              style={[
                styles.brandChip,
                filters.brand.toUpperCase() === brand.toUpperCase() &&
                  styles.brandChipActive,
              ]}
              onPress={() => {
                console.log(`${brand} brand clicked`);
                setFilters({ ...filters, brand });
              }}>
              <Text
                style={[
                  styles.brandChipText,
                  filters.brand.toUpperCase() === brand.toUpperCase() &&
                    styles.brandChipTextActive,
                ]}>
                {brand.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Brand Cars Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Memuat mobil...</Text>
          </View>
        ) : brandCars.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.brandCarsScrollContainer}>
            {brandCars.map((car) => (
              <View key={car.id} style={styles.brandCarWrapper}>
                {renderBrandCar({ item: car })}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyBrandContainer}>
            <Feather name="inbox" color="#64748b" size={40} />
            <Text style={styles.emptyText}>
              {filters.brand
                ? `Tidak ada mobil ${filters.brand}`
                : "Pilih brand untuk melihat mobil"}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.seeAllBrandButton}
          onPress={() => router.push("/cars")}>
          <Text style={styles.seeAllBrandText}>Lihat Semua Mobil</Text>
          <Feather name="arrow-right" color="#f59e0b" size={16} />
        </TouchableOpacity>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{cars.length}+</Text>
          <Text style={styles.statLabel}>Cars Available</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>100%</Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>24/7</Text>
          <Text style={styles.statLabel}>Support</Text>
        </View>
      </View>

      {/* Feedback Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.feedbackButton}
          onPress={() => router.push("/feedback")}>
          <View style={styles.feedbackContent}>
            <Feather name="message-circle" size={24} color="#fff" />
            <View style={styles.feedbackTextContainer}>
              <Text style={styles.feedbackTitle}>Berikan Feedback</Text>
              <Text style={styles.feedbackSubtitle}>
                Bantu kami meningkatkan layanan
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={24} color="#94a3b8" />
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
  hero: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 30,
    backgroundColor: "#1e293b",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
  },
  quickActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f59e0b",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#f59e0b",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "600",
  },
  heroDescription: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 20,
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  heroButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  searchSection: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 0,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  brandCount: {
    fontSize: 14,
    color: "#f59e0b",
    fontWeight: "600",
  },
  seeAll: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "600",
  },
  featuredList: {
    paddingRight: 20,
  },
  featuredCard: {
    width: CARD_WIDTH,
    marginRight: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1e293b",
  },
  featuredImage: {
    width: "100%",
    height: 180,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
  },
  imageNavButton: {
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  imageNavLeft: {
    left: 8,
  },
  imageNavRight: {
    right: 8,
  },
  imageCounter: {
    position: "absolute",
    bottom: 8,
    left: "50%",
    transform: [{ translateX: -25 }],
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  featuredContent: {
    padding: 16,
  },
  featuredTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  featuredDetails: {
    marginBottom: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: "#94a3b8",
  },
  featuredPrice: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#f59e0b",
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  detailButton: {
    flex: 1,
    backgroundColor: "#334155",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  detailButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  contactButton: {
    flex: 1,
    backgroundColor: "#f59e0b",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  contactButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  actionsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
  },
  brandsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  brandScrollContainer: {
    marginTop: 16,
  },
  brandChip: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: "#1e293b",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  brandChipActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  brandChipText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  brandChipTextActive: {
    color: "#1e293b",
  },
  brandCarsScrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  brandCarWrapper: {
    width: width * 0.7,
    marginRight: 12,
  },
  brandCarCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
  },
  brandCarImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#334155",
  },
  brandCarContent: {
    padding: 12,
  },
  brandCarTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  brandCarDetails: {
    marginBottom: 8,
    gap: 4,
  },
  brandCarDetailText: {
    fontSize: 10,
    color: "#94a3b8",
  },
  brandCarPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f59e0b",
  },
  emptyBrandContainer: {
    padding: 40,
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  seeAllBrandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  seeAllBrandText: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "600",
  },
  brandCard: {
    width: (width - 60) / 3,
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  brandName: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
  statsSection: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#f59e0b",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
  },
  feedbackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  feedbackContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  feedbackTextContainer: {
    gap: 4,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  feedbackSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
  },
  resetEmptyButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#f59e0b",
    borderRadius: 8,
  },
  resetEmptyText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  carCount: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  filterScroll: {
    paddingHorizontal: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#0f172a",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#f59e0b",
  },
  filterChipText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  rangeInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rangeInput: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 14,
  },
  rangeSeparator: {
    color: "#94a3b8",
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  resetButton: {
    flex: 1,
    backgroundColor: "#334155",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  applyButton: {
    flex: 1,
    backgroundColor: "#f59e0b",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
