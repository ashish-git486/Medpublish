# Project Context
We are building a comprehensive online medical journal publishing platform inspired by leading international medical publishing platforms such as Springer Nature, BMC, PLOS, and BMJ Open, while delivering a more modern, intuitive, and feature-rich user experience. The platform will enable researchers, clinicians, students, and academicians to submit manuscripts, manage peer review, publish high-quality scientific articles, and provide open access to published research.

The system will include complete journal management functionality, including manuscript submission, editorial workflow, reviewer management, article publication, issue and archive management, DOI integration, indexing support, user authentication, search functionality, article metrics, and an administrative dashboard. The website will be designed to meet international publishing standards while remaining scalable, secure, mobile-friendly, and optimized for search engines and academic indexing services such as Google Scholar.


## Project Name

MedPublish

## Project Purpose

This is a content and resource platform where contributors can publish
educational resources and users can discover, search, read, and download them.

## Target Users

The platform is designed for the global academic and healthcare research community.

Primary users include:

Medical students
Undergraduate and postgraduate researchers
Doctors and clinicians
Faculty members and professors
Scientists and biomedical researchers
Healthcare professionals
Journal editors and editorial board members
Peer reviewers
Universities and medical colleges
Hospitals and research institutions
Academic publishers
Librarians and institutional repositories

The platform also serves readers seeking access to high-quality, peer-reviewed medical literature. It provides a seamless experience for authors submitting manuscripts, reviewers evaluating scientific work, editors managing the publication process, and readers discovering, searching, and citing published research. The interface is designed to be accessible for both first-time authors and experienced researchers while supporting international standards for scientific publishing.

## Current MVP Features

- Homepage
- Resource library
- Search
- Category filtering
- Resource detail pages
- User authentication
- Contributor submissions
- Editorial screening workflow (screen → revise / peer review / reject)
- Peer review system (reviewer assignment, accept/decline, structured
  multi-reviewer reviews, editor review dashboard)

## Tech Stack

- React
- Vite
- Tailwind CSS
- Supabase
- JavaScript

## Current Status

**Phase 9 complete: Submission & Authorship Management Foundation.**

The manuscript submission and authorship model has been significantly enhanced to support real medical journal requirements:

- **Structured authorship system** — Multiple authors with explicit ordering, corresponding author designation, and affiliation management
- **Co-author invitation workflow** — Secure token-based invitation system for co-authors with acceptance/decline tracking
- **Author contributions tracking** — CRediT-style contribution statement support for standardized author role disclosure
- **Affiliation management** — Reusable institutional affiliations that can be shared among authors
- **Authorship change audit trail** — Complete history of authorship changes for compliance and transparency
- **Draft submission support** — Extended manuscript status model to support draft submissions
- **Backward compatibility** — Existing production workflow and submission process remain fully functional

**New tables** (additive migration, `supabase/migrations/0014_manuscript_authorship_system.sql`):
- `manuscript_authors` — Individual author records with explicit ordering, corresponding/submitting author flags, invitation status, and contribution statements
- `manuscript_affiliations` — Reusable institutional affiliation records per manuscript
- `manuscript_author_affiliations` — Many-to-many relationship between authors and affiliations
- `author_contributions` — CRediT-style contribution types per author
- `authorship_change_log` — Audit trail for authorship changes (added, removed, reordered, etc.)

**Extended tables**:
- `manuscripts` — added `draft` status to support draft submissions before final submission

**New SECURITY DEFINER database functions**:
- `add_manuscript_author()` — Add new author with validation and constraint enforcement
- `update_manuscript_author()` — Update author information with permission checks
- `remove_manuscript_author()` — Remove author with audit logging
- `get_manuscript_authors()` — Retrieve all authors with affiliations and contributions
- `invite_co_author()` — Generate secure invitation tokens for co-authors
- `accept_co_author_invitation()` — Accept co-author invitation with profile association
- `set_author_contributions()` — Set CRediT-style contribution types for authors
- `backfill_manuscript_authorship()` — Migrate existing manuscripts to new authorship system

**New service layer** (`src/services/authorshipService.js`):
- Complete authorship management functions for authors, affiliations, contributions, and invitations
- Validation functions for author order uniqueness and corresponding author requirements
- Author confirmation status checking for submission requirements

**Extended UI components**:
- `SubmitResourcePage` — Preserved existing simple submission form for backward compatibility
- Foundation for future multi-step submission UI with author management

**Database constraints**:
- Unique author order per manuscript
- Single corresponding author enforcement
- Invitation token security with expiration
- RLS policies for authorship data protection
- Authorship permissions based on manuscript status and user role

---

**Phase 10 complete: Author Profile & Author Workspace.**

A comprehensive author profile and workspace system has been implemented to provide authors with a professional control center for managing their publishing identity and manuscript activities:

- **Professional author profiles** — Extended profile fields for academic and professional information including ORCID, designation, department, biography, and contact details
- **Profile completeness tracking** — Visual indicator showing profile completion percentage with guidance on missing information
- **Author manuscript workspace** — Unified view of all manuscripts where the user is involved as submitting author or co-author
- **Action required dashboard** — Prominent display of pending actions including revision requests, proof reviews, and co-author invitations
- **Publication tracking** — Dedicated section for published work with author role and contribution information
- **Production status integration** — Real-time production workflow status for accepted manuscripts
- **Co-author invitation management** — Direct integration with the Phase 9 invitation system for accepting/declining invitations
- **Security model** — Authors can only access and modify their own profile information; manuscript-specific data follows existing RLS policies

**Extended profiles table** (additive migration, `supabase/migrations/0015_author_profile_enhancements.sql`):
- Added professional fields: `phone`, `country`, `city`, `postal_address`, `designation`, `department`, `orcid`, `bio`, `website_url`
- ORCID format validation constraint (basic format check: 0000-0000-0000-0000)
- Website URL format validation constraint
- Indexes for ORCID and country-based lookups

**New SECURITY DEFINER database functions**:
- `get_profile_completeness()` — Calculate profile completion percentage and identify missing fields
- `get_author_manuscript_summary()` — Comprehensive summary of manuscripts where user is submitting author or co-author
- `get_author_action_items()` — Aggregate action items requiring author attention (revisions, proofs, invitations)

**New service layer** (`src/services/profileService.js`):
- Profile CRUD operations with proper error handling
- Profile completeness calculation and validation
- Author manuscript summary retrieval
- Action items aggregation
- Co-author invitation management
- Publication tracking for authors
- ORCID and website URL validation utilities

**New route and UI**:
- `/profile` — Author Profile page with comprehensive workspace functionality
- Profile header with avatar, professional information, and completeness indicator
- Editable profile form with validation for professional information
- Manuscript workspace with status-based filtering and role indicators
- Action required section with priority-based action items
- Publications section with author role and contribution display
- Integration with existing Navbar for easy access

**Security and RLS**:
- Profile operations protected by existing `profiles` RLS policies (users can only update their own profile)
- Manuscript data access follows existing RLS policies from previous phases
- All new database functions use SECURITY DEFINER for proper permission checks
- Email field remains read-only (controlled by Supabase Auth)
- Profile changes do not affect historical manuscript authorship data

**Backward compatibility**:
- All new profile fields are optional and nullable
- Existing profiles without new fields display gracefully with "Add" prompts
- Existing manuscript workflow and submission process remain fully functional
- Existing MySubmissionsPage continues to work as before
- No changes to existing RLS policies or database constraints

**Previous Phase 8 complete: Production Workflow (Phase 2 - Typesetting, Author Proof, Corrections, Final Approval).**

The production workflow has been extended from "Ready For Typesetting" through the complete scholarly publishing lifecycle:

```
manuscripts.status = 'accepted'   (unchanged — set by apply_editor_decision(), 0004)
      |
      | trigger: create_production_record() creates a manuscript_production
      | row automatically, plus a production_metadata snapshot copied from
      | the manuscript's current version
      v
accepted -> copyediting -> metadata_verification -> ready_for_typesetting
      |            |                |                        |
      |            |                |                (metadata_verified
      |            |                |                 must be true to
      |            |                |                 enter this stage)
      `- advance_production_status() enforces this exact forward-only
         sequence server-side; each transition logs a production_events row

ready_for_typesetting -> typesetting -> author_proof -> proof_corrections
                                            |              |
                                            |              v
                                            |        (corrections resolved)
                                            |              |
                                            v              v
                                    final_proof_approval -> publication_ready
```

This completes the production workflow with scholarly publishing best practices:
- **Proof versioning** — immutable versioned proof files with historical preservation
- **Author proof review** — authors can review proofs and submit corrections
- **Proof correction workflow** — structured correction request and resolution system
- **Final proof approval** — explicit author approval before publication
- **Publication ready state** — distinct from "published" — indicates production completion

- **New tables** (additive migration, `supabase/migrations/0012_production_workflow_phase2.sql`):
  - `proof_versions` — immutable versioned proof files with version numbers, file metadata, and audit trail
  - `proof_correction_requests` — author-submitted correction requests with status tracking (open/in_review/resolved/rejected)
- **Extended tables**:
  - `manuscript_production` — added new status values (typesetting, author_proof, proof_corrections, final_proof_approval, publication_ready), new timestamp columns, typesetter assignment, and current proof version reference
  - `publication_files` — removed unique constraint to support multiple versions per publication, added file_purpose and proof_version_id columns
- **New SECURITY DEFINER database functions**:
  - `start_typesetting()` — transition from ready_for_typesetting to typesetting with typesetter assignment
  - `upload_proof_version()` — upload new proof version with automatic version numbering
  - `issue_author_proof()` — transition from typesetting to author_proof (requires proof to exist)
  - `submit_proof_corrections()` — author submits correction requests (author_proof -> proof_corrections)
  - `resolve_proof_correction()` — production staff resolves a correction request
  - `reject_proof_correction()` — production staff rejects a correction request
  - `approve_final_proof()` — author approves final proof (author_proof -> final_proof_approval)
  - `mark_publication_ready()` — transition from final_proof_approval to publication_ready
  - `return_to_typesetting()` — return to typesetting after corrections resolved (proof_corrections -> typesetting)
  - `get_current_proof_version()` — retrieve current proof for author viewing
  - `get_proof_corrections()` — retrieve correction requests for a manuscript
  - `get_proof_history()` — retrieve all proof versions for a manuscript
- **Extended RLS policies**:
  - Authors can read their own production records (read-only)
  - Authors can read their own proof versions
  - Authors can read and submit their own correction requests
  - Editors/admins retain full production control
- **Extended service layer** (`src/services/productionService.js`):
  - Added all new RPC function wrappers
  - Extended stats to include new workflow stages
  - Extended production record mapping to include new fields
- **Extended data layer** (`src/data/productionStatus.js`):
  - Added new status metadata and badges for all workflow stages
  - Extended action labels and filter options
  - Added new production event labels
- **Extended UI components**:
  - `TypesettingPanel` — typesetter assignment, proof upload, proof history, issue author proof
  - `AuthorProofPanel` — proof viewing, correction submission, final approval
  - `ProofCorrectionsPanel` — correction review and resolution, return to typesetting
  - `PublicationReadyPanel` — publication checklist and final verification
  - Enhanced `MySubmissionsPage` — authors can view production status and proof information for their accepted manuscripts
  - Enhanced `ProductionDashboardPage` — displays typesetter assignment and new status counts
- **Storage architecture**:
  - Reuses existing `publications` storage bucket
  - Uses deterministic path convention: `publications/{manuscript_id}/production/proofs/{version}/proof.pdf`
  - Proof files protected by RLS (not publicly accessible until published)
- **Intentionally not built yet**: DOI/Crossref registration, volume/issue assignment, scheduled publication, public Research Library publication from manuscripts, and any notification system — all deferred to a future phase per the original scope.

See `SUPABASE_SETUP.md` for the full schema/RLS reference and the complete production-workflow testing checklist.

---

**Previous phase — Phase 7: Production Workflow (first half).**

The post-acceptance production workflow existed for copyediting and metadata verification through "Ready For Typesetting", establishing the foundation for the complete production pipeline.

---

**Previous phase — Phase 6: Revision Management.**

The post-peer-review editorial decision now exists, along with full
manuscript versioning and an author-facing revision-and-resubmit loop —
the pipeline no longer dead-ends at `under_peer_review`:

```
under_peer_review
      |
Editor records a decision (editor_decisions row)
      |-- Accept          -> accepted
      |-- Reject           -> rejected
      |-- Minor Revision   -> minor_revision_requested  (+ revision_requests row)
      `-- Major Revision   -> major_revision_requested  (+ revision_requests row)
                                    |
                          Author reviews the decision letter + non-
                          confidential reviewer comments, submits a
                          revised manuscript + response letter
                                    |
                          -> new manuscript_versions row (never overwrites)
                          -> manuscripts row updated, status: revision_submitted
                          -> author_responses row created
                                    |
                          Editor records the NEXT decision, or sends the
                          manuscript back to reviewers for another round
```

- **New tables** (additive migration, `supabase/migrations/0004_revision_management.sql`):
  - `manuscript_versions` — immutable snapshot per version; the live
    `manuscripts` row's content columns always mirror the current version,
    so every existing page needed zero changes. No UPDATE/DELETE policy
    exists for anyone — versions are append-only by design.
  - `editor_decisions` — append-only log of every post-review decision
    (`accept` / `minor_revision` / `major_revision` / `reject`), with a
    decision letter, an editor-written reviewer-feedback summary, author
    instructions, and a revision deadline. `editor_id`/`version_id`/
    `created_at` are stamped server-side.
  - `revision_requests` — the author's actionable task, auto-created by a
    trigger whenever a minor/major decision is recorded; tracks
    `pending` -> `submitted`.
  - `author_responses` — the response letter + general notes + which new
    version they accompany.
  - `manuscript_events` — one row per status change, logged automatically;
    powers the author's timeline with real per-stage timestamps instead of
    a single overwritten column, and is a ready-made hook for a future
    notification system.
- `manuscripts` gains three new statuses (`minor_revision_requested`,
  `major_revision_requested`, `revision_submitted`) **alongside** the
  existing `revision_requested` (still used, unchanged, by pre-review
  editorial screening) and a `current_version_id` column. `review_assignments`
  gains a `version_id` column so editors always know which version a
  reviewer evaluated.
- Two new `SECURITY DEFINER` database functions:
  - `submit_manuscript_revision()` — the single atomic entry point an
    author calls to resubmit: creates the new version, updates the live
    manuscript, logs the response, and closes the revision request, after
    independently verifying the caller owns the manuscript and the request
    is still pending.
  - `get_author_visible_reviews()` — the only path by which an author ever
    sees anything derived from `reviews`. Returns only the recommendation
    and non-confidential comments for the relevant review round — never
    reviewer identity, never scores, never `comments_to_editor`. There is
    still no direct `SELECT` policy on `reviews` for authors.
- **`src/services/revisionService.js`** (new) — the only module that
  queries the five new tables: `recordEditorDecision`,
  `getDecisionsForManuscript`, `getVersionsForManuscript`,
  `getPendingRevisionRequest`, `getRevisionRequestsForManuscript`,
  `getAuthorVisibleReviews`, `submitManuscriptRevision`,
  `getAuthorResponseForRevisionRequest`, `getManuscriptTimeline`.
- **`/admin/submissions/:id` extended** with an "Editorial decision" panel
  (shown once `under_peer_review` or `revision_submitted`), a "Version
  history" panel, and a "Decision history" panel showing every past
  decision alongside the matching author response, if any.
- **New route `/my-submissions/:id`** (`SubmissionDetailPage.jsx`) — the
  author's full timeline (built from `manuscript_events`) plus every past
  editorial decision, with a CTA into the revision form when one is owed.
- **New route `/my-submissions/:id/revise`** (`RevisionSubmitPage.jsx`) —
  shows the editor's decision letter/instructions/deadline and the
  non-confidential reviewer comments, then a pre-filled form to submit the
  revised manuscript, response letter, and general notes.
- **`src/data/editorDecisionStatus.js`** (new) — shared label/badge
  metadata for the four decision types, same pattern as
  `manuscriptStatus.js`/`reviewStatus.js`.
- `MySubmissionsPage` links every submission into the new detail page and
  shows a "Submit revision →" shortcut when one is owed.
- **Intentionally not built yet** (see roadmap below): reviewer due-date
  enforcement/reminders, reviewer expertise/specialty matching, a
  one-click "send back to the same reviewers" shortcut (the architecture
  supports it, but the UI still re-picks from the same dropdown), and
  everything in the publication phase (DOI, volumes/issues, notifications).

See `SUPABASE_SETUP.md` for the full schema/RLS reference and the complete
revision-management testing checklist.

---

**Previous phase — Phase 5: Peer Review system.**

A manuscript sent to peer review (`under_peer_review`) can now be assigned
to one or more reviewers, who accept/decline, submit a structured review,
and have that review appear on the editor's dashboard — a real multi-
reviewer workflow resembling Editorial Manager / ScholarOne / OJS, not a
comments box:

```
Editor sends manuscript to peer review (under_peer_review)
      |
Editor assigns reviewer(s)         -> review_assignments (status: assigned)
      |
Reviewer: Accept / Decline         -> status: accepted | declined
      |
Reviewer submits structured review -> reviews row created
                                       assignment status -> submitted
      |
Editor sees every review's scores, recommendation, and comments,
plus a computed per-score average, on the manuscript's detail page
      |
(editorial decision after peer review — not built yet, see below)
```

- **Roles** extended safely to add `reviewer` alongside the existing
  `author` / `editor` / `admin` — the `profiles.role` check constraint was
  widened, not replaced; no existing user's role changed.
- **New tables** (additive migration, `supabase/migrations/0003_peer_review.sql`):
  - `review_assignments` — one row per (manuscript, reviewer): who assigned
    it, when, and its status (`assigned` / `accepted` / `declined` /
    `submitted` / `expired`). `assigned_by` and all status timestamps are
    stamped **server-side** by triggers, never trusted from the client.
  - `reviews` — one row per submitted review, linked 1:1 to its assignment
    via a `unique` constraint on `assignment_id` (this is what makes a
    duplicate submission impossible at the database level, not just the
    UI). Reviews are never stored inside `manuscripts` — a manuscript
    supports any number of independent reviews.
  - A new `manuscripts` SELECT policy lets a reviewer read only manuscripts
    they're actually assigned to; every existing manuscripts policy is
    unchanged.
  - `set_user_role()` — a `SECURITY DEFINER` function that lets an
    editor/admin grant the `reviewer` role to another user by email,
    without opening a general "editors can edit any profile" RLS policy.
- **`src/services/reviewService.js`** (new) — the only module that queries
  `review_assignments`/`reviews`: `assignReviewer`, `acceptReviewAssignment`,
  `declineReviewAssignment`, `submitReview`, `getReviewerDashboard`,
  `getAssignmentsForManuscript`, `getReviewsForEditor` (also computes
  per-score averages), `getReviewerCandidates`, and more.
- **`src/services/userService.js`** (new) — `promoteToReviewer(email)` /
  `setUserRole()`, wrapping the `set_user_role()` RPC call.
- **New route `/reviewer`** (`ReviewerDashboardPage.jsx`) — Assigned /
  Accepted / Completed tabs with stat cards, Accept/Decline/Start Review
  actions on each assignment card.
- **New route `/reviewer/review/:assignmentId`** (`ReviewFormPage.jsx`) — a
  full structured review form: overall recommendation (Accept / Minor
  Revision / Major Revision / Reject), six 1–5 scores (originality,
  methodology, statistical quality, clinical relevance, writing quality,
  ethical compliance), major comments (required), minor comments and
  comments-to-editor (optional), and a confidential flag. Validates
  required fields client-side; the database independently enforces
  everything that actually matters for integrity (ownership, assignment
  status, no duplicates).
- **`/admin/submissions/:id` extended** (not replaced) with a "Peer review"
  panel, shown once a manuscript is `under_peer_review` or later: assign a
  reviewer from a dropdown of everyone holding the `reviewer` role (already
  -assigned reviewers are excluded), see live assignment status per
  reviewer, and once reviews come in, see each one's scores, recommendation,
  and comments — plus a computed average per score across all reviewers.
  Confidential reviews are visibly badged. Author-facing pages are
  completely untouched by this — authors still see only their manuscript's
  status.
- **`/admin` dashboard extended** with a "Reviewer management" panel:
  editors/admins can grant the `reviewer` role to an existing user by email
  (no direct database access needed for this specific step) and see the
  current reviewer roster.
- **`src/data/reviewStatus.js`** (new) — shared label/badge metadata for
  assignment statuses and review recommendations, same pattern as
  `manuscriptStatus.js`.
- Navbar shows a "Reviewer" link for users with the `reviewer` role;
  `/reviewer` and `/reviewer/review/:assignmentId` are role-protected via
  the existing `ProtectedRoute` (`reviewer`/`editor`/`admin`).
- **Intentionally not built yet** (see roadmap below): the post-review
  editorial decision that would move a manuscript out of
  `under_peer_review`, a formal re-review/revision cycle, reviewer due
  dates (Reviewer Dashboard shows a labeled placeholder, not a real
  deadline), and reviewer expertise/specialty matching.

See `SUPABASE_SETUP.md` for the full schema/RLS reference and the complete
peer-review testing checklist.

---

**Previous phase — Phase 4: Editorial Screening workflow.**

The manuscript pipeline now has a real editorial-screening stage between
submission and peer review, instead of a single pending → approve/reject
step:

```
Author submits
      |
Editorial Screening   ("submitted" / "editorial_review")
      |-- Reject                 -> rejected
      |-- Request Revision       -> revision_requested
      `-- Send to Peer Review    -> under_peer_review
                                        |
                                  (peer review stage - not built yet)
                                        |
                                  accepted -> published
```

- `manuscripts.status` now supports 7 values: `submitted`, `editorial_review`,
  `revision_requested`, `under_peer_review`, `accepted`, `rejected`,
  `published`. Existing data was migrated automatically and non-destructively
  (`pending` -> `editorial_review`, `approved` -> `published`; `rejected`
  rows were left as-is) — see `supabase/migrations/0002_editorial_screening.sql`.
- New columns: `screening_notes` (the editor's note, shown to the author for
  revision requests and rejections) and `reviewed_by` (uuid referencing
  `auth.users`). Both `reviewed_by` and `reviewed_at` are stamped
  **server-side** by a trigger the moment status changes to a decision
  state — the client never sends them, so a decision can't be misattributed.
- `src/services/manuscriptService.js` gained `updateEditorialDecision(id, { decision, notes })`
  (`decision` is `'peer_review' | 'revision' | 'reject'`), an alias
  `getEditorialSubmissions` for `getSubmissions`, batched submitting-author/
  reviewer name lookups against `profiles`, and an updated
  `getSubmissionStats()` shape (`total`, `awaitingScreening`,
  `revisionRequested`, `underPeerReview`, `accepted`, `rejected`).
- `/admin` is now a real editorial dashboard: 6 summary stat cards, status
  filter chips, and a manuscript list (title, authors, type, category,
  submitting author, submitted date, status, last editorial action) that
  links out to a full detail view rather than expanding inline.
- New route `/admin/submissions/:id` (`AdminSubmissionDetailPage.jsx`) — a
  readable manuscript view with the 3 screening actions (Send to Peer
  Review / Request Revision / Reject), each requiring confirmation, with a
  notes field required for revision/rejection. Protected the same way as
  `/admin` (`editor`/`admin` role only).
- `src/data/manuscriptStatus.js` is a new shared module for status labels
  and badge styling, used by the dashboard, the detail page, and
  `MySubmissionsPage` so they never disagree on how a status is displayed.
- `MySubmissionsPage` shows the new statuses and now surfaces the editor's
  `screening_notes` to the author when a manuscript is sent back for
  revision or rejected.
- The public Research Library's visibility rule changed from
  `status = 'approved'` to `status = 'published'` (RLS policy updated to
  match) — behavior for readers is unchanged, only the underlying label.
  `src/services/articleService.js` needed no changes.
- Reviewer assignment and the full peer-review stage are intentionally
  **not** built yet — `under_peer_review` is a holding state for now, with
  no further action available from the admin dashboard.

See `SUPABASE_SETUP.md` for the full schema/RLS reference, the manual
migration step required in the Supabase dashboard, and the testing
checklist.

## Database Tables

**public.profiles** — one row per user, linked 1:1 to auth.users.
Columns: id (PK, references auth.users), full_name, email, avatar_url, role (`author` default | `editor` | `admin`), institution, created_at, updated_at.
RLS: readable by any authenticated user; insert/update restricted to your own row; a trigger prevents changing your own role unless you're already an editor/admin.

**public.manuscripts** — manuscript submissions.
Columns: id (PK), submitting_author_id (references auth.users), title, abstract, authors, category, article_type, content, keywords, institution, corresponding_email, references, status (`draft` | `editorial_review` default | `submitted` | `revision_requested` | `under_peer_review` | `minor_revision_requested` | `major_revision_requested` | `revision_submitted` | `accepted` | `rejected` | `published`), screening_notes, reviewed_by (references auth.users), current_version_id (references manuscript_versions), submitted_at, reviewed_at, created_at, updated_at.
RLS: authors can insert/read their own rows; editors/admins can read and update all rows (only they can change status/screening_notes — authors have no update policy at all); the public can read only `published` rows. `reviewed_by`/`reviewed_at` are set by a server-side trigger whenever status changes to a decision state, never trusted from the client. Content columns always mirror `current_version_id`'s snapshot — updated only via `submit_manuscript_revision()`. New `draft` status supports incomplete submissions before final submission.

**public.review_assignments** — one row per (manuscript, reviewer) invitation.
Columns: id (PK), manuscript_id (references manuscripts), reviewer_id (references auth.users), assigned_by (references auth.users, stamped server-side), assigned_at, accepted_at, declined_at, completed_at, status (`assigned` default | `accepted` | `declined` | `submitted` | `expired`), version_id (references manuscript_versions, auto-filled from the manuscript's current version at assignment time), created_at, updated_at.
RLS: a reviewer can read/update only their own assignment (accept/decline); editors/admins can read/insert/update all (assigning reviewers is insert-only for editors/admins). All timestamps and `assigned_by` are stamped by triggers, never trusted from the client.

**public.reviews** — one row per submitted review; a manuscript can have many.
Columns: id (PK), manuscript_id (references manuscripts, auto-filled from the assignment), assignment_id (references review_assignments, **unique** — enforces one review per assignment), reviewer_id (references auth.users), overall_recommendation (`accept` | `minor_revision` | `major_revision` | `reject`), originality_score, methodology_score, statistical_quality_score, clinical_relevance_score, writing_quality_score, ethical_compliance_score (all smallint 1–5), major_comments, minor_comments, comments_to_editor, confidential (boolean), submitted_at, updated_at.
RLS: a reviewer can read/insert/update only their own review; editors/admins can read all; authors have no policy at all (default-deny, so reviewer identities and review content can never reach an author through any client — the only exception is the narrow `get_author_visible_reviews()` function described below). A trigger validates every insert against the assignment (must belong to the reviewer, must be `accepted`) before allowing it, and a second trigger marks the assignment `submitted` afterward.

**public.manuscript_versions** — immutable snapshot per manuscript version; never overwritten or deleted.
Columns: id (PK), manuscript_id (references manuscripts), version_number (int, unique per manuscript), title, abstract, authors, content, keywords, references, submitted_by (references auth.users), created_at.
RLS: the manuscript's author can read every version of their own manuscript; a reviewer can read every version of any manuscript they have an assignment for; editors/admins can read all. No INSERT/UPDATE/DELETE policy exists for anyone — rows are created only by server-side triggers/functions.

**public.editor_decisions** — append-only log of every post-peer-review editorial decision.
Columns: id (PK), manuscript_id (references manuscripts), version_id (references manuscript_versions, auto-filled), editor_id (references auth.users, stamped server-side), decision (`accept` | `minor_revision` | `major_revision` | `reject`), decision_letter, reviewer_summary, author_instructions, revision_deadline (date), created_at.
RLS: the manuscript's author can read every decision on their own manuscript (safe — all text fields are editor-written); editors/admins can insert and read all. A trigger stamps `editor_id`/`version_id`/`created_at` and re-checks `is_editor_or_admin()` server-side; a second trigger moves the manuscript's status and, for a revision decision, creates the matching `revision_requests` row.

**public.revision_requests** — the author's actionable task, auto-created from a minor/major decision.
Columns: id (PK), manuscript_id (references manuscripts), editor_decision_id (references editor_decisions), version_id (references manuscript_versions), revision_type (`minor` | `major`), deadline (date), status (`pending` default | `submitted`), created_at, submitted_at.
RLS: the manuscript's author can read their own; editors/admins can read all. No client-facing INSERT/UPDATE policy — rows are created by `apply_editor_decision()` and closed out by `submit_manuscript_revision()`.

**public.author_responses** — the author's response letter + which new version it accompanies.
Columns: id (PK), revision_request_id (references revision_requests), manuscript_id (references manuscripts), new_version_id (references manuscript_versions, not null), response_letter (not null), general_notes, submitted_by (references auth.users), submitted_at.
RLS: the manuscript's author can read their own; a reviewer with an active assignment on that manuscript can read it too; editors/admins can read all. No client-facing INSERT policy — created only by `submit_manuscript_revision()`.

**public.manuscript_events** — one row per manuscript status change, logged automatically.
Columns: id (PK), manuscript_id (references manuscripts), status, actor_id (references auth.users), created_at.
RLS: the manuscript's author can read their own manuscript's events; editors/admins can read all. No client-facing INSERT/UPDATE/DELETE policy — rows are created only by a trigger on `manuscripts` insert/update.

**public.manuscript_production** — one row per manuscript, created automatically when `manuscripts.status` becomes `accepted`.
Columns: id (PK), manuscript_id (references manuscripts, **unique**), production_status (`accepted` default | `copyediting` | `metadata_verification` | `ready_for_typesetting`), production_editor_id (references auth.users), copyeditor_id (references auth.users), metadata_verified (boolean, default false), entered_production_at, copyediting_completed_at, metadata_verified_at, ready_for_typesetting_at, created_at, updated_at.
RLS: no policy for authors or reviewers at all (default-deny); editors/admins can read/insert/update. Created by the `create_production_record()` trigger; `production_status` changes only through `advance_production_status()`, which enforces the fixed forward-only sequence and requires `metadata_verified = true` before allowing entry into `ready_for_typesetting`.

**public.production_metadata** — the publication-facing metadata record; explicitly not the scientific manuscript.
Columns: id (PK), manuscript_id (references manuscripts, **unique**), title, running_title, abstract, keywords, author_order (jsonb array of `{ name, isCorresponding }`), affiliations (jsonb array of strings), corresponding_author_name, corresponding_author_email, updated_by (references auth.users), created_at, updated_at.
RLS: no policy for authors or reviewers at all (default-deny); editors/admins can read/insert/update. Pre-filled from the manuscript's current version by the same trigger that creates the production record. Edited only through `update_production_metadata()`, which also resets `metadata_verified` back to false.

**public.production_events** — one row per production status change or staff assignment, logged automatically.
Columns: id (PK), manuscript_id (references manuscripts), event_type (e.g. `entered_production`, `staff_assigned`, `copyediting_started`, `copyediting_completed`, `metadata_updated`, `metadata_verified`, `metadata_unverified`, `ready_for_typesetting`), production_status, actor_id (references auth.users), note, created_at.
RLS: no policy for authors or reviewers at all (default-deny); editors/admins can read/insert. Kept as a dedicated table rather than merged into `manuscript_events` since production is an editor/admin-only workspace.

**public.publications** — publication-level record for imported articles and future manuscript-produced articles.
Columns: id (PK), source_type (`imported` | `manuscript`), manuscript_id (references manuscripts, nullable), title, abstract, authors, affiliations, corresponding_author_name, corresponding_author_email, keywords, article_type, category, doi, journal_name, volume, issue, page_range, publication_date, publication_status (`draft` default | `published`), published_at, published_by (references auth.users), created_by (references auth.users), created_at, updated_at, extracted_text, extraction_status, extraction_error, rejected_at, rejected_by (references auth.users).
RLS: anonymous/authenticated users can read only `published` rows; editors/admins can read/insert/update all rows. Created by `create_imported_publication()` RPC; status changes only through `publish_publication()` and `reject_publication()` RPCs.

**public.publication_files** — metadata for uploaded article files (PDF/DOCX); actual files stored in Supabase Storage.
Columns: id (PK), publication_id (references publications, unique), file_name, file_type, file_size_bytes, storage_path (Supabase Storage path), file_hash (SHA-256), uploaded_by (references auth.users), uploaded_at.
RLS: anonymous/authenticated users can read files only for `published` publications; editors/admins can read/insert/update all rows. Created by `upload_publication_file()` RPC with upsert support.

**public.publication_events** — append-only audit trail for publication actions.
Columns: id (PK), publication_id (references publications), event_type (`imported` | `metadata_updated` | `file_uploaded` | `published` | `unpublished`), actor_id (references auth.users), note, created_at.
RLS: editors/admins can read/insert all rows. No client-facing INSERT/UPDATE/DELETE policy — rows created only by RPC functions.

**public.manuscript_authors** — individual author records for each manuscript with structured authorship information.
Columns: id (PK), manuscript_id (references manuscripts), profile_id (references auth.users, nullable), first_name, middle_name, last_name, email, orcid, author_order (int, unique per manuscript), is_corresponding_author (boolean), is_submitting_author (boolean), invitation_status (`pending` | `invited` | `accepted` | `declined` | `revoked` | `confirmed`), invitation_token, invitation_sent_at, invitation_expires_at, responded_at, contribution_statement, created_at, updated_at.
RLS: submitting authors can read/insert/update/delete their manuscript's authors during draft/submitted/editorial_review; editors/admins have full access; confirmed co-authors can read their own records. Constraints enforce unique author order and single corresponding author per manuscript.

**public.manuscript_affiliations** — reusable institutional affiliation records per manuscript.
Columns: id (PK), manuscript_id (references manuscripts), institution_name, department, division, city, state_province, country, postal_code, address, created_at, updated_at.
RLS: submitting authors can read/insert/update their manuscript's affiliations during draft/submitted/editorial_review; editors/admins have full access.

**public.manuscript_author_affiliations** — many-to-many relationship between authors and affiliations.
Columns: id (PK), author_id (references manuscript_authors), affiliation_id (references manuscript_affiliations), created_at.
RLS: submitting authors can read/insert their manuscript's author-affiliation relationships during draft/submitted/editorial_review; editors/admins have full access.

**public.author_contributions** — CRediT-style contribution types per author.
Columns: id (PK), author_id (references manuscript_authors), contribution_type (`conceptualization` | `methodology` | `investigation` | `data_curation` | `formal_analysis` | `software` | `validation` | `visualization` | `writing_original_draft` | `writing_review_editing` | `supervision` | `project_administration` | `funding_acquisition` | `resources` | `ethics_approval`), created_at.
RLS: submitting authors can read/insert their manuscript's author contributions during draft/submitted/editorial_review; editors/admins have full access.

**public.authorship_change_log** — audit trail for authorship changes after initial submission.
Columns: id (PK), manuscript_id (references manuscripts), change_type (`author_added` | `author_removed` | `author_order_changed` | `corresponding_author_changed` | `affiliation_changed` | `invitation_sent` | `invitation_accepted` | `invitation_declined`), author_id (references manuscript_authors), previous_value (jsonb), new_value (jsonb), reason, changed_by (references auth.users), created_at.
RLS: submitting authors can read change logs for their manuscripts; editors/admins can read all. INSERT restricted to system via SECURITY DEFINER functions.

## Supabase Storage

**Storage Bucket: `publications`** — stores uploaded article files (PDF/DOCX) for the publication import system.
⚠️ **CRITICAL**: This bucket must be created manually in the Supabase dashboard (Storage → Buckets → Create new bucket → name: `publications` → Public). Storage buckets cannot be created via SQL migrations.
File path structure: `{publication_id}/original.{extension}` (e.g., `abc-123-def/original.pdf`).
Storage RLS policies (applied via migration 0011):
- Public/authenticated users can read files (database RLS enforces only published publication files are accessible)
- Only editors/admins can upload/delete files (enforced via `is_editor_or_admin()` check)
See `SUPABASE_STORAGE_SETUP.md` for detailed setup instructions.

**public.profiles.role** now also accepts `reviewer` (in addition to `author` | `editor` | `admin`). Granting it is done via the `set_user_role()` database function (editor/admin callers only), exposed in-app through the "Reviewer management" panel on `/admin`.

Full schema + RLS policy SQL lives in `supabase/migrations/0001_auth_and_manuscripts.sql` (base tables), `supabase/migrations/0002_editorial_screening.sql` (editorial screening additions), `supabase/migrations/0003_peer_review.sql` (peer review additions), `supabase/migrations/0004_revision_management.sql` (revision management additions), `supabase/migrations/0005_production_workflow.sql` (production workflow additions), `supabase/migrations/0012_production_workflow_phase2.sql` (typesetting through publication_ready), `supabase/migrations/0013_proof_storage_security.sql` (storage security updates), `supabase/migrations/0014_manuscript_authorship_system.sql` (structured authorship system), and `supabase/migrations/0015_author_profile_enhancements.sql` (author profile and workspace — run all migrations, in order, manually in the Supabase SQL Editor for existing projects).

## Important Rules

1. Do not rewrite working features unnecessarily.
2. Do not change the tech stack without asking.
3. Do not delete existing functionality.
4. Keep components reusable.
5. Keep the application beginner-friendly.
6. Before making major changes, explain the plan.
7. Modify only files relevant to the current task.
