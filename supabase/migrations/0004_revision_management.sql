-- MedPublish: Revision Management workflow
--
-- Adds the post-peer-review editorial decision stage (Accept / Minor Revision
-- / Major Revision / Reject), manuscript versioning, revision requests,
-- author responses, and a status-change event log that powers the author's
-- multi-stage timeline. This is an ADDITIVE migration on top of 0001-0003 —
-- it does not drop any table, does not delete any manuscript/review/user
-- data, and does not weaken any existing RLS policy.
--
-- Run this file's contents in the Supabase SQL Editor (or via
-- `supabase db push`) AFTER 0001, 0002, and 0003 have already been applied.
-- Safe to run once; guards use `if not exists` / `if exists` /
-- `create or replace` throughout so re-running is idempotent, except for
-- the one-time data migration UPDATE in section 2 (itself safe to re-run,
-- since it only touches rows still carrying the old status value).

-- =========================================================================
-- 1. MANUSCRIPT_VERSIONS
-- =========================================================================
-- Immutable snapshot of a manuscript's content at submission time and at
-- every subsequent revision. Version 1 always mirrors the original
-- submission. `manuscripts` keeps its own content columns as the "current"
-- copy (so every existing page that reads manuscript.content/.abstract/etc.
-- keeps working unchanged) — this table exists purely so no version is ever
-- overwritten or lost, and so editors always know which exact text a
-- reviewer evaluated.

create table if not exists public.manuscript_versions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  version_number integer not null,
  title text not null,
  abstract text not null,
  authors text not null,
  content text not null,
  keywords text,
  "references" text,
  submitted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (manuscript_id, version_number)
);

alter table public.manuscript_versions enable row level security;

create index if not exists manuscript_versions_manuscript_idx
  on public.manuscript_versions (manuscript_id);

-- Authors can read every version of their own manuscript.
drop policy if exists "Authors can read their own manuscript versions" on public.manuscript_versions;
create policy "Authors can read their own manuscript versions"
  on public.manuscript_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_versions.manuscript_id
        and m.submitting_author_id = auth.uid()
    )
  );

-- Reviewers can read versions of manuscripts they've been assigned to
-- (any round — a reviewer asked to look at v2 may reasonably want v1 too).
drop policy if exists "Reviewers can read versions of assigned manuscripts" on public.manuscript_versions;
create policy "Reviewers can read versions of assigned manuscripts"
  on public.manuscript_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.review_assignments ra
      where ra.manuscript_id = manuscript_versions.manuscript_id
        and ra.reviewer_id = auth.uid()
    )
  );

drop policy if exists "Editors and admins can read all manuscript versions" on public.manuscript_versions;
create policy "Editors and admins can read all manuscript versions"
  on public.manuscript_versions for select
  to authenticated
  using (public.is_editor_or_admin());

-- No UPDATE or DELETE policy is defined for anyone — versions are
-- append-only and immutable by design ("do not overwrite manuscripts").
-- INSERT happens only through SECURITY DEFINER functions below, which
-- bypass RLS, so no client-facing INSERT policy is needed either.

-- =========================================================================
-- 2. MANUSCRIPTS: current_version_id + status model migration
-- =========================================================================

alter table public.manuscripts
  add column if not exists current_version_id uuid references public.manuscript_versions (id);

-- IMPORTANT: 'revision_requested' already means something today — it's the
-- PRE-peer-review editorial screening decision ("send this back to the
-- author before we even send it to reviewers"), used by the existing
-- "Request Revision" screening action and read directly by
-- MySubmissionsPage. We do NOT touch or remove it here.
--
-- This migration only ADDS the distinct POST-peer-review states: an editor
-- deciding minor/major revision after reviews are in, and the
-- 'revision_submitted' window between the author resubmitting and the
-- editor's next decision.
alter table public.manuscripts drop constraint if exists manuscripts_status_check;

alter table public.manuscripts
  add constraint manuscripts_status_check
  check (status in (
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

-- Backfill: give every existing manuscript a version-1 snapshot of its
-- current content, and point current_version_id at it.
insert into public.manuscript_versions
  (manuscript_id, version_number, title, abstract, authors, content, keywords, "references", submitted_by, created_at)
select
  m.id, 1, m.title, m.abstract, m.authors, m.content, m.keywords, m."references", m.submitting_author_id, m.submitted_at
from public.manuscripts m
where not exists (
  select 1 from public.manuscript_versions v where v.manuscript_id = m.id
);

update public.manuscripts m
set current_version_id = v.id
from public.manuscript_versions v
where v.manuscript_id = m.id and v.version_number = 1 and m.current_version_id is null;

-- ---- trigger: every NEW manuscript automatically gets its version 1 ------
create or replace function public.create_initial_manuscript_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version_id uuid;
begin
  insert into public.manuscript_versions
    (manuscript_id, version_number, title, abstract, authors, content, keywords, "references", submitted_by)
  values
    (new.id, 1, new.title, new.abstract, new.authors, new.content, new.keywords, new."references", new.submitting_author_id)
  returning id into v_version_id;

  update public.manuscripts set current_version_id = v_version_id where id = new.id;

  return null;
end;
$$;

drop trigger if exists trg_create_initial_manuscript_version on public.manuscripts;
create trigger trg_create_initial_manuscript_version
  after insert on public.manuscripts
  for each row execute function public.create_initial_manuscript_version();

-- =========================================================================
-- 3. MANUSCRIPT_EVENTS (status-change audit log / author timeline)
-- =========================================================================
-- Every time manuscripts.status changes, a row is logged here automatically.
-- This is what lets the author-facing timeline show real, distinct
-- timestamps per stage (Submitted, Editorial Screening, Under Review, Major
-- Revision Requested, Revision Submitted, Under Review again, Accepted...)
-- instead of a single reviewed_at column that gets overwritten every time.
-- It also gives any future notification system a ready-made trigger point.

create table if not exists public.manuscript_events (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  status text not null,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.manuscript_events enable row level security;

create index if not exists manuscript_events_manuscript_idx
  on public.manuscript_events (manuscript_id);

drop policy if exists "Authors can read their own manuscript events" on public.manuscript_events;
create policy "Authors can read their own manuscript events"
  on public.manuscript_events for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_events.manuscript_id
        and m.submitting_author_id = auth.uid()
    )
  );

drop policy if exists "Editors and admins can read all manuscript events" on public.manuscript_events;
create policy "Editors and admins can read all manuscript events"
  on public.manuscript_events for select
  to authenticated
  using (public.is_editor_or_admin());

create or replace function public.log_manuscript_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.manuscript_events (manuscript_id, status, actor_id)
    values (new.id, new.status, new.submitting_author_id);
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.manuscript_events (manuscript_id, status, actor_id)
    values (new.id, new.status, auth.uid());
  end if;
  return null;
end;
$$;

drop trigger if exists trg_log_manuscript_event_insert on public.manuscripts;
create trigger trg_log_manuscript_event_insert
  after insert on public.manuscripts
  for each row execute function public.log_manuscript_event();

drop trigger if exists trg_log_manuscript_event_update on public.manuscripts;
create trigger trg_log_manuscript_event_update
  after update on public.manuscripts
  for each row execute function public.log_manuscript_event();

-- Backfill one event per existing manuscript at its current status, so the
-- timeline has at least one entry for manuscripts that predate this
-- migration (their earlier history wasn't tracked and can't be recovered).
insert into public.manuscript_events (manuscript_id, status, actor_id, created_at)
select m.id, m.status, m.reviewed_by, coalesce(m.reviewed_at, m.submitted_at)
from public.manuscripts m
where not exists (
  select 1 from public.manuscript_events e where e.manuscript_id = m.id
);

-- ---- widen the existing editorial-screening stamping trigger -----------
-- Additive only: same behavior as before, just recognizes the new status
-- values too, so reviewed_by/reviewed_at stay meaningful after this phase.
create or replace function public.stamp_editorial_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in (
       'minor_revision_requested', 'major_revision_requested', 'revision_submitted',
       'under_peer_review', 'accepted', 'rejected', 'published'
     ) then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

-- =========================================================================
-- 4. REVIEW_ASSIGNMENTS: track which version was sent to each reviewer
-- =========================================================================

alter table public.review_assignments
  add column if not exists version_id uuid references public.manuscript_versions (id);

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
    if new.version_id is null then
      select current_version_id into new.version_id
      from public.manuscripts where id = new.manuscript_id;
    end if;
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

-- =========================================================================
-- 5. EDITOR_DECISIONS
-- =========================================================================
-- Append-only log of every post-peer-review editorial decision. The
-- reviewer_summary and author_instructions fields are written by the
-- editor themselves (not raw reviewer text), so it's safe to expose the
-- whole row to the manuscript's author.

create table if not exists public.editor_decisions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  version_id uuid references public.manuscript_versions (id),
  editor_id uuid references auth.users (id) on delete set null,
  decision text not null check (decision in ('accept', 'minor_revision', 'major_revision', 'reject')),
  decision_letter text,
  reviewer_summary text,
  author_instructions text,
  revision_deadline date,
  created_at timestamptz not null default now()
);

alter table public.editor_decisions enable row level security;

create index if not exists editor_decisions_manuscript_idx on public.editor_decisions (manuscript_id);

drop policy if exists "Authors can read decisions on their own manuscripts" on public.editor_decisions;
create policy "Authors can read decisions on their own manuscripts"
  on public.editor_decisions for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts m
      where m.id = editor_decisions.manuscript_id
        and m.submitting_author_id = auth.uid()
    )
  );

drop policy if exists "Editors and admins can read all decisions" on public.editor_decisions;
create policy "Editors and admins can read all decisions"
  on public.editor_decisions for select
  to authenticated
  using (public.is_editor_or_admin());

drop policy if exists "Editors and admins can record decisions" on public.editor_decisions;
create policy "Editors and admins can record decisions"
  on public.editor_decisions for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- ---- trigger: stamp editor_id/version_id server-side --------------------
create or replace function public.stamp_editor_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may record an editorial decision';
  end if;

  new.editor_id := auth.uid();
  new.created_at := now();
  if new.version_id is null then
    select current_version_id into new.version_id
    from public.manuscripts where id = new.manuscript_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_editor_decision on public.editor_decisions;
create trigger trg_stamp_editor_decision
  before insert on public.editor_decisions
  for each row execute function public.stamp_editor_decision();

-- =========================================================================
-- 6. REVISION_REQUESTS
-- =========================================================================
-- The actionable task an author sees and fulfills. Auto-created from an
-- editor_decisions row when the decision is a minor or major revision.

create table if not exists public.revision_requests (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  editor_decision_id uuid not null references public.editor_decisions (id) on delete cascade,
  version_id uuid references public.manuscript_versions (id),
  revision_type text not null check (revision_type in ('minor', 'major')),
  deadline date,
  status text not null default 'pending' check (status in ('pending', 'submitted')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

alter table public.revision_requests enable row level security;

create index if not exists revision_requests_manuscript_idx on public.revision_requests (manuscript_id);

drop policy if exists "Authors can read their own revision requests" on public.revision_requests;
create policy "Authors can read their own revision requests"
  on public.revision_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts m
      where m.id = revision_requests.manuscript_id
        and m.submitting_author_id = auth.uid()
    )
  );

drop policy if exists "Editors and admins can read all revision requests" on public.revision_requests;
create policy "Editors and admins can read all revision requests"
  on public.revision_requests for select
  to authenticated
  using (public.is_editor_or_admin());

-- No client-facing INSERT/UPDATE policy: rows are created by
-- apply_editor_decision() below and closed out by submit_manuscript_revision()
-- further down, both SECURITY DEFINER.

-- ---- trigger: turn a minor/major decision into a live revision request,
--      and move the manuscript's status to match the decision -----------
create or replace function public.apply_editor_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.decision = 'accept' then
    update public.manuscripts set status = 'accepted' where id = new.manuscript_id;

  elsif new.decision = 'reject' then
    update public.manuscripts set status = 'rejected' where id = new.manuscript_id;

  elsif new.decision = 'minor_revision' then
    update public.manuscripts set status = 'minor_revision_requested' where id = new.manuscript_id;
    insert into public.revision_requests (manuscript_id, editor_decision_id, version_id, revision_type, deadline)
    values (
      new.manuscript_id, new.id, new.version_id, 'minor',
      coalesce(new.revision_deadline, (current_date + interval '30 days')::date)
    );

  elsif new.decision = 'major_revision' then
    update public.manuscripts set status = 'major_revision_requested' where id = new.manuscript_id;
    insert into public.revision_requests (manuscript_id, editor_decision_id, version_id, revision_type, deadline)
    values (
      new.manuscript_id, new.id, new.version_id, 'major',
      coalesce(new.revision_deadline, (current_date + interval '30 days')::date)
    );
  end if;

  return null;
end;
$$;

drop trigger if exists trg_apply_editor_decision on public.editor_decisions;
create trigger trg_apply_editor_decision
  after insert on public.editor_decisions
  for each row execute function public.apply_editor_decision();

-- =========================================================================
-- 7. AUTHOR_RESPONSES
-- =========================================================================

create table if not exists public.author_responses (
  id uuid primary key default gen_random_uuid(),
  revision_request_id uuid not null references public.revision_requests (id) on delete cascade,
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  new_version_id uuid not null references public.manuscript_versions (id),
  response_letter text not null,
  general_notes text,
  submitted_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz not null default now()
);

alter table public.author_responses enable row level security;

create index if not exists author_responses_manuscript_idx on public.author_responses (manuscript_id);

drop policy if exists "Authors can read their own responses" on public.author_responses;
create policy "Authors can read their own responses"
  on public.author_responses for select
  to authenticated
  using (
    exists (
      select 1 from public.manuscripts m
      where m.id = author_responses.manuscript_id
        and m.submitting_author_id = auth.uid()
    )
  );

drop policy if exists "Editors and admins can read all responses" on public.author_responses;
create policy "Editors and admins can read all responses"
  on public.author_responses for select
  to authenticated
  using (public.is_editor_or_admin());

drop policy if exists "Assigned reviewers can read responses" on public.author_responses;
create policy "Assigned reviewers can read responses"
  on public.author_responses for select
  to authenticated
  using (
    exists (
      select 1 from public.review_assignments ra
      where ra.manuscript_id = author_responses.manuscript_id
        and ra.reviewer_id = auth.uid()
    )
  );

-- No client-facing INSERT policy: rows are created only by
-- submit_manuscript_revision() below, which validates ownership itself.

-- =========================================================================
-- 8. submit_manuscript_revision(): the one atomic author-facing entry point
-- =========================================================================
-- Creates the new manuscript_versions row, updates the live manuscripts
-- row (title/abstract/authors/content/keywords/references + status), logs
-- the author_responses row, and closes out the revision_requests row —
-- all in one transaction so there's never a partial/inconsistent state.

create or replace function public.submit_manuscript_revision(
  p_revision_request_id uuid,
  p_title text,
  p_abstract text,
  p_authors text,
  p_content text,
  p_keywords text,
  p_references text,
  p_response_letter text,
  p_general_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manuscript_id uuid;
  v_owner uuid;
  v_status text;
  v_next_version integer;
  v_new_version_id uuid;
begin
  select rr.manuscript_id, m.submitting_author_id, rr.status
    into v_manuscript_id, v_owner, v_status
  from public.revision_requests rr
  join public.manuscripts m on m.id = rr.manuscript_id
  where rr.id = p_revision_request_id;

  if v_manuscript_id is null then
    raise exception 'Revision request not found';
  end if;

  if v_owner is distinct from auth.uid() then
    raise exception 'You do not have permission to submit this revision';
  end if;

  if v_status <> 'pending' then
    raise exception 'This revision request has already been fulfilled';
  end if;

  if p_response_letter is null or trim(p_response_letter) = '' then
    raise exception 'A response letter is required';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version
  from public.manuscript_versions where manuscript_id = v_manuscript_id;

  insert into public.manuscript_versions
    (manuscript_id, version_number, title, abstract, authors, content, keywords, "references", submitted_by)
  values
    (v_manuscript_id, v_next_version, trim(p_title), trim(p_abstract), trim(p_authors), trim(p_content),
     nullif(trim(p_keywords), ''), nullif(trim(p_references), ''), auth.uid())
  returning id into v_new_version_id;

  update public.manuscripts
  set title = trim(p_title),
      abstract = trim(p_abstract),
      authors = trim(p_authors),
      content = trim(p_content),
      keywords = nullif(trim(p_keywords), ''),
      "references" = nullif(trim(p_references), ''),
      current_version_id = v_new_version_id,
      status = 'revision_submitted'
  where id = v_manuscript_id;

  insert into public.author_responses
    (revision_request_id, manuscript_id, new_version_id, response_letter, general_notes, submitted_by)
  values
    (p_revision_request_id, v_manuscript_id, v_new_version_id, trim(p_response_letter),
     nullif(trim(p_general_notes), ''), auth.uid());

  update public.revision_requests
  set status = 'submitted', submitted_at = now()
  where id = p_revision_request_id;

  return v_new_version_id;
end;
$$;

grant execute on function public.submit_manuscript_revision(
  uuid, text, text, text, text, text, text, text, text
) to authenticated;

-- =========================================================================
-- 9. get_author_visible_reviews(): safe, anonymized reviewer feedback
-- =========================================================================
-- Returns ONLY the author-safe fields (recommendation + non-confidential
-- comments) for the review round tied to a given revision request. Never
-- exposes reviewer identity, numeric scores, or comments_to_editor. This is
-- the sole path by which an author ever sees anything derived from the
-- reviews table — there is still no direct SELECT policy on `reviews` for
-- authors.

create or replace function public.get_author_visible_reviews(p_revision_request_id uuid)
returns table (
  overall_recommendation text,
  major_comments text,
  minor_comments text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manuscript_id uuid;
  v_owner uuid;
  v_version_id uuid;
begin
  select rr.manuscript_id, m.submitting_author_id, rr.version_id
    into v_manuscript_id, v_owner, v_version_id
  from public.revision_requests rr
  join public.manuscripts m on m.id = rr.manuscript_id
  where rr.id = p_revision_request_id;

  if v_manuscript_id is null or v_owner is distinct from auth.uid() then
    raise exception 'You do not have permission to view these reviews';
  end if;

  return query
    select r.overall_recommendation, r.major_comments, r.minor_comments, r.submitted_at
    from public.reviews r
    join public.review_assignments ra on ra.id = r.assignment_id
    where r.manuscript_id = v_manuscript_id
      and (v_version_id is null or ra.version_id = v_version_id)
    order by r.submitted_at asc;
end;
$$;

grant execute on function public.get_author_visible_reviews(uuid) to authenticated;
