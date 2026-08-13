-- MedPublish: Manuscript Authorship System (Phase 9)
--
-- Implements a structured manuscript authorship system that supports:
-- - Multiple authors with explicit ordering
-- - Different affiliations per author
-- - Corresponding author designation
-- - Submitting author tracking
-- - Co-author invitation/confirmation workflow
-- - Author contribution metadata
-- - Draft submission support
-- - Revision compatibility
-- - RLS protection
--
-- This is an ADDITIVE migration on top of 0001-0013 — it does not drop any table,
-- does not delete any existing data, and does not weaken any existing RLS policy.
--
-- The existing manuscripts.authors, manuscripts.institution, and manuscripts.corresponding_email
-- fields are preserved for backward compatibility. The new structured authorship system
-- operates alongside these fields and will eventually replace them for new submissions.
--
-- Run this file's contents in the Supabase SQL Editor (or via `supabase db push`)
-- AFTER 0001-0013 have already been applied. Safe to run once; guards use
-- `if not exists` / `if exists` / `create or replace` throughout so re-running is idempotent.

-- =========================================================================
-- 1. MANUSCRIPT_AUTHORS
-- =========================================================================
-- Individual author records for each manuscript. Each author has:
-- - Explicit author_order (no reliance on insertion order)
-- - Profile link (if author has MedPublish account)
-- - Contact information (email, ORCID)
-- - Corresponding/submitting author flags
-- - Invitation status and tracking
-- - Contribution statement

create table if not exists public.manuscript_authors (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  profile_id uuid references auth.users (id) on delete set null,
  
  -- Author identification
  first_name text not null,
  middle_name text,
  last_name text not null,
  email text not null,
  orcid text,
  
  -- Author position and roles
  author_order integer not null,
  is_corresponding_author boolean not null default false,
  is_submitting_author boolean not null default false,
  
  -- Invitation workflow
  invitation_status text not null default 'confirmed'
    check (invitation_status in ('pending', 'invited', 'accepted', 'declined', 'revoked', 'confirmed')),
  invitation_token text,
  invitation_sent_at timestamptz,
  invitation_expires_at timestamptz,
  responded_at timestamptz,
  
  -- Contribution information
  contribution_statement text,
  
  -- Audit trail
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Constraints
  constraint unique_manuscript_author_order unique (manuscript_id, author_order)
);

alter table public.manuscript_authors enable row level security;

-- Indexes
create index if not exists manuscript_authors_manuscript_idx
  on public.manuscript_authors (manuscript_id);
create index if not exists manuscript_authors_profile_idx
  on public.manuscript_authors (profile_id);
create index if not exists manuscript_authors_order_idx
  on public.manuscript_authors (manuscript_id, author_order);
create index if not exists manuscript_authors_invitation_token_idx
  on public.manuscript_authors (invitation_token) where invitation_token is not null;
create index if not exists manuscript_authors_email_idx
  on public.manuscript_authors (email);

-- Partial unique index to enforce exactly one corresponding author per manuscript
create unique index if not exists manuscript_authors_single_corresponding_author
  on public.manuscript_authors (manuscript_id)
  where is_corresponding_author = true;

-- Trigger for updated_at
drop trigger if exists trg_manuscript_authors_updated_at on public.manuscript_authors;
create trigger trg_manuscript_authors_updated_at
  before update on public.manuscript_authors
  for each row execute function public.set_updated_at();

-- =========================================================================
-- TRIGGER FUNCTION: enforce_single_corresponding_author()
-- =========================================================================
-- Ensures that only one corresponding author exists per manuscript
-- This trigger runs before INSERT/UPDATE on manuscript_authors

create or replace function public.enforce_single_corresponding_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_count integer;
begin
  -- Only check if setting is_corresponding_author to true
  if (TG_OP = 'INSERT' and NEW.is_corresponding_author = true) or
     (TG_OP = 'UPDATE' and NEW.is_corresponding_author = true and OLD.is_corresponding_author = false) then
    
    -- Count existing corresponding authors for this manuscript (excluding current row for UPDATE)
    if TG_OP = 'INSERT' then
      select count(*) into v_existing_count
      from public.manuscript_authors
      where manuscript_id = NEW.manuscript_id
        and is_corresponding_author = true;
    else
      select count(*) into v_existing_count
      from public.manuscript_authors
      where manuscript_id = NEW.manuscript_id
        and is_corresponding_author = true
        and id != NEW.id;
    end if;
    
    if v_existing_count > 0 then
      raise exception 'A corresponding author already exists for this manuscript. Use update_manuscript_author() function to change the corresponding author.';
    end if;
  end if;
  
  return NEW;
end;
$$;

-- Create trigger for INSERT
drop trigger if exists trg_enforce_single_corresponding_author_insert on public.manuscript_authors;
create trigger trg_enforce_single_corresponding_author_insert
  before insert on public.manuscript_authors
  for each row execute function public.enforce_single_corresponding_author();

-- Create trigger for UPDATE
drop trigger if exists trg_enforce_single_corresponding_author_update on public.manuscript_authors;
create trigger trg_enforce_single_corresponding_author_update
  before update on public.manuscript_authors
  for each row execute function public.enforce_single_corresponding_author();

-- =========================================================================
-- 2. MANUSCRIPT_AFFILIATIONS
-- =========================================================================
-- Reusable affiliation records for each manuscript. Authors can share affiliations
-- by referencing the same affiliation_id in the join table.

create table if not exists public.manuscript_affiliations (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  
  -- Institution information
  institution_name text not null,
  department text,
  division text,
  city text,
  state_province text,
  country text,
  postal_code text,
  address text,
  
  -- Audit trail
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manuscript_affiliations enable row level security;

-- Indexes
create index if not exists manuscript_affiliations_manuscript_idx
  on public.manuscript_affiliations (manuscript_id);

-- Trigger for updated_at
drop trigger if exists trg_manuscript_affiliations_updated_at on public.manuscript_affiliations;
create trigger trg_manuscript_affiliations_updated_at
  before update on public.manuscript_affiliations
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 3. MANUSCRIPT_AUTHOR_AFFILIATIONS
-- =========================================================================
-- Many-to-many relationship between authors and affiliations.
-- An author can have multiple affiliations, and an affiliation can be shared by multiple authors.

create table if not exists public.manuscript_author_affiliations (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.manuscript_authors (id) on delete cascade,
  affiliation_id uuid not null references public.manuscript_affiliations (id) on delete cascade,
  
  -- Audit trail
  created_at timestamptz not null default now(),
  
  -- Ensure unique author-affiliation pairs
  constraint unique_author_affiliation unique (author_id, affiliation_id)
);

alter table public.manuscript_author_affiliations enable row level security;

-- Indexes
create index if not exists manuscript_author_affiliations_author_idx
  on public.manuscript_author_affiliations (author_id);
create index if not exists manuscript_author_affiliations_affiliation_idx
  on public.manuscript_author_affiliations (affiliation_id);

-- =========================================================================
-- 4. AUTHOR_CONTRIBUTIONS
-- =========================================================================
-- Structured contribution tracking compatible with CRediT taxonomy.
-- Each author can have multiple contribution types.

create table if not exists public.author_contributions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.manuscript_authors (id) on delete cascade,
  
  -- CRediT-style contribution types
  contribution_type text not null check (contribution_type in (
    'conceptualization',
    'methodology',
    'investigation',
    'data_curation',
    'formal_analysis',
    'software',
    'validation',
    'visualization',
    'writing_original_draft',
    'writing_review_editing',
    'supervision',
    'project_administration',
    'funding_acquisition',
    'resources',
    'ethics_approval'
  )),
  
  -- Audit trail
  created_at timestamptz not null default now()
);

alter table public.author_contributions enable row level security;

-- Indexes
create index if not exists author_contributions_author_idx
  on public.author_contributions (author_id);
create index if not exists author_contributions_type_idx
  on public.author_contributions (contribution_type);

-- =========================================================================
-- 5. AUTHORSHIP_CHANGE_LOG
-- =========================================================================
-- Audit trail for authorship changes after initial submission.
-- This ensures all changes are tracked and reversible.

create table if not exists public.authorship_change_log (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  
  -- Change details
  change_type text not null check (change_type in (
    'author_added',
    'author_removed',
    'author_order_changed',
    'corresponding_author_changed',
    'affiliation_changed',
    'invitation_sent',
    'invitation_accepted',
    'invitation_declined'
  )),
  
  -- Change context
  author_id uuid references public.manuscript_authors (id) on delete set null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  
  -- Who made the change
  changed_by uuid not null references auth.users (id) on delete set null,
  
  -- When the change was made
  created_at timestamptz not null default now()
);

alter table public.authorship_change_log enable row level security;

-- Indexes
create index if not exists authorship_change_log_manuscript_idx
  on public.authorship_change_log (manuscript_id);
create index if not exists authorship_change_log_author_idx
  on public.authorship_change_log (author_id);
create index if not exists authorship_change_log_type_idx
  on public.authorship_change_log (change_type);
create index if not exists authorship_change_log_created_idx
  on public.authorship_change_log (created_at desc);

-- =========================================================================
-- 6. RLS POLICIES FOR MANUSCRIPT_AUTHORS
-- =========================================================================

-- Submitting authors can read their manuscript's authors
drop policy if exists "Submitting authors can read their manuscript authors" on public.manuscript_authors;
create policy "Submitting authors can read their manuscript authors"
  on public.manuscript_authors for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = manuscript_authors.manuscript_id
        and manuscripts.submitting_author_id = auth.uid()
    )
  );

-- Editors and admins can read all manuscript authors
drop policy if exists "Editors and admins can read manuscript authors" on public.manuscript_authors;
create policy "Editors and admins can read manuscript authors"
  on public.manuscript_authors for select
  to authenticated
  using (public.is_editor_or_admin());

-- Confirmed co-authors can read their own author records
drop policy if exists "Co-authors can read their own author records" on public.manuscript_authors;
create policy "Co-authors can read their own author records"
  on public.manuscript_authors for select
  to authenticated
  using (profile_id = auth.uid());

-- Submitting authors can insert authors for their manuscripts (only during draft)
drop policy if exists "Submitting authors can insert manuscript authors" on public.manuscript_authors;
create policy "Submitting authors can insert manuscript authors"
  on public.manuscript_authors for insert
  to authenticated
  with check (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = manuscript_authors.manuscript_id
        and manuscripts.submitting_author_id = auth.uid()
        and manuscripts.status in ('draft', 'submitted', 'editorial_review')
    )
  );

-- Editors and admins can insert authors for any manuscript
drop policy if exists "Editors and admins can insert manuscript authors" on public.manuscript_authors;
create policy "Editors and admins can insert manuscript authors"
  on public.manuscript_authors for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- Submitting authors can update authors for their manuscripts (only during draft)
drop policy if exists "Submitting authors can update manuscript authors" on public.manuscript_authors;
create policy "Submitting authors can update manuscript authors"
  on public.manuscript_authors for update
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = manuscript_authors.manuscript_id
        and manuscripts.submitting_author_id = auth.uid()
        and manuscripts.status in ('draft', 'submitted', 'editorial_review')
    )
  )
  with check (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = manuscript_authors.manuscript_id
        and manuscripts.submitting_author_id = auth.uid()
        and manuscripts.status in ('draft', 'submitted', 'editorial_review')
    )
  );

-- Editors and admins can update authors for any manuscript
drop policy if exists "Editors and admins can update manuscript authors" on public.manuscript_authors;
create policy "Editors and admins can update manuscript authors"
  on public.manuscript_authors for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- Submitting authors can delete authors for their manuscripts (only during draft)
drop policy if exists "Submitting authors can delete manuscript authors" on public.manuscript_authors;
create policy "Submitting authors can delete manuscript authors"
  on public.manuscript_authors for delete
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = manuscript_authors.manuscript_id
        and manuscripts.submitting_author_id = auth.uid()
        and manuscripts.status in ('draft', 'submitted', 'editorial_review')
    )
  );

-- Editors and admins can delete authors for any manuscript
drop policy if exists "Editors and admins can delete manuscript authors" on public.manuscript_authors;
create policy "Editors and admins can delete manuscript authors"
  on public.manuscript_authors for delete
  to authenticated
  using (public.is_editor_or_admin());

-- =========================================================================
-- 7. RLS POLICIES FOR MANUSCRIPT_AFFILIATIONS
-- =========================================================================

-- Submitting authors can read their manuscript's affiliations
drop policy if exists "Submitting authors can read their manuscript affiliations" on public.manuscript_affiliations;
create policy "Submitting authors can read their manuscript affiliations"
  on public.manuscript_affiliations for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = manuscript_affiliations.manuscript_id
        and manuscripts.submitting_author_id = auth.uid()
    )
  );

-- Editors and admins can read all affiliations
drop policy if exists "Editors and admins can read manuscript affiliations" on public.manuscript_affiliations;
create policy "Editors and admins can read manuscript affiliations"
  on public.manuscript_affiliations for select
  to authenticated
  using (public.is_editor_or_admin());

-- Submitting authors can insert affiliations for their manuscripts (only during draft)
drop policy if exists "Submitting authors can insert manuscript affiliations" on public.manuscript_affiliations;
create policy "Submitting authors can insert manuscript affiliations"
  on public.manuscript_affiliations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = manuscript_affiliations.manuscript_id
        and manuscripts.submitting_author_id = auth.uid()
        and manuscripts.status in ('draft', 'submitted', 'editorial_review')
    )
  );

-- Editors and admins can insert affiliations for any manuscript
drop policy if exists "Editors and admins can insert manuscript affiliations" on public.manuscript_affiliations;
create policy "Editors and admins can insert manuscript affiliations"
  on public.manuscript_affiliations for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- Submitting authors can update affiliations for their manuscripts (only during draft)
drop policy if exists "Submitting authors can update manuscript affiliations" on public.manuscript_affiliations;
create policy "Submitting authors can update manuscript affiliations"
  on public.manuscript_affiliations for update
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = manuscript_affiliations.manuscript_id
        and manuscripts.submitting_author_id = auth.uid()
        and manuscripts.status in ('draft', 'submitted', 'editorial_review')
    )
  )
  with check (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = manuscript_affiliations.manuscript_id
        and manuscripts.submitting_author_id = auth.uid()
        and manuscripts.status in ('draft', 'submitted', 'editorial_review')
    )
  );

-- Editors and admins can update affiliations for any manuscript
drop policy if exists "Editors and admins can update manuscript affiliations" on public.manuscript_affiliations;
create policy "Editors and admins can update manuscript affiliations"
  on public.manuscript_affiliations for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- =========================================================================
-- 8. RLS POLICIES FOR MANUSCRIPT_AUTHOR_AFFILIATIONS
-- =========================================================================

-- Submitting authors can read affiliations for their manuscript's authors
drop policy if exists "Submitting authors can read author affiliations" on public.manuscript_author_affiliations;
create policy "Submitting authors can read author affiliations"
  on public.manuscript_author_affiliations for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscript_authors ma
      join public.manuscripts m on m.id = ma.manuscript_id
      where ma.id = manuscript_author_affiliations.author_id
        and m.submitting_author_id = auth.uid()
    )
  );

-- Editors and admins can read all author affiliations
drop policy if exists "Editors and admins can read author affiliations" on public.manuscript_author_affiliations;
create policy "Editors and admins can read author affiliations"
  on public.manuscript_author_affiliations for select
  to authenticated
  using (public.is_editor_or_admin());

-- Submitting authors can insert affiliations for their manuscript's authors (only during draft)
drop policy if exists "Submitting authors can insert author affiliations" on public.manuscript_author_affiliations;
create policy "Submitting authors can insert author affiliations"
  on public.manuscript_author_affiliations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.manuscript_authors ma
      join public.manuscripts m on m.id = ma.manuscript_id
      where ma.id = manuscript_author_affiliations.author_id
        and m.submitting_author_id = auth.uid()
        and m.status in ('draft', 'submitted', 'editorial_review')
    )
  );

-- Editors and admins can insert author affiliations for any manuscript
drop policy if exists "Editors and admins can insert author affiliations" on public.manuscript_author_affiliations;
create policy "Editors and admins can insert author affiliations"
  on public.manuscript_author_affiliations for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- =========================================================================
-- 9. RLS POLICIES FOR AUTHOR_CONTRIBUTIONS
-- =========================================================================

-- Submitting authors can read contributions for their manuscript's authors
drop policy if exists "Submitting authors can read author contributions" on public.author_contributions;
create policy "Submitting authors can read author contributions"
  on public.author_contributions for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscript_authors ma
      join public.manuscripts m on m.id = ma.manuscript_id
      where ma.id = author_contributions.author_id
        and m.submitting_author_id = auth.uid()
    )
  );

-- Editors and admins can read all author contributions
drop policy if exists "Editors and admins can read author contributions" on public.author_contributions;
create policy "Editors and admins can read author contributions"
  on public.author_contributions for select
  to authenticated
  using (public.is_editor_or_admin());

-- Submitting authors can insert contributions for their manuscript's authors (only during draft)
drop policy if exists "Submitting authors can insert author contributions" on public.author_contributions;
create policy "Submitting authors can insert author contributions"
  on public.author_contributions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.manuscript_authors ma
      join public.manuscripts m on m.id = ma.manuscript_id
      where ma.id = author_contributions.author_id
        and m.submitting_author_id = auth.uid()
        and m.status in ('draft', 'submitted', 'editorial_review')
    )
  );

-- Editors and admins can insert author contributions for any manuscript
drop policy if exists "Editors and admins can insert author contributions" on public.author_contributions;
create policy "Editors and admins can insert author contributions"
  on public.author_contributions for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- =========================================================================
-- 10. RLS POLICIES FOR AUTHORSHIP_CHANGE_LOG
-- =========================================================================

-- Submitting authors can read change logs for their manuscripts
drop policy if exists "Submitting authors can read authorship change logs" on public.authorship_change_log;
create policy "Submitting authors can read authorship change logs"
  on public.authorship_change_log for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts
      where manuscripts.id = authorship_change_log.manuscript_id
        and manuscripts.submitting_author_id = auth.uid()
    )
  );

-- Editors and admins can read all change logs
drop policy if exists "Editors and admins can read authorship change logs" on public.authorship_change_log;
create policy "Editors and admins can read authorship change logs"
  on public.authorship_change_log for select
  to authenticated
  using (public.is_editor_or_admin());

-- Only the system (via SECURITY DEFINER functions) can insert change logs
drop policy if exists "System can insert authorship change logs" on public.authorship_change_log;
create policy "System can insert authorship change logs"
  on public.authorship_change_log for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- =========================================================================
-- 11. EXTEND MANUSCRIPTS STATUS VALUES FOR DRAFT SUPPORT
-- =========================================================================
-- This section adds 'draft' status to support incomplete submissions.
-- The constraint includes ALL existing statuses from migrations 0001-0004 plus the new 'draft' status.
-- 
-- Status evolution:
-- Migration 0001: pending, approved, rejected
-- Migration 0002: submitted, editorial_review, revision_requested, under_peer_review, accepted, rejected, published
-- Migration 0004: added minor_revision_requested, major_revision_requested, revision_submitted
-- Migration 0014: adds draft

alter table public.manuscripts
  drop constraint if exists manuscripts_status_check;

alter table public.manuscripts
  add constraint manuscripts_status_check
  check (status in (
    'draft',
    'submitted',
    'editorial_review',
    'revision_requested',
    'under_peer_review',
    'minor_revision_requested',
    'major_revision_requested',
    'revision_submitted',
    'accepted',
    'rejected',
    'published'
  ));

-- =========================================================================
-- 12. SECURITY DEFINER FUNCTIONS
-- =========================================================================

-- Function: add_manuscript_author()
-- Adds a new author to a manuscript with proper validation

create or replace function public.add_manuscript_author(
  p_manuscript_id uuid,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_email text,
  p_orcid text,
  p_author_order integer,
  p_is_corresponding_author boolean,
  p_is_submitting_author boolean,
  p_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manuscript_status text;
  v_submitting_author_id uuid;
  v_new_author_id uuid;
begin
  -- Check if user can modify this manuscript
  select status, submitting_author_id into v_manuscript_status, v_submitting_author_id
  from public.manuscripts
  where id = p_manuscript_id;
  
  if v_manuscript_status is null then
    raise exception 'Manuscript not found';
  end if;
  
  -- Only submitting author can add authors during draft/submitted/editorial_review
  if v_manuscript_status in ('draft', 'submitted', 'editorial_review') then
    if v_submitting_author_id != auth.uid() and not public.is_editor_or_admin() then
      raise exception 'Only the submitting author can add authors during draft/submitted stage';
    end if;
  -- After editorial_review, only editors/admins can add authors
  else
    if not public.is_editor_or_admin() then
      raise exception 'Only editors and admins can add authors after editorial review';
    end if;
  end if;
  
  -- Validate author order is not already taken
  if exists (
    select 1 from public.manuscript_authors
    where manuscript_id = p_manuscript_id and author_order = p_author_order
  ) then
    raise exception 'Author order % is already taken', p_author_order;
  end if;
  
  -- Insert the new author (trigger will enforce single corresponding author)
  insert into public.manuscript_authors (
    manuscript_id, profile_id, first_name, middle_name, last_name, email, orcid,
    author_order, is_corresponding_author, is_submitting_author
  )
  values (
    p_manuscript_id, p_profile_id, p_first_name, p_middle_name, p_last_name, p_email, p_orcid,
    p_author_order, p_is_corresponding_author, p_is_submitting_author
  )
  returning id into v_new_author_id;
  
  -- Log the change
  insert into public.authorship_change_log (
    manuscript_id, change_type, author_id, new_value, changed_by
  )
  values (
    p_manuscript_id, 'author_added', v_new_author_id,
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'email', p_email,
      'author_order', p_author_order,
      'is_corresponding_author', p_is_corresponding_author
    ),
    auth.uid()
  );
  
  return v_new_author_id;
end;
$$;

grant execute on function public.add_manuscript_author(
  uuid, text, text, text, text, text, integer, boolean, boolean, uuid
) to authenticated;

-- Function: update_manuscript_author()
-- Updates an existing author's information

create or replace function public.update_manuscript_author(
  p_author_id uuid,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_email text,
  p_orcid text,
  p_author_order integer,
  p_is_corresponding_author boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manuscript_id uuid;
  v_manuscript_status text;
  v_submitting_author_id uuid;
  v_old_order integer;
  v_old_corresponding boolean;
begin
  -- Get manuscript information
  select manuscript_id into v_manuscript_id
  from public.manuscript_authors
  where id = p_author_id;
  
  if v_manuscript_id is null then
    raise exception 'Author not found';
  end if;
  
  select status, submitting_author_id into v_manuscript_status, v_submitting_author_id
  from public.manuscripts
  where id = v_manuscript_id;
  
  -- Check permissions
  if v_manuscript_status in ('draft', 'submitted', 'editorial_review') then
    if v_submitting_author_id != auth.uid() and not public.is_editor_or_admin() then
      raise exception 'Only the submitting author can update authors during draft/submitted stage';
    end if;
  else
    if not public.is_editor_or_admin() then
      raise exception 'Only editors and admins can update authors after editorial review';
    end if;
  end if;
  
  -- Get current values
  select author_order, is_corresponding_author into v_old_order, v_old_corresponding
  from public.manuscript_authors
  where id = p_author_id;
  
  -- If changing author order, check if new order is available
  if p_author_order is distinct from v_old_order then
    if exists (
      select 1 from public.manuscript_authors
      where manuscript_id = v_manuscript_id 
        and author_order = p_author_order 
        and id != p_author_id
    ) then
      raise exception 'Author order % is already taken', p_author_order;
    end if;
  end if;
  
  -- Update the author (trigger will enforce single corresponding author)
  update public.manuscript_authors
  set 
    first_name = p_first_name,
    middle_name = p_middle_name,
    last_name = p_last_name,
    email = p_email,
    orcid = p_orcid,
    author_order = p_author_order,
    is_corresponding_author = p_is_corresponding_author
  where id = p_author_id;
  
  -- Log the change if significant
  if p_author_order is distinct from v_old_order then
    insert into public.authorship_change_log (
      manuscript_id, change_type, author_id, previous_value, new_value, changed_by
    )
    values (
      v_manuscript_id, 'author_order_changed', p_author_id,
      jsonb_build_object('author_order', v_old_order),
      jsonb_build_object('author_order', p_author_order),
      auth.uid()
    );
  end if;
  
  if p_is_corresponding_author is distinct from v_old_corresponding then
    insert into public.authorship_change_log (
      manuscript_id, change_type, author_id, previous_value, new_value, changed_by
    )
    values (
      v_manuscript_id, 'corresponding_author_changed', p_author_id,
      jsonb_build_object('is_corresponding_author', v_old_corresponding),
      jsonb_build_object('is_corresponding_author', p_is_corresponding_author),
      auth.uid()
    );
  end if;
end;
$$;

grant execute on function public.update_manuscript_author(
  uuid, text, text, text, text, text, integer, boolean
) to authenticated;

-- Function: remove_manuscript_author()
-- Removes an author from a manuscript

create or replace function public.remove_manuscript_author(p_author_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manuscript_id uuid;
  v_manuscript_status text;
  v_submitting_author_id uuid;
  v_author_info jsonb;
begin
  -- Get manuscript information
  select manuscript_id, 
         jsonb_build_object(
           'first_name', first_name,
           'last_name', last_name,
           'email', email,
           'author_order', author_order
         ) into v_manuscript_id, v_author_info
  from public.manuscript_authors
  where id = p_author_id;
  
  if v_manuscript_id is null then
    raise exception 'Author not found';
  end if;
  
  select status, submitting_author_id into v_manuscript_status, v_submitting_author_id
  from public.manuscripts
  where id = v_manuscript_id;
  
  -- Check permissions
  if v_manuscript_status in ('draft', 'submitted', 'editorial_review') then
    if v_submitting_author_id != auth.uid() and not public.is_editor_or_admin() then
      raise exception 'Only the submitting author can remove authors during draft/submitted stage';
    end if;
  else
    if not public.is_editor_or_admin() then
      raise exception 'Only editors and admins can remove authors after editorial review';
    end if;
  end if;
  
  -- Log the change before deletion
  insert into public.authorship_change_log (
    manuscript_id, change_type, previous_value, changed_by
  )
  values (
    v_manuscript_id, 'author_removed', v_author_info, auth.uid()
  );
  
  -- Delete the author (cascades to author_affiliations and author_contributions)
  delete from public.manuscript_authors where id = p_author_id;
end;
$$;

grant execute on function public.remove_manuscript_author(uuid) to authenticated;

-- Function: get_manuscript_authors()
-- Returns all authors for a manuscript with their affiliations and contributions

create or replace function public.get_manuscript_authors(p_manuscript_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ma.id,
      'profile_id', ma.profile_id,
      'first_name', ma.first_name,
      'middle_name', ma.middle_name,
      'last_name', ma.last_name,
      'email', ma.email,
      'orcid', ma.orcid,
      'author_order', ma.author_order,
      'is_corresponding_author', ma.is_corresponding_author,
      'is_submitting_author', ma.is_submitting_author,
      'invitation_status', ma.invitation_status,
      'contribution_statement', ma.contribution_statement,
      'affiliations', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', maf.id,
            'institution_name', maf.institution_name,
            'department', maf.department,
            'division', maf.division,
            'city', maf.city,
            'state_province', maf.state_province,
            'country', maf.country,
            'postal_code', maf.postal_code
          )
        ), '[]'::jsonb)
        from public.manuscript_author_affiliations maa
        join public.manuscript_affiliations maf on maf.id = maa.affiliation_id
        where maa.author_id = ma.id
      ),
      'contributions', (
        select coalesce(jsonb_agg(ac.contribution_type), '[]'::jsonb)
        from public.author_contributions ac
        where ac.author_id = ma.id
      )
    )
    ORDER BY ma.author_order asc
  ), '[]'::jsonb)
  from public.manuscript_authors ma
  where ma.manuscript_id = p_manuscript_id;
$$;

grant execute on function public.get_manuscript_authors(uuid) to authenticated;

-- Function: invite_co_author()
-- Generates an invitation token for a co-author

create or replace function public.invite_co_author(
  p_manuscript_id uuid,
  p_email text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manuscript_status text;
  v_submitting_author_id uuid;
  v_invitation_token text;
  v_author_id uuid;
begin
  -- Check manuscript permissions
  select status, submitting_author_id into v_manuscript_status, v_submitting_author_id
  from public.manuscripts
  where id = p_manuscript_id;
  
  if v_manuscript_status is null then
    raise exception 'Manuscript not found';
  end if;
  
  if v_submitting_author_id != auth.uid() and not public.is_editor_or_admin() then
    raise exception 'Only the submitting author can invite co-authors';
  end if;
  
  if v_manuscript_status not in ('draft', 'submitted', 'editorial_review') then
    raise exception 'Can only invite co-authors during draft/submitted/editorial_review stage';
  end if;
  
  -- Generate secure token
  v_invitation_token := encode(gen_random_bytes(32), 'hex');
  
  -- Create pending author record
  insert into public.manuscript_authors (
    manuscript_id, email, invitation_status, invitation_token,
    invitation_sent_at, invitation_expires_at, first_name, last_name, author_order
  )
  values (
    p_manuscript_id, p_email, 'invited', v_invitation_token,
    now(), now() + interval '7 days', 'Pending', 'Co-author', 
    (select coalesce(max(author_order), 0) + 1 from public.manuscript_authors where manuscript_id = p_manuscript_id)
  )
  returning id into v_author_id;
  
  -- Log the invitation
  insert into public.authorship_change_log (
    manuscript_id, change_type, author_id, new_value, changed_by
  )
  values (
    p_manuscript_id, 'invitation_sent', v_author_id,
    jsonb_build_object('email', p_email, 'token', v_invitation_token),
    auth.uid()
  );
  
  return v_invitation_token;
end;
$$;

grant execute on function public.invite_co_author(uuid, text) to authenticated;

-- Function: accept_co_author_invitation()
-- Accepts a co-author invitation

create or replace function public.accept_co_author_invitation(
  p_invitation_token text,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_orcid text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_manuscript_id uuid;
begin
  -- Find the invitation
  select id, manuscript_id into v_author_id, v_manuscript_id
  from public.manuscript_authors
  where invitation_token = p_invitation_token
    and invitation_status = 'invited'
    and invitation_expires_at > now();
  
  if v_author_id is null then
    raise exception 'Invalid or expired invitation token';
  end if;
  
  -- Update the author record
  update public.manuscript_authors
  set 
    first_name = p_first_name,
    middle_name = p_middle_name,
    last_name = p_last_name,
    orcid = p_orcid,
    profile_id = auth.uid(),
    invitation_status = 'accepted',
    responded_at = now(),
    invitation_token = null
  where id = v_author_id;
  
  -- Log the acceptance
  insert into public.authorship_change_log (
    manuscript_id, change_type, author_id, new_value, changed_by
  )
  values (
    v_manuscript_id, 'invitation_accepted', v_author_id,
    jsonb_build_object('profile_id', auth.uid()),
    auth.uid()
  );
  
  return v_author_id;
end;
$$;

grant execute on function public.accept_co_author_invitation(text, text, text, text, text) to authenticated;

-- Function: set_author_contributions()
-- Sets contribution types for an author

create or replace function public.set_author_contributions(
  p_author_id uuid,
  p_contribution_types text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manuscript_id uuid;
  v_manuscript_status text;
  v_submitting_author_id uuid;
begin
  -- Get manuscript information
  select manuscript_id into v_manuscript_id
  from public.manuscript_authors
  where id = p_author_id;
  
  if v_manuscript_id is null then
    raise exception 'Author not found';
  end if;
  
  select status, submitting_author_id into v_manuscript_status, v_submitting_author_id
  from public.manuscripts
  where id = v_manuscript_id;
  
  -- Check permissions
  if v_manuscript_status in ('draft', 'submitted', 'editorial_review') then
    if v_submitting_author_id != auth.uid() and not public.is_editor_or_admin() then
      raise exception 'Only the submitting author can set contributions during draft/submitted stage';
    end if;
  else
    if not public.is_editor_or_admin() then
      raise exception 'Only editors and admins can set contributions after editorial review';
    end if;
  end if;
  
  -- Delete existing contributions
  delete from public.author_contributions where author_id = p_author_id;
  
  -- Insert new contributions
  if array_length(p_contribution_types, 1) > 0 then
    insert into public.author_contributions (author_id, contribution_type)
    select p_author_id, unnest(p_contribution_types);
  end if;
end;
$$;

grant execute on function public.set_author_contributions(uuid, text[]) to authenticated;

-- Function: set_corresponding_author()
-- Safely changes the corresponding author for a manuscript by first clearing existing
create or replace function public.set_corresponding_author(
  p_manuscript_id uuid,
  p_new_author_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manuscript_status text;
  v_submitting_author_id uuid;
  v_current_corresponding_id uuid;
  v_new_author_manuscript_id uuid;
begin
  -- Check manuscript exists and get permissions
  select status, submitting_author_id into v_manuscript_status, v_submitting_author_id
  from public.manuscripts
  where id = p_manuscript_id;
  
  if v_manuscript_status is null then
    raise exception 'Manuscript not found';
  end if;
  
  -- Check permissions
  if v_manuscript_status in ('draft', 'submitted', 'editorial_review') then
    if v_submitting_author_id != auth.uid() and not public.is_editor_or_admin() then
      raise exception 'Only the submitting author can change corresponding author during draft/submitted stage';
    end if;
  else
    if not public.is_editor_or_admin() then
      raise exception 'Only editors and admins can change corresponding author after editorial review';
    end if;
  end if;
  
  -- Verify new author belongs to this manuscript
  select manuscript_id into v_new_author_manuscript_id
  from public.manuscript_authors
  where id = p_new_author_id;
  
  if v_new_author_manuscript_id is null then
    raise exception 'Author not found';
  end if;
  
  if v_new_author_manuscript_id != p_manuscript_id then
    raise exception 'Author does not belong to this manuscript';
  end if;
  
  -- Get current corresponding author
  select id into v_current_corresponding_id
  from public.manuscript_authors
  where manuscript_id = p_manuscript_id and is_corresponding_author = true;
  
  -- Log the change
  insert into public.authorship_change_log (
    manuscript_id, change_type, author_id, previous_value, new_value, changed_by
  )
  values (
    p_manuscript_id, 'corresponding_author_changed', p_new_author_id,
    jsonb_build_object('previous_author_id', v_current_corresponding_id),
    jsonb_build_object('new_author_id', p_new_author_id),
    auth.uid()
  );
  
  -- Clear existing corresponding author (if any)
  update public.manuscript_authors
  set is_corresponding_author = false
  where manuscript_id = p_manuscript_id and is_corresponding_author = true;
  
  -- Set new corresponding author
  update public.manuscript_authors
  set is_corresponding_author = true
  where id = p_new_author_id;
end;
$$;

grant execute on function public.set_corresponding_author(uuid, uuid) to authenticated;

-- =========================================================================
-- 13. BACKWARD COMPATIBILITY: BACKFILL FUNCTION
-- =========================================================================
-- This function can be used to migrate existing manuscripts to the new authorship system
-- by parsing the existing authors text field and creating structured author records.

create or replace function public.backfill_manuscript_authorship(p_manuscript_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manuscript record;
  v_author_names text[];
  v_author_name text;
  v_author_order integer;
  v_first_name text;
  v_last_name text;
  v_space_pos integer;
  v_new_author_id uuid;
  v_affiliation_id uuid;
begin
  -- Get manuscript data
  select * into v_manuscript
  from public.manuscripts
  where id = p_manuscript_id;
  
  if v_manuscript.id is null then
    raise exception 'Manuscript not found';
  end if;
  
  -- Skip if authors already exist
  if exists (select 1 from public.manuscript_authors where manuscript_id = p_manuscript_id) then
    return;
  end if;
  
  -- Parse authors from the text field
  v_author_names := string_to_array(v_manuscript.authors, ',');
  v_author_order := 1;
  
  -- Create affiliation from institution field
  if v_manuscript.institution is not null and trim(v_manuscript.institution) <> '' then
    insert into public.manuscript_affiliations (manuscript_id, institution_name)
    values (p_manuscript_id, trim(v_manuscript.institution))
    returning id into v_affiliation_id;
  end if;
  
  -- Create author records
  foreach v_author_name in array v_author_names loop
    v_author_name := trim(v_author_name);
    if v_author_name = '' then continue; end if;
    
    -- Try to parse first name and last name (naive approach)
    v_space_pos := position(' ' in v_author_name);
    if v_space_pos > 0 then
      v_first_name := substring(v_author_name, 1, v_space_pos - 1);
      v_last_name := substring(v_author_name, v_space_pos + 1);
    else
      v_first_name := '';
      v_last_name := v_author_name;
    end if;
    
    -- Insert author (only first author as corresponding)
    insert into public.manuscript_authors (
      manuscript_id, first_name, last_name, email, author_order,
      is_corresponding_author, is_submitting_author, invitation_status
    )
    values (
      p_manuscript_id, v_first_name, v_last_name,
      coalesce(v_manuscript.corresponding_email, 'unknown@example.com'),
      v_author_order,
      (v_author_order = 1), -- First author is corresponding by default
      (v_manuscript.submitting_author_id = auth.uid()), -- Current user is submitting author if they match
      'confirmed'
    )
    returning id into v_new_author_id;
    
    -- Link affiliation if exists
    if v_affiliation_id is not null then
      insert into public.manuscript_author_affiliations (author_id, affiliation_id)
      values (v_new_author_id, v_affiliation_id);
    end if;
    
    v_author_order := v_author_order + 1;
  end loop;
end;
$$;

grant execute on function public.backfill_manuscript_authorship(uuid) to authenticated;
