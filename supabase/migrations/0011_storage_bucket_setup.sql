-- MedPublish: Storage Bucket Setup for Publication Import System
--
-- This migration sets up the Supabase Storage bucket policies for the publications bucket.
-- 
-- IMPORTANT: Before running this migration, you must manually create the "publications" 
-- storage bucket in the Supabase dashboard:
-- 1. Go to Storage → Buckets
-- 2. Click "Create a new bucket"
-- 3. Name it: "publications"
-- 4. Make it Public
-- 5. Click "Create bucket"
--
-- After creating the bucket, run this migration to set up the RLS policies.

-- =========================================================================
-- STORAGE BUCKET POLICIES
-- =========================================================================

-- Allow public read access to files in the publications bucket
-- The actual access control is enforced at the database level via publication_files RLS
-- This storage policy allows read access to the bucket, but the database ensures only
-- files from published publications are accessible

DROP POLICY IF EXISTS "Public can read publication files" ON storage.objects;
CREATE POLICY "Public can read publication files"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'publications');

DROP POLICY IF EXISTS "Authenticated can read publication files" ON storage.objects;
CREATE POLICY "Authenticated can read publication files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'publications');

-- Only editors/admins can upload to the publications bucket
DROP POLICY IF EXISTS "Editors and admins can upload publication files" ON storage.objects;
CREATE POLICY "Editors and admins can upload publication files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'publications'
  AND public.is_editor_or_admin()
);

-- Only editors/admins can delete from the publications bucket
DROP POLICY IF EXISTS "Editors and admins can delete publication files" ON storage.objects;
CREATE POLICY "Editors and admins can delete publication files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'publications'
  AND public.is_editor_or_admin()
);

-- =========================================================================
-- VERIFICATION
-- =========================================================================

-- This query can be used to verify the policies are correctly applied
SELECT 
  policyname,
  tablename,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;
