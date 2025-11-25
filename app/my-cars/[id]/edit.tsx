import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

interface CarFormData {
  brand: string;
  model: string;
  year: string;
  transmission: string;
  engine_capacity: string;
  fuel_type: string;
  mileage: string;
  condition: string;
  color: string;
  price: string;
  location: string;
  description: string;
}

export default function EditCarScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();

  const [formData, setFormData] = useState<CarFormData>({
    brand: "",
    model: "",
    year: "",
    transmission: "",
    engine_capacity: "",
    fuel_type: "",
    mileage: "",
    condition: "",
    color: "",
    price: "",
    location: "",
    description: "",
  });

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCarData();
  }, [id]);

  const fetchCarData = async () => {
    try {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Check if user owns this car
      if (data.user_id !== user?.id) {
        Alert.alert("Error", "You don't have permission to edit this car");
        router.back();
        return;
      }

      // Populate form
      setFormData({
        brand: data.brand || "",
        model: data.model || "",
        year: data.year?.toString() || "",
        transmission: data.transmission || "",
        engine_capacity: data.engine_capacity || "",
        fuel_type: data.fuel_type || "",
        mileage: data.mileage?.toString() || "",
        condition: data.condition || "",
        color: data.color || "",
        price: data.price?.toString() || "",
        location: data.location || "",
        description: data.description || "",
      });

      // Parse images
      const parsedImages = parseImages(data.images);
      setImages(parsedImages);
    } catch (error: any) {
      console.error("Error fetching car:", error);
      Alert.alert("Error", "Failed to load car data");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const parseImages = (images: any): string[] => {
    if (!images) return [];
    if (typeof images === "string") {
      try {
        const parsed = JSON.parse(images);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(images) ? images : [];
  };

  const pickImages = async () => {
    try {
      const remainingSlots = 5 - images.length;
      if (remainingSlots <= 0) {
        Alert.alert("Limit Reached", "You can only upload up to 5 images");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((asset) => asset.uri);
        setImages([...images, ...newImages]);
      }
    } catch (error) {
      console.error("Error picking images:", error);
      Alert.alert("Error", "Failed to pick images");
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
  };

  const uploadImagesToSupabase = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const imageUri of images) {
      // Skip already uploaded images (URLs starting with http)
      if (imageUri.startsWith("http")) {
        uploadedUrls.push(imageUri);
        continue;
      }

      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const fileExt = imageUri.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;
        const filePath = `cars/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("car-images")
          .upload(filePath, blob);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("car-images").getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error("Error uploading image:", error);
        throw new Error("Failed to upload image");
      }
    }

    return uploadedUrls;
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validation
      if (!formData.brand || !formData.model || !formData.year) {
        Alert.alert(
          "Validation Error",
          "Please fill in brand, model, and year"
        );
        return;
      }

      if (images.length < 1) {
        Alert.alert("Validation Error", "Please upload at least 1 image");
        return;
      }

      // Upload new images
      const imageUrls = await uploadImagesToSupabase();

      // Update car data
      const carData = {
        brand: formData.brand,
        model: formData.model,
        year: parseInt(formData.year),
        transmission: formData.transmission || null,
        engine_capacity: formData.engine_capacity || null,
        fuel_type: formData.fuel_type || null,
        mileage: formData.mileage ? parseInt(formData.mileage) : null,
        condition: formData.condition || null,
        color: formData.color || null,
        price: formData.price ? parseInt(formData.price) : null,
        location: formData.location || null,
        description: formData.description || null,
        images: imageUrls,
      };

      const { error } = await supabase
        .from("cars")
        .update(carData)
        .eq("id", id);

      if (error) throw error;

      Alert.alert("Success", "Car updated successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error updating car:", error);
      Alert.alert("Error", "Failed to update car. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: "Edit Mobil",
            headerShown: true,
            headerStyle: { backgroundColor: "#1e293b" },
            headerTintColor: "#fff",
          }}
        />
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Edit Mobil",
          headerShown: true,
          headerStyle: { backgroundColor: "#1e293b" },
          headerTintColor: "#fff",
        }}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Edit Mobil</Text>
        <Text style={styles.subtitle}>Update informasi mobil Anda</Text>
      </View>

      {/* Image Upload Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Foto Mobil <Text style={styles.required}>*</Text>
        </Text>
        <Text style={styles.sectionSubtitle}>{images.length}/5 foto</Text>

        <View style={styles.imageGrid}>
          {images.map((uri, index) => (
            <View key={index} style={styles.imageSlotContainer}>
              <View style={styles.imageSlot}>
                <Image source={{ uri }} style={styles.uploadedImage} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}>
                  <Feather name="x" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {images.length < 5 && (
            <View style={styles.imageSlotContainer}>
              <TouchableOpacity
                style={styles.uploadPlaceholder}
                onPress={pickImages}>
                <Feather name="camera" size={24} color="#94a3b8" />
                <Text style={styles.uploadText}>Tambah</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Car Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informasi Mobil</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Merk <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Toyota"
            placeholderTextColor="#64748b"
            value={formData.brand}
            onChangeText={(text) => setFormData({ ...formData, brand: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Model <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Avanza"
            placeholderTextColor="#64748b"
            value={formData.model}
            onChangeText={(text) => setFormData({ ...formData, model: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Tahun <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="2020"
            placeholderTextColor="#64748b"
            value={formData.year}
            onChangeText={(text) => {
              const filtered = text.replace(/[^0-9]/g, "").slice(0, 4);
              setFormData({ ...formData, year: filtered });
            }}
            keyboardType="numeric"
            maxLength={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Transmisi</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[
                styles.radioButton,
                formData.transmission === "Manual" &&
                  styles.radioButtonSelected,
              ]}
              onPress={() =>
                setFormData({ ...formData, transmission: "Manual" })
              }>
              <Text
                style={[
                  styles.radioText,
                  formData.transmission === "Manual" &&
                    styles.radioTextSelected,
                ]}>
                Manual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.radioButton,
                formData.transmission === "Automatic" &&
                  styles.radioButtonSelected,
              ]}
              onPress={() =>
                setFormData({ ...formData, transmission: "Automatic" })
              }>
              <Text
                style={[
                  styles.radioText,
                  formData.transmission === "Automatic" &&
                    styles.radioTextSelected,
                ]}>
                Automatic
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Jenis Bahan Bakar</Text>
          <View style={styles.radioGroup}>
            {["Bensin", "Diesel", "Hybrid", "Electric"].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.radioButton,
                  formData.fuel_type === type && styles.radioButtonSelected,
                ]}
                onPress={() => setFormData({ ...formData, fuel_type: type })}>
                <Text
                  style={[
                    styles.radioText,
                    formData.fuel_type === type && styles.radioTextSelected,
                  ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kilometer</Text>
          <TextInput
            style={styles.input}
            placeholder="50000"
            placeholderTextColor="#64748b"
            value={formData.mileage}
            onChangeText={(text) => {
              const filtered = text.replace(/[^0-9]/g, "");
              setFormData({ ...formData, mileage: filtered });
            }}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Warna</Text>
          <TextInput
            style={styles.input}
            placeholder="Hitam"
            placeholderTextColor="#64748b"
            value={formData.color}
            onChangeText={(text) => setFormData({ ...formData, color: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Harga (Rp)</Text>
          <TextInput
            style={styles.input}
            placeholder="150000000"
            placeholderTextColor="#64748b"
            value={formData.price}
            onChangeText={(text) => {
              const filtered = text.replace(/[^0-9]/g, "");
              setFormData({ ...formData, price: filtered });
            }}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lokasi</Text>
          <TextInput
            style={styles.input}
            placeholder="Jakarta"
            placeholderTextColor="#64748b"
            value={formData.location}
            onChangeText={(text) =>
              setFormData({ ...formData, location: text })
            }
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Deskripsi</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Deskripsi mobil..."
            placeholderTextColor="#64748b"
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text })
            }
            multiline
            numberOfLines={4}
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Batal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Simpan</Text>
          )}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#94a3b8",
    marginTop: 12,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 16,
  },
  required: {
    color: "#ef4444",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  imageSlotContainer: {
    width: "30%",
  },
  imageSlot: {
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1e293b",
  },
  uploadedImage: {
    width: "100%",
    height: "100%",
  },
  uploadPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderWidth: 2,
    borderColor: "#334155",
    borderStyle: "dashed",
    borderRadius: 8,
  },
  uploadText: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 4,
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  radioGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  radioButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
  },
  radioButtonSelected: {
    backgroundColor: "#f59e0b",
    borderColor: "#f59e0b",
  },
  radioText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  radioTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#334155",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#f59e0b",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
