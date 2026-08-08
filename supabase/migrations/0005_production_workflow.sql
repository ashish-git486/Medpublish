-- MedPublish: Production Workflow (first half)
--
-- Adds the post-acceptance production pipeline: Accepted -> Copyediting ->
-- Metadata Verification -> Ready For Typesetting. This is an ADDITIVE
-- migration on top of 0001-0004 — it does not drop any table, does not
-- delete any manuscript/review/revision/user data, and does not weaken any
-- existing RLS policy.
--
-- Deliberately STOPS at "Ready For Typesetting". DOI registration, Crossref,
-- volume/issue assignment, scheduled publication, and public Research
-- Library publication are future phases and are NOT implemented here.
--
-- Run this file's contents in the Supabase SQL Editor (or via
-- `supabase db push`) AFTER 0001, 0002, 0003, and 0004 have already been
-- applied. Safe to run once; guards use `if not exists` / `if exists` /
-- `create or replace` throughout so re-running is idempotent.

-- =========================================================================
-- 1. MANUSCRIPT_PRODUCTION
-- =========================================================================
-- One production record per manuscript, created automatically the moment a
-- manuscript's status becomes 'accepted' (see trigger in section 5). This
-- table is intentionally separate from `manuscripts` — production status is
-- a different concern from editorial/peer-review status, and overloading
-- `manuscripts` would make both harder to reason about.

create table if not exists public.manuscript_production (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null unique references public.manuscripts (id) on delete cascade,
  production_status text not null default 'accepted'
    check (production_status in ('accepted', 'copyediting', 'metadata_verification', 'ready_for_typesetting')),
  production_editor_id uuid references auth.users (id) on delete set null,
  copyeditor_id uuid references auth.users (id) on delete set null,
  metadata_verified boolean not null default false,
  entered_production_at timestamptz not null default now(),
  copyediting_completed_at timestamptz,
  metadata_verified_at timestamptz,
  ready_for_typesetting_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manuscript_production enable row level security;

create index if not exists manuscript_production_status_idx
  on public.manuscript_production (production_status);
create index if not exists manuscript_production_editor_idx
  on public.manuscript_production (production_editor_id);
create index if not exists manuscript_production_copyeditor_idx
  on public.manuscript_production (copyeditor_id);

-- Authors: NO policy at all — default-deny. Reviewers: NO policy at all —
-- default-deny. Only editors/admins may read or write production records.
drop policy if exists "Editors and admins can read production records" on public.manuscript_production;
create policy "Editors and admins can read production records"
  on public.manuscript_production for select
  to authenticated
  using (public.is_editor_or_admin());

drop policy if exists "Editors and admins can insert production records" on public.manuscript_production;
create policy "Editors and admins can insert production records"
  on public.manuscript_production for insert
  to authenticated
  with check (public.is_editor_or_admin());

drop policy if exists "Editors and admins can update production records" on public.manuscript_production;
create policy "Editors and admins can update production records"
  on public.manuscript_production for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

drop trigger if exists trg_manuscript_production_updated_at on public.manuscript_production;
create trigger trg_manuscript_production_updated_at
  before update on public.manuscript_production
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 2. PRODUCTION_METADATA
-- =========================================================================
-- The publication-facing metadata record — explicitly NOT the scientific
-- manuscript. This is a distinct, separately-editable copy so editors can
-- correct author order, affiliations, running titles, etc. for publication
-- without ever touching `manuscripts` or `manuscript_versions` (which stay
-- the immutable scientific record). Designed to be extended by future
-- publication-metadata features (DOI, Crossref XML, issue metadata) without
-- redesigning this table.

create table if not exists public.production_metadata (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null unique references public.manuscripts (id) on delete cascade,
  title text not null,
  running_title text,
  abstract text not null,
  keywords text,
  -- Ordered array of { "name": "...", "affiliationIndex": 0, "isCorresponding": false }.
  -- Kept as jsonb rather than a join table for now — simple to edit as a
  -- unit from a single form, and easy to migrate to a normalized table
  -- later without touching anything else in this migration.
  author_order jsonb not null default '[]'::jsonb,
  -- Ordered array of affiliation strings, referenced by index from author_order.
  affiliations jsonb not null default '[]'::jsonb,
  corresponding_author_name text,
  corresponding_author_email text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.production_metadata enable row level security;

drop policy if exists "Editors and admins can read production metadata" on public.production_metadata;
create policy "Editors and admins can read production metadata"
  on public.production_metadata for select
  to authenticated
  using (public.is_editor_or_admin());

drop policy if exists "Editors and admins can insert production metadata" on public.production_metadata;
create policy "Editors and admins can insert production metadata"
  on public.production_metadata for insert
  to authenticated
  with check (public.is_editor_or_admin());

drop policy if exists "Editors and admins can update production metadata" on public.production_metadata;
create policy "Editors and admins can update production metadata"
  on public.production_metadata for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

drop trigger if exists trg_production_metadata_updated_at on public.production_metadata;
create trigger trg_production_metadata_updated_at
  before update on public.production_metadata
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 3. PRODUCTION_EVENTS (production timeline / audit log)
-- =========================================================================
-- Mirrors the append-only design of manuscript_events (0004), but kept as a
-- dedicated table rather than merged into it: production is an
-- editor/admin-only workspace, while manuscript_events is author-readable.
-- Keeping them separate means the author-facing timeline is never
-- accidentally exposed to (or polluted by) internal production activity.

create table if not exists public.production_events (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  event_type text not null,
  production_status text,
  actor_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.production_events enable row level security;

create index if not exists production_events_manuscript_idx
  on public.production_events (manuscript_id);

drop policy if exists "Editors and admins can read production events" on public.production_events;
create policy "Editors and admins can read production events"
  on public.production_events for select
  to authenticated
  using (public.is_editor_or_admin());

drop policy if exists "Editors and admins can insert production events" on public.production_events;
create policy "Editors and admins can insert production events"
  on public.production_events for insert
  to authenticated
  with check (public.is_editor_or_admin());

-- =========================================================================
-- 4. helper: is_manuscript_in_production()
-- =========================================================================
-- Used by the production dashboard's "not yet published" filter, and useful
-- for future features (e.g. blocking edits once published).

create or replace function public.is_manuscript_in_production(p_manuscript_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.manuscript_production where manuscript_id = p_manuscript_id
  );
$$;

-- =========================================================================
-- 5. TRIGGER: entering production is automatic on acceptance
-- =========================================================================
-- The moment manuscripts.status transitions to 'accepted' (already driven
-- by apply_editor_decision() in 0004, and reachable no other way), a
-- production record and its starting metadata snapshot are created
-- automatically. Idempotent via the unique constraint + ON CONFLICT, so
-- this is safe even if triggers somehow fire more than once for the same
-- transition.

create or replace function public.create_production_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_id uuid;
  v_version record;
  v_author_names text[];
  v_author_order jsonb;
begin
  if new.status = 'accepted' and (old.status is distinct from new.status) then

    insert into public.manuscript_production (manuscript_id, production_status, entered_production_at)
    values (new.id, 'accepted', now())
    on conflict (manuscript_id) do nothing
    returning id into v_created_id;

    if v_created_id is not null then
      select * into v_version from public.manuscript_versions where id = new.current_version_id;

      v_author_names := string_to_array(coalesce(v_version.authors, new.authors, ''), ',');
      select coalesce(jsonb_agg(jsonb_build_object('name', trim(both from a), 'isCorresponding', false)), '[]'::jsonb)
        into v_author_order
        from unnest(v_author_names) as a
        where trim(both from a) <> '';

      insert into public.production_metadata
        (manuscript_id, title, running_title, abstract, keywords, author_order, corresponding_author_email)
      values (
        new.id,
        coalesce(v_version.title, new.title),
        coalesce(v_version.title, new.title),
        coalesce(v_version.abstract, new.abstract),
        coalesce(v_version.keywords, new.keywords),
        coalesce(v_author_order, '[]'::jsonb),
        new.corresponding_email
      )
      on conflict (manuscript_id) do nothing;

      insert into public.production_events (manuscript_id, event_type, production_status, actor_id)
      values (new.id, 'entered_production', 'accepted', auth.uid());
    end if;

  end if;

  return null;
end;
$$;

drop trigger if exists trg_create_production_record on public.manuscripts;
create trigger trg_create_production_record
  after update on public.manuscripts
  for each row execute function public.create_production_record();

-- Backfill: any manuscript that's already 'accepted' before this migration
-- ran gets a production record too, so nothing that should be in the
-- production queue is silently skipped.
insert into public.manuscript_production (manuscript_id, production_status, entered_production_at)
select m.id, 'accepted', coalesce(m.reviewed_at, m.submitted_at)
from public.manuscripts m
where m.status = 'accepted'
  and not exists (
    select 1 from public.manuscript_production mp where mp.manuscript_id = m.id
  );

insert into public.production_metadata
  (manuscript_id, title, running_title, abstract, keywords, corresponding_author_email)
select m.id, m.title, m.title, m.abstract, m.keywords, m.corresponding_email
from public.manuscripts m
join public.manuscript_production mp on mp.manuscript_id = m.id
where not exists (
  select 1 from public.production_metadata pm where pm.manuscript_id = m.id
);

insert into public.production_events (manuscript_id, event_type, production_status, actor_id, created_at)
select mp.manuscript_id, 'entered_production', 'accepted', m.reviewed_by, mp.entered_production_at
from public.manuscript_production mp
join public.manuscripts m on m.id = mp.manuscript_id
where not exists (
  select 1 from public.production_events pe
  where pe.manuscript_id = mp.manuscript_id and pe.event_type = 'entered_production'
);

-- =========================================================================
-- 6. FUNCTION: assign_production_staff()
-- =========================================================================
-- Editors/admins assign a production editor and/or copyeditor. Either
-- argument may be null to leave that assignment unchanged — pass the
-- current value back from the client for "no change" fields.

create or replace function public.assign_production_staff(
  p_manuscript_id uuid,
  p_production_editor_id uuid,
  p_copyeditor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may assign production staff';
  end if;

  update public.manuscript_production
  set production_editor_id = p_production_editor_id,
      copyeditor_id = p_copyeditor_id,
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  if not found then
    raise exception 'No production record exists for this manuscript yet';
  end if;

  insert into public.production_events (manuscript_id, event_type, actor_id, note)
  values (p_manuscript_id, 'staff_assigned', auth.uid(), 'Production editor and/or copyeditor assignment updated');
end;
$$;

grant execute on function public.assign_production_staff(uuid, uuid, uuid) to authenticated;

-- =========================================================================
-- 7. FUNCTION: update_production_metadata()
-- =========================================================================
-- Edits the publication-facing metadata only. Never touches `manuscripts`
-- or `manuscript_versions`. Editing metadata resets metadata_verified back
-- to false — a prior verification no longer applies to changed content, so
-- Ready For Typesetting correctly requires re-verification.

create or replace function public.update_production_metadata(
  p_manuscript_id uuid,
  p_title text,
  p_running_title text,
  p_abstract text,
  p_keywords text,
  p_author_order jsonb,
  p_affiliations jsonb,
  p_corresponding_author_name text,
  p_corresponding_author_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may edit production metadata';
  end if;

  update public.production_metadata
  set title = trim(p_title),
      running_title = nullif(trim(coalesce(p_running_title, '')), ''),
      abstract = trim(p_abstract),
      keywords = nullif(trim(coalesce(p_keywords, '')), ''),
      author_order = coalesce(p_author_order, author_order),
      affiliations = coalesce(p_affiliations, affiliations),
      corresponding_author_name = nullif(trim(coalesce(p_corresponding_author_name, '')), ''),
      corresponding_author_email = nullif(trim(coalesce(p_corresponding_author_email, '')), ''),
      updated_by = auth.uid(),
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  if not found then
    raise exception 'No production metadata record exists for this manuscript yet';
  end if;

  update public.manuscript_production
  set metadata_verified = false,
      metadata_verified_at = null,
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  insert into public.production_events (manuscript_id, event_type, actor_id, note)
  values (p_manuscript_id, 'metadata_updated', auth.uid(), 'Production metadata edited');
end;
$$;

grant execute on function public.update_production_metadata(
  uuid, text, text, text, text, jsonb, jsonb, text, text
) to authenticated;

-- =========================================================================
-- 8. FUNCTION: set_metadata_verified()
-- =========================================================================

create or replace function public.set_metadata_verified(
  p_manuscript_id uuid,
  p_verified boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor_or_admin() then
    raise exception 'Only editors or admins may verify production metadata';
  end if;

  update public.manuscript_production
  set metadata_verified = p_verified,
      metadata_verified_at = case when p_verified then now() else null end,
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  if not found then
    raise exception 'No production record exists for this manuscript yet';
  end if;

  insert into public.production_events (manuscript_id, event_type, actor_id)
  values (p_manuscript_id, case when p_verified then 'metadata_verified' else 'metadata_unverified' end, auth.uid());
end;
$$;

grant execute on function public.set_metadata_verified(uuid, boolean) to authenticated;

-- =========================================================================
-- 9. FUNCTION: advance_production_status()
-- =========================================================================
-- Enforces the fixed forward-only sequence:
--   accepted -> copyediting -> metadata_verification -> ready_for_typesetting
-- Entry into 'ready_for_typesetting' additionally requires metadata to
-- already be verified (via set_metadata_verified above). No later
-- publication states exist yet — this function deliberately stops here.

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

  v_expected_next := case v_current
    when 'accepted' then 'copyediting'
    when 'copyediting' then 'metadata_verification'
    when 'metadata_verification' then 'ready_for_typesetting'
    else null
  end;

  if p_new_status is distinct from v_expected_next then
    raise exception 'Cannot advance production status from "%" to "%" — expected "%"',
      v_current, p_new_status, coalesce(v_expected_next, '(none — already at final stage)');
  end if;

  if p_new_status = 'ready_for_typesetting' and not coalesce(v_metadata_verified, false) then
    raise exception 'Metadata must be verified before marking Ready For Typesetting';
  end if;

  v_event_type := case p_new_status
    when 'copyediting' then 'copyediting_started'
    when 'metadata_verification' then 'copyediting_completed'
    when 'ready_for_typesetting' then 'ready_for_typesetting'
  end;

  update public.manuscript_production
  set production_status = p_new_status,
      copyediting_completed_at = case when p_new_status = 'metadata_verification' then now() else copyediting_completed_at end,
      ready_for_typesetting_at = case when p_new_status = 'ready_for_typesetting' then now() else ready_for_typesetting_at end,
      updated_at = now()
  where manuscript_id = p_manuscript_id;

  insert into public.production_events (manuscript_id, event_type, production_status, actor_id)
  values (p_manuscript_id, v_event_type, p_new_status, auth.uid());
end;
$$;

grant execute on function public.advance_production_status(uuid, text) to authenticated;
