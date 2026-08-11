-- Diagnostic script to check trigger status and profile creation issue
-- Run this in Supabase SQL Editor to diagnose the auth.users -> profiles issue

-- 1. Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing,
  enabled
FROM information_schema.triggers
WHERE trigger_name = 'trg_handle_new_user';

-- 2. Check if the trigger function exists
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'handle_new_user';

-- 3. Check the trigger function definition
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 4. Check auth.users that don't have profiles
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data,
  u.raw_app_meta_data,
  u.email_confirmed_at,
  p.id as profile_id
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- 5. Check auth.users that DO have profiles (for comparison)
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data,
  u.raw_app_meta_data,
  p.id as profile_id,
  p.full_name,
  p.email as profile_email,
  p.avatar_url
FROM auth.users u
INNER JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 5;

-- 6. Check all triggers on auth.users
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing,
  enabled
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND event_object_schema = 'auth';
