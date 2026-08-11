# Article Import Feature Fixes - Implementation Summary

## Overview
Comprehensive fixes to the Article Import feature to make it publication-ready with proper structured metadata extraction, improved heuristics, and complete editorial workflow controls.

## Problems Identified and Fixed

### 1. Title Extraction Bug
**Problem:** "Type of Article: Original Research Article" was being extracted as the title.

**Root Cause:** The old `detectTitle()` function used a simple heuristic that didn't properly exclude metadata labels and didn't score candidates properly.

**Fix:** 
- Implemented comprehensive title scoring algorithm
- Added extensive list of non-title patterns to avoid (article type labels, authors, affiliations, etc.)
- Scoring based on position, length, capitalization, content, and penalties for metadata patterns
- Only returns title if confidence score is high enough

### 2. Abstract Extraction Failure
**Problem:** Abstract field remained empty even when document contained abstract text.

**Root Cause:** The regex patterns were too restrictive and didn't handle structured abstracts or various section boundaries properly.

**Fix:**
- Improved regex patterns to match various abstract formats
- Support for structured abstracts with internal labels (Background, Methods, Results, Conclusion)
- Better section boundary detection (Keywords, Introduction, etc.)
- Text cleanup and normalization

### 3. Incomplete References Extraction
**Problem:** Only first few references were extracted from a 15-page document.

**Root Cause:** The references extraction was too aggressive in stopping and didn't handle the complete references section.

**Fix:**
- Improved detection of References section start
- Capture complete section until acknowledgment/conflict sections
- Better handling of multi-line references
- Formatting cleanup for extracted references

### 4. Authors and Affiliations Mixing
**Problem:** Author names were mixed with affiliations and markers.

**Root Cause:** Simple regex patterns didn't separate author names from institutional text and superscript markers.

**Fix:**
- Structured author block detection with continuation lines
- Removal of superscript affiliation markers (¹²³⁴⁵⁶⁷⁸⁹⁰†*‡§¶)
- Separate affiliation extraction with numbering
- Multi-line affiliation support

### 5. Missing Metadata Fields
**Problem:** Many important fields (corresponding author, journal, volume, issue, pages) were not extracted.

**Fix:**
- Added corresponding author detection with email extraction
- Added journal name detection
- Added publication metadata extraction (volume, issue, page range, publication date)
- Improved DOI detection and validation

### 6. Silent Metadata Fabrication
**Problem:** Article type and category were being defaulted rather than requiring manual selection.

**Fix:**
- Article type detection now returns empty string if not confidently detected
- Category defaults to "General" with explicit UI message that manual selection is required
- Article type dropdown includes "Select type..." option
- UI clearly indicates when manual selection is needed

### 7. Save Draft and Publish Failures
**Problem:** Save Draft and Publish buttons had validation issues and error handling problems.

**Fix:**
- Proper validation of required fields before operations
- Update vs create logic for drafts (prevents duplicate records)
- File upload error handling (doesn't fail draft save if file upload fails)
- Success messages and proper navigation
- Metadata updates before publishing

### 8. Missing Editorial Controls
**Problem:** No way to reject or delete draft articles.

**Fix:**
- Added rejected status to database schema
- Implemented reject functionality with audit trail
- Implemented delete draft functionality (only for drafts)
- Added UI buttons for Reject and Delete actions
- Proper status filtering and statistics

## Files Changed

### Core Extraction Logic
- **src/utils/documentExtractor.js** - Complete rewrite:
  - Structured DOCX parsing with paragraph preservation
  - Improved title detection with scoring algorithm
  - Enhanced author extraction with marker removal
  - Affiliation extraction with numbering
  - Abstract detection with section boundaries
  - Keywords normalization
  - Corresponding author detection
  - Publication metadata extraction
  - Complete references section extraction
  - Conservative article type detection

### Service Layer
- **src/services/publicationService.js** - Updated:
  - Fixed extraction metadata mapping
  - Added rejectPublication() function
  - Added deleteDraftPublication() function
  - Updated profile name attachment for rejectedBy
  - Fixed publicationFromRow mapping for new fields

### UI Components
- **src/routes/AdminImportPage.jsx** - Fixed:
  - Save Draft functionality with proper validation
  - Publish functionality with required field validation
  - Added extraction confidence indicators in UI
  - Added manual review warning message
  - Fixed article type selection (empty default)
  - Enhanced references field display
  - Better error handling and user feedback

- **src/routes/AdminLibraryPage.jsx** - Enhanced:
  - Added Reject button for draft articles
  - Added Delete button for draft articles
  - Added Delete button for rejected articles
  - Updated statistics to include rejected count
  - Fixed filter matching for new statuses
  - Improved responsive grid layout

### Status Management
- **src/data/publicationStatus.js** - Updated:
  - Added under_review, approved, rejected statuses
  - Added badge colors for new statuses
  - Updated status filters
  - Updated status order

### Article Service
- **src/services/articleService.js** - Fixed:
  - Filter out non-published articles from public library
  - publicationToArticle() now returns null for non-published
  - Proper filtering in getAllArticles()

### Database Migration
- **supabase/migrations/0008_rejected_status_and_lifecycle.sql** - New:
  - Adds rejected status to publication_status check
  - Adds rejected_at and rejected_by fields
  - Creates reject_publication() SECURITY DEFINER function
  - Creates delete_draft_publication() SECURITY DEFINER function
  - Updates get_publication_by_id() for new statuses
  - Backfills default values for existing rows

## Dependencies Added
None - Uses existing dependencies (mammoth, pdfjs-dist, supabase-js)

## Database Migration Required

**Migration File:** `supabase/migrations/0008_rejected_status_and_lifecycle.sql`

**Steps:**
1. Run the migration in Supabase SQL Editor
2. The migration is idempotent and safe to re-run
3. Adds rejected status and lifecycle management functions

## Extraction Strategy Details

### DOCX Parsing
- Uses mammoth.js with paragraph structure preservation
- Returns both raw text and structured paragraphs
- Preserves document order and basic formatting
- No external paid APIs used

### Title Extraction
- Scoring algorithm based on position, length, capitalization
- Avoids metadata labels (Article Type, Authors, Abstract, etc.)
- Returns empty string if confidence is low
- Does not use filename as fallback

### Author Extraction
- Detects author block with continuation lines
- Removes superscript affiliation markers
- Handles comma-separated and "and" patterns
- Detects multi-line author lists
- Does not include affiliation text

### Affiliation Extraction
- Detects institutional patterns (University, Institute, Hospital, etc.)
- Numbered affiliation support
- Multi-line affiliation handling
- Preserves numbering format

### Abstract Extraction
- Detects "Abstract" heading
- Captures text until next major section
- Handles structured abstracts with internal labels
- Supports various section boundaries
- Text cleanup and normalization

### Keywords Extraction
- Detects Keywords, Key Words, Index Terms headings
- Normalizes separators (semicolons, periods, "and")
- Converts to comma-separated format
- Removes trailing punctuation

### Corresponding Author Detection
- Detects "Corresponding author" or "Correspondence" sections
- Extracts email addresses using email pattern matching
- Extracts author name when available
- Returns empty if not confidently detected

### Publication Metadata Extraction
- DOI detection with validation
- Journal name detection
- Volume, issue, page range extraction
- Publication date extraction
- Returns empty string if not confidently detected

### Article Type Detection
- Only returns type if explicitly mentioned in document
- Returns empty string if not confidently detected
- Requires manual selection via UI
- Supports: Original Research Article, Review Article, Systematic Review, Meta-analysis, Case Report, Editorial, Letter, Short Communication

### References Extraction
- Detects References section start
- Captures complete section
- Handles acknowledgments/conflict boundaries
- Multi-line reference support
- Formatting cleanup

### Full Document Text Retention
- Complete extracted text stored in database
- Available for manual verification
- Preview in UI during import
- Preserved in extraction_status field

## UI Enhancements

### Extraction Confidence Indicators
- Visual confidence indicators for each field
- Color-coded badges (green=high, yellow=medium, red=low)
- Clear legend explaining confidence levels
- Helps editors prioritize manual review

### Manual Review Messaging
- Clear warning that metadata requires verification
- Blue information box emphasizing manual review
- Extraction status messages
- Guidance on which fields need attention

### Article Type Selection
- Dropdown with "Select type..." as default
- Expanded article type options
- Visual indicator when selection is required
- No silent defaults

### Category Selection
- Defaults to "General" with explicit note
- Clear message that category is not automatically extracted
- Full category list available

### Editorial Controls
- Reject button for draft articles
- Delete button for draft articles
- Delete button for rejected articles
- Confirmation dialogs for destructive actions
- Proper status filtering

## Database Status Model

### Publication Status Lifecycle
- `draft` - Initial state for imported articles
- `under_review` - Optional state for review process
- `approved` - Optional state for approved articles
- `published` - Published articles visible in public library
- `rejected` - Rejected articles (preserved for audit trail)

### Status Transitions
- draft → published (via publishPublication)
- draft → rejected (via rejectPublication)
- draft → deleted (via deleteDraftPublication - only for drafts)
- rejected → deleted (via deleteDraftPublication - for cleanup)

### Audit Trail
- All status changes logged in publication_events table
- Includes actor_id, event_type, and note
- Rejected publications track rejected_at and rejected_by
- Published publications track published_at and published_by

## Testing Instructions

### Prerequisites
1. Run migration: `supabase/migrations/0008_rejected_status_and_lifecycle.sql`
2. Ensure mammoth and pdfjs-dist are installed
3. Have a real 15-page medical DOCX test file

### Test Procedure
1. Navigate to `/admin/library/import`
2. Upload the 15-page DOCX file
3. Review extraction results in metadata review page
4. Verify each field extraction:
   - [ ] Title is the actual article title (not "Type of Article...")
   - [ ] Title is NOT a metadata label
   - [ ] Authors extracted correctly without affiliation markers
   - [ ] Affiliations extracted with numbering
   - [ ] Abstract extracted if present in document
   - [ ] Keywords extracted and normalized
   - [ ] Corresponding author detected if present
   - [ ] Corresponding email detected if present
   - [ ] DOI detected if present
   - [ ] Journal detected if present
   - [ ] Volume detected if present
   - [ ] Issue detected if present
   - [ ] Page range detected if present
   - [ ] Publication date detected if present
   - [ ] Article type empty or correctly detected
   - [ ] Category shows "General" with manual selection note
   - [ ] Complete references extracted
   - [ ] Full document text preview available
   - [ ] Confidence indicators displayed
5. Test Save Draft:
   - [ ] Validates required fields
   - [ ] Saves metadata correctly
   - [ ] Uploads file successfully
   - [ ] Shows success message
   - [ ] Navigates to library
   - [ ] Draft appears in library list
6. Test Publish:
   - [ ] Validates required fields
   - [ ] Updates metadata before publishing
   - [ ] Changes status to published
   - [ ] Shows success message
   - [ ] Navigates to library
   - [ ] Article shows as published
7. Test Reject:
   - [ ] Shows confirmation dialog
   - [ ] Changes status to rejected
   - [ ] Adds audit trail entry
   - [ ] Updates statistics
8. Test Delete Draft:
   - [ ] Shows confirmation dialog
   - [ ] Only works for draft status
   - [ ] Removes publication record
   - [ ] Updates statistics
9. Test Error Handling:
   - [ ] Validation errors shown clearly
   - [ ] File upload failures don't break draft save
   - [ ] Browser console checked for errors
   - [ ] Network errors handled gracefully

### Expected Results
- Title should be the actual article title, not a metadata label
- Abstract should contain the full abstract text
- Authors should be clean names without affiliation markers
- Affiliations should be numbered separately
- References should include the complete section
- Confidence indicators should reflect extraction quality
- Save Draft should work reliably
- Publish should validate and publish correctly
- Reject and Delete should work with proper confirmations
- No browser console errors during normal workflow

## Known Limitations

### Extraction Limitations
- Article type detection is conservative - requires explicit mention
- Category is not automatically extracted - requires manual selection
- Complex multi-column layouts may not parse perfectly
- Some journal-specific formatting may not be recognized
- Handwritten or scanned PDFs will require manual entry

### Functional Limitations
- File versioning not implemented (single file per publication)
- No bulk import functionality
- No duplicate detection beyond DOI/file hash
- No Crossref integration for DOI validation
- No automatic DOI registration

## Commands to Run Locally

### Setup
```bash
# Install dependencies (if not already installed)
npm install mammoth pdfjs-dist

# Run database migration
# Copy contents of supabase/migrations/0008_rejected_status_and_lifecycle.sql
# Run in Supabase SQL Editor
```

### Development
```bash
# Start development server
npm run dev

# Navigate to import page
# http://localhost:5173/admin/library/import
```

### Testing
```bash
# Test with real DOCX file
# 1. Open browser to http://localhost:5173/admin/library/import
# 2. Upload your 15-page medical DOCX
# 3. Review extraction results against checklist above
# 4. Test Save Draft, Publish, Reject, Delete workflows
# 5. Check browser console for errors
# 6. Verify database records in Supabase
```

## Additional Notes

### Medical Publishing Considerations
- All extraction is treated as draft-level only
- Editors must verify all metadata before publication
- No metadata is silently invented or fabricated
- Missing information remains blank and requires manual entry
- Full document text preserved for manual verification
- Audit trail maintained for all editorial actions

### Security Considerations
- All critical operations use SECURITY DEFINER functions
- RLS policies enforce role-based access
- File access controlled through storage and database policies
- Only editors/admins can import, publish, reject, or delete
- Published articles only visible to public

### Performance Considerations
- Client-side extraction for DOCX/PDF files
- Extraction results cached in metadata form
- File upload happens after metadata is saved
- No blocking operations during extraction
- Graceful degradation if extraction fails

## Conclusion

The Article Import feature has been comprehensively fixed to be publication-ready. The extraction now uses structured parsing with improved heuristics, properly avoids metadata labels, and provides clear confidence indicators. The editorial workflow includes proper draft management, validation, and lifecycle controls. All extraction is treated as draft-level requiring editorial verification, which is appropriate for a medical publishing platform.

The implementation follows the existing project architecture, uses the established Supabase setup, introduces no new dependencies, and maintains backward compatibility with existing functionality.