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
    metadataVerified: row.metadata_verified,
    enteredProductionAt: row.entered_production_at,
    copyeditingCompletedAt: row.copyediting_completed_at,
    metadataVerifiedAt: row.metadata_verified_at,
    readyForTypesettingAt: row.ready_for_typesetting_at,
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
      withNames[nameKey] = record[key] ? (byId.get(record[key])?.full_name ?? byId.get(record[key])?.email ?? null) : null
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
    ['productionEditorId', 'copyeditorId'],
  )
  return { data: withNames, error: null }
}

/** Basic counts for the production dashboard's summary cards. */
export async function getProductionStats() {
  const { data, error } = await getProductionQueue()
  if (error) {
    return {
      data: { total: 0, accepted: 0, copyediting: 0, metadataVerification: 0, readyForTypesetting: 0 },
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
