import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import {
  ADMIN_EMAIL,
  isEmailJsConfigured,
  sendEmailViaWebsiteAPI,
} from "@/lib/emailConfig";

type FeedbackType = "bug" | "feature" | "improvement" | "complaint" | "other";

interface FeedbackTypeOption {
  value: FeedbackType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

export default function FeedbackPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("improvement");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const feedbackTypes: FeedbackTypeOption[] = [
    {
      value: "bug",
      label: "Laporkan Bug",
      icon: "bug-outline",
      description: "Ada yang tidak berfungsi",
    },
    {
      value: "feature",
      label: "Saran Fitur",
      icon: "bulb-outline",
      description: "Ide fitur baru",
    },
    {
      value: "improvement",
      label: "Perbaikan",
      icon: "star-outline",
      description: "Saran perbaikan",
    },
    {
      value: "complaint",
      label: "Keluhan",
      icon: "sad-outline",
      description: "Masalah layanan",
    },
    {
      value: "other",
      label: "Lainnya",
      icon: "chatbubble-outline",
      description: "Masukan umum",
    },
  ];

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async () => {
    // Validation
    if (!subject.trim()) {
      Alert.alert("Error", "Mohon isi judul feedback");
      return;
    }

    if (!message.trim()) {
      Alert.alert("Error", "Mohon isi pesan feedback");
      return;
    }

    if (message.length < 10) {
      Alert.alert("Error", "Pesan minimal 10 karakter");
      return;
    }

    if (email && !isValidEmail(email)) {
      Alert.alert("Error", "Format email tidak valid");
      return;
    }

    // Require user to be logged in
    if (!user) {
      Alert.alert(
        "Login Required",
        "Mohon login terlebih dahulu untuk mengirim feedback",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/login") },
        ]
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const typeLabel =
        feedbackTypes.find((t) => t.value === feedbackType)?.label ||
        feedbackType;

      // PRIORITAS 1: Insert to database dulu - include type field
      const { error: dbError } = await supabase.from("feedback").insert({
        user_id: user.id,
        type: feedbackType,
        email: email || user.email || "anonymous@nerocars.com",
        subject: `${typeLabel}: ${subject}`,
        message: message,
      });

      if (dbError) throw dbError;

      console.log("✅ Feedback saved to database");

      // PRIORITAS 2: Coba kirim email (optional, jika gagal tidak masalah)
      try {
        // Prepare email template parameters
        const templateParams = {
          feedback_type: typeLabel,
          subject: subject,
          message: message,
          user_email: email || "Anonymous",
          sent_time: new Date().toLocaleString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          to_email: ADMIN_EMAIL,
        };

        if (isEmailJsConfigured()) {
          console.log(
            "📧 Attempting to send email notification via website API..."
          );
          const response = await sendEmailViaWebsiteAPI(templateParams);
          console.log("✅ Email sent successfully:", response.status);
        }
      } catch (emailError: any) {
        // Email gagal tidak masalah, yang penting sudah tersimpan di database
        console.warn(
          "⚠️ Email notification failed (but feedback saved):",
          emailError.message
        );
      }

      Alert.alert(
        "Sukses",
        "Terima kasih atas masukan Anda! Feedback telah tersimpan.",
        [
          {
            text: "OK",
            onPress: () => {
              setSubject("");
              setMessage("");
              setFeedbackType("improvement");
              router.back();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Error submitting feedback:", error);

      let errorMessage = "Gagal menyimpan feedback. Silakan coba lagi.";
      if (error.message) {
        errorMessage = `Terjadi kesalahan: ${error.message}`;
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Kirim Masukan",
          headerShown: true,
          headerStyle: { backgroundColor: "#1e293b" },
          headerTintColor: "#fff",
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="chatbubbles" size={48} color="#f59e0b" />
          <Text style={styles.title}>Kirim Masukan</Text>
          <Text style={styles.subtitle}>
            Kami sangat menghargai masukan Anda untuk meningkatkan layanan
            NeroCars
          </Text>
          {!user && (
            <View style={styles.loginNotice}>
              <Ionicons name="information-circle" size={20} color="#f59e0b" />
              <Text style={styles.loginNoticeText}>
                Anda harus login untuk mengirim feedback
              </Text>
            </View>
          )}
        </View>

        {/* Guidelines */}
        <View style={styles.section}>
          <View style={styles.guidelinesContainer}>
            <Text style={styles.guidelinesTitle}>
              📋 Panduan Mengirim Feedback
            </Text>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.guidelineText}>
                Jelaskan masalah atau saran dengan detail dan spesifik
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.guidelineText}>
                Sertakan langkah-langkah jika melaporkan bug
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.guidelineText}>
                Gunakan bahasa yang sopan dan konstruktif
              </Text>
            </View>
            <View style={styles.guidelineItem}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.guidelineText}>
                Minimal 10 karakter untuk pesan feedback
              </Text>
            </View>
          </View>
        </View>

        {/* Feedback Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Jenis Masukan</Text>
          <View style={styles.typeGrid}>
            {feedbackTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeCard,
                  feedbackType === type.value && styles.typeCardActive,
                ]}
                onPress={() => setFeedbackType(type.value)}>
                <Ionicons
                  name={type.icon}
                  size={24}
                  color={feedbackType === type.value ? "#fff" : "#94a3b8"}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    feedbackType === type.value && styles.typeLabelActive,
                  ]}>
                  {type.label}
                </Text>
                <Text
                  style={[
                    styles.typeDescription,
                    feedbackType === type.value && styles.typeDescriptionActive,
                  ]}>
                  {type.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Email */}
        <View style={styles.section}>
          <Text style={styles.label}>Email (Opsional)</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Subject */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Judul <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Judul singkat masukan Anda"
            placeholderTextColor="#64748b"
            value={subject}
            onChangeText={setSubject}
          />
        </View>

        {/* Message */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Pesan <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Jelaskan masukan Anda secara detail..."
            placeholderTextColor="#64748b"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{message.length} karakter</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!subject.trim() || !message.trim() || message.length < 10) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={
            isSubmitting ||
            !subject.trim() ||
            !message.trim() ||
            message.length < 10
          }>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Kirim Masukan</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
  },
  loginNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  loginNoticeText: {
    fontSize: 13,
    color: "#f59e0b",
    fontWeight: "500",
  },
  guidelinesContainer: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  guidelinesTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  guidelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  guidelineText: {
    fontSize: 13,
    color: "#94a3b8",
    lineHeight: 18,
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 12,
  },
  required: {
    color: "#ef4444",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  typeCard: {
    width: "48%",
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#334155",
  },
  typeCardActive: {
    backgroundColor: "#f59e0b",
    borderColor: "#f59e0b",
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
  typeLabelActive: {
    color: "#fff",
  },
  typeDescription: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
    textAlign: "center",
  },
  typeDescriptionActive: {
    color: "#fff",
    opacity: 0.9,
  },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  characterCount: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 8,
    textAlign: "right",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f59e0b",
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: "#334155",
    opacity: 0.5,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomSpace: {
    height: 40,
  },
});
