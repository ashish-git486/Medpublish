-- MedPublish: Author Profile Enhancements (Phase 10)
--
-- Adds professional author profile fields to support the Author Profile & Author Workspace feature.
-- This is an ADDITIVE migration on top of 0001-0014 — it does not drop any table,
-- does not delete any existing data, and does not weaken any existing RLS policy.
--
-- The existing profiles table columns are preserved for backward compatibility.
-- New fields are optional and allow null values to avoid breaking existing profiles.
--
-- Run this file's contents in the Supabase SQL Editor (or via `supabase db push`)
-- AFTER 0001-0014 have already been applied. Safe to run once; guards use
-- `if not exists` / `if exists` / `alter table ... add column if not exists` throughout
-- so re-running is idempotent.

-- =========================================================================
-- 1. EXTEND PROFILES TABLE WITH PROFESSIONAL AUTHOR FIELDS
-- =========================================================================

-- Add professional contact information
alter table public.profiles
  add column if not exists phone text;

-- Add location information
alter table public.profiles
  add column if not exists country text;
alter table public.profiles
  add column if not exists city text;
alter table public.profiles
  add column if not exists postal_address text;

-- Add professional details
alter table public.profiles
  add column if not exists designation text; -- Professional title/position
alter table public.profiles
  add column if not exists department text;
alter table public.profiles
  add column if not exists orcid text; -- ORCID iD

-- Add academic/professional information
alter table public.profiles
  add column if not exists bio text; -- Professional biography
alter table public.profiles
  add column if not exists website_url text; -- Personal or institutional website

-- =========================================================================
-- 2. ADD INDEXES FOR PROFILE FIELDS
-- =========================================================================

-- Index for ORCID lookups (useful for author identity verification)
create index if not exists profiles_orcid_idx
  on public.profiles (orcid) where orcid is not null;

-- Index for country-based filtering (useful for regional author directories)
create index if not exists profiles_country_idx
  on public.profiles (country) where country is not null;

-- =========================================================================
-- 3. ADD CONSTRAINTS FOR DATA VALIDATION
-- =========================================================================

-- Add ORCID format validation (basic check for ORCID format: 0000-0000-0000-0000)
-- This is a basic format check, not a verification of actual ORCID validity
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orcid_format_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint orcid_format_check
      check (orcid is null or orcid ~ '^\d{4}-\d{4}-\d{4}-\d{4}$');
  end if;
end $$;

-- Add website URL format validation
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'website_url_format_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint website_url_format_check
      check (website_url is null or website_url ~ '^https?://');
  end if;
end $$;

-- =========================================================================
-- 4. CREATE SECURITY DEFINER FUNCTION FOR PROFILE COMPLETENESS
-- =========================================================================

-- Function to calculate profile completeness percentage
-- This helps authors understand which fields are missing from their profile
create or replace function public.get_profile_completeness(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_required_fields integer := 2; -- full_name, email (always present from auth)
  v_optional_fields integer := 8; -- phone, country, city, postal_address, designation, department, orcid, bio
  v_filled_fields integer := 0;
  v_completeness_percentage numeric;
begin
  -- Get the user's profile
  select * into v_profile
  from public.profiles
  where id = p_user_id;
  
  if v_profile.id is null then
    return jsonb_build_object(
      'completeness_percentage', 0,
      'filled_fields', 0,
      'total_fields', v_required_fields + v_optional_fields,
      'missing_fields', array['full_name', 'email']::text[]
    );
  end if;
  
  -- Count filled required fields (full_name and email are always present from auth)
  v_filled_fields := v_filled_fields + 2;
  
  -- Count filled optional fields
  if v_profile.phone is not null and trim(v_profile.phone) <> '' then
    v_filled_fields := v_filled_fields + 1;
  end if;
  
  if v_profile.country is not null and trim(v_profile.country) <> '' then
    v_filled_fields := v_filled_fields + 1;
  end if;
  
  if v_profile.city is not null and trim(v_profile.city) <> '' then
    v_filled_fields := v_filled_fields + 1;
  end if;
  
  if v_profile.postal_address is not null and trim(v_profile.postal_address) <> '' then
    v_filled_fields := v_filled_fields + 1;
  end if;
  
  if v_profile.designation is not null and trim(v_profile.designation) <> '' then
    v_filled_fields := v_filled_fields + 1;
  end if;
  
  if v_profile.department is not null and trim(v_profile.department) <> '' then
    v_filled_fields := v_filled_fields + 1;
  end if;
  
  if v_profile.orcid is not null and trim(v_profile.orcid) <> '' then
    v_filled_fields := v_filled_fields + 1;
  end if;
  
  if v_profile.bio is not null and trim(v_profile.bio) <> '' then
    v_filled_fields := v_filled_fields + 1;
  end if;
  
  -- Calculate percentage
  v_completeness_percentage := (v_filled_fields::numeric / (v_required_fields + v_optional_fields)::numeric) * 100;
  
  -- Identify missing fields
  return jsonb_build_object(
    'completeness_percentage', round(v_completeness_percentage, 0),
    'filled_fields', v_filled_fields,
    'total_fields', v_required_fields + v_optional_fields,
    'missing_fields', (
      select array_agg(field_name)
      from unnest(array['phone', 'country', 'city', 'postal_address', 'designation', 'department', 'orcid', 'bio']::text[]) as field_name
      where field_name = 'phone' and (v_profile.phone is null or trim(v_profile.phone) = '')
         or field_name = 'country' and (v_profile.country is null or trim(v_profile.country) = '')
         or field_name = 'city' and (v_profile.city is null or trim(v_profile.city) = '')
         or field_name = 'postal_address' and (v_profile.postal_address is null or trim(v_profile.postal_address) = '')
         or field_name = 'designation' and (v_profile.designation is null or trim(v_profile.designation) = '')
         or field_name = 'department' and (v_profile.department is null or trim(v_profile.department) = '')
         or field_name = 'orcid' and (v_profile.orcid is null or trim(v_profile.orcid) = '')
         or field_name = 'bio' and (v_profile.bio is null or trim(v_profile.bio) = '')
    )
  );
end;
$$;

grant execute on function public.get_profile_completeness(uuid) to authenticated;

-- =========================================================================
-- 5. CREATE SECURITY DEFINER FUNCTION FOR AUTHOR MANUSCRIPT SUMMARY
-- =========================================================================

-- Function to get a comprehensive summary of manuscripts where the user is involved
-- This includes manuscripts where they are submitting author, co-author, or corresponding author
create or replace function public.get_author_manuscript_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submitting_author_manuscripts jsonb;
  v_co_author_manuscripts jsonb;
begin
  -- Get manuscripts where user is submitting author
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'manuscript_id', m.id,
      'title', m.title,
      'status', m.status,
      'article_type', m.article_type,
      'category', m.category,
      'submitted_at', m.submitted_at,
      'updated_at', m.updated_at,
      'role', 'submitting_author',
      'is_corresponding_author', true, -- Submitting author is typically corresponding
      'author_order', 1
    )
  ), '[]'::jsonb) into v_submitting_author_manuscripts
  from public.manuscripts m
  where m.submitting_author_id = p_user_id;

  -- Get manuscripts where user is co-author (from manuscript_authors)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'manuscript_id', manuscript_id,
      'title', title,
      'status', status,
      'article_type', article_type,
      'category', category,
      'submitted_at', submitted_at,
      'updated_at', updated_at,
      'role', role,
      'is_corresponding_author', is_corresponding_author,
      'author_order', author_order
    )
  ), '[]'::jsonb) into v_co_author_manuscripts
  from (
    select distinct
      ma.manuscript_id,
      m.title,
      m.status,
      m.article_type,
      m.category,
      m.submitted_at,
      m.updated_at,
      ma.author_order,
      ma.is_corresponding_author,
      'co_author' as role
    from public.manuscript_authors ma
    join public.manuscripts m on m.id = ma.manuscript_id
    where ma.profile_id = p_user_id
      and ma.invitation_status in ('accepted', 'confirmed')
      and m.submitting_author_id != p_user_id -- Exclude where they're already submitting author
  ) co_author_manuscripts;

  -- Return combined result
  return jsonb_build_object(
    'submitting_author_manuscripts', v_submitting_author_manuscripts,
    'co_author_manuscripts', v_co_author_manuscripts
  );
end;
$$;

grant execute on function public.get_author_manuscript_summary(uuid) to authenticated;

-- =========================================================================
-- 6. CREATE SECURITY DEFINER FUNCTION FOR AUTHOR ACTION ITEMS
-- =========================================================================

-- Function to get action items for an author (revisions, proofs, invitations, etc.)
create or replace function public.get_author_action_items(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- Initialize result structure
  v_result := jsonb_build_object(
    'revision_requests', '[]'::jsonb,
    'proof_reviews', '[]'::jsonb,
    'co_author_invitations', '[]'::jsonb,
    'pending_confirmations', '[]'::jsonb
  );
  
  -- Get pending revision requests where user is submitting author
  with revision_manuscripts as (
    select
      m.id as manuscript_id,
      m.title,
      rr.id as revision_request_id,
      rr.revision_type,
      rr.deadline,
      ed.decision_letter
    from public.manuscripts m
    join public.revision_requests rr on rr.manuscript_id = m.id
    join public.editor_decisions ed on ed.id = rr.editor_decision_id
    where m.submitting_author_id = p_user_id
      and rr.status = 'pending'
  )
  select jsonb_set(
    v_result,
    '{revision_requests}',
    (select coalesce(jsonb_agg(jsonb_build_object(
      'manuscript_id', manuscript_id,
      'title', title,
      'revision_request_id', revision_request_id,
      'revision_type', revision_type,
      'deadline', deadline,
      'decision_letter', decision_letter
    )), '[]'::jsonb) from revision_manuscripts)
  ) into v_result;
  
  -- Get proofs requiring author review
  with proof_manuscripts as (
    select
      m.id as manuscript_id,
      m.title,
      mp.production_status,
      pv.version_number,
      pv.uploaded_at
    from public.manuscripts m
    join public.manuscript_production mp on mp.manuscript_id = m.id
    join public.proof_versions pv on pv.id = mp.current_proof_version_id
    where m.submitting_author_id = p_user_id
      and mp.production_status in ('author_proof', 'proof_corrections', 'final_proof_approval')
  )
  select jsonb_set(
    v_result,
    '{proof_reviews}',
    (select coalesce(jsonb_agg(jsonb_build_object(
      'manuscript_id', manuscript_id,
      'title', title,
      'production_status', production_status,
      'proof_version', version_number,
      'proof_uploaded_at', uploaded_at
    )), '[]'::jsonb) from proof_manuscripts)
  ) into v_result;
  
  -- Get pending co-author invitations
  with invitations as (
    select
      ma.id as author_id,
      ma.manuscript_id,
      m.title,
      ma.invitation_sent_at,
      ma.invitation_expires_at
    from public.manuscript_authors ma
    join public.manuscripts m on m.id = ma.manuscript_id
    where ma.email = (
      select email from public.profiles where id = p_user_id
    )
      and ma.invitation_status = 'invited'
      and ma.invitation_expires_at > now()
  )
  select jsonb_set(
    v_result,
    '{co_author_invitations}',
    (select coalesce(jsonb_agg(jsonb_build_object(
      'author_id', author_id,
      'manuscript_id', manuscript_id,
      'title', title,
      'invitation_sent_at', invitation_sent_at,
      'invitation_expires_at', invitation_expires_at
    )), '[]'::jsonb) from invitations)
  ) into v_result;
  
  -- Get manuscripts where user is co-author but hasn't confirmed participation
  with pending_confirmations as (
    select
      ma.id as author_id,
      ma.manuscript_id,
      m.title,
      ma.invitation_status
    from public.manuscript_authors ma
    join public.manuscripts m on m.id = ma.manuscript_id
    where ma.profile_id = p_user_id
      and ma.invitation_status in ('pending', 'invited')
  )
  select jsonb_set(
    v_result,
    '{pending_confirmations}',
    (select coalesce(jsonb_agg(jsonb_build_object(
      'author_id', author_id,
      'manuscript_id', manuscript_id,
      'title', title,
      'invitation_status', invitation_status
    )), '[]'::jsonb) from pending_confirmations)
  ) into v_result;
  
  return v_result;
end;
$$;

grant execute on function public.get_author_action_items(uuid) to authenticated;

-- =========================================================================
-- 7. COMMENTS ON NEW COLUMNS AND FUNCTIONS
-- =========================================================================

comment on column public.profiles.phone is 'Professional phone number for author contact';
comment on column public.profiles.country is 'Author country of residence or institution';
comment on column public.profiles.city is 'Author city of residence or institution';
comment on column public.profiles.postal_address is 'Full postal address for correspondence';
comment on column public.profiles.designation is 'Professional title or position (e.g., Professor, MD, PhD)';
comment on column public.profiles.department is 'Department or division within institution';
comment on column public.profiles.orcid is 'ORCID iD for author identification (format: 0000-0000-0000-0000)';
comment on column public.profiles.bio is 'Professional biography or research interests';
comment on column public.profiles.website_url is 'Personal or institutional website URL';

comment on function public.get_profile_completeness(uuid) is 'Calculates profile completeness percentage and identifies missing fields for an author';
comment on function public.get_author_manuscript_summary(uuid) is 'Returns comprehensive summary of manuscripts where user is involved as submitting author or co-author';
comment on function public.get_author_action_items(uuid) is 'Returns action items requiring author attention: revision requests, proof reviews, co-author invitations, and pending confirmations';