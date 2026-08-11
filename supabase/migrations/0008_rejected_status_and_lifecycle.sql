-- MedPublish: Publication Lifecycle Enhancement
--
-- Adds support for rejected status and proper draft lifecycle management
-- This allows editors to reject imported articles while preserving them for audit trail
--
-- This is an ADDITIVE migration on top of 0001-0007 — it does not drop any
-- table, does not delete any existing data, and does not weaken any existing RLS policy.

-- =========================================================================
-- 1. ADD REJECTED STATUS TO PUBLICATION_STATUS CHECK
-- =========================================================================

-- First, we need to drop the existing check constraint to add the new status
-- The constraint might have different names depending on when it was created
do $$
begin
  -- Try to drop the constraint with various possible names
  alter table public.publications drop constraint if exists publications_publication_status_check;
  alter table public.publications drop constraint if exists "publications_publication_status_check";
  alter table public.publications drop constraint if exists "publications_publication_status_check_1";
exception when others then
  -- Ignore if constraint doesn't exist or other error
  null;
end $$;

-- Add the updated check constraint with 'rejected' status and lifecycle statuses
alter table public.publications
add constraint publications_publication_status_check 
  check (publication_status in ('draft', 'under_review', 'approved', 'published', 'rejected'));

-- =========================================================================
-- 2. ADD REJECTED_AT AND REJECTED_BY FIELDS
-- =========================================================================

alter table public.publications
add column if not exists rejected_at timestamptz;

alter table public.publications
add column if not exists rejected_by uuid references auth.users (id) on delete set null;

-- =========================================================================
-- 3. UPDATE RLS POLICIES TO INCLUDE REJECTED STATUS
-- =========================================================================

-- Update the policy to ensure rejected publications are not visible to public
drop policy if exists "Anonymous can read published publications" on public.publications;
create policy "Anonymous can read published publications"
  on public.publications for select
  to anon
  using (publication_status = 'published');

drop policy if exists "Authenticated can read published publications" on public.publications;
create policy "Authenticated can read published publications"
  on public.publications for select
  to authenticated
  using (publication_status = 'published');

-- =========================================================================
-- 4. ADD SECURITY DEFINER FUNCTION FOR REJECTING PUBLICATIONS
-- =========================================================================

create or replace function public.reject_publication(p_publication_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify editor/admin role
  if not public.is_editor_or_admin() then
    raise exception 'Only editors and admins can reject publications';
  end if;
  
  -- Update the publication status to rejected
  update public.publications
  set
    publication_status = 'rejected',
    rejected_at = now(),
    rejected_by = auth.uid(),
    updated_at = now()
  where id = p_publication_id;
  
  -- Log the rejection event
  insert into public.publication_events (
    publication_id,
    event_type,
    actor_id,
    note
  ) values (
    p_publication_id,
    'rejected',
    auth.uid(),
    'Publication rejected'
  );
  
  return true;
end;
$$;

-- =========================================================================
-- 5. ADD SECURITY DEFINER FUNCTION FOR DELETING DRAFT/REJECTED PUBLICATIONS
-- =========================================================================

create or replace function public.delete_draft_publication(p_publication_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify editor/admin role
  if not public.is_editor_or_admin() then
    raise exception 'Only editors and admins can delete draft publications';
  end if;
  
  -- Verify that the publication is a draft or rejected (not published)
  declare
    v_status text;
  begin
    select publication_status into v_status
    from public.publications
    where id = p_publication_id;
    
    if v_status is null then
      raise exception 'Publication not found';
    end if;
    
    if v_status not in ('draft', 'rejected') then
      raise exception 'Only draft or rejected publications can be deleted. Current status: %', v_status;
    end if;
  end;
  
  -- Delete the publication (cascade will handle related records)
  delete from public.publications
  where id = p_publication_id;
  
  return true;
end;
$$;

-- =========================================================================
-- 6. ADD SECURITY DEFINER FUNCTION FOR RESTORING REJECTED PUBLICATIONS
-- =========================================================================

create or replace function public.restore_rejected_publication(p_publication_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify editor/admin role
  if not public.is_editor_or_admin() then
    raise exception 'Only editors and admins can restore rejected publications';
  end if;
  
  -- Verify that the publication is rejected
  declare
    v_status text;
  begin
    select publication_status into v_status
    from public.publications
    where id = p_publication_id;
    
    if v_status is null then
      raise exception 'Publication not found';
    end if;
    
    if v_status != 'rejected' then
      raise exception 'Only rejected publications can be restored. Current status: %', v_status;
    end if;
  end;
  
  -- Restore the publication to draft status
  update public.publications
  set
    publication_status = 'draft',
    rejected_at = null,
    rejected_by = null,
    updated_at = now()
  where id = p_publication_id;
  
  -- Log the restoration event
  insert into public.publication_events (
    publication_id,
    event_type,
    actor_id,
    note
  ) values (
    p_publication_id,
    'restored',
    auth.uid(),
    'Publication restored from rejected to draft'
  );
  
  return true;
end;
$$;

-- =========================================================================
-- 7. UPDATE GET_PUBLICATION_BY_ID FUNCTION TO HANDLE NEW STATUS
-- =========================================================================

create or replace function public.get_publication_by_id(p_publication_id uuid)
returns public.publications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.publications%rowtype;
begin
  -- Editors and admins can see any publication
  if public.is_editor_or_admin() then
    select * into v_result
    from public.publications
    where id = p_publication_id;
    
    return v_result;
  end if;
  
  -- Regular users can only see published publications
  select * into v_result
  from public.publications
  where id = p_publication_id
  and publication_status = 'published';
  
  return v_result;
end;
$$;

-- =========================================================================
-- 8. BACKFILL DEFAULT VALUES FOR EXISTING ROWS
-- =========================================================================

-- Set default values for new columns on existing rows
update public.publications
set 
  rejected_at = null,
  rejected_by = null
where rejected_at is null;