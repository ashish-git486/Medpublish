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
│   └── migrations/    # Database migrations (0011+)
├── AGENTS.md          # This file
├── PROJECT_CONTEXT.md # Project overview and status
└── SUPABASE_STORAGE_SETUP.md # Storage setup guide
```

## Domain Services

Each domain has a dedicated service that handles all database queries:

- `manuscriptService.js` - Manuscript submissions and versions
- `reviewService.js` - Peer review assignments and reviews
- `productionService.js` - Production workflow (including proof versioning and corrections)
- `publicationService.js` - Publication import system
- `revisionService.js` - Revision submissions

**Never duplicate query logic across files.** Always use the appropriate service.

## Current Status

- Phase 7: Production Workflow (first half) - Complete
- Phase 8: Production Workflow (Phase 2 - Typesetting, Author Proof, Corrections, Final Approval) - Complete
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
