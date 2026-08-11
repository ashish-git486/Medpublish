-- MedPublish: Fix Profile Auto-Provisioning for All Auth Methods
--
-- This migration fixes the automatic profile creation mechanism for both
-- Google OAuth and email/password users. It ensures that every new user
-- in auth.users automatically gets a corresponding row in public.profiles.
--
-- This is an ADDITIVE migration that:
-- 1. Re-creates the trigger function with improved metadata extraction
-- 2. Ensures the trigger is enabled on auth.users
-- 3. Adds better error handling and logging
-- 4. Backfills existing auth.users that don't have profiles
-- 5. Does NOT delete or modify existing profiles
-- 6. Does NOT weaken RLS policies
--
-- Run this file's contents in the Supabase SQL Editor (or via
-- `supabase db push`) AFTER 0001-0009 have already been applied.
-- Safe to run once; guards use `if not exists` / `if exists` /
-- `create or replace` throughout so re-running is idempotent.

-- =========================================================================
-- 1. IMPROVED TRIGGER FUNCTION WITH BETTER METADATA EXTRACTION
-- =========================================================================
-- The original trigger only checked for 'full_name' and 'name' in raw_user_meta_data.
-- Google OAuth and other providers may use different field names or store data in
-- different locations. This improved version checks multiple possible locations.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_email text;
  v_avatar_url text;
begin
  -- Extract full_name from multiple possible metadata locations
  -- Priority: full_name -> name -> given_name + family_name -> email prefix
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'display_name',
    (new.raw_user_meta_data ->> 'given_name') || ' ' || (new.raw_user_meta_data ->> 'family_name'),
    split_part(new.email, '@', 1)
  );
  
  -- Extract email (use the auth.users email as primary source)
  v_email := new.email;
  
  -- Extract avatar_url from multiple possible locations
  v_avatar_url := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    new.raw_user_meta_data ->> 'image_url'
  );
  
  -- Insert the profile with error handling
  begin
    insert into public.profiles (id, full_name, email, avatar_url)
    values (
      new.id,
      v_full_name,
      v_email,
      v_avatar_url
    )
    on conflict (id) do nothing;
  exception when others then
    -- Log the error but don't fail the trigger
    -- This ensures auth.users creation succeeds even if profile creation fails
    raise log 'Failed to create profile for user %: %', new.id, SQLERRM;
  end;
  
  return new;
end;
$$;

-- =========================================================================
-- 2. ENSURE TRIGGER EXISTS AND IS ENABLED
-- =========================================================================

-- Drop existing trigger if it exists (to recreate with the new function)
drop trigger if exists trg_handle_new_user on auth.users;

-- Create the trigger with the improved function
create trigger trg_handle_new_user
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =========================================================================
-- 3. BACKFILL EXISTING AUTH.USERS WITHOUT PROFILES
-- =========================================================================
-- This safely creates profiles for users who signed up before the trigger
-- was working properly. Uses the same metadata extraction logic as the trigger.

insert into public.profiles (id, full_name, email, avatar_url)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    u.raw_user_meta_data ->> 'display_name',
    (u.raw_user_meta_data ->> 'given_name') || ' ' || (u.raw_user_meta_data ->> 'family_name'),
    split_part(u.email, '@', 1)
  ) as full_name,
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'avatar_url',
    u.raw_user_meta_data ->> 'picture',
    u.raw_user_meta_data ->> 'image_url'
  ) as avatar_url
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

-- =========================================================================
-- 4. VERIFICATION QUERIES (for manual verification after migration)
-- =========================================================================
-- Run these queries after the migration to verify the fix:

-- Check how many profiles were backfilled
-- select count(*) as backfilled_profiles from public.profiles;

-- Check that all auth.users now have profiles
-- select count(*) as users_without_profiles
-- from auth.users u
-- where not exists (select 1 from public.profiles p where p.id = u.id);

-- Verify the trigger is enabled
-- select 
--   trigger_name,
--   event_manipulation,
--   event_object_table,
--   action_timing,
--   enabled
-- from information_schema.triggers
-- where trigger_name = 'trg_handle_new_user';

-- Check recent users and their profiles
-- select 
--   u.id,
--   u.email,
--   u.created_at,
--   u.raw_user_meta_data,
--   p.id as profile_id,
--   p.full_name,
--   p.email as profile_email,
--   p.avatar_url,
--   p.role
-- from auth.users u
-- left join public.profiles p on u.id = p.id
-- order by u.created_at desc
-- limit 10;
