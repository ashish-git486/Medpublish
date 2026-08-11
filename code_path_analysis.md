# Code Path Analysis for Article Import Workflows

## PATH A: Direct Publish from Import Page (WORKS)

### Sequence:
1. **handleUpload** (AdminImportPage.jsx line 66)
   - extractMetadataFromFile(file)
   - createImportedPublication(metadata) → returns publicationId
   - uploadPublicationFile(publicationId, file) → uploads to storage + creates publication_files row
   - setStep(2) - moves to metadata review

2. **handlePublish** (AdminImportPage.jsx line 187)
   - updatePublicationMetadata(publicationId, metadata)
   - publishPublication(publicationId)
   - SUCCESS

### Key Points:
- publicationId is stored in state from handleUpload
- File is uploaded immediately during handleUpload
- publication_files row created during handleUpload
- Same publicationId used throughout

## PATH B: Draft → Admin Library → Publish (FAILS)

### Sequence:
1. **handleUpload** (AdminImportPage.jsx line 66)
   - extractMetadataFromFile(file)
   - createImportedPublication(metadata) → returns publicationId
   - uploadPublicationFile(publicationId, file) → uploads to storage + creates publication_files row
   - setStep(2) - moves to metadata review

2. **handleCreateDraft** (AdminImportPage.jsx line 142)
   - updatePublicationMetadata(publicationId, metadata)
   - setStep(3) - moves to publication review
   - NOTE: Does NOT create a new publication, just updates existing one

3. **User navigates to Admin Library** (/admin/library)
   - getAllPublications() fetches all publications
   - Lists the draft publication

4. **handlePublish** (AdminLibraryPage.jsx line 102)
   - publishPublication(publicationId)
   - FAILS with "Publication must have an associated file"

### Key Points:
- Same handleUpload as PATH A
- Same publicationId should be used
- publication_files row should exist from handleUpload
- No new publication creation in handleCreateDraft

## Investigation Questions:

1. **Is the publicationId the same in both paths?**
   - PATH A: publicationId from handleUpload state
   - PATH B: publicationId from getAllPublications() result

2. **Does publication_files row exist for the draft?**
   - Should have been created during handleUpload
   - Forensic analysis showed: publication_files row EXISTS for the published article
   - But 0 publication_events (suspicious)

3. **Is there any code that removes publication_files?**
   - Check for DELETE operations on publication_files
   - Check for publication deletion

4. **Is there any code that creates a second publication?**
   - Check for INSERT into publications after initial import
   - Check for clone/copy operations

5. **Is there a file re-upload required?**
   - File object is in browser memory
   - If page reloads, File object is lost
   - But file should already be in storage with publication_files row

## Next Steps:

1. Search for any DELETE on publication_files
2. Search for any INSERT into publications after import
3. Check if handleCreateDraft does anything unexpected
4. Verify publicationId persistence across page reloads
5. Check if Admin Library is using a different publicationId
