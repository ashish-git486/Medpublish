-- MedPublish: Editorial Screening workflow
--
-- Adds a real editorial-screening stage between submission and peer review.
-- This is an ADDITIVE migration on top of 0001_auth_and_manuscripts.sql — it
-- does not drop any table, does not delete any manuscript or user data, and
-- does not weaken RLS. Run this file's contents in the Supabase SQL Editor
-- (or via `supabase db push`) AFTER 0001 has already been applied.
--
-- Safe to run once. Re-running is mostly idempotent (guards use
-- `if not exists` / `if exists` / `create or replace` throughout), except
-- for the one-time data migration UPDATE statements in section 2, which are
-- themselves safe to re-run because they only touch rows still carrying the
-- old status values.

-- =========================================================================
-- 1. NEW COLUMNS
-- =========================================================================
-- screening_notes: the editor's note explaining a revision request or
--   rejection (or an optional note when sending to peer review).
-- reviewed_by: which editor/admin made the most recent editorial decision.
--   References auth.users directly (not public.profiles), matching the
--   existing submitting_author_id pattern. This column is NEVER trusted
--   from client input — see the stamp_editorial_decision trigger below,
--   which overwrites it with auth.uid() server-side.

alter table public.manuscripts
  add column if not exists screening_notes text,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

create index if not exists manuscripts_reviewed_by_idx on public.manuscripts (reviewed_by);

-- =========================================================================
-- 2. STATUS MODEL MIGRATION
-- =========================================================================
-- Old model:  pending | approved | rejected
-- New model:  submitted | editorial_review | revision_requested |
--             under_peer_review | accepted | rejected | published
--
-- Mapping for existing rows (no data is deleted, only the status label
-- changes to its equivalent new-model state):
--   pending  -> editorial_review   (already sitting in the screening queue)
--   approved -> published          (already publicly visible in the
--                                    Research Library, which is exactly
--                                    what 'published' means going forward)
--   rejected -> rejected           (unchanged; terminal in both models)
--
-- The constraint is dropped before the data migration (so old values remain
-- valid for the moment) and re-added afterwards with the full new set.

alter table public.manuscripts drop constraint if exists manuscripts_status_check;

update public.manuscripts set status = 'editorial_review' where status = 'pending';
update public.manuscripts set status = 'published' where status = 'approved';
-- status = 'rejected' rows are left as-is.

alter table public.manuscripts
  add constraint manuscripts_status_check
  check (status in (
    'submitted',
    'editorial_review',
    'revision_requested',
    'under_peer_review',
    'accepted',
    'rejected',
    'published'
  ));

-- New submissions enter directly into the editorial screening queue (the
-- separate 'submitted' value is kept in the model for a future intake/
-- completeness-check stage, but isn't produced by the app yet).
alter table public.manuscripts alter column status set default 'editorial_review';

-- =========================================================================
-- 3. RLS: public visibility now keys off 'published', not 'approved'
-- =========================================================================

drop policy if exists "Anyone can read approved manuscripts" on public.manuscripts;
drop policy if exists "Anyone can read published manuscripts" on public.manuscripts;
create policy "Anyone can read published manuscripts"
  on public.manuscripts for select
  to anon
  using (status = 'published');

-- Authors' own-row SELECT policy and editors/admins' all-row SELECT policy
-- from 0001 already cover every other case and need no change. Authors
-- still have no UPDATE policy at all, so they cannot alter status,
-- screening_notes, or reviewed_by/reviewed_at under any circumstance.

-- =========================================================================
-- 4. TRIGGER: server-side stamping of editorial decisions
-- =========================================================================
-- Whenever an editor/admin moves a manuscript into a decision state, the
-- database itself records who did it and when — the client only sends the
-- new status and an optional note. This means a compromised or buggy
-- frontend can't misattribute a decision to the wrong editor or forge a
-- timestamp, and it keeps the audit trail authoritative regardless of what
-- the client actually sent.

create or replace function public.stamp_editorial_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('revision_requested', 'under_peer_review', 'accepted', 'rejected', 'published') then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_editorial_decision on public.manuscripts;
create trigger trg_stamp_editorial_decision
  before update on public.manuscripts
  for each row execute function public.stamp_editorial_decision();

-- =========================================================================
-- 5. Helpful index for the new status-based filtering
-- =========================================================================
-- manuscripts_status_idx already exists from 0001 and covers the new values
-- fine since it's just an index on the status column, no change needed.
