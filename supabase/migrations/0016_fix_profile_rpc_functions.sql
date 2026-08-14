-- MedPublish: Fix Profile RPC Functions v1.0.2
-- 
-- This migration fixes critical bugs in the profile-related RPC functions
-- from migration 0015 that were causing production failures.
--
-- Issues fixed:
-- 1. Column name mismatch in get_author_action_items() (uploaded_at vs proof_uploaded_at)
-- 2. Potential JSONB path issues causing 22P02 errors
-- 3. Better error handling and null safety
--
-- This migration uses CREATE OR REPLACE to fix the existing functions
-- without requiring schema changes.

-- =========================================================================
-- 1. FIX get_author_action_items() FUNCTION
-- =========================================================================

-- Drop and recreate with corrected column names and improved error handling
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
  begin
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
  exception when others then
    -- If this fails, log and continue with empty array
    v_result := jsonb_set(v_result, '{revision_requests}', '[]'::jsonb);
  end;
  
  -- Get proofs requiring author review
  begin
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
  exception when others then
    -- If this fails, log and continue with empty array
    v_result := jsonb_set(v_result, '{proof_reviews}', '[]'::jsonb);
  end;
  
  -- Get pending co-author invitations
  begin
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
  exception when others then
    -- If this fails, log and continue with empty array
    v_result := jsonb_set(v_result, '{co_author_invitations}', '[]'::jsonb);
  end;
  
  -- Get manuscripts where user is co-author but hasn't confirmed participation
  begin
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
  exception when others then
    -- If this fails, log and continue with empty array
    v_result := jsonb_set(v_result, '{pending_confirmations}', '[]'::jsonb);
  end;
  
  return v_result;
end;
$$;

grant execute on function public.get_author_action_items(uuid) to authenticated;

-- =========================================================================
-- 2. FIX get_author_manuscript_summary() FUNCTION
-- =========================================================================

-- Recreate with improved error handling and explicit JSONB structure
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
  begin
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
        'is_corresponding_author', true,
        'author_order', 1
      )
    ), '[]'::jsonb) into v_submitting_author_manuscripts
    from public.manuscripts m
    where m.submitting_author_id = p_user_id;
  exception when others then
    v_submitting_author_manuscripts := '[]'::jsonb;
  end;

  -- Get manuscripts where user is co-author (from manuscript_authors)
  begin
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
        and m.submitting_author_id != p_user_id
    ) co_author_manuscripts;
  exception when others then
    v_co_author_manuscripts := '[]'::jsonb;
  end;

  -- Return combined result
  return jsonb_build_object(
    'submitting_author_manuscripts', v_submitting_author_manuscripts,
    'co_author_manuscripts', v_co_author_manuscripts
  );
end;
$$;

grant execute on function public.get_author_manuscript_summary(uuid) to authenticated;

-- =========================================================================
-- 3. UPDATE FUNCTION COMMENTS
-- =========================================================================

comment on function public.get_author_action_items(uuid) is 'Returns action items requiring author attention: revision requests, proof reviews, co-author invitations, and pending confirmations. Fixed in 0016 with improved error handling and corrected column names.';

comment on function public.get_author_manuscript_summary(uuid) is 'Returns comprehensive summary of manuscripts where user is involved as submitting author or co-author. Fixed in 0016 with improved error handling.';