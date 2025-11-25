-- ================================================
-- FIX RLS POLICIES - QUICK FIX
-- ================================================

-- Drop all existing policies on cars table
DROP POLICY IF EXISTS "Anyone can view available cars" ON cars;
DROP POLICY IF EXISTS "Users can view own cars" ON cars;
DROP POLICY IF EXISTS "Users can insert own cars" ON cars;
DROP POLICY IF EXISTS "Users can update own cars" ON cars;
DROP POLICY IF EXISTS "Users can delete own cars" ON cars;

-- Create new policies that work for both authenticated and anonymous users

-- 1. Allow EVERYONE (including anonymous) to view available cars
CREATE POLICY "Public can view available cars"
ON cars FOR SELECT
TO anon, authenticated
USING (is_draft = false AND is_sold = false);

-- 2. Allow authenticated users to view ALL their own cars (including drafts)
CREATE POLICY "Users can view all own cars"
ON cars FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Allow authenticated users to insert their own cars
CREATE POLICY "Authenticated users can insert own cars"
ON cars FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Allow authenticated users to update their own cars
CREATE POLICY "Authenticated users can update own cars"
ON cars FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Allow authenticated users to delete their own cars
CREATE POLICY "Authenticated users can delete own cars"
ON cars FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ================================================
-- VERIFY POLICIES
-- ================================================

-- Check if policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'cars';

-- Test query as anonymous user
SELECT COUNT(*) as total_available_cars FROM cars WHERE is_draft = false AND is_sold = false;
