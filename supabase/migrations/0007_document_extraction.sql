-- MedPublish: Document Extraction Enhancement
--
-- Adds support for storing extracted text from imported PDF/DOCX files
-- to enable metadata detection, search, and future rendering capabilities.
--
-- This is an ADDITIVE migration on top of 0001-0006 — it does not drop any
-- table, does not delete any existing data, and does not weaken any existing
-- RLS policy.
--
-- Run this file's contents in the Supabase SQL Editor (or via
-- `supabase db push`) AFTER 0001, 0002, 0003, 0004, 0005, and 0006 have
-- already been applied. Safe to run once; guards use `if not exists` / `if exists`
-- throughout so re-running is idempotent.

-- =========================================================================
-- 1. ADD EXTRACTED TEXT FIELD TO PUBLICATIONS
-- =========================================================================
-- This field stores the full text extracted from PDF/DOCX files for:
-- - Scholarly metadata detection (title, authors, abstract, keywords, DOI)
-- - Search indexing
-- - Future text-based rendering features
-- - Reference extraction and analysis

alter table public.publications
add column if not exists extracted_text text;

-- Add an index for text search if needed in the future
-- create index if not exists publications_extracted_text_idx 
--   on public.publications using gin(to_tsvector('english', extracted_text));

-- =========================================================================
-- 2. ADD EXTRACTION STATUS TRACKING
-- =========================================================================
-- Track the status of document extraction to provide feedback to administrators

alter table public.publications
add column if not exists extraction_status text 
  check (extraction_status in ('pending', 'completed', 'failed', 'not_applicable'));

alter table public.publications
add column if not exists extraction_error text;

-- =========================================================================
-- 3. UPDATE RLS POLICIES FOR NEW COLUMNS
-- =========================================================================
-- The new columns inherit the existing RLS policies from the publications table,
-- so no new policies are needed. The existing policies already cover all columns.

-- =========================================================================
-- 4. BACKFILL DEFAULT VALUES FOR EXISTING ROWS
-- =========================================================================
-- Set default values for existing publications that don't have extraction data

update public.publications
set 
  extraction_status = 'not_applicable',
  extracted_text = ''
where extraction_status is null;

-- =========================================================================
-- 5. UPDATE DATABASE FUNCTIONS FOR NEW COLUMNS
-- =========================================================================

-- Update create_imported_publication to accept extracted text
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
  p_publication_date date default null,
  p_extracted_text text default null
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
    created_by,
    extracted_text,
    extraction_status
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
    auth.uid(),
    p_extracted_text,
    case when p_extracted_text is not null and length(p_extracted_text) > 0 then 'completed' else 'pending' end
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

-- Update update_publication_metadata to include extracted text
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
  p_publication_date date default null,
  p_extracted_text text default null
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
    publication_date = p_publication_date,
    extracted_text = coalesce(p_extracted_text, extracted_text),
    extraction_status = case when p_extracted_text is not null and length(p_extracted_text) > 0 then 'completed' else extraction_status end
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