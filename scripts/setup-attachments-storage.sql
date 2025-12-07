-- Setup Attachments Storage Bucket for Chat Files
-- Run this in Supabase SQL Editor or Storage section

-- Note: This is a reference script. Actual bucket creation should be done through Supabase Dashboard > Storage
-- Steps:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "Create a new bucket"
-- 3. Name: attachments
-- 4. Public bucket: YES (so files can be accessed via public URL)
-- 5. File size limit: 10MB
-- 6. Allowed MIME types: image/*, application/pdf, application/msword, application/vnd.*, text/*

-- However, if you want to create via SQL:

-- Create storage bucket for attachments (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  true,
  10485760, -- 10MB in bytes
  ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.*', 'text/*']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for attachments bucket
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Allow anyone to read files (since it's a public bucket)
CREATE POLICY "Allow public to read files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'attachments');

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Verify bucket creation
SELECT * FROM storage.buckets WHERE id = 'attachments';
