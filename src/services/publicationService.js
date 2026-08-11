// Supabase-backed publication import service.
//
// This is the ONLY module that should query `publications`, `publication_files`,
// and `publication_events`, matching the pattern established by
// manuscriptService.js, productionService.js, and other services.
//
// Every function returns { data, error } so callers can render proper
// loading/error/empty states instead of assuming success.

import { supabase } from '../lib/supabase.js'
import {
  extractTextFromDOCX as extractDOCX,
  extractTextFromPDF as extractPDF,
  extractScholarlyMetadata,
} from '../utils/documentExtractor.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

const PUBLICATIONS_TABLE = 'publications'
const FILES_TABLE = 'publication_files'
const EVENTS_TABLE = 'publication_events'

// ---------------------------------------------------------------------
// Row <-> camelCase mapping
// ---------------------------------------------------------------------

function publicationFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    sourceType: row.source_type,
    manuscriptId: row.manuscript_id,
    title: row.title,
    abstract: row.abstract,
    authors: row.authors,
    affiliations: row.affiliations,
    correspondingAuthorName: row.corresponding_author_name,
    correspondingAuthorEmail: row.corresponding_author_email,
    keywords: row.keywords,
    articleType: row.article_type,
    category: row.category,
    doi: row.doi,
    journalName: row.journal_name,
    volume: row.volume,
    issue: row.issue,
    pageRange: row.page_range,
    publicationDate: row.publication_date,
    publicationStatus: row.publication_status,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    extractedText: row.extracted_text,
    extractionStatus: row.extraction_status,
    extractionError: row.extraction_error,
    rejectedAt: row.rejected_at,
    rejectedBy: row.rejected_by,
  }
}

function fileFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    publicationId: row.publication_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes,
    storagePath: row.storage_path,
    fileHash: row.file_hash,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  }
}

function eventFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    publicationId: row.publication_id,
    eventType: row.event_type,
    actorId: row.actor_id,
    note: row.note,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------------
// Profile name attachment (same pattern as productionService.js)
// ---------------------------------------------------------------------

async function attachProfileNames(records, idKeys) {
  const ids = new Set()
  for (const record of records) {
    for (const key of idKeys) {
      if (record[key]) ids.add(record[key])
    }
  }

  if (ids.size === 0) return records

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', Array.from(ids))

  if (error) {
    console.error('MedPublish: failed to load profile names', error)
    return records
  }

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  return records.map((record) => {
    const withNames = { ...record }
    for (const key of idKeys) {
      const nameKey = `${key.replace(/Id$/, '')}Name`
      withNames[nameKey] = record[key] ? (byId.get(record[key])?.full_name ?? byId.get(record[key])?.email ?? null) : null
    }
    return withNames
  })
}

// ---------------------------------------------------------------------
// Public Research Library queries
// ---------------------------------------------------------------------

/**
 * Every published publication for the public Research Library.
 * This uses the SECURITY DEFINER function which enforces publication_status = 'published'.
 */
export async function getPublishedPublications() {
  const { data, error } = await supabase
    .rpc('get_published_publications')

  if (error) return { data: [], error }

  const withNames = await attachProfileNames(
    data.map(publicationFromRow),
    ['createdBy', 'publishedBy', 'rejectedBy'],
  )
  return { data: withNames, error: null }
}

/**
 * Get a single publication by ID. Uses SECURITY DEFINER function which
 * enforces that only published publications are accessible to non-editors/admins.
 */
export async function getPublicationById(id) {
  const { data, error } = await supabase
    .rpc('get_publication_by_id', { p_publication_id: id })

  return { data: publicationFromRow(data), error }
}

/**
 * Get publication file metadata for a publication. The actual file access
 * is controlled by database RLS on publication_files table.
 */
export async function getPublicationFile(publicationId) {
  const { data, error } = await supabase
    .from(FILES_TABLE)
    .select('*')
    .eq('publication_id', publicationId)
    .maybeSingle()

  return { data: fileFromRow(data), error }
}

/**
 * Get a public URL for a publication file from Supabase Storage.
 * This should only be called for published publications.
 */
export async function getPublicationFileUrl(storagePath) {
  const { data, error } = await supabase
    .storage
    .from('publications')
    .createSignedUrl(storagePath, 60 * 60 * 24) // 24 hour expiry

  if (error) return { data: null, error }

  return { data: data.signedUrl, error: null }
}

// ---------------------------------------------------------------------
// Admin/Editor queries
// ---------------------------------------------------------------------

/**
 * All publications (including drafts) for the admin library management.
 */
export async function getAllPublications() {
  console.log('[MedPublish DEBUG] getAllPublications called')
  console.log('[MedPublish DEBUG] Supabase URL:', supabaseUrl)
  
  const { data, error } = await supabase
    .from(PUBLICATIONS_TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  console.log('[MedPublish DEBUG] getAllPublications result:', { count: data?.length || 0, error })
  if (data && data.length > 0) {
    data.forEach((pub, i) => {
      console.log(`[MedPublish DEBUG] Publication [${i}]:`, pub.id, pub.title?.substring(0, 30))
    })
  }

  if (error) return { data: [], error }

  const withNames = await attachProfileNames(
    data.map(publicationFromRow),
    ['createdBy', 'publishedBy', 'rejectedBy'],
  )
  return { data: withNames, error: null }
}

/**
 * Get publication events/audit trail for a specific publication.
 */
export async function getPublicationEvents(publicationId) {
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select('*')
    .eq('publication_id', publicationId)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error }

  const withNames = await attachProfileNames(data.map(eventFromRow), ['actorId'])
  return { data: withNames, error: null }
}

/**
 * Basic counts for the admin dashboard.
 */
export async function getPublicationStats() {
  const { data, error } = await getAllPublications()
  if (error) {
    return {
      data: { total: 0, draft: 0, published: 0, rejected: 0, imported: 0 },
      error,
    }
  }
  return {
    data: {
      total: data.length,
      draft: data.filter((p) => p.publicationStatus === 'draft').length,
      published: data.filter((p) => p.publicationStatus === 'published').length,
      rejected: data.filter((p) => p.publicationStatus === 'rejected').length,
      imported: data.filter((p) => p.sourceType === 'imported').length,
    },
    error: null,
  }
}

// ---------------------------------------------------------------------
// Actions (all go through SECURITY DEFINER database functions)
// ---------------------------------------------------------------------

/**
 * Create a new imported publication as a draft.
 */
export async function createImportedPublication(metadata) {
  console.log('[MedPublish DEBUG] createImportedPublication called')
  console.log('[MedPublish DEBUG] Metadata:', metadata.title?.substring(0, 30))
  console.log('[MedPublish DEBUG] Supabase URL:', supabaseUrl)
  
  const { data, error } = await supabase
    .rpc('create_imported_publication', {
      p_title: metadata.title,
      p_abstract: metadata.abstract,
      p_authors: metadata.authors,
      p_affiliations: metadata.affiliations || null,
      p_corresponding_author_name: metadata.correspondingAuthorName || null,
      p_corresponding_author_email: metadata.correspondingAuthorEmail || null,
      p_keywords: metadata.keywords || null,
      p_article_type: metadata.articleType,
      p_category: metadata.category,
      p_doi: metadata.doi || null,
      p_journal_name: metadata.journalName || null,
      p_volume: metadata.volume || null,
      p_issue: metadata.issue || null,
      p_page_range: metadata.pageRange || null,
      p_publication_date: metadata.publicationDate || null,
      p_extracted_text: metadata.extractedText || null,
    })

  console.log('[MedPublish DEBUG] createImportedPublication result:', { data, error })
  return { data, error }
}

/**
 * Update publication metadata.
 */
export async function updatePublicationMetadata(publicationId, metadata) {
  const { data, error } = await supabase
    .rpc('update_publication_metadata', {
      p_publication_id: publicationId,
      p_title: metadata.title,
      p_abstract: metadata.abstract,
      p_authors: metadata.authors,
      p_affiliations: metadata.affiliations || null,
      p_corresponding_author_name: metadata.correspondingAuthorName || null,
      p_corresponding_author_email: metadata.correspondingAuthorEmail || null,
      p_keywords: metadata.keywords || null,
      p_article_type: metadata.articleType,
      p_category: metadata.category,
      p_doi: metadata.doi || null,
      p_journal_name: metadata.journalName || null,
      p_volume: metadata.volume || null,
      p_issue: metadata.issue || null,
      p_page_range: metadata.pageRange || null,
      p_publication_date: metadata.publicationDate || null,
      p_extracted_text: metadata.extractedText || null,
    })

  return { data, error }
}

/**
 * Upload a publication file to Supabase Storage and register it in the database.
 */
export async function uploadPublicationFile(publicationId, file) {
  console.log('[MedPublish DEBUG] uploadPublicationFile called')
  console.log('[MedPublish DEBUG] Publication ID:', publicationId)
  console.log('[MedPublish DEBUG] File:', file.name, file.size, file.type)
  console.log('[MedPublish DEBUG] Supabase URL:', supabaseUrl)
  
  try {
    // Generate storage path
    const fileExtension = file.name.split('.').pop()
    const storagePath = `${publicationId}/original.${fileExtension}`
    console.log('[MedPublish DEBUG] Storage path:', storagePath)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('publications')
      .upload(storagePath, file)

    console.log('[MedPublish DEBUG] Storage upload result:', { uploadData, uploadError })

    if (uploadError) {
      return { data: null, error: uploadError }
    }

    // Calculate file hash (SHA-256) for duplicate detection
    const fileBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    console.log('[MedPublish DEBUG] File hash:', fileHash.substring(0, 16))

    // Register file in database using SECURITY DEFINER function
    const { data, error } = await supabase
      .rpc('upload_publication_file', {
        p_publication_id: publicationId,
        p_file_name: file.name,
        p_file_type: file.type,
        p_file_size_bytes: file.size,
        p_storage_path: storagePath,
        p_file_hash: fileHash,
      })

    console.log('[MedPublish DEBUG] upload_publication_file RPC result:', { data, error })

    if (error) {
      // Clean up storage if database insert fails
      await supabase.storage.from('publications').remove([storagePath])
      return { data: null, error }
    }

    return { data, error: null }
  } catch (error) {
    console.log('[MedPublish DEBUG] uploadPublicationFile exception:', error)
    return { data: null, error }
  }
}

/**
 * Publish a publication (server-side operation with verification).
 */
export async function publishPublication(publicationId) {
  console.log('[MedPublish DEBUG] publishPublication called with ID:', publicationId)
  console.log('[MedPublish DEBUG] Supabase URL:', supabaseUrl)
  
  // First, check if publication_files row exists (diagnostic)
  const { data: fileCheck, error: fileCheckError } = await supabase
    .from('publication_files')
    .select('*')
    .eq('publication_id', publicationId)
    .maybeSingle()
  
  console.log('[MedPublish DEBUG] publication_files check:', { 
    hasFile: !!fileCheck, 
    fileCheckError,
    fileId: fileCheck?.id,
    fileName: fileCheck?.file_name 
  })
  
  const { data, error } = await supabase
    .rpc('publish_publication', { p_publication_id: publicationId })

  console.log('[MedPublish DEBUG] publishPublication result:', { data, error })
  return { data, error }
}

/**
 * Reject a publication (server-side operation with verification).
 */
export async function rejectPublication(publicationId) {
  const { data, error } = await supabase
    .rpc('reject_publication', { p_publication_id: publicationId })

  return { data, error }
}

/**
 * Delete a draft publication (server-side operation with verification).
 */
export async function deleteDraftPublication(publicationId) {
  const { data, error } = await supabase
    .rpc('delete_draft_publication', { p_publication_id: publicationId })

  return { data, error }
}

/**
 * Restore a rejected publication to draft status (server-side operation with verification).
 */
export async function restoreRejectedPublication(publicationId) {
  const { data, error } = await supabase
    .rpc('restore_rejected_publication', { p_publication_id: publicationId })

  return { data, error }
}

/**
 * Check for potential duplicates (by DOI or file hash).
 */
export async function checkDuplicatePublication(doi = null, fileHash = null) {
  const { data, error } = await supabase
    .rpc('check_duplicate_publication', {
      p_doi: doi,
      p_file_hash: fileHash,
    })

  return { data, error }
}

// ---------------------------------------------------------------------
// File processing helpers (client-side PDF/DOCX text extraction)
// ---------------------------------------------------------------------

/**
 * Attempt to extract metadata from uploaded file.
 * This is always treated as a DRAFT - admin must review and correct.
 */
export async function extractMetadataFromFile(file) {
  const fileType = file.type
  const fileName = file.name

  let extractionResult
  if (fileType === 'application/pdf') {
    extractionResult = await extractPDF(file)
  } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    extractionResult = await extractDOCX(file)
  } else {
    return {
      success: false,
      message: 'Unsupported file type for automatic extraction',
    }
  }

  if (!extractionResult.success) {
    return {
      success: true,
      metadata: {
        title: '', // Don't guess - leave blank for manual review
        abstract: '',
        authors: '',
        affiliations: '',
        correspondingAuthorName: '',
        correspondingAuthorEmail: '',
        keywords: '',
        articleType: '', // Don't guess - require manual selection
        category: 'General', // Default category
        extractedText: '',
        extractionMessage: extractionResult.error || extractionResult.message || 'Extraction failed. Manual review required.',
        extractionStatus: 'failed',
      },
    }
  }

  // Extract scholarly metadata from the text, using paragraphs if available
  const paragraphs = extractionResult.paragraphs || null
  const scholarlyMetadata = extractScholarlyMetadata(extractionResult.text, paragraphs)
  
  // Use the detected article type (empty if not confidently detected)
  const detectedArticleType = scholarlyMetadata.articleType

  // Build the final metadata with extracted values
  return {
    success: true,
    metadata: {
      title: scholarlyMetadata.title || '', // Leave blank if not confidently extracted
      abstract: scholarlyMetadata.abstract,
      authors: scholarlyMetadata.authors,
      affiliations: scholarlyMetadata.affiliations,
      correspondingAuthorName: scholarlyMetadata.correspondingAuthorName,
      correspondingAuthorEmail: scholarlyMetadata.correspondingAuthorEmail,
      keywords: scholarlyMetadata.keywords,
      articleType: detectedArticleType, // Empty if not detected
      category: 'General', // Default to General, require manual selection
      doi: scholarlyMetadata.doi,
      journalName: scholarlyMetadata.journalName,
      volume: scholarlyMetadata.volume,
      issue: scholarlyMetadata.issue,
      pageRange: scholarlyMetadata.pageRange,
      publicationDate: scholarlyMetadata.publicationDate,
      extractedText: extractionResult.text,
      references: scholarlyMetadata.references,
      extractionMessage: extractionResult.isScanned 
        ? 'This PDF appears to contain scanned/image-only pages. Automatic text extraction was not available. Please review metadata manually.'
        : 'Document text extracted successfully. Please verify and edit the metadata before publishing. Some fields may require manual entry.',
      extractionStatus: extractionResult.isScanned ? 'failed' : 'completed',
      confidence: scholarlyMetadata.confidence,
    },
  }
}

// Re-export the extraction functions for convenience
export { extractTextFromPDF, extractTextFromDOCX } from '../utils/documentExtractor.js'