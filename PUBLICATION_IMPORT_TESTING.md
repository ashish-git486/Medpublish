# Publication Import System - Testing Procedure

## Prerequisites

1. Apply database migration `supabase/migrations/0006_publication_import_system.sql`
2. Set up Supabase Storage bucket `publications` per `SUPABASE_STORAGE_SETUP.md`
3. Ensure dev server is running: `npm run dev`
4. Have editor/admin role test account available

## Test 1: Database Migration Verification

**Steps:**
1. Open Supabase SQL Editor
2. Run `SELECT * FROM public.publications LIMIT 5;`
3. Run `SELECT * FROM public.publication_files LIMIT 5;`
4. Run `SELECT * FROM public.publication_events LIMIT 5;`

**Expected:**
- All three tables exist and are empty
- No errors returned
- RLS policies are active

## Test 2: Admin Library Access

**Steps:**
1. Log in as editor/admin
2. Navigate to `/admin/library`
3. Verify page loads without errors

**Expected:**
- Library management page loads
- Statistics show: Total: 0, Draft: 0, Published: 0, Imported: 0
- "Import Article" button is visible
- Empty state message displayed

## Test 3: Import Wizard - File Upload

**Steps:**
1. Click "Import Article" button
2. Navigate to `/admin/library/import`
3. Try uploading an invalid file (e.g., .jpg)
4. Try uploading a valid PDF file
5. Try uploading a valid DOCX file
6. Try uploading a file > 50MB

**Expected:**
- Invalid file type shows error message
- Valid PDF/DOCX files are accepted
- Large files show size error
- File information displayed after selection
- "Continue to Metadata Review" button enabled

## Test 4: Import Wizard - Metadata Review

**Steps:**
1. Upload a valid PDF file
2. Click "Continue to Metadata Review"
3. Review the extracted metadata (should show placeholder message)
4. Edit title, authors, abstract
5. Fill in required fields
6. Click "Continue to Review"

**Expected:**
- Step indicator shows Step 2 active
- Form displays with placeholder data
- All fields are editable
- Validation prevents proceeding without required fields
- Successfully moves to Step 3

## Test 5: Import Wizard - Save Draft

**Steps:**
1. Complete metadata for an article
2. On Step 3, click "Save as Draft"
3. Navigate to `/admin/library`

**Expected:**
- Article saved successfully
- Redirected to library management
- Statistics show: Total: 1, Draft: 1, Published: 0, Imported: 1
- Article appears in table with "Draft" status
- "Imported" badge displayed

## Test 6: Import Wizard - Publish Directly

**Steps:**
1. Start new import with different file
2. Complete metadata
3. On Step 3, click "Publish Article"
4. Confirm publication dialog

**Expected:**
- Article published successfully
- Redirected to library management
- Statistics show: Total: 2, Draft: 1, Published: 1, Imported: 2
- Article appears with "Published" status

## Test 7: Publication Detail View

**Steps:**
1. Click on a draft publication from library
2. Navigate to `/admin/library/:id`
3. Review all displayed information
4. Click "Edit Metadata"

**Expected:**
- Publication details displayed correctly
- File information shown
- Publication history timeline visible
- Edit mode activates correctly
- All metadata fields editable

## Test 8: Metadata Update

**Steps:**
1. Open a draft publication
2. Click "Edit Metadata"
3. Modify title, authors, or abstract
4. Click "Save Changes"
5. Verify changes persisted

**Expected:**
- Changes saved successfully
- Edit mode closes
- Updated metadata displayed
- New event appears in timeline

## Test 9: Publish from Detail Page

**Steps:**
1. Open a draft publication
2. Click "Publish Article"
3. Confirm dialog

**Expected:**
- Article published successfully
- Status changes to "Published"
- Published timestamp set
- New event appears in timeline
- "Publish" button no longer visible

## Test 10: Public Research Library - Published Articles

**Steps:**
1. Log out or open incognito window
2. Navigate to `/library`
3. Search for imported article title

**Expected:**
- Published imported articles appear in library
- Draft articles do NOT appear
- Search works for imported articles
- Category filtering works

## Test 11: Public Article Detail - Imported Article

**Steps:**
1. Click on an imported article in public library
2. Navigate to `/resources/:id`

**Expected:**
- Article detail page loads
- "Imported article" badge displayed
- Additional publication metadata shown (journal, volume, etc.)
- Download link for article file visible
- DOI displayed if present

## Test 12: File Access Security

**Steps:**
1. As anonymous user, try to access draft article file URL directly
2. As editor/admin, access published article file
3. As anonymous user, access published article file

**Expected:**
- Draft file access denied for anonymous users
- Published file accessible to all users
- File URLs work correctly

## Test 13: Unauthorized Access Prevention

**Steps:**
1. Log in as author (not editor/admin)
2. Try to navigate to `/admin/library`
3. Try to navigate to `/admin/library/import`
4. Try to navigate to `/admin/library/:id`

**Expected:**
- Access denied for all admin library routes
- Redirected to appropriate page or shown access denied

## Test 14: Duplicate Detection

**Steps:**
1. Import an article with a specific DOI
2. Try to import another article with same DOI
3. Upload same file twice with different metadata

**Expected:**
- System should warn about duplicate DOI
- System should warn about duplicate file hash
- Admin can still proceed after warning

## Test 15: Existing Workflow Regression

**Steps:**
1. Test manuscript submission still works
2. Test editorial screening still works
3. Test peer review still works
4. Test production workflow still works
5. Test existing Research Library still works

**Expected:**
- All existing features continue to work
- No breaking changes to manuscript workflow
- Mock articles still appear in library
- Existing published manuscripts still accessible

## Test 16: Navigation Integration

**Steps:**
1. Log in as editor/admin
2. Check navbar for "Library" link
3. Click "Library" link
4. Verify navigation to `/admin/library`

**Expected:**
- "Library" link visible in navbar
- Link navigates to correct page
- Link only visible to editors/admins

## Test 17: Error Handling

**Steps:**
1. Try importing with network disconnected
2. Try publishing with incomplete metadata
3. Try uploading corrupted file

**Expected:**
- Appropriate error messages displayed
- Graceful degradation
- No app crashes
- Clear recovery paths

## Test 18: File Size Limits

**Steps:**
1. Try uploading exactly 50MB file
2. Try uploading 51MB file
3. Try uploading very small file (1KB)

**Expected:**
- 50MB file accepted
- 51MB file rejected with clear error
- Small file accepted

## Test 19: Concurrent Operations

**Steps:**
1. Open two browser tabs as same admin
2. Start import in both tabs
3. Try to publish same article from both tabs

**Expected:**
- System handles concurrent operations gracefully
- No data corruption
- Appropriate conflict resolution

## Test 20: Storage Cleanup

**Steps:**
1. Delete a publication from database (via SQL)
2. Check if file still exists in storage

**Expected:**
- File should be cleaned up (if cascade delete works)
- Or manual cleanup process documented
- No orphaned files accumulate

## Performance Tests

### Test 21: Large Library Performance
1. Import 50+ articles
2. Load admin library page
3. Load public library page

**Expected:**
- Pages load within acceptable time
- Pagination or infinite scroll if needed
- No memory issues

### Test 22: File Upload Performance
1. Upload 10MB PDF
2. Upload 25MB PDF
3. Measure upload times

**Expected:**
- Upload completes within reasonable time
- Progress indication (if implemented)
- No timeouts

## Security Tests

### Test 23: RLS Policy Enforcement
1. Try direct SQL insert as author role
2. Try direct SQL update as author role
3. Try to access draft publications via API

**Expected:**
- All unauthorized operations blocked
- RLS policies working correctly
- No data leakage

### Test 24: File Access Control
1. Generate signed URL for published file
2. Try to access after expiry
3. Try to manipulate URL to access other files

**Expected:**
- URL expires correctly
- URL cannot be manipulated
- Access strictly controlled

## Cross-Browser Tests

### Test 25: Browser Compatibility
1. Test in Chrome
2. Test in Firefox
3. Test in Safari
4. Test in Edge

**Expected:**
- All features work across browsers
- Consistent UI rendering
- File upload works everywhere

## Mobile Tests

### Test 26: Mobile Responsiveness
1. Test on mobile device or emulator
2. Try import workflow on mobile
3. Try library management on mobile

**Expected:**
- Responsive design works
- Touch targets appropriate size
- File upload works on mobile

## Success Criteria

Feature is considered complete when:

- [ ] All 26 tests pass
- [ ] No console errors in browser
- [ ] No security vulnerabilities identified
- [ ] Performance acceptable
- [ ] Mobile experience functional
- [ ] Documentation complete
- [ ] Code review approved

## Known Limitations to Document

1. PDF/DOCX text extraction not implemented (manual review required)
2. No automatic DOI validation
3. No bulk import functionality
4. File versioning not implemented
5. No publication scheduling

## Test Results Template

| Test # | Test Name | Status | Notes | Date |
|--------|-----------|--------|-------|------|
| 1 | Database Migration Verification | ☐ | | |
| 2 | Admin Library Access | ☐ | | |
| 3 | Import Wizard - File Upload | ☐ | | |
| 4 | Import Wizard - Metadata Review | ☐ | | |
| 5 | Import Wizard - Save Draft | ☐ | | |
| 6 | Import Wizard - Publish Directly | ☐ | | |
| 7 | Publication Detail View | ☐ | | |
| 8 | Metadata Update | ☐ | | |
| 9 | Publish from Detail Page | ☐ | | |
| 10 | Public Research Library - Published Articles | ☐ | | |
| 11 | Public Article Detail - Imported Article | ☐ | | |
| 12 | File Access Security | ☐ | | |
| 13: Unauthorized Access Prevention | ☐ | | |
| 14 | Duplicate Detection | ☐ | | |
| 15 | Existing Workflow Regression | ☐ | | |
| 16 | Navigation Integration | ☐ | | |
| 17 | Error Handling | ☐ | | |
| 18 | File Size Limits | ☐ | | |
| 19 | Concurrent Operations | ☐ | | |
| 20 | Storage Cleanup | ☐ | | |
| 21 | Large Library Performance | ☐ | | |
| 22 | File Upload Performance | ☐ | | |
| 23 | RLS Policy Enforcement | ☐ | | |
| 24 | File Access Control | ☐ | | |
| 25 | Browser Compatibility | ☐ | | |
| 26 | Mobile Responsiveness | ☐ | | |