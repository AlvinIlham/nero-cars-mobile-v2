// EmailJS Configuration for Mobile App
// Menggunakan kredensial yang sama dengan website

export const EMAILJS_CONFIG = {
  // Public Key dari EmailJS Dashboard
  PUBLIC_KEY: "-TUZFxk0zj6tnxnnJ",

  // Service ID dari EmailJS Dashboard > Email Services
  SERVICE_ID: "service_nfhn2ak",

  // Template ID dari EmailJS Dashboard > Email Templates
  TEMPLATE_ID: "template_jybkznk",
};

// Email developer yang akan menerima feedback
export const ADMIN_EMAIL = "alvinilhamuddin4@gmail.com";

// API endpoint website untuk mengirim email (proxy endpoint)
// Ganti dengan URL website Anda yang sudah deploy
// Contoh: "https://your-website.vercel.app/api/send-feedback-email"
const WEBSITE_API_URL = "http://localhost:3000/api/send-feedback-email"; // Untuk testing local
// const WEBSITE_API_URL = "https://your-production-url.com/api/send-feedback-email"; // Untuk production

// Fungsi untuk mengecek apakah EmailJS sudah dikonfigurasi
export const isEmailJsConfigured = (): boolean => {
  return (
    EMAILJS_CONFIG.PUBLIC_KEY !== "YOUR_PUBLIC_KEY" &&
    EMAILJS_CONFIG.SERVICE_ID !== "YOUR_SERVICE_ID" &&
    EMAILJS_CONFIG.TEMPLATE_ID !== "YOUR_TEMPLATE_ID"
  );
};

// Fungsi untuk mengirim email melalui website API endpoint (kompatibel dengan React Native)
export const sendEmailViaWebsiteAPI = async (templateParams: any) => {
  try {
    const response = await fetch(WEBSITE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templateParams),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }

    const data = await response.json();
    return {
      status: response.status,
      text: data.message || "Email sent successfully",
    };
  } catch (error: any) {
    console.error("Error sending email via website API:", error);
    throw error;
  }
};

// Legacy function (tidak digunakan, EmailJS block mobile apps)
export const sendEmailViaEmailJS = async (templateParams: any) => {
  try {
    const response = await fetch(
      "https://api.emailjs.com/api/v1.0/email/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: EMAILJS_CONFIG.SERVICE_ID,
          template_id: EMAILJS_CONFIG.TEMPLATE_ID,
          user_id: EMAILJS_CONFIG.PUBLIC_KEY,
          template_params: templateParams,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`EmailJS error: ${response.status} - ${errorText}`);
    }

    return {
      status: response.status,
      text: await response.text(),
    };
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
