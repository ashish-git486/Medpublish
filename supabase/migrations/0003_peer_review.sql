-- MedPublish: Peer Review workflow
--
-- Adds a real peer-review stage: reviewer role, reviewer assignment,
-- structured multi-reviewer reviews, and reviewer visibility into
-- manuscripts they've been assigned. This is an ADDITIVE migration on top
-- of 0001_auth_and_manuscripts.sql and 0002_editorial_screening.sql — it
-- does not drop any table, does not delete any manuscript/user/profile
-- data, and does not weaken any existing RLS policy.
--
-- Run this file's contents in the Supabase SQL Editor (or via
-- `supabase db push`) AFTER 0001 and 0002 have already been applied.
-- Safe to run once; guards use `if not exists` / `if exists` /
-- `create or replace` throughout so re-running is idempotent.

-- =========================================================================
-- 1. ROLE MODEL: add 'reviewer'
-- =========================================================================
-- Existing roles: author (default) | editor | admin. Existing users and
-- their current roles are completely unaffected by widening this check
-- constraint — nobody's role value changes, this only permits a new one.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('author', 'editor', 'admin', 'reviewer'));

-- ---- helper: is_reviewer() ---------------------------------------------
create or replace function public.is_reviewer()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'reviewer'
  );
$$;

-- ---- function: set_user_role() -----------------------------------------
-- Lets an editor/admin grant a role (most commonly 'reviewer') to another
-- user's profile, without opening up a general "editors can update any
-- profile row" RLS policy (which would let an editor edit anyone's name/
-- institution/etc. too). This function touches ONLY the role column, and
-- checks the caller's privilege itself rather than trusting RLS/the client.
create or replace function public.set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may change a user''s role';
  end if;

  if new_role not in ('author', 'editor', 'admin', 'reviewer') then
    raise exception 'Invalid role: %', new_role;
  end if;

  update public.profiles set role = new_role where id = target_user_id;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

-- =========================================================================
-- 2. REVIEW_ASSIGNMENTS
-- =========================================================================
-- One row per (manuscript, reviewer) invitation. A manuscript can have
-- many assignments (multiple reviewers); a reviewer can have many
-- assignments (many manuscripts).

create table if not exists public.review_assignments (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  completed_at timestamptz,
  status text not null default 'assigned'
    check (status in ('assigned', 'accepted', 'declined', 'submitted', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.review_assignments enable row level security;

create index if not exists review_assignments_manuscript_idx
  on public.review_assignments (manuscript_id);
create index if not exists review_assignments_reviewer_idx
  on public.review_assignments (reviewer_id);
create index if not exists review_assignments_status_idx
  on public.review_assignments (status);

-- Reviewers can see their own assignments; editors/admins can see all
-- (needed for the editorial dashboard's "track review progress" view).
drop policy if exists "Reviewers can read their own assignments" on public.review_assignments;
create policy "Reviewers can read their own assignments"
  on public.review_assignments for select
  to authenticated
  using (reviewer_id = auth.uid());

drop policy if exists "Editors and admins can read all assignments" on public.review_assignments;
create policy "Editors and admins can read all assignments"
  on public.review_assignments for select
  to authenticated
  using (public.is_editor_or_admin());

-- Only editors/admins can create assignments (assign a reviewer).
drop policy if exists "Editors and admins can create assignments" on public.review_assignments;
create policy "Editors and admins can create assignments"
  on public.review_assignments for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- A reviewer may update ONLY their own assignment (accept/decline/start).
-- Editors/admins may also update any assignment (e.g. mark expired).
drop policy if exists "Reviewers can update their own assignment" on public.review_assignments;
create policy "Reviewers can update their own assignment"
  on public.review_assignments for update
  to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

drop policy if exists "Editors and admins can update assignments" on public.review_assignments;
create policy "Editors and admins can update assignments"
  on public.review_assignments for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- ---- trigger: stamp assigned_by + status timestamps server-side --------
-- The client only ever sends manuscript_id/reviewer_id (on insert) or a
-- new status (on update, e.g. 'accepted'/'declined'). All timestamps and
-- the "who assigned this" field are authoritative server-side values.
create or replace function public.stamp_review_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.assigned_by := auth.uid();
    new.assigned_at := now();
    new.status := coalesce(new.status, 'assigned');
    new.accepted_at := null;
    new.declined_at := null;
    new.completed_at := null;
    return new;
  end if;

  -- UPDATE
  if new.status is distinct from old.status then
    if new.status = 'accepted' then
      new.accepted_at := now();
    elsif new.status = 'declined' then
      new.declined_at := now();
    elsif new.status = 'submitted' then
      new.completed_at := now();
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_stamp_review_assignment_insert on public.review_assignments;
create trigger trg_stamp_review_assignment_insert
  before insert on public.review_assignments
  for each row execute function public.stamp_review_assignment();

drop trigger if exists trg_stamp_review_assignment_update on public.review_assignments;
create trigger trg_stamp_review_assignment_update
  before update on public.review_assignments
  for each row execute function public.stamp_review_assignment();

-- =========================================================================
-- 3. REVIEWS
-- =========================================================================
-- A manuscript supports MULTIPLE independent reviews (never stored inside
-- the manuscripts row). Exactly one review per assignment is enforced at
-- the database level via the unique constraint on assignment_id, which
-- also means "prevent duplicate submissions" holds even if the UI has a
-- bug or two requests race.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  assignment_id uuid not null unique references public.review_assignments (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  overall_recommendation text not null
    check (overall_recommendation in ('accept', 'minor_revision', 'major_revision', 'reject')),
  originality_score smallint not null check (originality_score between 1 and 5),
  methodology_score smallint not null check (methodology_score between 1 and 5),
  statistical_quality_score smallint not null check (statistical_quality_score between 1 and 5),
  clinical_relevance_score smallint not null check (clinical_relevance_score between 1 and 5),
  writing_quality_score smallint not null check (writing_quality_score between 1 and 5),
  ethical_compliance_score smallint not null check (ethical_compliance_score between 1 and 5),
  major_comments text,
  minor_comments text,
  comments_to_editor text,
  confidential boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create index if not exists reviews_manuscript_idx on public.reviews (manuscript_id);
create index if not exists reviews_reviewer_idx on public.reviews (reviewer_id);

-- Reviewers can read/insert/update only their own review. Editors/admins
-- can read all reviews (to prepare an editorial decision). Authors have NO
-- policy at all on this table, so they cannot see reviews or reviewer
-- identities under any circumstance (default-deny).
drop policy if exists "Reviewers can read their own reviews" on public.reviews;
create policy "Reviewers can read their own reviews"
  on public.reviews for select
  to authenticated
  using (reviewer_id = auth.uid());

drop policy if exists "Editors and admins can read all reviews" on public.reviews;
create policy "Editors and admins can read all reviews"
  on public.reviews for select
  to authenticated
  using (public.is_editor_or_admin());

drop policy if exists "Reviewers can submit their own review" on public.reviews;
create policy "Reviewers can submit their own review"
  on public.reviews for insert
  to authenticated
  with check (reviewer_id = auth.uid());

drop policy if exists "Reviewers can update their own review" on public.reviews;
create policy "Reviewers can update their own review"
  on public.reviews for update
  to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

-- ---- trigger: validate against the assignment + auto-fill manuscript_id
-- Ensures a review can only be created against an assignment that (a)
-- actually belongs to the submitting reviewer, and (b) has been accepted
-- (a reviewer can't submit a review they never agreed to do). Also fills
-- manuscript_id from the assignment server-side so the two can never
-- disagree.
create or replace function public.validate_review_against_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment record;
begin
  select * into assignment from public.review_assignments where id = new.assignment_id;

  if assignment is null then
    raise exception 'Review assignment % does not exist', new.assignment_id;
  end if;

  if assignment.reviewer_id is distinct from new.reviewer_id then
    raise exception 'This review assignment does not belong to this reviewer';
  end if;

  if assignment.status not in ('accepted', 'submitted') then
    raise exception 'Cannot submit a review for an assignment with status "%"', assignment.status;
  end if;

  new.manuscript_id := assignment.manuscript_id;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_validate_review_against_assignment on public.reviews;
create trigger trg_validate_review_against_assignment
  before insert on public.reviews
  for each row execute function public.validate_review_against_assignment();

-- ---- trigger: submitting a review marks the assignment 'submitted' -----
create or replace function public.mark_assignment_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.review_assignments
  set status = 'submitted', completed_at = now(), updated_at = now()
  where id = new.assignment_id;
  return new;
end;
$$;

drop trigger if exists trg_mark_assignment_submitted on public.reviews;
create trigger trg_mark_assignment_submitted
  after insert on public.reviews
  for each row execute function public.mark_assignment_submitted();

-- =========================================================================
-- 4. MANUSCRIPTS: reviewers may read manuscripts they're assigned to
-- =========================================================================
-- Additive policy only — every existing manuscripts policy from 0001/0002
-- is untouched. Without this, a reviewer role has no way to read the
-- manuscript text/abstract for a paper they've been asked to review.

drop policy if exists "Reviewers can read assigned manuscripts" on public.manuscripts;
create policy "Reviewers can read assigned manuscripts"
  on public.manuscripts for select
  to authenticated
  using (
    exists (
      select 1 from public.review_assignments ra
      where ra.manuscript_id = manuscripts.id
        and ra.reviewer_id = auth.uid()
    )
  );

-- =========================================================================
-- 5. updated_at triggers for the new tables (reuses existing helper)
-- =========================================================================
-- public.set_updated_at() already exists from 0001_auth_and_manuscripts.sql.
-- review_assignments and reviews already stamp updated_at themselves inside
-- their dedicated triggers above (stamp_review_assignment /
-- validate_review_against_assignment), so no additional generic trigger is
-- needed here — listed for documentation completeness only.
