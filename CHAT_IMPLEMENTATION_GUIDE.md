# Chat System Implementation Guide

## 📦 Installation Steps

### 1. Install Required Packages (Mobile)

```bash
cd nero-cars-mobile
npx expo install react-native-gifted-chat
```

### 2. Run SQL Migration

Jalankan file `scripts/fix-messages-structure.sql` di Supabase SQL Editor:

1. Buka https://app.supabase.com
2. Pilih project Anda
3. Klik "SQL Editor" di sidebar
4. Buat New Query
5. Copy-paste isi file `fix-messages-structure.sql`
6. Klik Run

**Ini akan:**

- Fix struktur tabel `messages`
- Buat tabel `conversations` jika belum ada
- Setup RLS policies
- Tambah indexes untuk performa
- Enable realtime subscriptions

### 3. Verify Database Structure

Jalankan query ini untuk memastikan struktur benar:

```sql
-- Check messages table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Check conversations table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('messages', 'conversations');
```

## 🚀 Testing

### Test Mobile App

1. Start Expo:

```bash
cd nero-cars-mobile
npx expo start
```

2. Test flow:
   - Login sebagai user A
   - Buka detail mobil dari seller
   - Klik "Hubungi Penjual"
   - Kirim pesan
   - Login sebagai user B di device lain
   - Check Messages tab
   - Reply pesan

### Test Web App

1. Start Next.js:

```bash
cd nero-cars-web
npm run dev
```

2. Test flow:
   - Login dengan user yang sama
   - Buka `/messages`
   - Chat harus sinkron dengan mobile
   - Test read/unread status

## ✨ Features Implemented

### Mobile (React Native + Gifted Chat)

- ✅ List conversations with unread count
- ✅ Chat room with Gifted Chat UI
- ✅ Real-time message updates
- ✅ Auto mark as read when open chat
- ✅ Avatar & timestamp display
- ✅ Beautiful bubble chat design

### Web (Next.js)

- ✅ Same database structure as mobile
- ✅ Fixed read/unread logic
- ✅ Simplified query (no OR null checks)
- ✅ Consistent with mobile behavior

## 🔧 Integration Points

### Start Chat from Car Detail (Mobile)

Add this function to your car detail page:

```tsx
import { getOrCreateConversation } from "@/lib/chatService";

const handleContactSeller = async () => {
  if (!user) {
    Alert.alert("Login Required", "Silakan login terlebih dahulu");
    return;
  }

  try {
    const { data: conversation, error } = await getOrCreateConversation(
      carId,
      user.id,
      car.seller_id
    );

    if (error || !conversation) {
      Alert.alert("Error", "Gagal membuat percakapan");
      return;
    }

    router.push({
      pathname: "/messages/[id]",
      params: {
        id: conversation.id,
        otherPersonName: car.seller?.full_name || "Penjual",
        carInfo: `${car.brand} ${car.model} ${car.year}`,
      },
    });
  } catch (error) {
    console.error("Error:", error);
  }
};
```

### Start Chat from Car Detail (Web)

Already implemented in your web app. Just make sure it uses the same `getOrCreateConversation` function.

## 🐛 Troubleshooting

### Messages not showing

- Check RLS policies enabled
- Verify user authenticated
- Check console for errors

### Real-time not working

- Ensure Realtime enabled in Supabase project settings
- Check publication includes messages & conversations tables
- Verify network connection

### Read/Unread not updating

- Run the SQL migration again
- Check `is_read` column has default value `false`
- No NULL values in `is_read`

## 📊 Database Schema

### messages table

```
- id (bigserial)
- conversation_id (uuid) → conversations.id
- sender_id (uuid) → auth.users.id
- receiver_id (uuid) → auth.users.id
- content (text)
- is_read (boolean, default: false)
- created_at (timestamp)
```

### conversations table

```
- id (uuid, primary key)
- car_id (text) → cars.id
- buyer_id (uuid) → auth.users.id
- seller_id (uuid) → auth.users.id
- last_message (text)
- last_message_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
```

## 🎯 Next Steps (Optional Enhancements)

1. **Typing Indicator**

   - Use Supabase presence
   - Show "typing..." when other person typing

2. **Message Status**

   - Sent (✓)
   - Delivered (✓✓)
   - Read (✓✓ blue)

3. **Image Sharing**

   - Upload to Supabase Storage
   - Send image URL in message

4. **Push Notifications**

   - Expo Push Notifications
   - Send when app in background

5. **Message Search**
   - Full-text search in messages
   - Filter by conversation

## 📝 Notes

- Gifted Chat is fully compatible with Expo Go
- No external paid services needed
- All data stored in your Supabase database
- Web and mobile share same backend
- Real-time updates work out of the box
