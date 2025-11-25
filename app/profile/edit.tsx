import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: string;
  address: string;
  city: string;
  province: string;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    birthDate: "",
    gender: "Laki-laki",
    address: "",
    city: "",
    province: "",
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      if (!user?.id) {
        Alert.alert("Error", "User tidak ditemukan");
        router.back();
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
      }

      if (profile) {
        const [firstName, ...lastNameParts] = (profile.full_name || "").split(
          " "
        );
        setFormData({
          firstName: firstName || "",
          lastName: lastNameParts.join(" ") || "",
          email: profile.email || user.email || "",
          phone: profile.phone || "",
          birthDate: profile.birth_date || "",
          gender: profile.gender || "Laki-laki",
          address: profile.address || "",
          city: profile.city || "",
          province: profile.province || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      Alert.alert("Error", "Gagal memuat data profil");
    } finally {
      setFetchingData(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert("Validasi", "Nama depan dan belakang harus diisi");
      return;
    }

    if (!formData.email.trim()) {
      Alert.alert("Validasi", "Email harus diisi");
      return;
    }

    setLoading(true);

    try {
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: formData.phone,
          birth_date: formData.birthDate,
          gender: formData.gender,
          address: formData.address,
          city: formData.city,
          province: formData.province,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);

      if (error) throw error;

      Alert.alert("Sukses", "Profil berhasil diperbarui!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", error.message || "Gagal memperbarui profil");
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: "Edit Profil",
            headerShown: true,
            headerStyle: {
              backgroundColor: "#1e293b",
            },
            headerTintColor: "#fff",
          }}
        />
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>Memuat data profil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Edit Profil",
          headerShown: true,
          headerStyle: {
            backgroundColor: "#1e293b",
          },
          headerTintColor: "#fff",
        }}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          {/* Nama Depan */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nama Depan *</Text>
            <TextInput
              style={styles.input}
              value={formData.firstName}
              onChangeText={(text) =>
                setFormData({ ...formData, firstName: text })
              }
              placeholder="Masukkan nama depan"
              placeholderTextColor="#64748b"
            />
          </View>

          {/* Nama Belakang */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nama Belakang *</Text>
            <TextInput
              style={styles.input}
              value={formData.lastName}
              onChangeText={(text) =>
                setFormData({ ...formData, lastName: text })
              }
              placeholder="Masukkan nama belakang"
              placeholderTextColor="#64748b"
            />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formData.email}
              editable={false}
              placeholder="Email"
              placeholderTextColor="#64748b"
            />
            <Text style={styles.helperText}>Email tidak dapat diubah</Text>
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>No. Telepon</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="Masukkan nomor telepon"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
            />
          </View>

          {/* Tanggal Lahir */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tanggal Lahir</Text>
            <TextInput
              style={styles.input}
              value={formData.birthDate}
              onChangeText={(text) =>
                setFormData({ ...formData, birthDate: text })
              }
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748b"
            />
          </View>

          {/* Jenis Kelamin */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Jenis Kelamin</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() =>
                  setFormData({ ...formData, gender: "Laki-laki" })
                }>
                <View style={styles.radioCircle}>
                  {formData.gender === "Laki-laki" && (
                    <View style={styles.radioSelected} />
                  )}
                </View>
                <Text style={styles.radioLabel}>Laki-laki</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioOption}
                onPress={() =>
                  setFormData({ ...formData, gender: "Perempuan" })
                }>
                <View style={styles.radioCircle}>
                  {formData.gender === "Perempuan" && (
                    <View style={styles.radioSelected} />
                  )}
                </View>
                <Text style={styles.radioLabel}>Perempuan</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Alamat */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Alamat</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.address}
              onChangeText={(text) =>
                setFormData({ ...formData, address: text })
              }
              placeholder="Masukkan alamat lengkap"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Kota */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Kota</Text>
            <TextInput
              style={styles.input}
              value={formData.city}
              onChangeText={(text) => setFormData({ ...formData, city: text })}
              placeholder="Masukkan kota"
              placeholderTextColor="#64748b"
            />
          </View>

          {/* Provinsi */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Provinsi</Text>
            <TextInput
              style={styles.input}
              value={formData.province}
              onChangeText={(text) =>
                setFormData({ ...formData, province: text })
              }
              placeholder="Masukkan provinsi"
              placeholderTextColor="#64748b"
            />
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => router.back()}
              disabled={loading}>
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Simpan</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },
  inputDisabled: {
    backgroundColor: "#0f172a",
    opacity: 0.6,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  helperText: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  radioGroup: {
    flexDirection: "row",
    gap: 24,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#f59e0b",
    justifyContent: "center",
    alignItems: "center",
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#f59e0b",
  },
  radioLabel: {
    color: "#fff",
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "#334155",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#f59e0b",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
