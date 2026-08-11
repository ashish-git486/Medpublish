-- MedPublish: Proof Storage Security Update
--
-- This migration adds granular security policies to protect production proof files
-- while preserving existing access for published publication files.
--
-- IMPORTANT: This migration requires the 'publications' storage bucket to exist.
-- If it doesn't exist, create it manually in the Supabase Dashboard:
-- 1. Go to Storage → Buckets
-- 2. Click "Create a new bucket"
-- 3. Name it: "publications"
-- 4. Make it Public
-- 5. Click "Create bucket"
--
-- The existing publications bucket policies allow public read access to the entire bucket,
-- which is appropriate for published articles but not for unpublished production proofs.
--
-- This migration adds path-specific policies to protect proof files while maintaining
-- backward compatibility with existing publication file access.

-- =========================================================================
-- UPDATE STORAGE POLICIES FOR PROOF FILE PROTECTION
-- =========================================================================

-- Replace the overly broad public read policy with a more specific one
-- that only allows public access to non-proof files

DROP POLICY IF EXISTS "Public can read publication files" ON storage.objects;
CREATE POLICY "Public can read non-proof publication files"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'publications'
  AND (name NOT LIKE '%/production/proofs/%')
);

DROP POLICY IF EXISTS "Authenticated can read publication files" ON storage.objects;
CREATE POLICY "Authenticated can read non-proof publication files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'publications'
  AND (name NOT LIKE '%/production/proofs/%')
);

-- Add specific policies for proof file access

-- Editors and admins can read all proof files
CREATE POLICY "Editors and admins can read proof files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'publications'
  AND name ~ 'production/proofs/'
  AND public.is_editor_or_admin()
);

-- Authors can read proof files for their own manuscripts
-- Use proof_versions table to establish manuscript ownership
CREATE POLICY "Authors can read their own proof files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'publications'
  AND name ~ 'production/proofs/'
  AND EXISTS (
    SELECT 1 FROM public.proof_versions pv
    JOIN public.manuscripts m ON m.id = pv.manuscript_id
    WHERE pv.storage_path = name
    AND m.submitting_author_id = auth.uid()
  )
);

-- Editors and admins can upload proof files (existing policy already covers this, but make it explicit)
DROP POLICY IF EXISTS "Editors and admins can upload publication files" ON storage.objects;
CREATE POLICY "Editors and admins can upload to publications bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'publications'
  AND public.is_editor_or_admin()
);

-- Editors and admins can delete files (existing policy already covers this)
DROP POLICY IF EXISTS "Editors and admins can delete publication files" ON storage.objects;
CREATE POLICY "Editors and admins can delete from publications bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'publications'
  AND public.is_editor_or_admin()
);

-- =========================================================================
-- VERIFICATION QUERY
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
