-- MedPublish: Admin Curated Article Import + Publication System
--
-- Adds a publication layer that allows editors/admins to import external
-- scholarly articles (PDF/DOCX) and publish them to the Research Library
-- without going through MedPublish's editorial workflow.
--
-- This is an ADDITIVE migration on top of 0001-0005 — it does not drop any
-- table, does not delete any existing data, and does not weaken any existing
-- RLS policy.
--
-- Key architectural principle: Imported articles are NOT manuscripts. They
-- do not have submission events, peer reviews, editorial decisions, or
-- production history. They represent a separate publication source that
-- converges with manuscript-produced articles at the publication layer.
--
-- Run this file's contents in the Supabase SQL Editor (or via
-- `supabase db push`) AFTER 0001, 0002, 0003, 0004, and 0005 have already
-- been applied. Safe to run once; guards use `if not exists` / `if exists` /
-- `create or replace` throughout so re-running is idempotent.

-- =========================================================================
-- 1. PUBLICATIONS
-- =========================================================================
-- The publication-level record. Can represent either:
-- - An imported article (source_type = 'imported')
-- - A future manuscript-produced article (source_type = 'manuscript')
--
-- This is the bridge between external content and the public Research Library.

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('imported', 'manuscript')),
  manuscript_id uuid references public.manuscripts (id) on delete set null,
  
  -- Core publication metadata
  title text not null,
  abstract text not null,
  authors text not null,
  affiliations text,
  corresponding_author_name text,
  corresponding_author_email text,
  keywords text,
  article_type text not null,
  category text not null,
  
  -- Publication metadata (optional, for future DOI/volume/issue support)
  doi text,
  journal_name text,
  volume text,
  issue text,
  page_range text,
  publication_date date,
  
  -- Status and audit trail
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published')),
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  
  -- Record keeping
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure uniqueness constraints
  constraint unique_doi unique (doi)
);

alter table public.publications enable row level security;

-- Indexes for common queries
create index if not exists publications_status_idx on public.publications (publication_status);
create index if not exists publications_source_type_idx on public.publications (source_type);
create index if not exists publications_manuscript_id_idx on public.publications (manuscript_id);
create index if not exists publications_category_idx on public.publications (category);
create index if not exists publications_created_by_idx on public.publications (created_by);

-- =========================================================================
-- 2. PUBLICATION_FILES
-- =========================================================================
-- Stores metadata for uploaded article files (PDF/DOCX). The actual file
-- content is stored in Supabase Storage; this table tracks the metadata
-- and storage reference.

create table if not exists public.publication_files (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  
  -- File metadata
  file_name text not null,
  file_type text not null, -- 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  file_size_bytes bigint not null,
  storage_path text not null, -- Supabase Storage path
  file_hash text, -- SHA-256 hash for duplicate detection
  
  -- Upload tracking
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  
  -- Ensure one primary file per publication (can be relaxed later for versions)
  constraint unique_publication_file unique (publication_id)
);

alter table public.publication_files enable row level security;

-- Indexes
create index if not exists publication_files_publication_idx on public.publication_files (publication_id);
create index if not exists publication_files_hash_idx on public.publication_files (file_hash);

-- =========================================================================
-- 3. PUBLICATION_EVENTS
-- =========================================================================
-- Append-only audit trail for publication actions, following the same pattern
-- as manuscript_events and production_events.

create table if not exists public.publication_events (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  event_type text not null, -- 'imported', 'metadata_updated', 'file_uploaded', 'published', 'unpublished'
  actor_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.publication_events enable row level security;

create index if not exists publication_events_publication_idx on public.publication_events (publication_id);

-- =========================================================================
-- 4. RLS POLICIES
-- =========================================================================

-- PUBLICATIONS policies

-- Anonymous/public users can only read published publications
drop policy if exists "Anonymous can read published publications" on public.publications;
create policy "Anonymous can read published publications"
  on public.publications for select
  to anon
  using (publication_status = 'published');

-- Authenticated users can read published publications
drop policy if exists "Authenticated can read published publications" on public.publications;
create policy "Authenticated can read published publications"
  on public.publications for select
  to authenticated
  using (publication_status = 'published');

-- Editors and admins can read all publications (including drafts)
drop policy if exists "Editors and admins can read all publications" on public.publications;
create policy "Editors and admins can read all publications"
  on public.publications for select
  to authenticated
  using (public.is_editor_or_admin());

-- Only editors and admins can insert publications (create imports)
drop policy if exists "Editors and admins can insert publications" on public.publications;
create policy "Editors and admins can insert publications"
  on public.publications for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- Only editors and admins can update publications
drop policy if exists "Editors and admins can update publications" on public.publications;
create policy "Editors and admins can update publications"
  on public.publications for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- PUBLICATION_FILES policies

-- Anonymous/public users can read files for published publications only
drop policy if exists "Anonymous can read files for published publications" on public.publication_files;
create policy "Anonymous can read files for published publications"
  on public.publication_files for select
  to anon
  using (
    exists (
      select 1 from public.publications
      where publications.id = publication_files.publication_id
      and publications.publication_status = 'published'
    )
  );

-- Authenticated users can read files for published publications only
drop policy if exists "Authenticated can read files for published publications" on public.publication_files;
create policy "Authenticated can read files for published publications"
  on public.publication_files for select
  to authenticated
  using (
    exists (
      select 1 from public.publications
      where publications.id = publication_files.publication_id
      and publications.publication_status = 'published'
    )
  );

-- Editors and admins can read all publication files
drop policy if exists "Editors and admins can read all publication files" on public.publication_files;
create policy "Editors and admins can read all publication files"
  on public.publication_files for select
  to authenticated
  using (public.is_editor_or_admin());

-- Only editors and admins can insert publication files
drop policy if exists "Editors and admins can insert publication files" on public.publication_files;
create policy "Editors and admins can insert publication files"
  on public.publication_files for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- Only editors and admins can update publication files
drop policy if exists "Editors and admins can update publication files" on public.publication_files;
create policy "Editors and admins can update publication files"
  on public.publication_files for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- PUBLICATION_EVENTS policies

-- Editors and admins can read all publication events
drop policy if exists "Editors and admins can read publication events" on public.publication_events;
create policy "Editors and admins can read publication events"
  on public.publication_events for select
  to authenticated
  using (public.is_editor_or_admin());

-- Only editors and admins can insert publication events
drop policy if exists "Editors and admins can insert publication events" on public.publication_events;
create policy "Editors and admins can insert publication events"
  on public.publication_events for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- =========================================================================
-- 5. TRIGGERS
-- =========================================================================

-- Keep updated_at current for publications and publication_files
drop trigger if exists trg_publications_updated_at on public.publications;
create trigger trg_publications_updated_at
  before update on public.publications
  for each row execute function public.set_updated_at();

drop trigger if exists trg_publication_files_updated_at on public.publication_files;
create trigger trg_publication_files_updated_at
  before update on public.publication_files
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 6. SECURITY DEFINER FUNCTIONS
-- =========================================================================

-- Create a new publication (draft) as an imported article
create or replace function public.create_imported_publication(
  p_title text,
  p_abstract text,
  p_authors text,
  p_affiliations text,
  p_corresponding_author_name text,
  p_corresponding_author_email text,
  p_keywords text,
  p_article_type text,
  p_category text,
  p_doi text default null,
  p_journal_name text default null,
  p_volume text default null,
  p_issue text default null,
  p_page_range text default null,
  p_publication_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publication_id uuid;
begin
  -- Verify editor/admin role
  if not public.is_editor_or_admin() then
    raise exception 'Only editors and admins can create imported publications';
  end if;
  
  -- Insert the publication
  insert into public.publications (
    source_type,
    manuscript_id,
    title,
    abstract,
    authors,
    affiliations,
    corresponding_author_name,
    corresponding_author_email,
    keywords,
    article_type,
    category,
    doi,
    journal_name,
    volume,
    issue,
    page_range,
    publication_date,
    publication_status,
    created_by
  ) values (
    'imported',
    null,
    p_title,
    p_abstract,
    p_authors,
    p_affiliations,
    p_corresponding_author_name,
    p_corresponding_author_email,
    p_keywords,
    p_article_type,
    p_category,
    p_doi,
    p_journal_name,
    p_volume,
    p_issue,
    p_page_range,
    p_publication_date,
    'draft',
    auth.uid()
  ) returning id into v_publication_id;
  
  -- Log the import event
  insert into public.publication_events (
    publication_id,
    event_type,
    actor_id,
    note
  ) values (
    v_publication_id,
    'imported',
    auth.uid(),
    'Article imported from external source'
  );
  
  return v_publication_id;
end;
$$;

-- Update publication metadata
create or replace function public.update_publication_metadata(
  p_publication_id uuid,
  p_title text,
  p_abstract text,
  p_authors text,
  p_affiliations text,
  p_corresponding_author_name text,
  p_corresponding_author_email text,
  p_keywords text,
  p_article_type text,
  p_category text,
  p_doi text default null,
  p_journal_name text default null,
  p_volume text default null,
  p_issue text default null,
  p_page_range text default null,
  p_publication_date date default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify editor/admin role
  if not public.is_editor_or_admin() then
    raise exception 'Only editors and admins can update publication metadata';
  end if;
  
  -- Update the publication
  update public.publications
  set
    title = p_title,
    abstract = p_abstract,
    authors = p_authors,
    affiliations = p_affiliations,
    corresponding_author_name = p_corresponding_author_name,
    corresponding_author_email = p_corresponding_author_email,
    keywords = p_keywords,
    article_type = p_article_type,
    category = p_category,
    doi = p_doi,
    journal_name = p_journal_name,
    volume = p_volume,
    issue = p_issue,
    page_range = p_page_range,
    publication_date = p_publication_date
  where id = p_publication_id;
  
  -- Log the metadata update event
  insert into public.publication_events (
    publication_id,
    event_type,
    actor_id,
    note
  ) values (
    p_publication_id,
    'metadata_updated',
    auth.uid(),
    'Publication metadata updated'
  );
  
  return true;
end;
$$;

-- Upload a publication file (upsert - replaces existing file if present)
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

-- Publish a publication (server-side, requires verification)
create or replace function public.publish_publication(p_publication_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publication record;
begin
  -- Verify editor/admin role
  if not public.is_editor_or_admin() then
    raise exception 'Only editors and admins can publish publications';
  end if;
  
  -- Get the publication and verify it's publishable
  select * into v_publication
  from public.publications
  where id = p_publication_id;
  
  if not found then
    raise exception 'Publication not found';
  end if;
  
  if v_publication.publication_status = 'published' then
    raise exception 'Publication is already published';
  end if;
  
  -- Verify required metadata
  if v_publication.title is null or v_publication.title = '' then
    raise exception 'Publication must have a title';
  end if;
  
  if v_publication.abstract is null or v_publication.abstract = '' then
    raise exception 'Publication must have an abstract';
  end if;
  
  if v_publication.authors is null or v_publication.authors = '' then
    raise exception 'Publication must have authors';
  end if;
  
  -- Verify a file exists
  if not exists (
    select 1 from public.publication_files
    where publication_id = p_publication_id
  ) then
    raise exception 'Publication must have an associated file';
  end if;
  
  -- Update the publication status
  update public.publications
  set
    publication_status = 'published',
    published_at = now(),
    published_by = auth.uid()
  where id = p_publication_id;
  
  -- Log the publish event
  insert into public.publication_events (
    publication_id,
    event_type,
    actor_id,
    note
  ) values (
    p_publication_id,
    'published',
    auth.uid(),
    'Publication published to Research Library'
  );
  
  return true;
end;
$$;

-- Get all published publications for the Research Library
create or replace function public.get_published_publications()
returns setof public.publications
language sql
security definer
set search_path = public
as $$
  select * from public.publications
  where publication_status = 'published'
  order by published_at desc;
$$;

-- Get a single publication by ID (only if published, or for editors/admins)
create or replace function public.get_publication_by_id(p_publication_id uuid)
returns public.publications
language sql
security definer
set search_path = public
as $$
  select * from public.publications
  where id = p_publication_id
  and (
    publication_status = 'published'
    or public.is_editor_or_admin()
  );
$$;

-- Check for duplicate publications (by DOI or file hash)
create or replace function public.check_duplicate_publication(
  p_doi text default null,
  p_file_hash text default null
)
returns table (duplicate_type text, found boolean)
language sql
security definer
set search_path = public
as $$
  select
    'doi' as duplicate_type,
    exists (select 1 from public.publications where doi = p_doi) as found
  where p_doi is not null
  union all
  select
    'file_hash' as duplicate_type,
    exists (
      select 1 from public.publication_files
      where file_hash = p_file_hash
    ) as found
  where p_file_hash is not null;
$$;