-- MedPublish: Fix File Upload to Support Upsert
--
-- This migration updates the upload_publication_file function to handle
-- the case where a file already exists for a publication (upsert behavior).
-- This is necessary because the publication_files table has a unique constraint
-- on publication_id, and re-uploading a file would otherwise fail.
--
-- This is an ADDITIVE migration that only updates a function.

-- =========================================================================
-- UPDATE UPLOAD_PUBLICATION_FILE FUNCTION TO SUPPORT UPSERT
-- =========================================================================

create or replace function public.upload_publication_file(
  p_publication_id uuid,
  p_file_name text,
  p_file_type text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_file_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file_id uuid;
  v_old_storage_path text;
begin
  -- Verify editor/admin role
  if not public.is_editor_or_admin() then
    raise exception 'Only editors and admins can upload publication files';
  end if;
  
  -- Verify publication exists
  if not exists (select 1 from public.publications where id = p_publication_id) then
    raise exception 'Publication not found';
  end if;
  
  -- Check if a file already exists for this publication
  select storage_path into v_old_storage_path
  from public.publication_files
  where publication_id = p_publication_id;
  
  -- Delete old file record if it exists
  if v_old_storage_path is not null then
    delete from public.publication_files
    where publication_id = p_publication_id;
    
    -- Note: The old storage file should be cleaned up by the application
    -- or a separate cleanup job, as we can't delete from storage in a database function
  end if;
  
  -- Insert the new file record
  insert into public.publication_files (
    publication_id,
    file_name,
    file_type,
    file_size_bytes,
    storage_path,
    file_hash,
    uploaded_by
  ) values (
    p_publication_id,
    p_file_name,
    p_file_type,
    p_file_size_bytes,
    p_storage_path,
    p_file_hash,
    auth.uid()
  ) returning id into v_file_id;
  
  -- Log the file upload event
  insert into public.publication_events (
    publication_id,
    event_type,
    actor_id,
    note
  ) values (
    p_publication_id,
    'file_uploaded',
    auth.uid(),
    'File uploaded: ' || p_file_name
  );
  
  return v_file_id;
end;
$$;