// Supabase-backed production workflow service.
//
// This is the ONLY module that should query `manuscript_production`,
// `production_metadata`, and `production_events`, matching the pattern
// established by manuscriptService.js, reviewService.js, and
// revisionService.js.
//
// Every function returns { data, error } so callers can render proper
// loading/error/empty states instead of assuming success.

import { supabase } from '../lib/supabase.js'
import { getCategoryBySlug } from '../data/mockData.js'

const PRODUCTION_TABLE = 'manuscript_production'
const METADATA_TABLE = 'production_metadata'
const EVENTS_TABLE = 'production_events'

// Columns pulled from `manuscripts` for the production dashboard/detail
// header — deliberately narrow, mirrors MANUSCRIPT_SUMMARY_COLUMNS in
// reviewService.js rather than selecting the full manuscript row.
const MANUSCRIPT_SUMMARY_COLUMNS =
  'id, title, authors, category, article_type, submitting_author_id, status, reviewed_at, corresponding_email'

// ---------------------------------------------------------------------
// Row <-> camelCase mapping
// ---------------------------------------------------------------------

function productionFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    productionStatus: row.production_status,
    productionEditorId: row.production_editor_id,
    copyeditorId: row.copyeditor_id,
    typesetterId: row.typesetter_id,
    metadataVerified: row.metadata_verified,
    enteredProductionAt: row.entered_production_at,
    copyeditingCompletedAt: row.copyediting_completed_at,
    metadataVerifiedAt: row.metadata_verified_at,
    readyForTypesettingAt: row.ready_for_typesetting_at,
    typesettingStartedAt: row.typesetting_started_at,
    typesettingCompletedAt: row.typesetting_completed_at,
    authorProofIssuedAt: row.author_proof_issued_at,
    proofCorrectionsRequestedAt: row.proof_corrections_requested_at,
    finalProofApprovedAt: row.final_proof_approved_at,
    publicationReadyAt: row.publication_ready_at,
    currentProofVersionId: row.current_proof_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    manuscript: row.manuscripts
      ? {
          id: row.manuscripts.id,
          title: row.manuscripts.title,
          authors: row.manuscripts.authors,
          categorySlug: row.manuscripts.category,
          articleType: row.manuscripts.article_type,
          submittingAuthorId: row.manuscripts.submitting_author_id,
          status: row.manuscripts.status,
          acceptedAt: row.manuscripts.reviewed_at,
          correspondingEmail: row.manuscripts.corresponding_email,
        }
      : null,
  }
}

function metadataFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    title: row.title,
    runningTitle: row.running_title,
    abstract: row.abstract,
    keywords: row.keywords,
    authorOrder: row.author_order ?? [],
    affiliations: row.affiliations ?? [],
    correspondingAuthorName: row.corresponding_author_name,
    correspondingAuthorEmail: row.corresponding_author_email,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function eventFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    eventType: row.event_type,
    productionStatus: row.production_status,
    actorId: row.actor_id,
    note: row.note,
    createdAt: row.created_at,
  }
}

// Batches profile-name lookups (production editor, copyeditor, event
// actors) against public.profiles, same pattern as
// manuscriptService.attachProfileNames.
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
      const profile = byId.get(record[key])
      withNames[nameKey] = record[key] ? (profile?.full_name ?? profile?.email ?? null) : null
    }
    return withNames
  })
}

// ---------------------------------------------------------------------
// Dashboard: the production queue
// ---------------------------------------------------------------------

/**
 * Every manuscript currently in production (accepted and not yet
 * published — the "published" status doesn't exist yet in the app's
 * reachable states, so this is every manuscript_production row whose
 * manuscript is still 'accepted'), for the Production Dashboard.
 */
export async function getProductionQueue() {
  const { data, error } = await supabase
    .from(PRODUCTION_TABLE)
    .select(`*, manuscripts!inner (${MANUSCRIPT_SUMMARY_COLUMNS})`)
    .eq('manuscripts.status', 'accepted')
    .order('entered_production_at', { ascending: false })

  if (error) return { data: [], error }

  const withNames = await attachProfileNames(
    data.map(productionFromRow),
    ['productionEditorId', 'copyeditorId', 'typesetterId'],
  )
  return { data: withNames, error: null }
}

/** Basic counts for the production dashboard's summary cards. */
export async function getProductionStats() {
  const { data, error } = await getProductionQueue()
  if (error) {
    return {
      data: {
        total: 0,
        accepted: 0,
        copyediting: 0,
        metadataVerification: 0,
        readyForTypesetting: 0,
        typesetting: 0,
        authorProof: 0,
        proofCorrections: 0,
        finalProofApproval: 0,
        publicationReady: 0,
      },
      error,
    }
  }
  return {
    data: {
      total: data.length,
      accepted: data.filter((p) => p.productionStatus === 'accepted').length,
      copyediting: data.filter((p) => p.productionStatus === 'copyediting').length,
      metadataVerification: data.filter((p) => p.productionStatus === 'metadata_verification').length,
      readyForTypesetting: data.filter((p) => p.productionStatus === 'ready_for_typesetting').length,
      typesetting: data.filter((p) => p.productionStatus === 'typesetting').length,
      authorProof: data.filter((p) => p.productionStatus === 'author_proof').length,
      proofCorrections: data.filter((p) => p.productionStatus === 'proof_corrections').length,
      finalProofApproval: data.filter((p) => p.productionStatus === 'final_proof_approval').length,
      publicationReady: data.filter((p) => p.productionStatus === 'publication_ready').length,
    },
    error: null,
  }
}

// ---------------------------------------------------------------------
// Detail page: one manuscript's production record
// ---------------------------------------------------------------------

/** The production record (+ manuscript summary + assignee names) for one manuscript. */
export async function getProductionRecord(manuscriptId) {
  const { data, error } = await supabase
    .from(PRODUCTION_TABLE)
    .select(`*, manuscripts (${MANUSCRIPT_SUMMARY_COLUMNS})`)
    .eq('manuscript_id', manuscriptId)
    .maybeSingle()

  if (error || !data) return { data: null, error }

  const [withNames] = await attachProfileNames([productionFromRow(data)], [
    'productionEditorId',
    'copyeditorId',
    'typesetterId',
  ])

  return {
    data: {
      ...withNames,
      categoryName: withNames.manuscript
        ? getCategoryBySlug(withNames.manuscript.categorySlug)?.name ?? withNames.manuscript.categorySlug
        : null,
    },
    error: null,
  }
}

/** The production metadata record for one manuscript, for the metadata editor form. */
export async function getProductionMetadata(manuscriptId) {
  const { data, error } = await supabase
    .from(METADATA_TABLE)
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .maybeSingle()

  return { data: metadataFromRow(data), error }
}

/** Editors/admins available to be assigned as production editor or copyeditor. */
export async function getProductionStaffCandidates() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['editor', 'admin'])
    .order('full_name', { ascending: true })

  return { data: data ?? [], error }
}

/** Full production timeline for one manuscript, oldest first. */
export async function getProductionTimeline(manuscriptId) {
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error }

  const withNames = await attachProfileNames(data.map(eventFromRow), ['actorId'])
  return { data: withNames, error: null }
}

// ---------------------------------------------------------------------
// Actions (all go through SECURITY DEFINER database functions)
// ---------------------------------------------------------------------

/** Assign (or reassign) the production editor and/or copyeditor for a manuscript. */
export async function assignProductionStaff(manuscriptId, { productionEditorId, copyeditorId } = {}) {
  const { error } = await supabase.rpc('assign_production_staff', {
    p_manuscript_id: manuscriptId,
    p_production_editor_id: productionEditorId || null,
    p_copyeditor_id: copyeditorId || null,
  })

  return { error }
}

/**
 * Edit the publication-facing production metadata. Never touches
 * `manuscripts` or `manuscript_versions`. Resets metadata_verified to
 * false server-side, since a prior verification no longer applies to
 * edited content.
 */
export async function updateProductionMetadata(manuscriptId, form) {
  const { error } = await supabase.rpc('update_production_metadata', {
    p_manuscript_id: manuscriptId,
    p_title: form.title,
    p_running_title: form.runningTitle,
    p_abstract: form.abstract,
    p_keywords: form.keywords,
    p_author_order: form.authorOrder ?? [],
    p_affiliations: form.affiliations ?? [],
    p_corresponding_author_name: form.correspondingAuthorName,
    p_corresponding_author_email: form.correspondingAuthorEmail,
  })

  return { error }
}

/** Mark (or unmark) the production metadata as verified. */
export async function setMetadataVerified(manuscriptId, verified) {
  const { error } = await supabase.rpc('set_metadata_verified', {
    p_manuscript_id: manuscriptId,
    p_verified: verified,
  })

  return { error }
}

/**
 * Advance a manuscript's production status one step along the fixed
 * sequence (accepted -> copyediting -> metadata_verification ->
 * ready_for_typesetting). The database function itself validates the
 * transition is legal and that metadata is verified before allowing entry
 * into ready_for_typesetting, so this call is the single source of truth.
 */
export async function advanceProductionStatus(manuscriptId, newStatus) {
  const { error } = await supabase.rpc('advance_production_status', {
    p_manuscript_id: manuscriptId,
    p_new_status: newStatus,
  })

  return { error }
}

// -------------------------------------------------------------------------
// Phase 2: Typesetting, Author Proof, Corrections, Final Approval
// -------------------------------------------------------------------------

/**
 * Start typesetting for a manuscript (ready_for_typesetting -> typesetting).
 */
export async function startTypesetting(manuscriptId, typesetterId) {
  const { error } = await supabase.rpc('start_typesetting', {
    p_manuscript_id: manuscriptId,
    p_typesetter_id: typesetterId,
  })

  return { error }
}

/**
 * Upload a new proof version for a manuscript.
 */
export async function uploadProofVersion(manuscriptId, proofData) {
  const { error } = await supabase.rpc('upload_proof_version', {
    p_manuscript_id: manuscriptId,
    p_file_name: proofData.fileName,
    p_file_type: proofData.fileType,
    p_file_size_bytes: proofData.fileSizeBytes,
    p_storage_path: proofData.storagePath,
    p_file_hash: proofData.fileHash,
    p_proof_purpose: proofData.proofPurpose,
    p_notes: proofData.notes,
  })

  return { error }
}

/**
 * Issue the current proof to the author for review (typesetting -> author_proof).
 */
export async function issueAuthorProof(manuscriptId) {
  const { error } = await supabase.rpc('issue_author_proof', {
    p_manuscript_id: manuscriptId,
  })

  return { error }
}

/**
 * Submit proof correction requests (author_proof -> proof_corrections).
 */
export async function submitProofCorrections(manuscriptId, corrections) {
  const { error } = await supabase.rpc('submit_proof_corrections', {
    p_manuscript_id: manuscriptId,
    p_corrections: JSON.stringify(corrections),
  })

  return { error }
}

/**
 * Resolve a specific proof correction request.
 */
export async function resolveProofCorrection(correctionId, resolutionNote) {
  const { error } = await supabase.rpc('resolve_proof_correction', {
    p_correction_id: correctionId,
    p_resolution_note: resolutionNote,
  })

  return { error }
}

/**
 * Reject a specific proof correction request.
 */
export async function rejectProofCorrection(correctionId, resolutionNote) {
  const { error } = await supabase.rpc('reject_proof_correction', {
    p_correction_id: correctionId,
    p_resolution_note: resolutionNote,
  })

  return { error }
}

/**
 * Author approves the final proof (author_proof -> final_proof_approval).
 */
export async function approveFinalProof(manuscriptId) {
  const { error } = await supabase.rpc('approve_final_proof', {
    p_manuscript_id: manuscriptId,
  })

  return { error }
}

/**
 * Mark manuscript as publication ready (final_proof_approval -> publication_ready).
 */
export async function markPublicationReady(manuscriptId) {
  const { error } = await supabase.rpc('mark_publication_ready', {
    p_manuscript_id: manuscriptId,
  })

  return { error }
}

/**
 * Return to typesetting after corrections are resolved (proof_corrections -> typesetting).
 */
export async function returnToTypesetting(manuscriptId) {
  const { error } = await supabase.rpc('return_to_typesetting', {
    p_manuscript_id: manuscriptId,
  })

  return { error }
}

/**
 * Get the current proof version for a manuscript.
 */
export async function getCurrentProofVersion(manuscriptId) {
  const { data, error } = await supabase.rpc('get_current_proof_version', {
    p_manuscript_id: manuscriptId,
  })

  return { data, error }
}

/**
 * Get all correction requests for a manuscript.
 */
export async function getProofCorrections(manuscriptId) {
  const { data, error } = await supabase.rpc('get_proof_corrections', {
    p_manuscript_id: manuscriptId,
  })

  return { data, error }
}

/**
 * Get proof version history for a manuscript.
 */
export async function getProofHistory(manuscriptId) {
  const { data, error } = await supabase.rpc('get_proof_history', {
    p_manuscript_id: manuscriptId,
  })

  return { data, error }
}

// -------------------------------------------------------------------------
// Real Supabase Storage integration for proof files
// -------------------------------------------------------------------------

/**
 * Upload a proof file to Supabase Storage and register it in the database.
 * This follows the same pattern as uploadPublicationFile in publicationService.js.
 */
export async function uploadProofFile(manuscriptId, file, nextVersionNumber, notes = '') {
  try {
    // Validate file
    if (!file) {
      return { data: null, error: new Error('No file provided') }
    }

    if (file.size === 0) {
      return { data: null, error: new Error('File is empty') }
    }

    // Validate file type (prefer PDF for proofs)
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      return { data: null, error: new Error('Only PDF and DOCX files are supported for proof uploads') }
    }

    // Generate storage path following the convention from migration 0012
    const fileExtension = file.name.split('.').pop()
    const storagePath = `${manuscriptId}/production/proofs/${nextVersionNumber}/proof.${fileExtension}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('publications')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      return { data: null, error: uploadError }
    }

    // Calculate file hash (SHA-256) for duplicate detection
    const fileBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Register proof version in database using the existing RPC
    const { data, error } = await uploadProofVersion(manuscriptId, {
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      storagePath: storagePath,
      fileHash: fileHash,
      proofPurpose: 'typeset',
      notes: notes,
    })

    if (error) {
      // Clean up storage if database insert fails
      await supabase.storage.from('publications').remove([storagePath])
      return { data: null, error }
    }

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Get a signed URL for a proof file for authorized access.
 * This provides time-limited access to private proof files.
 */
export async function getProofFileUrl(storagePath, expiresIn = 3600) {
  try {
    const { data, error } = await supabase
      .storage
      .from('publications')
      .createSignedUrl(storagePath, expiresIn)

    if (error) {
      return { data: null, error }
    }

    return { data: data.signedUrl, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Validate a proof file before upload.
 */
export function validateProofFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' }
  }

  // Maximum file size: 50MB
  const MAX_FILE_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 50MB limit' }
  }

  // Allowed file types
  const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only PDF and DOCX files are supported' }
  }

  return { valid: true, error: null }
}
