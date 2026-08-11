-- Diagnostic script to check publication_files for specific publication
-- Run this in Supabase SQL Editor

-- 1. Check if publication exists
SELECT 
  id,
  title,
  publication_status,
  source_type,
  created_at
FROM public.publications
WHERE id = '7f093845-bab1-4e74-ba2a-e3d588f4d751';

-- 2. Check if publication_files row exists for this publication
SELECT 
  id,
  publication_id,
  file_name,
  file_type,
  file_size_bytes,
  storage_path,
  uploaded_at,
  uploaded_by
FROM public.publication_files
WHERE publication_id = '7f093845-bab1-4e74-ba2a-e3d588f4d751';

-- 3. Check all publication events for this publication
SELECT 
  id,
  publication_id,
  event_type,
  actor_id,
  note,
  created_at
FROM public.publication_events
WHERE publication_id = '7f093845-bab1-4e74-ba2a-e3d588f4d751'
ORDER BY created_at;

-- 4. Check if ANY publication_files rows exist
SELECT COUNT(*) as total_files
FROM public.publication_files;

-- 5. Check all publications and their file status
SELECT 
  p.id,
  p.title,
  p.publication_status,
  CASE WHEN pf.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_file,
  pf.storage_path
FROM public.publications p
LEFT JOIN public.publication_files pf ON p.id = pf.publication_id
ORDER BY p.created_at DESC
LIMIT 10;
