# Forensic Analysis Report - Article Import Workflows

## Current Database State

### Publications
- **Total**: 1 publication
- **Published**: 1 (ID: `b765af99-e3db-4637-809b-01c977747465`)
- **Drafts**: 0 ⚠️ **NO DRAFTS FOUND**

### Publication Files
- **Total**: 1 publication_files row
- **File**: Stroke.docx
- **Associated with**: `b765af99-e3db-4637-809b-01c977747465` (the published publication)
- **Status**: Correctly associated

### Storage Objects
- **Total**: 2 storage folders
  1. `b765af99-e3db-4637-809b-01c977747465` → matches published publication
  2. `4361527b-14f0-4cb4-888e-7c37c8c30602` → ⚠️ **NO CORRESPONDING PUBLICATION**

### Publication Events
- **Total**: 0 events ⚠️ **SUSPICIOUS**
- Expected: At least 'imported' and 'file_uploaded' events for the published publication

## Critical Findings

### 1. No Drafts in Database
The user reported having a draft in Admin Library that fails to publish, but the database contains **ZERO draft publications**. This suggests:

- The draft may have already been published (explaining why it's now published)
- The draft may have been deleted
- There may be a UI caching issue showing stale data
- The user may be looking at a different Supabase project

### 2. Orphaned Storage Object
Storage folder `4361527b-14f0-4cb4-888e-7c37c8c30602` exists with no corresponding publication or publication_files row. This suggests:

- A failed import attempt
- A deleted publication without proper storage cleanup
- A test import that wasn't completed

### 3. Missing Publication Events
The published publication has **ZERO** publication_events, which is highly suspicious. The RPC functions should log:
- 'imported' event when create_imported_publication is called
- 'file_uploaded' event when upload_publication_file is called
- 'published' event when publish_publication is called

This suggests either:
- The RPC functions are not executing the event logging
- The events are being deleted
- There's a transaction rollback issue

### 4. RLS Query Inconsistency
The joined query pattern (used by Admin Library) showed `publication_files: NO` in the initial forensic analysis, but direct queries showed the file exists. However, re-testing showed the joined query DOES work correctly. This may have been a transient issue or authentication state problem.

## Working vs Failing Paths

### Working Path (Direct Publish)
Since there are no drafts currently, we cannot test the failing path. The only publication is already published via direct publish.

### Hypothesis for Failing Path
Based on the code analysis, the draft → Admin Library → Publish path should work identically to direct publish because:

1. Both use the same `handleUpload` function
2. Both create the publication via `createImportedPublication`
3. Both upload the file via `uploadPublicationFile`
4. Both use the same `publishPublication` function
5. No code path creates a second publication
6. No code path deletes publication_files

## Next Steps Required

To properly diagnose the failing path, we need:

1. **Create a new draft** via the import flow
2. **Navigate to Admin Library** (without publishing directly)
3. **Check the database state** to confirm the draft exists with file association
4. **Attempt to publish from Admin Library**
5. **Observe the error and diagnostic logs**

Without a current draft in the system, we cannot reproduce the reported failure.

## Recommendations

1. **Create a test draft** to reproduce the issue
2. **Add event logging** to verify RPC functions are executing completely
3. **Clean up orphaned storage** (`4361527b-14f0-4cb4-888e-7c37c8c30602`)
4. **Investigate missing events** - check if event logging is working in the RPC functions
5. **Verify authentication state** - the initial RLS query inconsistency may be related to auth

## Database Cleanup SQL

```sql
-- Clean up orphaned storage object (manual step required in Supabase Storage dashboard)
-- Delete folder: 4361527b-14f0-4cb4-888e-7c37c8c30602

-- Verify publication events are being logged
SELECT * FROM publication_events ORDER BY created_at DESC;
```
