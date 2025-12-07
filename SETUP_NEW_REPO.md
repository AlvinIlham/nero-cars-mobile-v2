# Nero Cars Mobile V2 - Setup Repository Baru

Repository ini adalah versi baru yang terpisah dari repository lama.

## Setup GitHub Repository

### 1. Buat Repository Baru di GitHub

- Buka https://github.com/new
- Nama repository: `nero-cars-mobile-v2`
- Deskripsi: "Nero Cars - Platform Jual Beli Mobil (Mobile App Version 2)"
- Pilih **Public** atau **Private** sesuai kebutuhan
- **JANGAN** centang "Initialize this repository with a README"
- Klik "Create repository"

### 2. Hubungkan dengan Repository Lokal

Setelah repository dibuat di GitHub, jalankan perintah berikut di terminal:

```powershell
# Pastikan Anda berada di folder nero-cars-mobile-v2
cd "C:\UNP\UNP\Semester 5\Interaksi Manusia dan Komputer\Tahap 6\nero-cars-mobile-v2"

# Tambahkan remote origin (ganti YOUR_USERNAME dengan username GitHub Anda)
git remote add origin https://github.com/YOUR_USERNAME/nero-cars-mobile-v2.git

# Push ke GitHub
git branch -M main
git push -u origin main
```

### 3. Setup Project

Setelah repository terhubung, install dependencies:

```powershell
npm install
```

### 4. Setup Environment Variables

Buat file `.env` dan isi dengan kredensial Supabase Anda:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Jalankan Development Server

```powershell
npx expo start
```

Scan QR code dengan Expo Go app di smartphone Anda.

## Status Repository

✅ Repository lokal sudah diinisialisasi
✅ Initial commit sudah dibuat
⏳ Menunggu dibuat di GitHub dan dihubungkan

## Catatan Penting

- Repository ini TIDAK terhubung dengan repository lama (nero-cars-mobile)
- Semua file source code sudah di-copy dari repository lama
- Folder `node_modules` tidak di-copy, perlu install ulang dengan `npm install`
- History commit dimulai dari awal (clean history)

## Menjalankan di Perangkat

### Android

```powershell
npx expo run:android
```

### iOS (Mac only)

```powershell
npx expo run:ios
```
