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
  Platform,
} from "react-native";
import { router, Link } from "expo-router";
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
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  contact_preference: string;
}

interface Agreements {
  termsAndConditions: boolean;
  promotionalInfo: boolean;
}

export default function SellCarScreen() {
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
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    contact_preference: "",
  });

  const [agreements, setAgreements] = useState<Agreements>({
    termsAndConditions: false,
    promotionalInfo: false,
  });

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Sorry, we need camera roll permissions to upload images!"
      );
    }
  };

  const pickImages = async () => {
    try {
      const remainingSlots = 5 - images.length;
      if (remainingSlots <= 0) {
        Alert.alert("Limit Reached", "You can only upload up to 5 images");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], // Updated syntax for newer versions
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
    setImages(images.filter((_, i) => i !== index));
  };

  const uploadImagesToSupabase = async (): Promise<string[]> => {
    const imageUrls: string[] = [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No session found");
      }

      // Get Supabase URL from client
      const supabaseUrl =
        (supabase as any).supabaseUrl ||
        "https://fnpdxvfzwnirhazitmoc.supabase.co";

      for (let i = 0; i < images.length; i++) {
        const imageUri = images[i];

        // Get file extension
        const fileExt = imageUri.split(".").pop()?.split("?")[0] || "jpeg";
        const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`;

        // Create FormData for React Native file upload
        const formData = new FormData();
        formData.append("", {
          uri: imageUri,
          type: `image/${fileExt}`,
          name: `image.${fileExt}`,
        } as any);

        // Upload directly using fetch API with Supabase auth
        const uploadResponse = await fetch(
          `${supabaseUrl}/storage/v1/object/car-image/${fileName}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "x-upsert": "false",
            },
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("Upload error:", uploadResponse.status, errorText);
          throw new Error(`Upload failed: ${errorText}`);
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("car-image").getPublicUrl(fileName);

        imageUrls.push(publicUrl);
      }

      return imageUrls;
    } catch (error) {
      console.error("Error uploading images:", error);
      throw error;
    }
  };

  const handleSubmit = async (isDraft: boolean) => {
    try {
      setLoading(true);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Error", "You must be logged in to sell a car");
        router.push("/login");
        return;
      }

      // Validation for publishing
      if (!isDraft) {
        if (images.length < 5) {
          Alert.alert(
            "Validation Error",
            "Please upload at least 5 images to publish"
          );
          return;
        }

        const requiredFields: (keyof CarFormData)[] = [
          "brand",
          "model",
          "year",
          "transmission",
          "fuel_type",
          "price",
          "contact_name",
          "contact_phone",
          "contact_email",
        ];

        for (const field of requiredFields) {
          if (!formData[field]) {
            Alert.alert(
              "Validation Error",
              `Please fill in the ${field.replace("_", " ")} field`
            );
            return;
          }
        }

        // Validate year range
        const currentYear = new Date().getFullYear();
        const yearNum = parseInt(formData.year);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear) {
          Alert.alert(
            "Validation Error",
            `Year must be between 1900 and ${currentYear}`
          );
          return;
        }

        // Validate agreements
        if (!agreements.termsAndConditions) {
          Alert.alert(
            "Validation Error",
            "Please agree to the Terms and Conditions to proceed"
          );
          return;
        }
      } else {
        // For draft, at least one field should be filled
        const hasAnyData = Object.values(formData).some(
          (value) => value !== ""
        );
        if (!hasAnyData && images.length === 0) {
          Alert.alert("Validation Error", "Please fill in at least one field");
          return;
        }
      }

      // Upload images
      let imageUrls: string[] = [];
      if (images.length > 0) {
        imageUrls = await uploadImagesToSupabase();
      }

      // Prepare car data
      const carData = {
        user_id: user.id,
        brand: formData.brand || "",
        model: formData.model || "",
        year: formData.year ? parseInt(formData.year) : 2000,
        transmission: formData.transmission || "Manual",
        engine_capacity: formData.engine_capacity || null,
        fuel_type: formData.fuel_type || "Gasoline",
        condition: formData.condition || null,
        mileage: formData.mileage ? parseInt(formData.mileage) : 0,
        color: formData.color || "Black",
        price: formData.price ? parseInt(formData.price) : 0,
        location: formData.location || "",
        description: formData.description || null,
        images: imageUrls,
        is_sold: false,
        is_draft: isDraft,
      };

      // Insert into database
      const { data, error } = await supabase
        .from("cars")
        .insert([carData])
        .select();

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      Alert.alert(
        "Success",
        isDraft ? "Car saved as draft" : "Car posted successfully!",
        [
          {
            text: "OK",
            onPress: () => router.replace("/"),
          },
        ]
      );

      // Reset form
      setFormData({
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
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        contact_preference: "",
      });
      setAgreements({
        termsAndConditions: false,
        promotionalInfo: false,
      });
      setImages([]);
    } catch (error) {
      console.error("Error submitting car:", error);
      Alert.alert("Error", "Failed to submit car. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const imageSlots = [
    { label: "Foto Depan", required: true },
    { label: "Foto Belakang", required: true },
    { label: "Interior", required: true },
    { label: "Dashboard", required: true },
    { label: "Mesin", required: true },
  ];

  // Show login prompt if user is not logged in
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.authPrompt}>
          <Feather name="shopping-bag" color="#94a3b8" size={64} />
          <Text style={styles.authTitle}>Login Required</Text>
          <Text style={styles.authSubtext}>
            You need to login to sell your car
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Jual Mobil</Text>
        <Text style={styles.subtitle}>Isi informasi mobil Anda</Text>
      </View>

      {/* Image Upload Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Foto Mobil <Text style={styles.required}>*</Text>
        </Text>
        <Text style={styles.sectionSubtitle}>Minimal 5 foto untuk posting</Text>

        <View style={styles.imageGrid}>
          {imageSlots.map((slot, index) => (
            <View key={index} style={styles.imageSlotContainer}>
              <Text style={styles.imageSlotLabel}>
                {slot.label}
                {slot.required && <Text style={styles.required}>*</Text>}
              </Text>
              <View style={styles.imageSlot}>
                {images[index] ? (
                  <>
                    <Image
                      source={{ uri: images[index] }}
                      style={styles.uploadedImage}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeImage(index)}>
                      <Feather name="x" size={16} color="#fff" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadPlaceholder}
                    onPress={pickImages}>
                    <Feather name="camera" size={24} color="#ccc" />
                    <Text style={styles.uploadText}>Tambah Foto</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {images.length < 5 && (
          <TouchableOpacity style={styles.addMoreButton} onPress={pickImages}>
            <Feather name="plus" size={20} color="#FF6B00" />
            <Text style={styles.addMoreText}>Tambah Foto Lainnya</Text>
          </TouchableOpacity>
        )}
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
            placeholder="Contoh: Toyota"
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
            placeholder="Contoh: Avanza"
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
            placeholder="Contoh: 2020"
            value={formData.year}
            onChangeText={(text) => {
              // Only allow numbers and max 4 digits
              const filtered = text.replace(/[^0-9]/g, "").slice(0, 4);
              setFormData({ ...formData, year: filtered });
            }}
            keyboardType="numeric"
            maxLength={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Transmisi <Text style={styles.required}>*</Text>
          </Text>
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
          <Text style={styles.label}>Kapasitas Mesin (cc)</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: 1500"
            value={formData.engine_capacity}
            onChangeText={(text) =>
              setFormData({ ...formData, engine_capacity: text })
            }
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Jenis Bahan Bakar <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.radioGroup}>
            {["Petrol", "Diesel", "Electric", "Hybrid"].map((fuel) => (
              <TouchableOpacity
                key={fuel}
                style={[
                  styles.radioButton,
                  formData.fuel_type === fuel && styles.radioButtonSelected,
                ]}
                onPress={() => setFormData({ ...formData, fuel_type: fuel })}>
                <Text
                  style={[
                    styles.radioText,
                    formData.fuel_type === fuel && styles.radioTextSelected,
                  ]}>
                  {fuel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kilometer (km)</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: 50000"
            value={formData.mileage}
            onChangeText={(text) => setFormData({ ...formData, mileage: text })}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kondisi</Text>
          <View style={styles.radioGroup}>
            {["Excellent", "Good", "Fair"].map((cond) => (
              <TouchableOpacity
                key={cond}
                style={[
                  styles.radioButton,
                  formData.condition === cond && styles.radioButtonSelected,
                ]}
                onPress={() => setFormData({ ...formData, condition: cond })}>
                <Text
                  style={[
                    styles.radioText,
                    formData.condition === cond && styles.radioTextSelected,
                  ]}>
                  {cond}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Warna</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Hitam"
            value={formData.color}
            onChangeText={(text) => setFormData({ ...formData, color: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Harga <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: 150000000"
            value={formData.price}
            onChangeText={(text) => setFormData({ ...formData, price: text })}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lokasi</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: Jakarta"
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
            placeholder="Deskripsikan kondisi mobil Anda..."
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text.slice(0, 500) })
            }
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.charCount}>
            {formData.description.length}/500
          </Text>
        </View>
      </View>

      {/* Contact Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informasi Kontak</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Nama Lengkap <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Nama lengkap"
            value={formData.contact_name}
            onChangeText={(text) =>
              setFormData({ ...formData, contact_name: text })
            }
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Nomor Telepon <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="08xxxxxxxxxx"
            value={formData.contact_phone}
            onChangeText={(text) =>
              setFormData({ ...formData, contact_phone: text })
            }
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Email <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            value={formData.contact_email}
            onChangeText={(text) =>
              setFormData({ ...formData, contact_email: text })
            }
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Kontak Preferensi</Text>
          <View style={styles.radioGroup}>
            {["WhatsApp", "Phone", "Email"].map((pref) => (
              <TouchableOpacity
                key={pref}
                style={[
                  styles.radioButton,
                  formData.contact_preference === pref &&
                    styles.radioButtonSelected,
                ]}
                onPress={() =>
                  setFormData({ ...formData, contact_preference: pref })
                }>
                <Text
                  style={[
                    styles.radioText,
                    formData.contact_preference === pref &&
                      styles.radioTextSelected,
                  ]}>
                  {pref}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() =>
              setAgreements({
                ...agreements,
                termsAndConditions: !agreements.termsAndConditions,
              })
            }>
            <View
              style={[
                styles.checkbox,
                agreements.termsAndConditions && styles.checkboxChecked,
              ]}>
              {agreements.termsAndConditions && (
                <Feather name="check" size={16} color="#fff" />
              )}
            </View>
            <Text style={styles.checkboxText}>
              Saya menyetujui{" "}
              <Text style={styles.link}>Syarat dan Ketentuan</Text> serta{" "}
              <Text style={styles.link}>Kebijakan Privasi</Text> NEROCARS{" "}
              <Text style={styles.required}>*</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() =>
              setAgreements({
                ...agreements,
                promotionalInfo: !agreements.promotionalInfo,
              })
            }>
            <View
              style={[
                styles.checkbox,
                agreements.promotionalInfo && styles.checkboxChecked,
              ]}>
              {agreements.promotionalInfo && (
                <Feather name="check" size={16} color="#fff" />
              )}
            </View>
            <Text style={styles.checkboxText}>
              Saya bersedia menerima informasi penawaran dan promosi dari
              NEROCARS
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.draftButton]}
          onPress={() => handleSubmit(true)}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FF6B00" />
          ) : (
            <Text style={styles.draftButtonText}>Simpan Draft</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.publishButton]}
          onPress={() => handleSubmit(false)}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.publishButtonText}>Posting Iklan</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  section: {
    backgroundColor: "#fff",
    padding: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 16,
  },
  required: {
    color: "#FF6B00",
  },
  imageGrid: {
    marginBottom: 16,
  },
  imageSlotContainer: {
    marginBottom: 16,
  },
  imageSlotLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  imageSlot: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
    overflow: "hidden",
  },
  uploadPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  uploadText: {
    marginTop: 8,
    fontSize: 13,
    color: "#999",
  },
  uploadedImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  addMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#FF6B00",
    borderRadius: 8,
    backgroundColor: "#fff5e6",
  },
  addMoreText: {
    marginLeft: 8,
    color: "#FF6B00",
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
    marginTop: 4,
  },
  radioGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  radioButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  radioButtonSelected: {
    borderColor: "#FF6B00",
    backgroundColor: "#fff5e6",
  },
  radioText: {
    fontSize: 14,
    color: "#666",
  },
  radioTextSelected: {
    color: "#FF6B00",
    fontWeight: "600",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    backgroundColor: "#fff",
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  draftButton: {
    borderWidth: 1,
    borderColor: "#FF6B00",
    backgroundColor: "#fff",
  },
  draftButtonText: {
    color: "#FF6B00",
    fontSize: 16,
    fontWeight: "600",
  },
  publishButton: {
    backgroundColor: "#FF6B00",
  },
  publishButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  checkboxContainer: {
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#FF6B00",
    borderColor: "#FF6B00",
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  link: {
    color: "#FF6B00",
    textDecorationLine: "underline",
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
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    width: "80%",
    alignItems: "center",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  registerButton: {
    borderWidth: 1,
    borderColor: "#3b82f6",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
  },
  registerButtonText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },
});
