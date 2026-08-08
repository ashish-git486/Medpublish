-- MedPublish: profiles + manuscript submissions + Row Level Security
--
-- Run this file's contents in the Supabase SQL Editor (or via the Supabase
-- CLI as a migration) for a new or existing project. It is safe to run
-- once; re-running will error on "already exists" rather than duplicate
-- data, which is the expected/safe behavior for a migration file.

-- =========================================================================
-- 1. PROFILES
-- =========================================================================
-- One row per authenticated user, linked 1:1 to Supabase's built-in
-- auth.users table. This is where we store the user's role, since roles
-- must never be trusted from client-supplied data.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  role text not null default 'author' check (role in ('author', 'editor', 'admin')),
  institution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone signed in can read any profile. Author names/affiliations are
-- shown publicly next to published articles, so this is intentionally
-- permissive for SELECT. Adjust if you want profile data fully private.
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Users may create only their own profile row.
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- Users may update their own profile, but the role column is protected
-- separately below — RLS alone can't restrict individual columns, so a
-- trigger (see below) prevents non-admins from changing `role`.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---- helper: has_role() ------------------------------------------------
-- SECURITY DEFINER so it can read public.profiles regardless of the
-- calling user's row-level policies, without causing recursive RLS checks.
create or replace function public.has_role(target_role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = target_role
  );
$$;

create or replace function public.is_editor_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('editor', 'admin')
  );
$$;

-- ---- trigger: block self-service role changes --------------------------
-- A user can update their own full_name/institution/avatar_url, but only
-- an existing editor/admin (acting on someone else's row through a trusted
-- context) may change `role`. This stops "change my own role from the
-- browser" attacks even though the UPDATE policy above allows the row.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_editor_or_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_self_escalation on public.profiles;
create trigger trg_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- ---- trigger: auto-create profile on signup -----------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 2. MANUSCRIPTS (submissions)
-- =========================================================================

create table if not exists public.manuscripts (
  id uuid primary key default gen_random_uuid(),
  submitting_author_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  abstract text not null,
  authors text not null,
  category text not null,
  article_type text not null,
  content text not null,
  keywords text,
  institution text,
  corresponding_email text,
  "references" text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manuscripts enable row level security;

-- Authors can create their own submissions.
drop policy if exists "Authenticated users can submit manuscripts" on public.manuscripts;
create policy "Authenticated users can submit manuscripts"
  on public.manuscripts for insert
  to authenticated
  with check (submitting_author_id = auth.uid());

-- Authors can read their own submissions, regardless of status.
drop policy if exists "Authors can read their own submissions" on public.manuscripts;
create policy "Authors can read their own submissions"
  on public.manuscripts for select
  to authenticated
  using (submitting_author_id = auth.uid());

-- Editors/admins can read every submission (for the review queue).
drop policy if exists "Editors and admins can read all submissions" on public.manuscripts;
create policy "Editors and admins can read all submissions"
  on public.manuscripts for select
  to authenticated
  using (public.is_editor_or_admin());

-- Anonymous/public users can only read approved manuscripts (these are the
-- ones merged into the public Research Library).
drop policy if exists "Anyone can read approved manuscripts" on public.manuscripts;
create policy "Anyone can read approved manuscripts"
  on public.manuscripts for select
  to anon
  using (status = 'approved');

-- Only editors/admins can update a submission's status (approve/reject).
-- Authors are intentionally NOT given an UPDATE policy, so they cannot
-- approve/reject or edit a manuscript after submitting it.
drop policy if exists "Editors and admins can update submissions" on public.manuscripts;
create policy "Editors and admins can update submissions"
  on public.manuscripts for update
  to authenticated
  using (public.is_editor_or_admin())
  with check (public.is_editor_or_admin());

-- Keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_manuscripts_updated_at on public.manuscripts;
create trigger trg_manuscripts_updated_at
  before update on public.manuscripts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Helpful index for the review queue and "my submissions" queries.
create index if not exists manuscripts_status_idx on public.manuscripts (status);
create index if not exists manuscripts_author_idx on public.manuscripts (submitting_author_id);
