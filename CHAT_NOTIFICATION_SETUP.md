# Chat & Notification System Setup

## Overview

Sistem chat dan notifikasi real-time untuk aplikasi Car Showroom Mobile menggunakan Supabase.

## Features Implemented

### 1. Chat System

- ✅ Real-time messaging antara pembeli dan penjual
- ✅ Chat history dengan pagination
- ✅ Mark messages as read
- ✅ Unread message counter
- ✅ Chat dari tombol "Hubungi Penjual"
- ✅ Real-time updates menggunakan Supabase Realtime

### 2. Notification System

- ✅ Real-time notifications
- ✅ Multiple notification types:
  - `message` - Pesan baru masuk
  - `favorite` - Mobil Anda difavoritkan
  - `car_sold` - Mobil berhasil terjual
  - `car_approved` - Listing mobil disetujui
  - `car_rejected` - Listing mobil ditolak
  - `price_drop` - Penurunan harga mobil favorit
  - `new_listing` - Listing baru dari brand favorit
  - `offer_received` - Tawaran diterima
  - `offer_accepted` - Tawaran diterima penjual
  - `offer_rejected` - Tawaran ditolak
  - `system` - Notifikasi sistem
- ✅ Icon dan warna berbeda per tipe
- ✅ Mark as read (single & all)
- ✅ Auto cleanup notifikasi lama

## Database Setup

### 1. Run SQL Script di Supabase

Jalankan file `scripts/setup-chat-notifications.sql` di Supabase SQL Editor:

```sql
-- Script akan membuat:
-- 1. Tabel messages dengan RLS policies
-- 2. Tabel notifications dengan semua tipe
-- 3. Indexes untuk performa
-- 4. Triggers untuk auto-update timestamps
-- 5. Enable Realtime subscriptions
```

### 2. Tables Structure

#### Messages Table

```sql
- id: BIGSERIAL (Primary Key)
- sender_id: UUID (Foreign Key -> auth.users)
- receiver_id: UUID (Foreign Key -> auth.users)
- message: TEXT
- car_id: TEXT (optional, untuk referensi mobil)
- is_read: BOOLEAN
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### Notifications Table

```sql
- id: BIGSERIAL (Primary Key)
- user_id: UUID (Foreign Key -> auth.users)
- type: TEXT (enum: message, favorite, car_sold, etc.)
- title: TEXT
- message: TEXT
- is_read: BOOLEAN
- related_id: TEXT (optional, untuk referensi ke record lain)
- created_at: TIMESTAMP
```

## How It Works

### Chat Flow

1. User klik "Hubungi Penjual" pada card mobil atau detail page
2. System cek apakah user sudah login
3. Navigasi ke `/chat/[userId]` dengan params:
   - userId: ID penjual
   - userName: Nama penjual
   - carId: ID mobil (optional)
4. Chat page load messages history
5. Subscribe ke Realtime updates
6. Saat pesan dikirim:
   - Insert ke tabel `messages`
   - Create notification untuk receiver di tabel `notifications`
   - Receiver langsung menerima notifikasi real-time

### Notification Flow

1. Berbagai event trigger notifikasi:
   - Chat baru masuk
   - Mobil difavoritkan
   - Listing approved/rejected
   - Dll
2. Notification dikirim ke tabel `notifications`
3. User yang login subscribe ke channel notifications
4. Notification muncul real-time di halaman Notifications
5. User bisa mark as read atau delete

## Files Created/Modified

### New Files

- `app/chat/[userId].tsx` - Chat detail page dengan real-time messaging
- `scripts/setup-chat-notifications.sql` - Database setup script

### Modified Files

- `app/(tabs)/index.tsx` - Tambah `handleContactSeller()` function
- `app/cars/[id].tsx` - Update tombol "Hubungi Penjual" dengan handler
- `app/messages/index.tsx` - Update navigasi ke chat detail
- `app/notifications/index.tsx` - Tambah real-time subscription

## Testing

### 1. Test Chat System

```
1. Login sebagai user A
2. Buka detail mobil dari user B
3. Klik "Hubungi Penjual"
4. Kirim pesan
5. Login sebagai user B
6. Cek halaman Messages - pesan harus muncul
7. Buka chat - real-time messaging harus bekerja
```

### 2. Test Notifications

```
1. Login sebagai user A
2. Kirim pesan ke user B
3. User B harus menerima notifikasi real-time
4. Klik notifikasi - navigasi ke halaman yang sesuai
5. Test mark as read
```

### 3. Test Real-time

```
1. Buka 2 emulator/devices
2. Login sebagai user berbeda di masing-masing
3. Kirim pesan dari satu device
4. Device lainnya harus langsung menerima tanpa refresh
```

## Notification Types Usage

### Creating Notifications Programmatically

```typescript
// Example: Notify when car is favorited
await supabase.from("notifications").insert({
  user_id: carOwnerId,
  type: "favorite",
  title: "Mobil Difavoritkan",
  message: `${userName} menyukai ${carBrand} ${carModel} Anda`,
  is_read: false,
  related_id: carId,
});

// Example: Notify when car is sold
await supabase.from("notifications").insert({
  user_id: sellerId,
  type: "car_sold",
  title: "Mobil Terjual!",
  message: `${carBrand} ${carModel} Anda telah terjual`,
  is_read: false,
  related_id: carId,
});

// Example: Price drop notification
await supabase.from("notifications").insert({
  user_id: buyerId,
  type: "price_drop",
  title: "Harga Turun!",
  message: `${carBrand} ${carModel} turun harga menjadi Rp ${newPrice}`,
  is_read: false,
  related_id: carId,
});
```

## Next Steps

1. **Implementasi notifikasi lainnya:**

   - Favorite: Saat mobil difavoritkan
   - Car sold: Saat mobil berhasil terjual
   - Price drop: Monitor perubahan harga

2. **Push Notifications:**

   - Integrate Expo Notifications
   - Send push when app is in background

3. **Chat Enhancements:**

   - Image sharing dalam chat
   - Voice messages
   - Read receipts (double checkmark)
   - Typing indicators

4. **Analytics:**
   - Track message response time
   - Most active chat times
   - Notification click-through rates

## Troubleshooting

### Messages tidak muncul

- Cek RLS policies di Supabase
- Verify user authentication
- Check console logs untuk errors

### Real-time tidak bekerja

- Pastikan Realtime enabled di Supabase project settings
- Verify subscription channels
- Check network connection

### Notifications tidak muncul

- Cek tabel notifications exists
- Verify real-time subscription
- Check user_id matches

## Security Notes

- ✅ RLS (Row Level Security) enabled
- ✅ Users hanya bisa lihat message mereka sendiri
- ✅ Users hanya bisa kirim message atas nama mereka sendiri
- ✅ Notifications protected dengan RLS
- ✅ No sensitive data exposed in notifications
