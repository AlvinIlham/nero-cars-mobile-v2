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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCarStore } from "@/store/carStore";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { Car } from "@/types";
import { supabase } from "@/lib/supabase";

type FilterState = {
  brand: string;
  transmission: string;
  fuelType: string;
  location: string;
  bodyType: string;
  minPrice: number;
  maxPrice: number;
  minYear: number;
  maxYear: number;
};

export default function CarsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { cars, loading, fetchCars } = useCarStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCars, setFilteredCars] = useState<Car[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    brand: "",
    transmission: "",
    fuelType: "",
    location: "",
    bodyType: "",
    minPrice: 0,
    maxPrice: 0,
    minYear: 0,
    maxYear: 0,
  });
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // State untuk filter options dari database
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [availableBodyTypes, setAvailableBodyTypes] = useState<string[]>([]);
  const [availableTransmissions, setAvailableTransmissions] = useState<
    string[]
  >([]);
  const [availableFuelTypes, setAvailableFuelTypes] = useState<string[]>([]);

  useEffect(() => {
    console.log("🚗 Cars screen mounted - fetching data...");
    fetchCars();
    fetchFilterOptions();

    // Subscribe to realtime changes on cars table
    const carsChannel = supabase
      .channel("cars-screen-changes")
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

    return () => {
      supabase.removeChannel(carsChannel);
    };
  }, []);

  // Load search query and filters from URL params - only on mount
  useEffect(() => {
    if (params.search && typeof params.search === "string") {
      setSearchQuery(params.search);
    }

    // Load filter params from URL
    const urlFilters: FilterState = {
      brand: typeof params.brand === "string" ? params.brand : "",
      transmission:
        typeof params.transmission === "string" ? params.transmission : "",
      fuelType: typeof params.fuelType === "string" ? params.fuelType : "",
      location: typeof params.location === "string" ? params.location : "",
      bodyType: typeof params.bodyType === "string" ? params.bodyType : "",
      minPrice:
        typeof params.minPrice === "string" ? parseInt(params.minPrice) : 0,
      maxPrice:
        typeof params.maxPrice === "string" ? parseInt(params.maxPrice) : 0,
      minYear:
        typeof params.minYear === "string" ? parseInt(params.minYear) : 0,
      maxYear:
        typeof params.maxYear === "string" ? parseInt(params.maxYear) : 0,
    };

    // Only update if there are filter params
    if (
      params.brand ||
      params.transmission ||
      params.fuelType ||
      params.location ||
      params.minPrice ||
      params.maxPrice ||
      params.minYear ||
      params.maxYear
    ) {
      setFilters(urlFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount to load initial params

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
    if (filters.bodyType) {
      result = result.filter((car) => car.body_type === filters.bodyType);
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
    if (filters.bodyType) count++;
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
      bodyType: "",
      minPrice: 0,
      maxPrice: 0,
      minYear: 0,
      maxYear: 0,
    });
  };

  // Fetch filter options dari database
  const fetchFilterOptions = async () => {
    console.log("🔍 Fetching filter options...");
    try {
      // Hardcoded fallback data (same as website)
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

      // Try to fetch from brands table first
      const { data: brandsData, error: brandsError } = await supabase
        .from("brands")
        .select("name")
        .order("name");

      console.log("📦 Brands data:", brandsData?.length, "brands");
      if (brandsError) console.log("❌ Brands error:", brandsError);

      // Try to fetch from locations table
      const { data: locationsData, error: locationsError } = await supabase
        .from("locations")
        .select("city")
        .order("city");

      console.log("📍 Locations data:", locationsData?.length, "locations");
      if (locationsError) console.log("❌ Locations error:", locationsError);

      // Fetch from cars table for other filters
      const { data: carsData } = await supabase
        .from("cars")
        .select("brand, location, body_type, transmission, fuel_type");

      console.log("🚗 Cars data:", carsData?.length, "cars");

      // Set brands: use brands table, or cars brands, or default
      if (brandsData && brandsData.length > 0) {
        const brands = brandsData.map((b) => b.name).sort();
        console.log("✅ Setting brands from brands table:", brands.length);
        setAvailableBrands(brands);
      } else if (carsData && carsData.length > 0) {
        const carBrands = [
          ...new Set(carsData.map((car) => car.brand).filter(Boolean)),
        ];
        // Merge with default brands
        const allBrands = [...new Set([...carBrands, ...defaultBrands])].sort();
        setAvailableBrands(allBrands);
      } else {
        setAvailableBrands(defaultBrands);
      }

      // Set locations: use locations table, or cars locations, or default
      if (locationsData && locationsData.length > 0) {
        const locations = locationsData.map((l) => l.city).sort();
        console.log(
          "✅ Setting locations from locations table:",
          locations.length
        );
        setAvailableLocations(locations);
      } else if (carsData && carsData.length > 0) {
        const carLocations = [
          ...new Set(carsData.map((car) => car.location).filter(Boolean)),
        ];
        // Merge with default locations
        const allLocations = [
          ...new Set([...carLocations, ...defaultLocations]),
        ].sort();
        console.log("✅ Setting locations merged:", allLocations.length);
        setAvailableLocations(allLocations);
      } else {
        console.log("✅ Setting default locations:", defaultLocations.length);
        setAvailableLocations(defaultLocations);
      }

      // Extract unique body types, transmissions, fuel types from cars
      // Always merge with defaults to show all options
      const defaultBodyTypes = [
        "SUV",
        "Sedan",
        "Hatchback",
        "MPV",
        "Coupe",
        "Convertible",
        "Truck",
        "Van",
        "Wagon",
        "Sports Car",
        "Crossover",
        "Pickup",
        "Minivan",
        "Roadster",
        "Limousine",
      ];

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

      if (carsData && carsData.length > 0) {
        // Merge database values with defaults
        const carBodyTypes = [
          ...new Set(carsData.map((car) => car.body_type).filter(Boolean)),
        ];
        const allBodyTypes = [
          ...new Set([...carBodyTypes, ...defaultBodyTypes]),
        ].sort();
        console.log("✅ Setting body types:", allBodyTypes.length);
        setAvailableBodyTypes(allBodyTypes);

        const carTransmissions = [
          ...new Set(carsData.map((car) => car.transmission).filter(Boolean)),
        ];
        const allTransmissions = [
          ...new Set([...carTransmissions, ...defaultTransmissions]),
        ].sort();
        console.log("✅ Setting transmissions:", allTransmissions.length);
        setAvailableTransmissions(allTransmissions);

        const carFuelTypes = [
          ...new Set(carsData.map((car) => car.fuel_type).filter(Boolean)),
        ];
        const allFuelTypes = [
          ...new Set([...carFuelTypes, ...defaultFuelTypes]),
        ].sort();
        console.log("✅ Setting fuel types:", allFuelTypes.length);
        setAvailableFuelTypes(allFuelTypes);
      } else {
        // Set default values if no cars data
        setAvailableBodyTypes(defaultBodyTypes.sort());
        setAvailableTransmissions(defaultTransmissions.sort());
        setAvailableFuelTypes(defaultFuelTypes.sort());
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
      // Set all defaults on error
      setAvailableBrands(
        [
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
        ].sort()
      );
      setAvailableLocations(
        [
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
        ].sort()
      );
      setAvailableBodyTypes(
        [
          "SUV",
          "Sedan",
          "Hatchback",
          "MPV",
          "Coupe",
          "Convertible",
          "Truck",
          "Van",
          "Wagon",
          "Sports Car",
          "Crossover",
          "Pickup",
          "Minivan",
          "Roadster",
          "Limousine",
        ].sort()
      );
      setAvailableTransmissions(
        [
          "Manual",
          "Automatic",
          "CVT",
          "DCT",
          "Semi-Automatic",
          "AMT",
          "Dual Clutch",
          "Tiptronic",
        ].sort()
      );
      setAvailableFuelTypes(
        [
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
        ].sort()
      );
    }
  };

  const getBrands = () => {
    console.log(
      "🏷️ getBrands() called, returning:",
      availableBrands.length,
      "brands"
    );
    return availableBrands;
  };

  const getLocations = () => {
    console.log(
      "📍 getLocations() called, returning:",
      availableLocations.length,
      "locations"
    );
    return availableLocations;
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
              editable={true}
              selectTextOnFocus={true}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
            {searchQuery && ` untuk "${searchQuery}"`}
          </Text>
          {(activeFilterCount > 0 || searchQuery) && (
            <TouchableOpacity
              onPress={() => {
                resetFilters();
                setSearchQuery("");
              }}>
              <Text style={styles.clearFilters}>Reset</Text>
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
                  {availableTransmissions.map((type) => (
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
                  {availableFuelTypes.map((type) => (
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

              {/* Body Type Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Body Type</Text>
                <View style={styles.filterRow}>
                  {availableBodyTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterChip,
                        filters.bodyType === type && styles.filterChipActive,
                      ]}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          bodyType: filters.bodyType === type ? "" : type,
                        })
                      }>
                      <Text
                        style={[
                          styles.filterChipText,
                          filters.bodyType === type &&
                            styles.filterChipTextActive,
                        ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                  Rp {item.price.toLocaleString("id-ID")}
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
