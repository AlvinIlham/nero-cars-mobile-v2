import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useCarStore } from "@/store/carStore";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { Car } from "@/types";

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

export default function CarsScreen() {
  const router = useRouter();
  const { cars, loading, fetchCars } = useCarStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCars, setFilteredCars] = useState<Car[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
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

  useEffect(() => {
    fetchCars();
  }, []);

  // Helper function to parse images - handle string, JSON string, or array
  const parseImages = (images: any): string[] => {
    if (!images) return [];

    // If it's already an array
    if (Array.isArray(images)) {
      return images.filter((img) => img && typeof img === "string");
    }

    // If it's a string, try to parse as JSON
    if (typeof images === "string") {
      try {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed)) {
          return parsed.filter((img) => img && typeof img === "string");
        }
        return [images];
      } catch (e) {
        return [images];
      }
    }

    return [];
  };

  const getFirstImage = (car: Car): string => {
    const images = parseImages(car.images);
    return (
      images[0] || "https://via.placeholder.com/300/1e293b/94a3b8?text=No+Image"
    );
  };

  useEffect(() => {
    let result = cars;

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (car) =>
          car.brand.toLowerCase().includes(query) ||
          car.model.toLowerCase().includes(query) ||
          car.location.toLowerCase().includes(query) ||
          car.year.toString().includes(query)
      );
    }

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

    setFilteredCars(result);

    // Count active filters
    let count = 0;
    if (filters.brand) count++;
    if (filters.transmission) count++;
    if (filters.fuelType) count++;
    if (filters.location) count++;
    if (filters.minPrice > 0 || filters.maxPrice > 0) count++;
    if (filters.minYear > 0 || filters.maxYear > 0) count++;
    setActiveFilterCount(count);
  }, [searchQuery, cars, filters]);

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

  const getBrands = () => {
    const brands = [...new Set(cars.map((car) => car.brand))];
    return brands.sort();
  };

  const getLocations = () => {
    const locations = [...new Set(cars.map((car) => car.location))];
    return locations.sort();
  };

  const formatPrice = (price: number) => {
    return `Rp ${(price / 1000000).toFixed(0)} Jt`;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Feather name="search" color="#94a3b8" size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari mobil, merek, lokasi..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Feather name="x" color="#94a3b8" size={20} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}>
            <Feather name="sliders" color="#fff" size={20} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultCount}>
            {filteredCars.length} mobil ditemukan
          </Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={resetFilters}>
              <Text style={styles.clearFilters}>Hapus Filter</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Cars</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Feather name="x" color="#fff" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScroll}>
              {/* Brand Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Brand</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      !filters.brand && styles.filterChipActive,
                    ]}
                    onPress={() => setFilters({ ...filters, brand: "" })}>
                    <Text
                      style={[
                        styles.filterChipText,
                        !filters.brand && styles.filterChipTextActive,
                      ]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {getBrands().map((brand) => (
                    <TouchableOpacity
                      key={brand}
                      style={[
                        styles.filterChip,
                        filters.brand === brand && styles.filterChipActive,
                      ]}
                      onPress={() => setFilters({ ...filters, brand })}>
                      <Text
                        style={[
                          styles.filterChipText,
                          filters.brand === brand &&
                            styles.filterChipTextActive,
                        ]}>
                        {brand}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Transmission Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Transmission</Text>
                <View style={styles.filterRow}>
                  {["Manual", "Automatic", "CVT", "DCT"].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterChip,
                        filters.transmission === type &&
                          styles.filterChipActive,
                      ]}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          transmission:
                            filters.transmission === type ? "" : type,
                        })
                      }>
                      <Text
                        style={[
                          styles.filterChipText,
                          filters.transmission === type &&
                            styles.filterChipTextActive,
                        ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Fuel Type Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Fuel Type</Text>
                <View style={styles.filterRow}>
                  {["Petrol", "Diesel", "Electric", "Hybrid"].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterChip,
                        filters.fuelType === type && styles.filterChipActive,
                      ]}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          fuelType: filters.fuelType === type ? "" : type,
                        })
                      }>
                      <Text
                        style={[
                          styles.filterChipText,
                          filters.fuelType === type &&
                            styles.filterChipTextActive,
                        ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Location Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Location</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      !filters.location && styles.filterChipActive,
                    ]}
                    onPress={() => setFilters({ ...filters, location: "" })}>
                    <Text
                      style={[
                        styles.filterChipText,
                        !filters.location && styles.filterChipTextActive,
                      ]}>
                      All Cities
                    </Text>
                  </TouchableOpacity>
                  {getLocations().map((location) => (
                    <TouchableOpacity
                      key={location}
                      style={[
                        styles.filterChip,
                        filters.location === location &&
                          styles.filterChipActive,
                      ]}
                      onPress={() => setFilters({ ...filters, location })}>
                      <Text
                        style={[
                          styles.filterChipText,
                          filters.location === location &&
                            styles.filterChipTextActive,
                        ]}>
                        {location}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Price Range */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Price Range (Million Rp)</Text>
                <View style={styles.rangeInputs}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={
                      filters.minPrice > 0
                        ? (filters.minPrice / 1000000).toString()
                        : ""
                    }
                    onChangeText={(text) =>
                      setFilters({
                        ...filters,
                        minPrice: parseInt(text || "0") * 1000000,
                      })
                    }
                  />
                  <Text style={styles.rangeSeparator}>-</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Max"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={
                      filters.maxPrice > 0
                        ? (filters.maxPrice / 1000000).toString()
                        : ""
                    }
                    onChangeText={(text) =>
                      setFilters({
                        ...filters,
                        maxPrice: parseInt(text || "0") * 1000000,
                      })
                    }
                  />
                </View>
              </View>

              {/* Year Range */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Year Range</Text>
                <View style={styles.rangeInputs}>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min Year"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={
                      filters.minYear > 0 ? filters.minYear.toString() : ""
                    }
                    onChangeText={(text) =>
                      setFilters({ ...filters, minYear: parseInt(text || "0") })
                    }
                  />
                  <Text style={styles.rangeSeparator}>-</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Max Year"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={
                      filters.maxYear > 0 ? filters.maxYear.toString() : ""
                    }
                    onChangeText={(text) =>
                      setFilters({ ...filters, maxYear: parseInt(text || "0") })
                    }
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetFilters}>
                <Text style={styles.resetButtonText}>Reset All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilterModal(false)}>
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={filteredCars}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const firstImage = getFirstImage(item);

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/cars/${item.id}`)}>
              <Image
                source={{ uri: firstImage }}
                style={styles.image}
                onError={(e) => {
                  console.log(
                    `Image failed for ${item.brand} ${item.model}:`,
                    firstImage
                  );
                }}
              />
              <View style={styles.cardContent}>
                <Text style={styles.carTitle} numberOfLines={1}>
                  {item.brand} {item.model} {item.year}
                </Text>

                <View style={styles.details}>
                  <View style={styles.detailItem}>
                    <Feather name="map-pin" size={12} color="#94a3b8" />
                    <Text style={styles.detailText} numberOfLines={1}>
                      {item.location}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Feather name="activity" size={12} color="#94a3b8" />
                    <Text style={styles.detailText}>
                      {item.mileage.toLocaleString()} Km
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Feather name="settings" size={12} color="#94a3b8" />
                    <Text style={styles.detailText}>{item.transmission}</Text>
                  </View>
                </View>

                <Text style={styles.price}>
                  Rp {(item.price / 1000000).toFixed(0)} Jt
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
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
  searchContainer: {
    padding: 16,
    backgroundColor: "#0f172a",
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
  },
  searchBar: {
    flex: 1,
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
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: "#f59e0b",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  resultCount: {
    color: "#94a3b8",
    fontSize: 14,
  },
  clearFilters: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "600",
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
  list: {
    padding: 8,
  },
  card: {
    flex: 1,
    margin: 8,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 120,
    backgroundColor: "#334155",
  },
  cardContent: {
    padding: 12,
  },
  carTitle: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 8,
  },
  carBrand: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "600",
  },
  carModel: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "bold",
    marginTop: 4,
  },
  carYear: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  price: {
    fontSize: 16,
    color: "#f59e0b",
    fontWeight: "bold",
    marginTop: 8,
  },
  details: {
    marginBottom: 8,
    gap: 4,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 10,
    color: "#94a3b8",
  },
});
