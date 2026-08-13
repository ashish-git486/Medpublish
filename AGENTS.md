# MedPublish - Agent Setup Instructions

This file contains setup instructions and development guidelines for AI agents working on the MedPublish project.

## Initial Setup Requirements

Before working on this project, ensure the following are configured:

### 1. Supabase Project Setup

- Database migrations have been applied (0001-0011)
- Authentication is configured
- Row Level Security (RLS) policies are in place

### 2. ⚠️ CRITICAL: Supabase Storage Bucket Setup

The publication import feature requires a storage bucket that **must be created manually**:

1. Go to Supabase Dashboard → Storage → Buckets
2. Click "Create a new bucket"
3. Name it: `publications`
4. Make it **Public**
5. Click "Create bucket"
6. Run migration `0011_storage_bucket_setup.sql` to apply RLS policies

**This step cannot be automated via SQL migrations.** If the storage bucket doesn't exist, the Article Import feature will fail with "Publication must have an associated file" error.

### 3. Environment Variables

Ensure `.env.local` exists with:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Development Guidelines

### Code Style

- Follow existing patterns in the codebase
- Use existing services (don't duplicate query logic)
- Return `{ data, error }` from service functions
- Use SECURITY DEFINER database functions for sensitive operations
- Never expose service-role keys in frontend code

### Database Changes

- Always create new migrations (never edit old ones)
- Use `if not exists` / `create or replace` for idempotency
- Keep migrations additive (don't drop tables/data)
- Update PROJECT_CONTEXT.md when adding new tables
- Latest migration: 0015_author_profile_enhancements.sql (author profile and workspace)

### Testing

- Run `npm run build` before committing
- Test critical paths end-to-end
- Use diagnostic tools in the project root:
  - `diagnostic_publication_check.js` - Check publication_files state
  - `storage_test.js` - Verify storage bucket access

### Common Patterns

#### Service Layer Pattern
```javascript
// Services return { data, error } for proper error handling
export async function getSomething() {
  const { data, error } = await supabase
    .from('table')
    .select('*')
  
  if (error) return { data: null, error }
  return { data, error: null }
}
```

#### SECURITY DEFINER Functions
```sql
-- Always use SECURITY DEFINER for sensitive operations
create or replace function public.do_something()
returns ...
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify role
  if not public.is_editor_or_admin() then
    raise exception 'Unauthorized';
  end if;
  
  -- Do work
  ...
end;
$$;
```

## Project Structure

```
medpublish/
├── src/
│   ├── components/     # Reusable React components
│   ├── data/          # Static data and enums
│   ├── lib/           # Supabase client and utilities
│   ├── routes/        # Page components
│   ├── services/      # API service layer (one per domain)
│   └── utils/         # Utility functions
├── supabase/
│   └── migrations/    # Database migrations (0014+)
├── AGENTS.md          # This file
├── PROJECT_CONTEXT.md # Project overview and status
└── SUPABASE_STORAGE_SETUP.md # Storage setup guide
```

## Authorship System (Phase 9)

The structured authorship system provides real medical journal authorship capabilities:

### Database Tables
- `manuscript_authors` - Individual author records with ordering, roles, and invitation status
- `manuscript_affiliations` - Reusable institutional affiliations
- `manuscript_author_affiliations` - Many-to-many author-affiliation relationships
- `author_contributions` - CRediT-style contribution types
- `authorship_change_log` - Audit trail for authorship changes

### Key Features
- **Explicit author ordering** - No reliance on database insertion order
- **Corresponding author enforcement** - Database constraint ensures exactly one corresponding author
- **Co-author invitations** - Secure token-based invitation workflow
- **Affiliation sharing** - Multiple authors can share the same institutional affiliation
- **Contribution tracking** - CRediT taxonomy for standardized author role disclosure
- **Change audit trail** - All authorship changes are logged for compliance

### Service Functions
Use `authorshipService.js` for all authorship operations:
- `getManuscriptAuthors()` - Get authors with affiliations and contributions
- `addManuscriptAuthor()` - Add new author with validation
- `updateManuscriptAuthor()` - Update author information
- `removeManuscriptAuthor()` - Remove author with audit logging
- `inviteCoAuthor()` - Generate invitation token
- `acceptCoAuthorInvitation()` - Accept co-author invitation
- `setAuthorContributions()` - Set CRediT contribution types

### Database Functions
SECURITY DEFINER functions handle permission checks and constraints:
- `add_manuscript_author()` - Server-side validation and constraint enforcement
- `update_manuscript_author()` - Permission-based updates with change logging
- `remove_manuscript_author()` - Secure removal with audit trail
- `get_manuscript_authors()` - Retrieve complete authorship data
- `invite_co_author()` - Generate secure invitation tokens
- `accept_co_author_invitation()` - Handle invitation acceptance
- `set_author_contributions()` - Update contribution types
- `backfill_manuscript_authorship()` - Migrate existing manuscripts

### RLS Policies
- Submitting authors can manage authorship during draft/submitted/editorial_review stages
- Editors/admins have full access for editorial control
- Confirmed co-authors can read their own author records
- All operations are protected by role-based access control

### Backward Compatibility
- Existing `manuscripts.authors` text field preserved
- Existing `manuscripts.submitting_author_id` relationship maintained
- Production workflow functions remain unchanged
- Existing submission process works without modification

## Author Profile & Author Workspace (Phase 10)

The author profile and workspace system provides a professional control center for authors:

### Extended Profile Fields
- `phone` - Professional contact number
- `country` - Country of residence or institution
- `city` - City of residence or institution
- `postal_address` - Full postal address for correspondence
- `designation` - Professional title or position (e.g., Professor, MD, PhD)
- `department` - Department or division within institution
- `orcid` - ORCID iD for author identification (format: 0000-0000-0000-0000)
- `bio` - Professional biography or research interests
- `website_url` - Personal or institutional website

### Key Features
- **Profile completeness tracking** - Visual indicator showing completion percentage with missing field guidance
- **Professional information management** - Structured fields for academic and professional identity
- **ORCID integration** - Format validation and display with ORCID profile links
- **Author manuscript workspace** - Unified view of manuscripts as submitting author or co-author
- **Action required dashboard** - Priority-based display of revision requests, proof reviews, and invitations
- **Publication tracking** - Dedicated section for published work with author roles
- **Production status integration** - Real-time workflow status for accepted manuscripts
- **Co-author invitation management** - Direct integration with invitation acceptance/decline

### Service Functions
Use `profileService.js` for all profile operations:
- `getMyProfile()` - Get current user's profile
- `updateMyProfile()` - Update current user's profile with validation
- `getProfileCompleteness()` - Calculate profile completion percentage
- `getAuthorManuscriptSummary()` - Get comprehensive manuscript summary
- `getAuthorActionItems()` - Get pending action items (revisions, proofs, invitations)
- `getMyPublications()` - Get published manuscripts where user is author
- `validateORCID()` - Validate ORCID format
- `validateWebsiteUrl()` - Validate website URL format

### Database Functions
SECURITY DEFINER functions handle profile operations:
- `get_profile_completeness()` - Calculate completion percentage and identify missing fields
- `get_author_manuscript_summary()` - Retrieve manuscripts where user is submitting author or co-author
- `get_author_action_items()` - Aggregate action items requiring author attention

### Route and UI
- `/profile` - Author Profile page with comprehensive workspace
- Profile header with avatar, professional information, and completeness indicator
- Editable profile form with validation for professional information
- Manuscript workspace with status-based filtering and role indicators
- Action required section with priority-based action items
- Publications section with author role and contribution display
- Navbar integration with avatar and profile link

### Security and RLS
- Profile operations protected by existing `profiles` RLS policies
- Users can only update their own profile information
- Email field remains read-only (controlled by Supabase Auth)
- Manuscript data access follows existing RLS policies from previous phases
- Profile changes do not affect historical manuscript authorship data

### Backward Compatibility
- All new profile fields are optional and nullable
- Existing profiles display gracefully with "Add" prompts
- Existing manuscript workflow and submission process remain fully functional
- Existing MySubmissionsPage continues to work as before
- No changes to existing RLS policies or database constraints

## Domain Services

Each domain has a dedicated service that handles all database queries:

- `manuscriptService.js` - Manuscript submissions and versions
- `reviewService.js` - Peer review assignments and reviews
- `productionService.js` - Production workflow (including proof versioning and corrections)
- `publicationService.js` - Publication import system
- `revisionService.js` - Revision submissions
- `authorshipService.js` - Structured authorship management (authors, affiliations, contributions, invitations)
- `profileService.js` - Author profile and workspace management (profile CRUD, completeness, manuscript summary, action items)
- `userService.js` - User management and role grants

**Never duplicate query logic across files.** Always use the appropriate service.

## Current Status

- Phase 7: Production Workflow (first half) - Complete
- Phase 8: Production Workflow (Phase 2 - Typesetting, Author Proof, Corrections, Final Approval) - Complete
- Phase 9: Submission & Authorship Management Foundation - Complete
- Phase 10: Author Profile & Author Workspace - Complete
- Publication Import System - Complete (storage bucket setup required)

See PROJECT_CONTEXT.md for detailed feature status.

## Troubleshooting

### Article Import Fails

If Article Import fails with "Publication must have an associated file":

1. Check if storage bucket exists: `node storage_test.js`
2. If bucket doesn't exist, create it manually in Supabase Dashboard
3. Run migration 0011 to apply storage policies
4. Verify with: `node diagnostic_publication_check.js`

### Database Query Errors

- Check RLS policies in the relevant migration
- Verify user has correct role (editor/admin)
- Check if SECURITY DEFINER function exists
- Review auth session status

### Build Errors

- Check for TypeScript errors (if applicable)
- Verify all imports are correct
- Ensure environment variables are set
- Run `npm install` if dependencies are missing

## Documentation

- `PROJECT_CONTEXT.md` - Overall project status and architecture
- `SUPABASE_STORAGE_SETUP.md` - Storage bucket setup guide
- `SUPABASE_SETUP.md` - Database schema reference
- Migration files contain inline documentation for each change
