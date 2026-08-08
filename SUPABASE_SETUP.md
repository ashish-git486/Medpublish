# MedPublish — Supabase Auth & Database Setup

This document covers everything needed to run the real authentication and
manuscript-submission system that now backs MedPublish, replacing the old
localStorage prototype.

## 1. Install dependencies

```bash
npm install
```

This pulls in `@supabase/supabase-js`, which was added to `package.json`.

## 2. Environment variables

Copy the example file and fill in your project's values:

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Both values come from the Supabase dashboard (see step 3). `.env.local` is
already git-ignored. **Never** put the `service_role` secret key here — it
must never appear in frontend code.

## 3. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **Project Settings → API**, copy the **Project URL** and the
   **anon public** key into `.env.local`.

## 4. Run the database schema

1. Open the Supabase dashboard's **SQL Editor**.
2. Paste the full contents of `supabase/migrations/0001_auth_and_manuscripts.sql`
   and run it. (If you use the Supabase CLI locally, you can instead run
   `supabase db push` after linking the project, since the file already
   lives under `supabase/migrations/`.)
3. Then paste and run `supabase/migrations/0002_editorial_screening.sql`.
   This is a **separate, additive migration** — run it after 0001, whether
   you're setting up a brand-new project or upgrading an existing one that
   already has manuscripts in it. It does not drop anything or delete any
   data; it adds columns, widens the status model, and migrates existing
   `pending`/`approved` rows to their new-model equivalents in place.
4. Then paste and run `supabase/migrations/0003_peer_review.sql`. Also
   additive — run it after 0001 and 0002. It does not drop anything or
   delete any data; it adds the `reviewer` role, two new tables
   (`review_assignments`, `reviews`), and a new manuscripts SELECT policy
   so reviewers can read manuscripts they're assigned to.
5. Then paste and run `supabase/migrations/0004_revision_management.sql`.
   Also additive — run it after 0001, 0002, and 0003. It does not drop
   anything, delete any data, or remove any existing status value
   (`revision_requested` from editorial screening is untouched). It adds
   five new tables (`manuscript_versions`, `editor_decisions`,
   `revision_requests`, `author_responses`, `manuscript_events`), three
   new post-peer-review manuscript statuses, a `current_version_id`
   column on `manuscripts`, a `version_id` column on
   `review_assignments`, and two database functions
   (`submit_manuscript_revision`, `get_author_visible_reviews`).
6. Then paste and run `supabase/migrations/0005_production_workflow.sql`.
   Also additive — run it after 0001 through 0004. It does not drop
   anything or delete any data. It adds three new tables
   (`manuscript_production`, `production_metadata`, `production_events`),
   a trigger that automatically creates a production record (and starting
   metadata snapshot) the moment a manuscript's status becomes `accepted`,
   and four database functions (`assign_production_staff`,
   `update_production_metadata`, `set_metadata_verified`,
   `advance_production_status`). It also backfills production records for
   any manuscript that was already `accepted` before you ran it.

This creates:
- `public.profiles` — one row per user, linked to `auth.users`
- `public.manuscripts` — manuscript submissions, with the editorial
  screening workflow (see **Editorial Screening Workflow** below)
- `public.review_assignments` and `public.reviews` — the peer review
  system (see **Peer Review Workflow** below)
- `public.manuscript_versions`, `public.editor_decisions`,
  `public.revision_requests`, `public.author_responses`, and
  `public.manuscript_events` — the revision management system (see
  **Revision Management Workflow** below)
- Row Level Security policies on all nine tables
- A trigger that auto-creates a `profiles` row when someone signs up
- A trigger that blocks a user from changing their own `role` column
- A trigger that stamps `reviewed_by`/`reviewed_at` server-side whenever a
  manuscript's status changes to an editorial decision
- Triggers that stamp `assigned_by`/`accepted_at`/`declined_at`/`completed_at`
  server-side on `review_assignments`, and that validate + link a `reviews`
  row to its assignment server-side
- A `set_user_role()` database function editors/admins can call to grant
  the `reviewer` role to another user (used by the "Reviewer management"
  panel on `/admin`)
- A trigger that creates a `manuscript_versions` row (version 1) for every
  new manuscript, and a trigger that logs every manuscripts status change
  into `manuscript_events`
- A trigger that turns an `editor_decisions` insert into the right
  manuscript status change and, for a revision decision, a new
  `revision_requests` row
- The `submit_manuscript_revision()` function, which atomically creates a
  new manuscript version, updates the live manuscript, logs the author's
  response, and closes out the revision request
- The `get_author_visible_reviews()` function, the only path by which an
  author ever sees anything derived from `reviews` — always anonymized,
  never confidential comments
- `public.manuscript_production`, `public.production_metadata`, and
  `public.production_events` — the production workflow (see **Production
  Workflow** below), editor/admin only (no author or reviewer access at
  all)
- A trigger that automatically creates a production record + starting
  metadata snapshot the moment a manuscript's status becomes `accepted`
- The `assign_production_staff()`, `update_production_metadata()`,
  `set_metadata_verified()`, and `advance_production_status()` functions —
  the only ways production records change; `advance_production_status()`
  enforces the fixed forward-only sequence and requires verified metadata
  before entering `ready_for_typesetting`

See **Database Schema**, **Editorial Screening Workflow**,
**Peer Review Workflow**, **Revision Management Workflow**, **Production
Workflow**, and **RLS Policies** below for details.

## 5. Enable Google OAuth

1. In the Supabase dashboard, go to **Authentication → Providers → Google**.
2. Toggle it on.
3. You'll need a Google Cloud OAuth Client ID/Secret:
   - In the [Google Cloud Console](https://console.cloud.google.com/), create
     an OAuth 2.0 Client ID (type: Web application).
   - Add this **Authorized redirect URI** (Supabase shows the exact value on
     the same provider page, it follows this pattern):
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
   - Copy the generated Client ID and Client Secret into the Supabase Google
     provider settings and save.
4. In **Authentication → URL Configuration**, add your app's URLs (e.g.
   `http://localhost:5173` for local dev, plus your deployed domain) to
   **Redirect URLs** — the app calls `signInWithOAuth` with
   `redirectTo: window.location.origin`, so Supabase needs to allow that
   exact origin.

## 6. Run the app locally

```bash
npm run dev
```

Visit the printed local URL (typically `http://localhost:5173`).

## 7. Testing checklist

- **Email signup**: Go to `/signup`, create an account. If your Supabase
  project requires email confirmation (default), you'll see a "check your
  email" screen; confirm via the emailed link, then log in.
- **Email login**: Go to `/login` with a confirmed account's credentials.
- **Google login**: Click "Continue with Google" on `/login` or `/signup`
  and complete the Google consent screen.
- **Logout**: Click "Log out" in the navbar once signed in.
- **Manuscript submission**: While logged in, go to `/submit`, fill out the
  form, and submit. You should land on the confirmation screen with a real
  submission ID.
- **My Submissions**: Go to `/my-submissions` — it should show manuscripts
  you personally submitted (via your session, not the browser's local
  storage).
- **Admin/editor review workflow**: A brand-new user has the `author` role
  and will see "Access denied" on `/admin`. To test the screening actions,
  manually set a user's `role` to `editor` or `admin` in the Supabase Table
  Editor (`profiles` table) — this cannot be done from the app UI by
  design. Once promoted, that user can open `/admin`, click into a
  manuscript, and Send to Peer Review / Request Revision / Reject it.
  There is no more "approve" — a manuscript only reaches `published` via
  the peer-review/acceptance stage (once built beyond this phase), or via
  the one-time legacy-data migration.
- **Peer review workflow**: Have an editor grant a second test user the
  `reviewer` role from the "Reviewer management" panel at the bottom of
  `/admin` (just needs their email — no direct database access required
  for this step). Send a manuscript to peer review, then from
  `/admin/submissions/:id` assign the reviewer. Log in as that reviewer,
  go to `/reviewer`, accept the assignment, click "Start Review", fill out
  and submit the structured review form. Back on the editor's account, the
  completed review, its scores, and comments should now appear in the
  Peer Review panel on the manuscript's detail page.
- **Route protection**: While logged out, visiting `/submit`,
  `/my-submissions`, `/admin`, `/admin/submissions/:id`, `/reviewer`, or
  `/reviewer/review/:assignmentId` directly should redirect to `/login`.
  While logged in as a plain `author`, visiting any admin or reviewer
  route should show "Access denied" rather than the actual page.

### Editorial screening checklist

**Authorization**
- [ ] Author cannot access `/admin` or `/admin/submissions/:id`
- [ ] Editor can access both
- [ ] Admin can access both

**Workflow**
- [ ] A newly submitted manuscript appears under "Awaiting Screening" on `/admin`
- [ ] Clicking "Review manuscript" opens the full manuscript at `/admin/submissions/:id`
- [ ] "Send to Peer Review" moves it to `under_peer_review`
- [ ] "Request Revision" (on a different manuscript) requires a note and moves it to `revision_requested`
- [ ] "Reject" (on a different manuscript) requires a note and moves it to `rejected`
- [ ] After each action, `reviewed_by` and `reviewed_at` are populated, and the reviewer's name shows on both the dashboard and detail page
- [ ] The editorial note is saved and visible on the detail page, and to the author on `/my-submissions`

**Security**
- [ ] An author cannot change a manuscript's `status`, `screening_notes`, or `reviewed_by` from the browser (no UPDATE policy exists for authors — try it via devtools/network tab against the Supabase REST API directly, not just the UI)
- [ ] An author cannot call `updateEditorialDecision` successfully (RLS rejects it)
- [ ] RLS still restricts `SELECT` correctly for all three roles

**Regression**
- [ ] Google login still works
- [ ] Email login still works
- [ ] Manuscript submission still works and defaults to `editorial_review`
- [ ] `/my-submissions` still works and shows correct statuses
- [ ] Public `/library` and `/resources/:id` still show `published` manuscripts (previously `approved`)

### Peer review checklist

**Reviewer assignment**
- [ ] Editor grants the `reviewer` role to a test user via `/admin`'s "Reviewer management" panel
- [ ] Editor can assign that reviewer to a manuscript that's `under_peer_review` from `/admin/submissions/:id`
- [ ] The reviewer no longer appears in the "assign a reviewer" dropdown once assigned (until declined)
- [ ] A new row appears under "Assigned reviewers" with status "Awaiting Response"

**Accept / decline**
- [ ] The reviewer sees the new assignment under "Assigned Reviews" on `/reviewer`
- [ ] Clicking "Accept Review" moves it to "Accepted Reviews" and records `accepted_at`
- [ ] On a second assignment, clicking "Decline Review" moves it out of the active tabs and records `declined_at`
- [ ] A declined reviewer becomes assignable again from the editor's dropdown

**Submit review**
- [ ] "Start Review" on an accepted assignment opens the structured review form at `/reviewer/review/:assignmentId`
- [ ] The manuscript's abstract/full text is visible to the reviewer on that page
- [ ] Submitting without a recommendation, without all six scores, or without major comments shows validation errors and does not submit
- [ ] A complete submission succeeds, redirects to `/reviewer`, and the assignment now shows "Review Submitted"
- [ ] Revisiting `/reviewer/review/:assignmentId` for that same assignment shows an "already submitted" message instead of the form again (both in the UI and if attempted directly against the API, since `assignment_id` is a unique column)

**Multiple reviewers**
- [ ] A manuscript can have 2+ reviewers assigned at once, each with independent assignment/review rows
- [ ] The editor's Peer Review panel lists every completed review separately, with a computed average per score

**Editor visibility**
- [ ] Editor sees every submitted review's scores, recommendation, and comments on `/admin/submissions/:id`
- [ ] A review marked "confidential" shows a visible "Confidential" badge to the editor
- [ ] "Comments to editor only" text is visible to the editor

**RLS verification** (try these against the Supabase REST API directly, not just the UI)
- [ ] A reviewer cannot `SELECT` another reviewer's row in `reviews` or `review_assignments`
- [ ] A reviewer cannot `INSERT` a review against an assignment that isn't their own, or that they haven't accepted (the `validate_review_against_assignment` trigger raises an exception)
- [ ] A reviewer cannot `INSERT` a second review for an assignment they already reviewed (unique constraint on `assignment_id`)
- [ ] An author has no access at all to `review_assignments` or `reviews` — no rows returned for any query
- [ ] An author cannot read a manuscript they don't own unless it's `published` — reviewer visibility into a manuscript is scoped only to manuscripts they're actually assigned to
- [ ] A plain `author` cannot call `set_user_role` to grant themselves the `reviewer`, `editor`, or `admin` role (the function itself checks `is_editor_or_admin()` server-side and raises an exception otherwise)

**Role verification**
- [ ] `/reviewer` and `/reviewer/review/:assignmentId` are reachable by `reviewer`, `editor`, and `admin` roles
- [ ] `/reviewer` and `/reviewer/review/:assignmentId` show "Access denied" for a plain `author`
- [ ] Existing `author`/`editor`/`admin` accounts are unaffected — nobody's existing role changed as a side effect of this migration

**Regression**
- [ ] Editorial screening workflow (Send to Peer Review / Request Revision / Reject) still works unchanged
- [ ] Public Library and article detail pages are unaffected
- [ ] `/my-submissions` is unaffected — authors still see only manuscript status, never reviewer identities or review content

### Revision management checklist

**Editorial decision**
- [ ] "Editorial decision" panel appears on `/admin/submissions/:id` once status is `under_peer_review` or `revision_submitted`, and not before
- [ ] Each of the four decision buttons (Accept / Minor Revision / Major Revision / Reject) requires a decision letter before it can be confirmed
- [ ] "Accept" moves the manuscript to `accepted`
- [ ] "Reject" moves the manuscript to `rejected`
- [ ] "Minor Revision" moves the manuscript to `minor_revision_requested` and creates a `revision_requests` row
- [ ] "Major Revision" moves the manuscript to `major_revision_requested` and creates a `revision_requests` row
- [ ] Leaving the deadline field blank on a revision decision still produces a real deadline date (30 days out) on the `revision_requests` row
- [ ] The new decision appears in "Decision history" on the manuscript's detail page

**Author-facing revision request**
- [ ] `/my-submissions` shows the new status and a "Submit revision →" link once a revision is requested
- [ ] `/my-submissions/:id` shows a full timeline with distinct timestamps for each stage reached so far
- [ ] `/my-submissions/:id/revise` shows the editor's decision letter, reviewer-feedback summary, author instructions, and deadline
- [ ] `/my-submissions/:id/revise` shows the non-confidential reviewer comments (major/minor comments) with no reviewer name and no scores visible anywhere on the page
- [ ] The revision form is pre-filled with the manuscript's current content
- [ ] Submitting without a response letter shows a validation error and does not submit

**Versioning**
- [ ] After submitting a revision, a new `manuscript_versions` row exists (`version_number` incremented) and the manuscript's `current_version_id` points at it
- [ ] The manuscript's status becomes `revision_submitted`
- [ ] "Version history" on `/admin/submissions/:id` lists every version and lets you expand each one to view its title/abstract snapshot
- [ ] The original (version 1) content is still fully intact and viewable — nothing was overwritten

**Re-review loop**
- [ ] Once `revision_submitted`, both the "Peer review" and "Editorial decision" panels are visible on `/admin/submissions/:id`
- [ ] Assigning a reviewer at this point creates a `review_assignments` row whose `version_id` points at the newly submitted version (not the original)
- [ ] The editor can record a second decision (e.g. Accept) against the revised version, and it's correctly attributed to that version in "Decision history"

**RLS verification** (try these against the Supabase REST API directly, not just the UI)
- [ ] An author cannot `SELECT` from `reviews` directly under any circumstance (still default-deny, unchanged from the peer review phase)
- [ ] An author can only call `get_author_visible_reviews()` for a revision request tied to their own manuscript — calling it with someone else's `revision_request_id` raises an exception and returns nothing
- [ ] An author can only call `submit_manuscript_revision()` against their own manuscript's pending revision request — calling it against someone else's, or against an already-`submitted` request, raises an exception
- [ ] An author cannot `INSERT` directly into `editor_decisions`, `revision_requests`, `manuscript_versions`, or `author_responses` (no INSERT policy exists for authors on any of them)
- [ ] A plain `author` cannot record an editor_decisions row even by calling the table's insert endpoint directly (RLS + the `stamp_editor_decision` trigger both reject it)

**Regression**
- [ ] Editorial screening workflow is completely unaffected — `revision_requested` (the pre-review screening status) still works exactly as before
- [ ] Peer review assignment/accept/decline/submit flow is completely unaffected
- [ ] Existing manuscripts from before this migration each have a version-1 snapshot and a backfilled timeline event

### Production workflow checklist

**Entering production**
- [ ] Recording an "Accept" editorial decision automatically creates a `manuscript_production` row (`production_status = 'accepted'`) and a `production_metadata` row pre-filled from the manuscript's current version
- [ ] The new manuscript appears on `/production` immediately, with no manual "enter production" step required
- [ ] Manuscripts that were already `accepted` before this migration ran also appear on `/production` (backfilled)

**Dashboard**
- [ ] `/production` is reachable by `editor`/`admin` and shows "Access denied" for every other role, including `reviewer`
- [ ] `/production` is a separate page from `/admin` — no editorial-screening manuscripts (still pending screening/peer review) appear on it
- [ ] Status filter chips correctly narrow the list
- [ ] The quick-advance button on the dashboard card advances one manuscript's status without navigating away

**Production workspace (`/production/:id`)**
- [ ] Shows the manuscript summary, revision history, peer review history, and editorial decision history without any duplicated data-fetching logic (reuses `revisionService.js`/`reviewService.js`)
- [ ] Assigning a production editor and/or copyeditor persists and appears immediately in the dashboard list
- [ ] Editing production metadata (title, running title, abstract, keywords, author order, affiliations, corresponding author) saves correctly and does **not** change `manuscripts` or create a new `manuscript_versions` row
- [ ] Editing metadata after it was verified resets `metadata_verified` back to false
- [ ] "Mark metadata verified" sets `metadata_verified_at`; toggling it off clears the timestamp
- [ ] Advancing from `accepted` → `copyediting` → `metadata_verification` works and each transition appears in the production timeline with the correct label
- [ ] Attempting to advance from `metadata_verification` to `ready_for_typesetting` **before** verifying metadata is rejected with a clear error
- [ ] Advancing to `ready_for_typesetting` after verifying metadata succeeds and stamps `ready_for_typesetting_at`
- [ ] Attempting to skip a stage (e.g. `accepted` straight to `metadata_verification`) is rejected by `advance_production_status()`

**RLS verification** (try these against the Supabase REST API directly, not just the UI)
- [ ] An author has no access at all to `manuscript_production`, `production_metadata`, or `production_events` — no rows returned for any query, even for their own manuscript
- [ ] A reviewer has no access at all to any of the three production tables
- [ ] A plain `author` or `reviewer` cannot call `assign_production_staff`, `update_production_metadata`, `set_metadata_verified`, or `advance_production_status` (each function checks `is_editor_or_admin()` server-side and raises an exception otherwise)

**Regression**
- [ ] Editorial screening, peer review, and revision management workflows are completely unaffected
- [ ] `manuscripts.status` never becomes anything other than `accepted` as a result of this phase — no `published` status is ever set here
- [ ] Public Library and article detail pages are unaffected

## Database Schema

### `public.profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | References `auth.users(id)` |
| `full_name` | text | From signup form or Google profile |
| `email` | text | Copied from `auth.users` at signup time |
| `avatar_url` | text | From Google profile, if available |
| `role` | text | `author` (default) \| `editor` \| `admin` \| `reviewer` |
| `institution` | text | Optional |
| `created_at` / `updated_at` | timestamptz | |

A row is created automatically by a database trigger the moment a new
`auth.users` row appears (email signup or first Google login) — the app
never has to "remember" to create a profile.

### `public.manuscripts`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `submitting_author_id` | uuid | References `auth.users(id)` |
| `title`, `abstract`, `authors`, `category`, `article_type`, `content`, `keywords`, `institution`, `corresponding_email`, `references` | text | Mirror the submission form fields |
| `status` | text | `editorial_review` (default) \| `submitted` \| `revision_requested` \| `under_peer_review` \| `minor_revision_requested` \| `major_revision_requested` \| `revision_submitted` \| `accepted` \| `rejected` \| `published` |
| `screening_notes` | text | Editor's note — shown to the author on revision/rejection |
| `reviewed_by` | uuid | References `auth.users(id)`; set by trigger, never by the client |
| `current_version_id` | uuid | References `manuscript_versions(id)` — the version whose content is mirrored into the columns above |
| `submitted_at`, `reviewed_at`, `created_at`, `updated_at` | timestamptz | |

### `public.review_assignments`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `manuscript_id` | uuid | References `manuscripts(id)` |
| `reviewer_id` | uuid | References `auth.users(id)` |
| `assigned_by` | uuid | References `auth.users(id)`; set by trigger from `auth.uid()`, never by the client |
| `assigned_at` | timestamptz | Set by trigger on insert |
| `accepted_at` / `declined_at` / `completed_at` | timestamptz | Set by trigger the moment `status` changes to the matching value |
| `status` | text | `assigned` (default) \| `accepted` \| `declined` \| `submitted` \| `expired` |
| `version_id` | uuid | References `manuscript_versions(id)` — auto-filled from the manuscript's current version at assignment time, so editors always know which version a reviewer evaluated |
| `created_at` / `updated_at` | timestamptz | |

### `public.reviews`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `manuscript_id` | uuid | References `manuscripts(id)`; auto-filled from the assignment server-side |
| `assignment_id` | uuid, **unique** | References `review_assignments(id)` — the unique constraint is what makes duplicate submission impossible at the database level |
| `reviewer_id` | uuid | References `auth.users(id)` |
| `overall_recommendation` | text | `accept` \| `minor_revision` \| `major_revision` \| `reject` |
| `originality_score`, `methodology_score`, `statistical_quality_score`, `clinical_relevance_score`, `writing_quality_score`, `ethical_compliance_score` | smallint | Each 1–5, enforced by a check constraint |
| `major_comments`, `minor_comments`, `comments_to_editor` | text | Nullable; `comments_to_editor` is never shown to the author |
| `confidential` | boolean | Reviewer-set flag, editor-only visibility either way |
| `submitted_at` / `updated_at` | timestamptz | |

### `public.manuscript_versions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `manuscript_id` | uuid | References `manuscripts(id)` |
| `version_number` | integer | 1, 2, 3… per manuscript (`unique (manuscript_id, version_number)`) |
| `title`, `abstract`, `authors`, `content`, `keywords`, `references` | text | Immutable snapshot at the time this version was created |
| `submitted_by` | uuid | References `auth.users(id)` |
| `created_at` | timestamptz | |

Rows are **never updated or deleted** — no UPDATE/DELETE policy exists for
anyone. Version 1 is created automatically for every manuscript by a
trigger; later versions are created only by `submit_manuscript_revision()`.

### `public.editor_decisions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `manuscript_id` | uuid | References `manuscripts(id)` |
| `version_id` | uuid | References `manuscript_versions(id)` — the version this decision was made about; auto-filled server-side |
| `editor_id` | uuid | References `auth.users(id)`; set by trigger, never by the client |
| `decision` | text | `accept` \| `minor_revision` \| `major_revision` \| `reject` |
| `decision_letter`, `reviewer_summary`, `author_instructions` | text | All editor-written; safe to show the author since none of it is raw reviewer text |
| `revision_deadline` | date | Optional; defaults to 30 days out if left blank on a revision decision |
| `created_at` | timestamptz | |

### `public.revision_requests`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `manuscript_id` | uuid | References `manuscripts(id)` |
| `editor_decision_id` | uuid | References `editor_decisions(id)` — the decision that created this request |
| `version_id` | uuid | References `manuscript_versions(id)` — the version that needs revising |
| `revision_type` | text | `minor` \| `major` |
| `deadline` | date | |
| `status` | text | `pending` (default) \| `submitted` |
| `created_at` / `submitted_at` | timestamptz | |

Auto-created by a trigger the moment an `editor_decisions` row with
`decision in ('minor_revision', 'major_revision')` is inserted — there's no
client-facing INSERT policy on this table.

### `public.author_responses`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `revision_request_id` | uuid | References `revision_requests(id)` |
| `manuscript_id` | uuid | References `manuscripts(id)` |
| `new_version_id` | uuid, not null | References `manuscript_versions(id)` — the version this response accompanies |
| `response_letter` | text, not null | The author's point-by-point reply |
| `general_notes` | text | Optional |
| `submitted_by` | uuid | References `auth.users(id)` |
| `submitted_at` | timestamptz | |

Created only by `submit_manuscript_revision()` — there's no client-facing
INSERT policy on this table either.

### `public.manuscript_events`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `manuscript_id` | uuid | References `manuscripts(id)` |
| `status` | text | The status the manuscript changed *to* |
| `actor_id` | uuid | References `auth.users(id)` |
| `created_at` | timestamptz | |

One row per status change, logged automatically by a trigger on
`manuscripts` (insert and update). This is what powers the author-facing
timeline with real, distinct timestamps per stage instead of a single
overwritten `reviewed_at` column — and it's a ready-made hook for a future
notification system.

### `public.manuscript_production`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `manuscript_id` | uuid, **unique** | References `manuscripts(id)` — one production record per manuscript |
| `production_status` | text | `accepted` (default) \| `copyediting` \| `metadata_verification` \| `ready_for_typesetting` |
| `production_editor_id` | uuid | References `auth.users(id)` |
| `copyeditor_id` | uuid | References `auth.users(id)` |
| `metadata_verified` | boolean | Default `false` |
| `entered_production_at`, `copyediting_completed_at`, `metadata_verified_at`, `ready_for_typesetting_at` | timestamptz | Stamped per-stage, never overwritten once set (except when metadata edits reset verification) |
| `created_at` / `updated_at` | timestamptz | |

Created automatically by a trigger the instant `manuscripts.status`
becomes `accepted`. `production_status` only ever changes through
`advance_production_status()`, which enforces the fixed forward-only
sequence and blocks entry into `ready_for_typesetting` until
`metadata_verified = true`.

### `public.production_metadata`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `manuscript_id` | uuid, **unique** | References `manuscripts(id)` |
| `title`, `running_title`, `abstract`, `keywords` | text | The publication-facing copy — separate from `manuscripts`/`manuscript_versions` |
| `author_order` | jsonb | Array of `{ "name": "...", "isCorresponding": false }`, in publication order |
| `affiliations` | jsonb | Array of affiliation strings |
| `corresponding_author_name` / `corresponding_author_email` | text | |
| `updated_by` | uuid | References `auth.users(id)` |
| `created_at` / `updated_at` | timestamptz | |

Pre-filled from the manuscript's current version by the same trigger that
creates the production record. Edited only through
`update_production_metadata()`, which also resets `metadata_verified` back
to `false` on every edit. Never overwrites `manuscripts` or
`manuscript_versions` — this is a fully separate record.

### `public.production_events`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `manuscript_id` | uuid | References `manuscripts(id)` |
| `event_type` | text | `entered_production` \| `staff_assigned` \| `copyediting_started` \| `copyediting_completed` \| `metadata_updated` \| `metadata_verified` \| `metadata_unverified` \| `ready_for_typesetting` |
| `production_status` | text | The resulting production status, where applicable |
| `actor_id` | uuid | References `auth.users(id)` |
| `note` | text | Optional |
| `created_at` | timestamptz | |

Append-only production timeline, logged automatically by every production
function above. Kept as a dedicated table (not merged into
`manuscript_events`) since production is an editor/admin-only workspace —
authors have no access to it at all.

## Editorial Screening Workflow

```
Author submits
      |
Editorial Screening   (status: submitted / editorial_review)
      |-- Reject                 -> rejected
      |-- Request Revision       -> revision_requested
      `-- Send to Peer Review    -> under_peer_review
                                        |
                                  (peer review — not built yet)
                                        |
                                  accepted -> published
```

- New manuscripts default to `editorial_review` (`submitted` is reserved
  for a possible future intake step and isn't produced by the app yet).
- `submitted` and `editorial_review` are both treated as "awaiting
  screening" by the dashboard and stats — there's currently no separate
  action that moves a manuscript between the two.
- The three screening actions all live in `manuscriptService.updateEditorialDecision(id, { decision, notes })`,
  where `decision` is `'peer_review'`, `'revision'`, or `'reject'`.
- `reviewed_by` and `reviewed_at` are **never** sent by the client — a
  database trigger (`stamp_editorial_decision`) sets them from `auth.uid()`
  and `now()` the moment `status` changes to a decision state. This keeps
  the audit trail trustworthy even if the frontend has a bug or is
  tampered with.
- `under_peer_review` is where the peer review system (below) takes over:
  editors assign reviewers and track review progress on that manuscript's
  detail page. `accepted` and `published` still exist in the status model
  for the *next* phase (the post-review editorial decision) — nothing in
  the current app transitions a manuscript into them yet, except the
  one-time data migration of previously `approved` manuscripts to
  `published`.
- The public Research Library now reads `status = 'published'` (previously
  `status = 'approved'`) — this is purely a rename at the database level;
  reader-facing behavior is unchanged.

## Peer Review Workflow

```
Manuscript enters under_peer_review
      |
Editor assigns one or more reviewers   (review_assignments row, status: assigned)
      |
Reviewer responds
      |-- Decline                       -> status: declined (editor can reassign)
      `-- Accept                        -> status: accepted, accepted_at stamped
                                                |
                                        Reviewer opens the review form
                                                |
                                        Submits structured review        -> reviews row created
                                                                             assignment status: submitted
                                                                             completed_at stamped
                                                |
                                        Editor sees the review, its scores,
                                        recommendation, and comments on the
                                        manuscript's detail page, alongside
                                        every other reviewer's submission
                                                |
                                  (editorial decision after peer review —
                                   not built yet; see Known Limitations)
```

- A manuscript supports **multiple independent reviewers**; each gets its
  own `review_assignments` row and, once submitted, its own `reviews` row.
  Reviews are never stored on the manuscript itself.
- **Becoming a reviewer**: there's no self-service reviewer signup. An
  editor/admin grants the role from the "Reviewer management" panel at the
  bottom of `/admin` by email — this calls the `set_user_role()` database
  function, which re-checks the caller's privilege server-side rather than
  trusting the client.
- **Assigning reviewers**: from `/admin/submissions/:id`, once a manuscript
  is `under_peer_review` (or any later status), editors see a "Peer
  review" panel to assign any user currently holding the `reviewer` role.
  Already-assigned (non-declined) reviewers are excluded from the picker
  automatically. Reviewer expertise/specialty matching isn't built yet —
  the picker is a flat list of all reviewers, by design left open for that
  to be added later (`getReviewerCandidates()` is the one place that would
  need to grow filtering logic).
- **Accept / decline**: reviewers see incoming assignments on `/reviewer`
  and can accept or decline; `accepted_at`/`declined_at` are stamped
  server-side by a trigger, never sent by the client.
- **Reviewing**: only an *accepted* assignment can produce a review — the
  `validate_review_against_assignment` trigger rejects a submission
  otherwise, independent of whatever the UI allows. The review form
  captures an overall recommendation (`accept` / `minor_revision` /
  `major_revision` / `reject`), six 1–5 scores (originality, methodology,
  statistical quality, clinical relevance, writing quality, ethical
  compliance), major comments (required), minor comments (optional),
  comments to editor only (optional, never shown to the author), and an
  optional confidential flag.
- **Duplicate prevention**: the `assignment_id` column on `reviews` is
  `unique`, so a second review against the same assignment is rejected at
  the database level regardless of what the client does.
- **Author visibility**: authors have no RLS policy at all on
  `review_assignments` or `reviews` — this is a default-deny, not a UI
  choice, so reviewer identities and review content can never leak to the
  author through any client. Authors continue to see only their
  manuscript's current status on `/my-submissions`, same as before this
  phase.
- **What's built in this phase**: the post-peer-review editorial decision
  (Accept / Minor Revision / Major Revision / Reject), manuscript
  versioning, and the author's revision-and-resubmit loop. See
  **Revision Management Workflow** below.
- **What's still intentionally not built**: reviewer due dates (the
  Reviewer Dashboard shows a clearly-labeled placeholder date, not a real
  deadline column) and reviewer expertise/specialty tagging. See
  **Known Limitations** below and `PROJECT_CONTEXT.md`'s roadmap.

## Revision Management Workflow

```
under_peer_review
      |
Editor records a decision (editor_decisions row)
      |-- Accept          -> accepted
      |-- Reject           -> rejected
      |-- Minor Revision   -> minor_revision_requested   (+ revision_requests row, status: pending)
      `-- Major Revision   -> major_revision_requested   (+ revision_requests row, status: pending)
                                    |
                          Author reviews the decision letter,
                          the editor's reviewer-feedback summary,
                          and the non-confidential reviewer comments
                          on /my-submissions/:id/revise
                                    |
                          Submits revised manuscript + response letter
                          (submit_manuscript_revision() RPC)
                                    |
                          -> new manuscript_versions row (v2, v3, …)
                          -> manuscripts row updated in place, status: revision_submitted
                          -> author_responses row created
                          -> revision_requests row closed (status: submitted)
                                    |
                          Editor records the NEXT decision — same
                          editor_decisions flow as above, now against
                          the new version. Re-assigning the same or
                          different reviewers is just a normal
                          assignReviewer() call against the manuscript;
                          the new assignment's version_id automatically
                          points at the just-submitted version.
```

- **Recording a decision**: from `/admin/submissions/:id`, once a
  manuscript is `under_peer_review` or `revision_submitted`, editors see
  an "Editorial decision" panel with the four decision buttons. Every
  decision requires a decision letter; minor/major revisions also accept
  optional author instructions and an optional deadline (defaults to 30
  days out). `editor_id`, `version_id` (the manuscript's current version
  at decision time), and `created_at` are all stamped server-side —
  `apply_editor_decision()` then moves the manuscript's status and, for a
  revision decision, creates the `revision_requests` row, all inside one
  trigger so the two can never disagree.
- **What the author sees**: `/my-submissions` links every submission to
  `/my-submissions/:id`, a full timeline built from `manuscript_events`
  (real timestamps per stage, not a single overwritten column) plus every
  past `editor_decisions` row. When a revision is owed, a prominent CTA
  leads to `/my-submissions/:id/revise`.
- **What the author never sees**: reviewer identity, numeric scores, or
  `comments_to_editor`. The revision page calls
  `get_author_visible_reviews()`, a `SECURITY DEFINER` function that
  returns only `overall_recommendation` + `major_comments` +
  `minor_comments` for the review round tied to that specific revision
  request — there is still no direct table grant to `reviews` for authors.
- **Versioning**: manuscripts are never overwritten. Each revision creates
  a new `manuscript_versions` row (immutable — no UPDATE/DELETE policy
  exists on that table for anyone); the live `manuscripts` row's content
  columns always mirror the current version, so every existing page
  (`ResourceDetailPage`, the review form, etc.) needed zero changes.
  `current_version_id` tracks which version is "live," and
  `review_assignments.version_id` records which version each reviewer
  actually evaluated.
- **Submitting a revision**: goes through `submit_manuscript_revision()`,
  a single `SECURITY DEFINER` transaction that creates the version, updates
  the manuscript, logs the `author_responses` row, and closes the
  `revision_requests` row. It independently verifies the caller owns the
  manuscript and that the revision request is still `pending` — an author
  cannot submit against someone else's manuscript or resubmit against an
  already-fulfilled request, even via direct API calls.
- **Re-review after a revision**: once a manuscript reaches
  `revision_submitted`, the "Peer review" panel and the "Editorial
  decision" panel are both available, so an editor can accept, reject,
  request another revision, or send the manuscript back to the same or
  different reviewers — `assignReviewer()` is unchanged and simply creates
  a new `review_assignments` row scoped to the current version.

## Production Workflow

```
manuscripts.status = 'accepted'
      |
      | (trigger, automatic — no manual "enter production" step)
      v
accepted
      |  Assign production editor / copyeditor (optional, any time)
      v
copyediting                 -- Start Copyediting
      |
      v
metadata_verification       -- Complete Copyediting
      |  Edit production metadata (title, abstract, keywords, running
      |  title, author order, affiliations, corresponding author)
      |  Mark metadata verified
      v
ready_for_typesetting       -- Mark Ready For Typesetting
                                (blocked until metadata_verified = true)
```

- **Deliberately stops here.** DOI registration, Crossref integration,
  volume/issue assignment, scheduled publication, and public Research
  Library publication are future phases. `manuscripts.status` never
  becomes anything beyond `accepted` as a result of this workflow.
- **Entering production is automatic.** The moment
  `apply_editor_decision()` (from the revision-management phase) sets
  `manuscripts.status = 'accepted'`, a trigger creates the
  `manuscript_production` row and a `production_metadata` snapshot copied
  from the manuscript's current version. No editor action is required to
  "start" production.
- **A completely separate dashboard.** `/production` shows only
  manuscripts with an active production record whose manuscript is still
  `accepted` — it never shows manuscripts still in editorial screening or
  peer review, and it's a different route/page from `/admin`.
- **The production detail page (`/production/:id`) is the workspace.** It
  shows the manuscript itself, staff assignment, the metadata editor, the
  production timeline, and — reusing `revisionService.js` and
  `reviewService.js` rather than duplicating any query logic — read-only
  panels for version history, editorial decision history, and peer review
  history.
- **Metadata is never the scientific record.** `production_metadata` is a
  fully separate table from `manuscripts`/`manuscript_versions`. Editing
  it (title, running title, abstract, keywords, author order,
  affiliations, corresponding author) never touches the scientific
  manuscript or creates a new `manuscript_versions` row.
- **Editing metadata resets verification.** Since a prior verification no
  longer applies to changed content, `update_production_metadata()` always
  resets `metadata_verified` back to `false` server-side.
- **The final gate is enforced server-side.**
  `advance_production_status()` only allows the exact next step in the
  sequence, and refuses to move a manuscript into `ready_for_typesetting`
  unless `metadata_verified = true` — this can't be bypassed from the
  client even via a direct API call.
- **Fully separate audit trail.** `production_events` mirrors the design
  of `manuscript_events` but is kept as its own table, since production is
  an editor/admin-only workspace and authors have no access to it at all
  (unlike `manuscript_events`, which authors can read for their own
  manuscript).

## RLS Policies

**profiles**
- `SELECT`: any authenticated user can read any profile (needed to show
  author names/affiliations publicly).
- `INSERT`: a user may only insert a row with `id = auth.uid()`.
- `UPDATE`: a user may update their own row, but a trigger silently reverts
  any change to `role` unless the actor already has `editor`/`admin`
  privileges. This is what stops "change my own role from devtools."

**manuscripts**
- `INSERT`: authenticated users, only with `submitting_author_id = auth.uid()`.
- `SELECT`:
  - authors can read their own rows (any status)
  - editors/admins can read every row
  - anonymous/public visitors can read only `status = 'published'` rows
- `UPDATE`: only editors/admins (checked via a `SECURITY DEFINER` helper
  function, `is_editor_or_admin()`, so the check itself isn't subject to the
  same RLS it's enforcing). Authors have **no** update policy at all, so
  they cannot self-approve, self-reject, edit a manuscript after
  submission, or touch `status`/`screening_notes`/`reviewed_by` in any way.
  A separate trigger (`stamp_editorial_decision`) overwrites
  `reviewed_by`/`reviewed_at` with the actual acting editor and the actual
  time whenever an editor/admin changes `status` to a decision state, so
  even an editor's client can't misattribute or misdate a decision.
- `SELECT` additionally allows a **reviewer** to read a manuscript if (and
  only if) a `review_assignments` row exists linking that manuscript to
  their `auth.uid()` — this is the only manuscript visibility reviewers
  have; a manuscript they're not assigned to is invisible to them just
  like it is to any other unrelated author.

**review_assignments**
- `SELECT`: a reviewer can read only their own assignments
  (`reviewer_id = auth.uid()`); editors/admins can read all.
- `INSERT`: editors/admins only — this is how a reviewer gets assigned.
  `assigned_by`/`assigned_at` are stamped server-side from `auth.uid()`
  and `now()`, never trusted from the client.
- `UPDATE`: a reviewer can update only their own row (used for
  accept/decline); editors/admins can update any row. A trigger stamps
  `accepted_at`/`declined_at`/`completed_at` server-side whenever `status`
  changes to the matching value.

**reviews**
- `SELECT`: a reviewer can read only their own reviews; editors/admins can
  read all. Authors have **no policy at all** — not a restrictive one, an
  *absent* one — so RLS's default-deny means zero rows are ever returned
  to an author, regardless of query.
- `INSERT`: a reviewer can insert only with `reviewer_id = auth.uid()`. A
  trigger (`validate_review_against_assignment`) additionally rejects the
  insert unless the referenced `assignment_id` belongs to that reviewer
  and is currently `accepted`, and it auto-fills `manuscript_id` from the
  assignment so it can never be spoofed to point at a different
  manuscript. The `assignment_id` column's `unique` constraint independently
  guarantees only one review can ever exist per assignment.
- `UPDATE`: a reviewer can update only their own review.
- After a successful insert, a second trigger (`mark_assignment_submitted`)
  flips the linked `review_assignments.status` to `submitted` and stamps
  `completed_at` — the reviewer never has to (and cannot) set this
  directly.

**manuscript_versions**
- `SELECT`: the manuscript's author can read every version of their own
  manuscript; a reviewer can read every version of any manuscript they
  have a `review_assignments` row for (any round); editors/admins can
  read all.
- No `INSERT`/`UPDATE`/`DELETE` policy exists for anyone — rows are
  created only by the `create_initial_manuscript_version` trigger (on new
  manuscripts) and `submit_manuscript_revision()` (on resubmission), both
  `SECURITY DEFINER`. This is what makes "never overwrite a manuscript"
  a database guarantee rather than a UI convention.

**editor_decisions**
- `SELECT`: the manuscript's author can read every decision on their own
  manuscript (safe — `decision_letter`/`reviewer_summary`/
  `author_instructions` are all editor-written, never raw reviewer text);
  editors/admins can read all.
- `INSERT`: editors/admins only. A trigger (`stamp_editor_decision`)
  stamps `editor_id`/`created_at`/`version_id` server-side and
  independently re-checks `is_editor_or_admin()`, so even a compromised
  client can't misattribute a decision. A second trigger
  (`apply_editor_decision`) then moves the manuscript's `status` and, for
  a revision decision, creates the matching `revision_requests` row.
- No `UPDATE`/`DELETE` policy — decisions are an append-only log.

**revision_requests**
- `SELECT`: the manuscript's author can read their own; editors/admins
  can read all.
- No client-facing `INSERT`/`UPDATE` policy — rows are created by
  `apply_editor_decision()` and closed out (`status: 'submitted'`) by
  `submit_manuscript_revision()`, both `SECURITY DEFINER`.

**author_responses**
- `SELECT`: the manuscript's author can read their own; a reviewer with
  an active assignment on that manuscript can read it too (so they can
  see what changed before re-reviewing); editors/admins can read all.
- No client-facing `INSERT` policy — rows are created only by
  `submit_manuscript_revision()`, which independently verifies the caller
  owns the manuscript before inserting anything.

**manuscript_events**
- `SELECT`: the manuscript's author can read their own manuscript's
  events; editors/admins can read all.
- No client-facing `INSERT`/`UPDATE`/`DELETE` policy — rows are created
  only by the `log_manuscript_event` trigger on `manuscripts` insert/update.

**submit_manuscript_revision() function**
- `SECURITY DEFINER`, but re-verifies the caller owns the manuscript
  (`submitting_author_id = auth.uid()`) tied to the given
  `revision_request_id`, and that the request is still `status = 'pending'`,
  before doing anything — raising an exception otherwise. This is what
  lets a single RPC atomically touch four tables (`manuscript_versions`,
  `manuscripts`, `author_responses`, `revision_requests`) without opening
  up broad client-facing INSERT/UPDATE policies on any of them.

**get_author_visible_reviews() function**
- `SECURITY DEFINER`, but re-verifies the caller owns the manuscript tied
  to the given `revision_request_id` before returning anything. Returns
  only `overall_recommendation`, `major_comments`, `minor_comments`, and
  `submitted_at` — never `reviewer_id`, never any of the six numeric
  scores, never `comments_to_editor`. This is the **only** path by which
  an author-facing page ever touches anything derived from `reviews`;
  there is still no direct `SELECT` policy on `reviews` for authors.

**set_user_role() function**
- `SECURITY DEFINER`, but checks `is_editor_or_admin()` on the *caller*
  before doing anything, and raises an exception otherwise. This is what
  lets the "Reviewer management" panel work from the client without
  opening up a general "any editor can edit any profile row" RLS policy,
  which would have allowed editors to change unrelated profile fields too.

**manuscript_production**
- `SELECT`/`INSERT`/`UPDATE`: editors/admins only. No policy at all for
  authors or reviewers — default-deny, so neither role can read or write
  this table under any circumstance, even for their own manuscript.
- Rows are created automatically by the `create_production_record` trigger;
  `production_status` only ever changes through
  `advance_production_status()`.

**production_metadata**
- `SELECT`/`INSERT`/`UPDATE`: editors/admins only. Same default-deny for
  authors and reviewers as `manuscript_production`.
- Pre-filled by the same trigger that creates the production record; edited
  only through `update_production_metadata()`.

**production_events**
- `SELECT`/`INSERT`: editors/admins only. Same default-deny for authors and
  reviewers.
- Append-only — rows are created by the production functions/trigger, never
  updated or deleted.

**assign_production_staff() / update_production_metadata() /
set_metadata_verified() / advance_production_status() functions**
- All four are `SECURITY DEFINER`, but each independently checks
  `is_editor_or_admin()` on the caller before doing anything, raising an
  exception otherwise — the same pattern as `stamp_editor_decision()` and
  `set_user_role()`. `advance_production_status()` additionally re-checks
  the manuscript's *current* `production_status` server-side before
  allowing a transition, so the fixed sequence can't be skipped even via a
  direct API call.

## Supabase Dashboard Configuration Still Required

These steps can't be scripted from the repo and must be done by hand in the
dashboard:
1. Paste and run the SQL migration (step 4 above).
2. Turn on the Google provider and supply its Client ID/Secret (step 5).
3. Add your app's origins to **Authentication → URL Configuration →
   Redirect URLs**.
4. Decide whether email confirmation is required
   (**Authentication → Providers → Email → Confirm email**) — the signup
   flow already handles both cases, but the emailed confirmation link
   requires your **Site URL** to also be set correctly.
5. Promote at least one account to `editor` or `admin` manually in the
   `profiles` table so someone can access `/admin`.

## Known Limitations Before This Is Production-Ready

- **No reviewer due dates.** The Reviewer Dashboard shows a clearly
  labeled placeholder date (assignment date + 21 days); there's no real
  deadline column, no reminder emails, and no "expired" automation yet
  (`expired` exists in the status model but nothing currently sets it).
  Revision deadlines (`revision_requests.deadline`) are real dates now,
  but nothing currently enforces or reminds about them either.
- **No reviewer expertise/specialty matching.** The "assign a reviewer"
  picker on `/admin/submissions/:id` is a flat list of everyone with the
  `reviewer` role; matching reviewers to a manuscript's subject area is
  intentionally left for later (see `PROJECT_CONTEXT.md`).
- **"Send back to previous reviewers" is a manual re-assignment, not a
  one-click action.** The architecture supports it (a new
  `review_assignments` row against the same reviewer, scoped to the new
  version), but the UI doesn't yet pre-select "the reviewers from last
  round" for you — an editor re-picks them from the same dropdown used for
  first-round assignment.
- **No DOI issuance.** Real submissions publish with `doi: null`; there's no
  integration with a DOI registration agency (e.g. Crossref).
- **No file/PDF uploads.** Manuscripts are plain text in the `content`
  column; there's no manuscript file storage (Supabase Storage would be a
  natural next step).
- **No email notifications** on submission, screening decisions, editorial
  decisions, or publication. `manuscript_events` is a ready-made trigger
  point for this, but nothing consumes it yet.
- **No pagination.** `getSubmissions()` and `getAllArticles()` fetch full
  tables; this will need pagination/limits once volume grows.
- **No rate limiting or spam protection** on the public signup/submission
  forms.
- **`editor`/`admin` promotion is still manual.** Granting the `reviewer`
  role is now in-app (see the "Reviewer management" panel on `/admin`),
  but there's still no in-app "invite an editor" flow — promoting a user
  to `editor` or `admin` requires direct database access via the Supabase
  Table Editor.
- **Mock articles remain mixed into the public Library** alongside real
  submissions, clearly marked as prototype/demo data per the project
  instructions — these should be removed before a real launch.
