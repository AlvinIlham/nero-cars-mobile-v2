# 🚀 Quick Start Guide - Nero Cars Mobile

Panduan cepat untuk menjalankan aplikasi mobile dalam 5 menit!

## ⚡ Langkah Cepat (5 Menit)

### 1️⃣ Install Dependencies (2 menit)

```bash
cd Car_Showroom_Mobile
npm install
```

### 2️⃣ Setup Environment (1 menit)

Buat file `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> 💡 **Tip:** Copy URL dan Key dari file `.env` di folder `Car_Showroom_Web_Backup1`

### 3️⃣ Run App (2 menit)

```bash
npm start
```

Pilih salah satu:

- **Tekan `a`** untuk Android emulator
- **Tekan `i`** untuk iOS simulator (Mac only)
- **Scan QR code** dengan Expo Go app (di phone)

## 📱 Testing di Phone Langsung

### Android:

1. Install **Expo Go** dari Play Store
2. Buka Expo Go app
3. Scan QR code yang muncul di terminal
4. ✅ App langsung running!

### iOS:

1. Install **Expo Go** dari App Store
2. Buka Camera app
3. Scan QR code yang muncul di terminal
4. Tap notification untuk buka di Expo Go
5. ✅ App langsung running!

## 🎯 Test Accounts

Gunakan akun yang sudah ada di database web app, atau buat akun baru:

```
Email: test@example.com
Password: password123
```

## ✨ Fitur yang Bisa Dicoba

1. **Browse Cars** - Lihat daftar mobil
2. **Car Detail** - Tap mobil untuk detail lengkap
3. **Login** - Login dengan akun dari web app
4. **Profile** - Lihat profile setelah login

## 🔧 Troubleshooting Cepat

**Problem:** QR code tidak bisa di-scan

```bash
npm start -- --tunnel
```

**Problem:** Metro bundler error

```bash
npm start -- --clear
```

**Problem:** Module not found

```bash
rm -rf node_modules
npm install
```

## 📖 Dokumentasi Lengkap

Lihat [README.md](./README.md) untuk dokumentasi lengkap.

---

Happy coding! 🚀
