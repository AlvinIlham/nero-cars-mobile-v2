# Setup Blocked Users Feature

## Instruksi Instalasi

1. **Buka Supabase Dashboard**

   - Login ke https://supabase.com
   - Pilih project "nero-cars"

2. **Jalankan SQL Script**

   - Buka menu "SQL Editor" di sidebar
   - Klik "New Query"
   - Copy semua isi dari file `setup-blocked-users.sql`
   - Paste ke editor dan klik "Run"

3. **Verifikasi**
   - Buka "Table Editor"
   - Pastikan tabel `blocked_users` sudah terbuat
   - Check RLS policies sudah aktif

## Fitur yang Diaktifkan

### Mobile (React Native)

- ✅ Blokir user dari menu titik tiga di chat room
- ✅ Filter conversations untuk hide blocked users
- ✅ Validasi saat klik "Hubungi Penjual" (cek apakah user/seller sudah diblokir)
- ✅ Alert konfirmasi sebelum blokir
- ✅ Auto redirect ke messages list setelah blokir

### Web (Next.js)

- ✅ Blokir user dari dropdown menu di chat
- ✅ Filter conversations untuk hide blocked users
- ✅ Validasi block check
- ✅ Confirm dialog sebelum blokir
- ✅ Auto reload conversations setelah blokir

## Database Schema

```sql
blocked_users:
- id (UUID, primary key)
- blocker_id (UUID, references auth.users)
- blocked_id (UUID, references auth.users)
- created_at (timestamp)
- UNIQUE constraint on (blocker_id, blocked_id)
```

## Cara Kerja

1. **Blokir User**:

   - User A klik "Blokir User" di chat dengan User B
   - Record baru insert ke `blocked_users` table
   - User A tidak bisa lihat conversation dengan User B lagi

2. **Filter Conversations**:

   - Saat load conversations, query ke `blocked_users` table
   - Filter out conversations dimana other user ada di blocked list
   - Baik blocker maupun blocked user tidak akan melihat conversation

3. **Prevent Contact**:
   - Saat klik "Hubungi Penjual", check dulu apakah ada block
   - Jika ada (dari salah satu sisi), tampilkan alert dan cancel action

## Testing

1. Login sebagai User A
2. Buka chat dengan User B
3. Klik titik tiga > Blokir User
4. Konfirmasi
5. Verify:
   - Chat dengan User B hilang dari list
   - Tidak bisa klik "Hubungi Penjual" di mobil User B
   - User B juga tidak melihat chat dengan User A

## Unblock Feature (Optional)

Untuk menambahkan fitur unblock di masa depan:

```sql
-- Delete record dari blocked_users
DELETE FROM blocked_users
WHERE blocker_id = 'user_id'
  AND blocked_id = 'blocked_user_id';
```

Bisa ditambahkan di settings/profile page dengan list blocked users.
