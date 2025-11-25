-- ================================================
-- COMPLETE DATABASE SETUP FOR MOBILE APP
-- ================================================

-- 1. CREATE PROFILES TABLE (if not exists)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE CARS TABLE (if not exists)
CREATE TABLE IF NOT EXISTS cars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  price BIGINT NOT NULL,
  mileage INTEGER NOT NULL,
  transmission TEXT NOT NULL,
  engine_capacity TEXT,
  fuel_type TEXT NOT NULL,
  condition TEXT,
  color TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  is_sold BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fix existing cars table if it already exists
ALTER TABLE cars ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE cars ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE cars ALTER COLUMN is_sold SET DEFAULT false;
ALTER TABLE cars ALTER COLUMN is_draft SET DEFAULT false;
ALTER TABLE cars ALTER COLUMN images SET DEFAULT '{}';
ALTER TABLE cars ALTER COLUMN fuel_type DROP NOT NULL;
ALTER TABLE cars ALTER COLUMN color DROP NOT NULL;

-- Fix existing profiles table
ALTER TABLE profiles ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE profiles ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE profiles ALTER COLUMN full_name DROP NOT NULL;

-- 3. CREATE MESSAGES TABLE (if not exists)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add receiver_id and conversation_id columns if they don't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'receiver_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN conversation_id UUID NOT NULL DEFAULT uuid_generate_v4();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'content'
  ) THEN
    ALTER TABLE messages RENAME COLUMN message TO content;
  END IF;
END $$;

-- 4. CREATE NOTIFICATIONS TABLE (if not exists)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add link column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'link'
  ) THEN
    ALTER TABLE notifications ADD COLUMN link TEXT;
  END IF;
END $$;

-- 5. CREATE FAVORITES TABLE (if not exists)
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  car_id UUID REFERENCES cars(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, car_id)
);

-- ================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- ================================================
-- PROFILES POLICIES
-- ================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow public profile creation" ON profiles;

-- Anyone can view profiles (for displaying seller info)
CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow profile creation during signup
CREATE POLICY "Allow public profile creation"
ON profiles FOR INSERT
WITH CHECK (true);

-- ================================================
-- CARS POLICIES
-- ================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view available cars" ON cars;
DROP POLICY IF EXISTS "Users can view own cars" ON cars;
DROP POLICY IF EXISTS "Users can insert own cars" ON cars;
DROP POLICY IF EXISTS "Users can update own cars" ON cars;
DROP POLICY IF EXISTS "Users can delete own cars" ON cars;

-- Anyone (including anonymous users) can view available cars
CREATE POLICY "Anyone can view available cars"
ON cars FOR SELECT
USING (is_draft = false AND is_sold = false);

-- Users can view ALL their own cars (including drafts and sold)
CREATE POLICY "Users can view own cars"
ON cars FOR SELECT
USING (auth.uid() = user_id);

-- Authenticated users can insert their own cars
CREATE POLICY "Users can insert own cars"
ON cars FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own cars
CREATE POLICY "Users can update own cars"
ON cars FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own cars
CREATE POLICY "Users can delete own cars"
ON cars FOR DELETE
USING (auth.uid() = user_id);

-- ================================================
-- MESSAGES POLICIES
-- ================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

-- Users can view messages where they are sender or receiver
CREATE POLICY "Users can view their messages"
ON messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Authenticated users can send messages
CREATE POLICY "Users can send messages"
ON messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- ================================================
-- NOTIFICATIONS POLICIES
-- ================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ================================================
-- FAVORITES POLICIES
-- ================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can add favorites" ON favorites;
DROP POLICY IF EXISTS "Users can remove favorites" ON favorites;

-- Users can view their own favorites
CREATE POLICY "Users can view own favorites"
ON favorites FOR SELECT
USING (auth.uid() = user_id);

-- Users can add to their favorites
CREATE POLICY "Users can add favorites"
ON favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove from their favorites
CREATE POLICY "Users can remove favorites"
ON favorites FOR DELETE
USING (auth.uid() = user_id);

-- ================================================
-- TRIGGERS FOR AUTO-UPDATING updated_at
-- ================================================

-- Create or replace function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_cars_updated_at ON cars;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cars_updated_at
BEFORE UPDATE ON cars
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- FUNCTION TO AUTO-CREATE PROFILE ON SIGNUP
-- ================================================

-- Drop existing function if any
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to call the function
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ================================================
-- GRANT PERMISSIONS
-- ================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on tables
GRANT ALL ON profiles TO anon, authenticated;
GRANT ALL ON cars TO anon, authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON favorites TO authenticated;

-- ================================================
-- DONE!
-- ================================================
SELECT 'Database setup completed successfully!' AS status;
