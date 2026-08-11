-- Check publication_events RLS policies
-- Run this in Supabase SQL Editor to see if events can be inserted

SELECT 
  policyname,
  tablename,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'publication_events'
  AND schemaname = 'public'
ORDER BY policyname;

-- Check if publication_events table exists and has records
SELECT COUNT(*) as event_count
FROM public.publication_events;

-- Check if the publication_events table has any RLS enabled
SELECT 
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'publication_events'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
