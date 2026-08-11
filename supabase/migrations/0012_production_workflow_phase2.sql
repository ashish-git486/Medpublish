-- MedPublish: Production Workflow (Phase 2 - Typesetting, Author Proof, Corrections, Final Approval)
--
-- Extends the production workflow from "Ready For Typesetting" through the complete
-- scholarly publishing lifecycle: Typesetting → Author Proof → Proof Corrections →
-- Final Proof Approval → Publication Ready.
--
-- This is an ADDITIVE migration on top of 0001-0011 — it does not drop any table,
-- does not delete any existing data, and does not weaken any existing RLS policy.
--
-- Key architectural additions:
-- - Extends manuscript_production.production_status with new workflow stages
-- - Adds proof_versions table for immutable versioned proof files
-- - Adds proof_correction_requests table for author correction workflow
-- - Removes unique constraint from publication_files to support multiple versions
-- - Adds SECURITY DEFINER functions for proof workflow transitions
-- - Adds RLS policies for author access to their proof information
--
-- Run this file's contents in the Supabase SQL Editor (or via `supabase db push`)
-- AFTER 0001-0011 have already been applied. Safe to run once; guards use
-- `if not exists` / `if exists` / `create or replace` throughout so re-running is idempotent.

-- =========================================================================
-- 1. EXTEND MANUSCRIPT_PRODUCTION STATUS VALUES
-- =========================================================================
-- Add new workflow stages while preserving existing data

alter table public.manuscript_production
  drop constraint if exists manuscript_production_production_status_check;

alter table public.manuscript_production
  add constraint manuscript_production_production_status_check
  check (production_status in (
    'accepted',
    'copyediting',
    'metadata_verification',
    'ready_for_typesetting',
    'typesetting',
    'author_proof',
    'proof_corrections',
    'final_proof_approval',
    'publication_ready'
  ));

-- Add timestamp columns for new stages (columns without FK dependencies)
alter table public.manuscript_production
  add column if not exists typesetting_started_at timestamptz,
  add column if not exists typesetting_completed_at timestamptz,
  add column if not exists author_proof_issued_at timestamptz,
  add column if not exists proof_corrections_requested_at timestamptz,
  add column if not exists final_proof_approved_at timestamptz,
  add column if not exists publication_ready_at timestamptz,
  add column if not exists typesetter_id uuid references auth.users (id) on delete set null;

-- Add index for typesetter column
create index if not exists manuscript_production_typesetter_idx
  on public.manuscript_production (typesetter_id);

-- =========================================================================
-- 2. PROOF_VERSIONS
-- =========================================================================
-- Immutable versioned proof files. Each proof version is never modified once created.
-- This preserves the historical record required for scholarly publishing compliance.

create table if not exists public.proof_versions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  version_number integer not null,
  
  -- File metadata
  file_name text not null,
  file_type text not null,
  file_size_bytes bigint not null,
  storage_path text not null,
  file_hash text,
  
  -- Proof metadata
  proof_purpose text not null check (proof_purpose in ('typeset', 'revision')),
  notes text,
  
  -- Audit trail
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  
  -- Ensure one version number per manuscript
  constraint unique_manuscript_version unique (manuscript_id, version_number)
);

alter table public.proof_versions enable row level security;

-- Indexes
create index if not exists proof_versions_manuscript_idx
  on public.proof_versions (manuscript_id);
create index if not exists proof_versions_version_idx
  on public.proof_versions (manuscript_id, version_number);
create index if not exists proof_versions_hash_idx
  on public.proof_versions (file_hash);

-- =========================================================================
-- 3. ADD FK COLUMN TO MANUSCRIPT_PRODUCTION (AFTER proof_versions EXISTS)
-- =========================================================================
-- Now add the foreign key column that references proof_versions

alter table public.manuscript_production
  add column if not exists current_proof_version_id uuid references public.proof_versions(id) on delete set null;

-- Add index for the new FK column
create index if not exists manuscript_production_current_proof_idx
  on public.manuscript_production (current_proof_version_id);

-- =========================================================================
-- 4. PROOF_CORRECTION_REQUESTS
-- =========================================================================
-- Author-submitted correction requests for a specific proof version.
-- Each request tracks the correction lifecycle from submission to resolution.

create table if not exists public.proof_correction_requests (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  proof_version_id uuid not null references public.proof_versions (id) on delete cascade,
  
  -- Correction details
  location_page text,
  location_text text,
  correction_text text not null,
  
  -- Status tracking
  status text not null default 'open'
    check (status in ('open', 'in_review', 'resolved', 'rejected')),
  
  -- Resolution tracking
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  
  -- Audit trail
  submitted_by uuid not null references auth.users (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proof_correction_requests enable row level security;

-- Indexes
create index if not exists proof_corrections_manuscript_idx
  on public.proof_correction_requests (manuscript_id);
create index if not exists proof_corrections_proof_version_idx
  on public.proof_correction_requests (proof_version_id);
create index if not exists proof_corrections_status_idx
  on public.proof_correction_requests (status);
create index if not exists proof_corrections_submitted_by_idx
  on public.proof_correction_requests (submitted_by);

-- Trigger for updated_at
drop trigger if exists trg_proof_corrections_updated_at on public.proof_correction_requests;
create trigger trg_proof_corrections_updated_at
  before update on public.proof_correction_requests
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 5. REMOVE UNIQUE CONSTRAINT FROM PUBLICATION_FILES
-- =========================================================================
-- Allow multiple files per publication to support proof versioning

alter table public.publication_files
  drop constraint if exists unique_publication_file;

-- Add a column to track the purpose/version of each file
alter table public.publication_files
  add column if not exists file_purpose text check (file_purpose in ('import', 'proof', 'final')),
  add column if not exists proof_version_id uuid references public.proof_versions (id) on delete set null;

-- =========================================================================
-- 6. RLS POLICIES FOR PROOF_VERSIONS
-- =========================================================================

-- Editors and admins can read all proof versions
drop policy if exists "Editors and admins can read proof versions" on public.proof_versions;
create policy "Editors and admins can read proof versions"
  on public.proof_versions for select
  to authenticated
  using (public.is_editor_or_admin());

-- Only editors and admins can insert proof versions
drop policy if exists "Editors and admins can insert proof versions" on public.proof_versions;
create policy "Editors and admins can insert proof versions"
  on public.proof_versions for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- Authors can read proof versions for their own manuscripts
drop policy if exists "Authors can read their own proof versions" on public.proof_versions;
create policy "Authors can read their own proof versions"
  on public.proof_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = proof_versions.manuscript_id
      and manuscripts.submitting_author_id = auth.uid()
    )
  );

-- =========================================================================
-- 7. RLS POLICIES FOR PROOF_CORRECTION_REQUESTS
-- =========================================================================

-- Editors and admins can read all correction requests
drop policy if exists "Editors and admins can read correction requests" on public.proof_correction_requests;
create policy "Editors and admins can read correction requests"
  on public.proof_correction_requests for select
  to authenticated
  using (public.is_editor_or_admin());

-- Only editors and admins can update correction requests (resolve/reject)
drop policy if exists "Editors and admins can update correction requests" on public.proof_correction_requests;
create policy "Editors and admins can update correction requests"
  on public.proof_correction_requests for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- Authors can read correction requests for their own manuscripts
drop policy if exists "Authors can read their own correction requests" on public.proof_correction_requests;
create policy "Authors can read their own correction requests"
  on public.proof_correction_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = proof_correction_requests.manuscript_id
      and manuscripts.submitting_author_id = auth.uid()
    )
  );

-- Authors can insert correction requests for their own manuscripts
drop policy if exists "Authors can insert correction requests" on public.proof_correction_requests;
create policy "Authors can insert correction requests"
  on public.proof_correction_requests for insert
  to authenticated
  with check (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = proof_correction_requests.manuscript_id
      and manuscripts.submitting_author_id = auth.uid()
    )
  );

-- =========================================================================
-- 8. UPDATE MANUSCRIPT_PRODUCTION RLS FOR AUTHOR ACCESS
-- =========================================================================

-- Authors can read production records for their own manuscripts (read-only)
drop policy if exists "Authors can read their own production records" on public.manuscript_production;
create policy "Authors can read their own production records"
  on public.manuscript_production for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = manuscript_production.manuscript_id
      and manuscripts.submitting_author_id = auth.uid()
    )
  );

-- =========================================================================
-- 9. FUNCTION: start_typesetting()
-- =========================================================================
-- Transition from ready_for_typesetting to typesetting, assign typesetter

create or replace function public.start_typesetting(
  p_manuscript_id uuid,
  p_typesetter_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may start typesetting';
  end if;

  select production_status into v_current
  from public.manuscript_production
  where manuscript_id = p_manuscript_id;

  if v_current is null then
    raise exception 'No production record exists for this manuscript yet';
  end if;

  if v_current != 'ready_for_typesetting' then
    raise exception 'Can only start typesetting from ready_for_typesetting status (current: %)', v_current;
  end if;

  update public.manuscript_production
  set production_status = 'typesetting',
      typesetter_id = p_typesetter_id,
      typesetting_started_at = now(),
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  insert into public.production_events (manuscript_id, event_type, production_status, actor_id, note)
  values (p_manuscript_id, 'typesetting_started', 'typesetting', auth.uid(), 'Typesetting started');
end;
$$;

grant execute on function public.start_typesetting(uuid, uuid) to authenticated;

-- =========================================================================
-- 10. FUNCTION: upload_proof_version()
-- =========================================================================
-- Upload a new proof version and link it to the production record

create or replace function public.upload_proof_version(
  p_manuscript_id uuid,
  p_file_name text,
  p_file_type text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_file_hash text,
  p_proof_purpose text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version integer;
  v_proof_id uuid;
  v_current_status text;
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may upload proof versions';
  end if;

  select production_status into v_current_status
  from public.manuscript_production
  where manuscript_id = p_manuscript_id;

  if v_current_status is null then
    raise exception 'No production record exists for this manuscript yet';
  end if;

  if v_current_status not in ('typesetting', 'proof_corrections') then
    raise exception 'Can only upload proofs during typesetting or proof_corrections status (current: %)', v_current_status;
  end if;

  -- Get next version number
  select coalesce(max(version_number), 0) + 1 into v_next_version
  from public.proof_versions
  where manuscript_id = p_manuscript_id;

  -- Create proof version
  insert into public.proof_versions (
    manuscript_id, version_number, file_name, file_type, file_size_bytes,
    storage_path, file_hash, proof_purpose, notes, uploaded_by
  )
  values (
    p_manuscript_id, v_next_version, p_file_name, p_file_type, p_file_size_bytes,
    p_storage_path, p_file_hash, p_proof_purpose, p_notes, auth.uid()
  )
  returning id into v_proof_id;

  -- Update production record with current proof
  update public.manuscript_production
  set current_proof_version_id = v_proof_id,
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  insert into public.production_events (manuscript_id, event_type, actor_id, note)
  values (p_manuscript_id, 'proof_created', auth.uid(), 
    format('Proof version %s uploaded as %s', v_next_version, p_proof_purpose));

  return v_proof_id;
end;
$$;

grant execute on function public.upload_proof_version(
  uuid, text, text, bigint, text, text, text, text
) to authenticated;

-- =========================================================================
-- 11. FUNCTION: issue_author_proof()
-- =========================================================================
-- Transition from typesetting to author_proof (requires proof to exist)

create or replace function public.issue_author_proof(p_manuscript_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_current_proof_id uuid;
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may issue author proofs';
  end if;

  select production_status, current_proof_version_id
  into v_current, v_current_proof_id
  from public.manuscript_production
  where manuscript_id = p_manuscript_id;

  if v_current is null then
    raise exception 'No production record exists for this manuscript yet';
  end if;

  if v_current != 'typesetting' then
    raise exception 'Can only issue author proof from typesetting status (current: %)', v_current;
  end if;

  if v_current_proof_id is null then
    raise exception 'Cannot issue author proof: no proof version exists';
  end if;

  update public.manuscript_production
  set production_status = 'author_proof',
      typesetting_completed_at = now(),
      author_proof_issued_at = now(),
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  insert into public.production_events (manuscript_id, event_type, production_status, actor_id)
  values (p_manuscript_id, 'author_proof_issued', 'author_proof', auth.uid());
end;
$$;

grant execute on function public.issue_author_proof(uuid) to authenticated;

-- =========================================================================
-- 12. FUNCTION: submit_proof_corrections()
-- =========================================================================
-- Author submits correction requests, transition to proof_corrections

create or replace function public.submit_proof_corrections(
  p_manuscript_id uuid,
  p_corrections jsonb -- array of {location_page, location_text, correction_text}
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_current_proof_id uuid;
  v_correction record;
  v_correction_id uuid;
begin
  select production_status, current_proof_version_id
  into v_current, v_current_proof_id
  from public.manuscript_production
  where manuscript_id = p_manuscript_id;

  if v_current is null then
    raise exception 'No production record exists for this manuscript yet';
  end if;

  if v_current != 'author_proof' then
    raise exception 'Can only submit corrections during author_proof status (current: %)', v_current;
  end if;

  if v_current_proof_id is null then
    raise exception 'Cannot submit corrections: no current proof version exists';
  end if;

  -- Insert each correction
  for v_correction in select * from jsonb_array_elements(p_corrections)
  loop
    insert into public.proof_correction_requests (
      manuscript_id, proof_version_id, location_page, location_text,
      correction_text, submitted_by
    )
    values (
      p_manuscript_id, v_current_proof_id,
      v_correction.value->>'location_page',
      v_correction.value->>'location_text',
      v_correction.value->>'correction_text',
      auth.uid()
    );
  end loop;

  -- Update production status
  update public.manuscript_production
  set production_status = 'proof_corrections',
      proof_corrections_requested_at = now(),
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  insert into public.production_events (manuscript_id, event_type, production_status, actor_id, note)
  values (p_manuscript_id, 'proof_corrections_requested', 'proof_corrections', auth.uid(), 
    format('Author submitted %s correction requests', jsonb_array_length(p_corrections)));
end;
$$;

grant execute on function public.submit_proof_corrections(uuid, jsonb) to authenticated;

-- =========================================================================
-- 13. FUNCTION: resolve_proof_correction()
-- =========================================================================
-- Production staff resolves a correction request

create or replace function public.resolve_proof_correction(
  p_correction_id uuid,
  p_resolution_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may resolve correction requests';
  end if;

  update public.proof_correction_requests
  set status = 'resolved',
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = p_resolution_note,
      updated_at = now()
  where id = p_correction_id;

  if not found then
    raise exception 'Correction request not found';
  end if;
end;
$$;

grant execute on function public.resolve_proof_correction(uuid, text) to authenticated;

-- =========================================================================
-- 14. FUNCTION: reject_proof_correction()
-- =========================================================================
-- Production staff rejects a correction request

create or replace function public.reject_proof_correction(
  p_correction_id uuid,
  p_resolution_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may reject correction requests';
  end if;

  update public.proof_correction_requests
  set status = 'rejected',
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = p_resolution_note,
      updated_at = now()
  where id = p_correction_id;

  if not found then
    raise exception 'Correction request not found';
  end if;
end;
$$;

grant execute on function public.reject_proof_correction(uuid, text) to authenticated;

-- =========================================================================
-- 15. FUNCTION: approve_final_proof()
-- =========================================================================
-- Author approves the final proof (transition to final_proof_approval)

create or replace function public.approve_final_proof(p_manuscript_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_current_proof_id uuid;
  v_open_corrections integer;
  v_manuscript_author_id uuid;
begin
  select production_status, current_proof_version_id
  into v_current, v_current_proof_id
  from public.manuscript_production
  where manuscript_id = p_manuscript_id;

  if v_current is null then
    raise exception 'No production record exists for this manuscript yet';
  end if;

  if v_current != 'author_proof' then
    raise exception 'Can only approve final proof during author_proof status (current: %)', v_current;
  end if;

  if v_current_proof_id is null then
    raise exception 'Cannot approve proof: no current proof version exists';
  end if;

  -- Check if user is the manuscript author
  select submitting_author_id into v_manuscript_author_id
  from public.manuscripts
  where id = p_manuscript_id;

  if v_manuscript_author_id != auth.uid() then
    raise exception 'Only the manuscript author may approve the final proof';
  end if;

  -- Check for unresolved corrections
  select count(*) into v_open_corrections
  from public.proof_correction_requests
  where manuscript_id = p_manuscript_id
  and status = 'open';

  if v_open_corrections > 0 then
    raise exception 'Cannot approve proof: %s correction requests are still open', v_open_corrections;
  end if;

  update public.manuscript_production
  set production_status = 'final_proof_approval',
      final_proof_approved_at = now(),
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  insert into public.production_events (manuscript_id, event_type, production_status, actor_id, note)
  values (p_manuscript_id, 'final_proof_approved', 'final_proof_approval', auth.uid(), 
    format('Final proof version approved'));
end;
$$;

grant execute on function public.approve_final_proof(uuid) to authenticated;

-- =========================================================================
-- 16. FUNCTION: mark_publication_ready()
-- =========================================================================
-- Transition from final_proof_approval to publication_ready

create or replace function public.mark_publication_ready(p_manuscript_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_metadata_verified boolean;
  v_current_proof_id uuid;
  v_final_proof_approved_at timestamptz;
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may mark publication ready';
  end if;

  select production_status, metadata_verified, current_proof_version_id, final_proof_approved_at
  into v_current, v_metadata_verified, v_current_proof_id, v_final_proof_approved_at
  from public.manuscript_production
  where manuscript_id = p_manuscript_id;

  if v_current is null then
    raise exception 'No production record exists for this manuscript yet';
  end if;

  if v_current != 'final_proof_approval' then
    raise exception 'Can only mark publication ready from final_proof_approval status (current: %)', v_current;
  end if;

  if not coalesce(v_metadata_verified, false) then
    raise exception 'Metadata must be verified before marking publication ready';
  end if;

  if v_current_proof_id is null then
    raise exception 'Cannot mark publication ready: no proof version exists';
  end if;

  if v_final_proof_approved_at is null then
    raise exception 'Cannot mark publication ready: final proof has not been approved';
  end if;

  update public.manuscript_production
  set production_status = 'publication_ready',
      publication_ready_at = now(),
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  insert into public.production_events (manuscript_id, event_type, production_status, actor_id)
  values (p_manuscript_id, 'publication_ready', 'publication_ready', auth.uid());
end;
$$;

grant execute on function public.mark_publication_ready(uuid) to authenticated;

-- =========================================================================
-- 17. FUNCTION: return_to_typesetting()
-- =========================================================================
-- After corrections are resolved, return to typesetting for new proof version

create or replace function public.return_to_typesetting(p_manuscript_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_open_corrections integer;
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may return to typesetting';
  end if;

  select production_status into v_current
  from public.manuscript_production
  where manuscript_id = p_manuscript_id;

  if v_current is null then
    raise exception 'No production record exists for this manuscript yet';
  end if;

  if v_current != 'proof_corrections' then
    raise exception 'Can only return to typesetting from proof_corrections status (current: %)', v_current;
  end if;

  -- Check all corrections are resolved or rejected
  select count(*) into v_open_corrections
  from public.proof_correction_requests
  where manuscript_id = p_manuscript_id
  and status = 'open';

  if v_open_corrections > 0 then
    raise exception 'Cannot return to typesetting: %s correction requests are still open', v_open_corrections;
  end if;

  update public.manuscript_production
  set production_status = 'typesetting',
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  insert into public.production_events (manuscript_id, event_type, production_status, actor_id, note)
  values (p_manuscript_id, 'returned_to_typesetting', 'typesetting', auth.uid(), 
    'Returned to typesetting for revised proof after corrections resolved');
end;
$$;

grant execute on function public.return_to_typesetting(uuid) to authenticated;

-- =========================================================================
-- 18. UPDATE EXISTING advance_production_status() FUNCTION
-- =========================================================================
-- Extend to handle new workflow stages

create or replace function public.advance_production_status(
  p_manuscript_id uuid,
  p_new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_expected_next text;
  v_event_type text;
  v_metadata_verified boolean;
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may advance production status';
  end if;

  select production_status, metadata_verified
  into v_current, v_metadata_verified
  from public.manuscript_production
  where manuscript_id = p_manuscript_id;

  if v_current is null then
    raise exception 'No production record exists for this manuscript yet';
  end if;

  -- Define the complete forward-only sequence
  v_expected_next := case v_current
    when 'accepted' then 'copyediting'
    when 'copyediting' then 'metadata_verification'
    when 'metadata_verification' then 'ready_for_typesetting'
    when 'ready_for_typesetting' then 'typesetting'
    when 'typesetting' then 'author_proof'
    when 'author_proof' then 'final_proof_approval'
    when 'final_proof_approval' then 'publication_ready'
    else null
  end;

  if p_new_status is distinct from v_expected_next then
    raise exception 'Cannot advance production status from "%" to "%" — expected "%"',
      v_current, p_new_status, coalesce(v_expected_next, '(none — already at final stage)');
  end if;

  -- Metadata verification still required for ready_for_typesetting
  if p_new_status = 'ready_for_typesetting' and not coalesce(v_metadata_verified, false) then
    raise exception 'Metadata must be verified before marking Ready For Typesetting';
  end if;

  -- Map status to event type
  v_event_type := case p_new_status
    when 'copyediting' then 'copyediting_started'
    when 'metadata_verification' then 'copyediting_completed'
    when 'ready_for_typesetting' then 'ready_for_typesetting'
    when 'typesetting' then 'typesetting_started'
    when 'author_proof' then 'author_proof_issued'
    when 'final_proof_approval' then 'final_proof_approved'
    when 'publication_ready' then 'publication_ready'
  end;

  -- Update timestamps based on status
  update public.manuscript_production
  set production_status = p_new_status,
      copyediting_completed_at = case when p_new_status = 'metadata_verification' then now() else copyediting_completed_at end,
      ready_for_typesetting_at = case when p_new_status = 'ready_for_typesetting' then now() else ready_for_typesetting_at end,
      typesetting_started_at = case when p_new_status = 'typesetting' then now() else typesetting_started_at end,
      typesetting_completed_at = case when p_new_status = 'author_proof' then now() else typesetting_completed_at end,
      author_proof_issued_at = case when p_new_status = 'author_proof' then now() else author_proof_issued_at end,
      final_proof_approved_at = case when p_new_status = 'final_proof_approval' then now() else final_proof_approved_at end,
      publication_ready_at = case when p_new_status = 'publication_ready' then now() else publication_ready_at end,
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  insert into public.production_events (manuscript_id, event_type, production_status, actor_id)
  values (p_manuscript_id, v_event_type, p_new_status, auth.uid());
end;
$$;

-- =========================================================================
-- 19. HELPER FUNCTION: get_current_proof_version()
-- =========================================================================
-- Get the current proof version for a manuscript (for author viewing)

create or replace function public.get_current_proof_version(p_manuscript_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', pv.id,
    'version_number', pv.version_number,
    'file_name', pv.file_name,
    'file_type', pv.file_type,
    'file_size_bytes', pv.file_size_bytes,
    'storage_path', pv.storage_path,
    'proof_purpose', pv.proof_purpose,
    'notes', pv.notes,
    'uploaded_at', pv.uploaded_at,
    'uploaded_by', pv.uploaded_by
  )
  from public.proof_versions pv
  join public.manuscript_production mp on mp.current_proof_version_id = pv.id
  where mp.manuscript_id = p_manuscript_id;
$$;

grant execute on function public.get_current_proof_version(uuid) to authenticated;

-- =========================================================================
-- 20. HELPER FUNCTION: get_proof_corrections()
-- =========================================================================
-- Get correction requests for a manuscript

create or replace function public.get_proof_corrections(p_manuscript_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(pcr_json), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', pcr.id,
      'proof_version_id', pcr.proof_version_id,
      'location_page', pcr.location_page,
      'location_text', pcr.location_text,
      'correction_text', pcr.correction_text,
      'status', pcr.status,
      'resolved_by', pcr.resolved_by,
      'resolved_at', pcr.resolved_at,
      'resolution_note', pcr.resolution_note,
      'submitted_by', pcr.submitted_by,
      'submitted_at', pcr.submitted_at
    ) as pcr_json
    from public.proof_correction_requests pcr
    where pcr.manuscript_id = p_manuscript_id
    order by pcr.created_at asc
  ) ordered_corrections;
$$;

grant execute on function public.get_proof_corrections(uuid) to authenticated;

-- =========================================================================
-- 21. HELPER FUNCTION: get_proof_history()
-- =========================================================================
-- Get all proof versions for a manuscript

create or replace function public.get_proof_history(p_manuscript_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(pv_json), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', pv.id,
      'version_number', pv.version_number,
      'file_name', pv.file_name,
      'file_type', pv.file_type,
      'file_size_bytes', pv.file_size_bytes,
      'proof_purpose', pv.proof_purpose,
      'notes', pv.notes,
      'uploaded_at', pv.uploaded_at,
      'uploaded_by', pv.uploaded_by
    ) as pv_json
    from public.proof_versions pv
    where pv.manuscript_id = p_manuscript_id
    order by pv.version_number asc
  ) ordered_versions;
$$;

grant execute on function public.get_proof_history(uuid) to authenticated;
