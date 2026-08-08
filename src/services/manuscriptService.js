// Supabase-backed replacement for localStorageService.js.
//
// This is the ONLY module that should query the `manuscripts` table.
// Pages must go through the functions exported here rather than calling
// `supabase.from('manuscripts')` directly, so data access stays centralized
// and easy to change later.
//
// Every function returns { data, error } so callers can render proper
// loading/error/empty states instead of assuming success.

import { supabase } from '../lib/supabase.js'

const TABLE = 'manuscripts'

// Workflow: submitted -> editorial_review -> revision_requested
//                                          -> under_peer_review -> accepted -> published
//                                          -> rejected
// 'submitted' and 'editorial_review' are treated as one combined queue —
// "awaiting editorial screening" — since no separate action currently moves
// a manuscript from one to the other. Everything else is a decision an
// editor/admin has already made.
export const AWAITING_SCREENING_STATUSES = ['submitted', 'editorial_review']

const DECISION_TO_STATUS = {
  peer_review: 'under_peer_review',
  revision: 'revision_requested',
  reject: 'rejected',
}

// Map the DB's snake_case columns to the camelCase shape the existing UI
// components already expect (same field names as the old localStorage
// submissions), so pages need minimal changes.
function fromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    submittingAuthorId: row.submitting_author_id,
    title: row.title,
    abstract: row.abstract,
    authors: row.authors,
    categorySlug: row.category,
    articleType: row.article_type,
    content: row.content,
    keywords: row.keywords,
    institution: row.institution,
    correspondingEmail: row.corresponding_email,
    references: row.references,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    screeningNotes: row.screening_notes,
  }
}

function toInsertRow(data, authorId) {
  return {
    submitting_author_id: authorId,
    title: data.title?.trim() ?? '',
    abstract: data.abstract?.trim() ?? '',
    authors: data.authors?.trim() ?? '',
    category: data.categorySlug ?? '',
    article_type: data.articleType ?? '',
    content: data.content?.trim() ?? '',
    keywords: data.keywords?.trim() ?? '',
    institution: data.institution?.trim() ?? '',
    corresponding_email: data.correspondingEmail?.trim() ?? '',
    references: data.references?.trim() ?? '',
  }
}

// Batches lookups for the submitting author's and reviewing editor's
// display names against public.profiles (readable by any authenticated
// user), and attaches them to each manuscript. One query regardless of how
// many manuscripts/distinct people are involved.
async function attachProfileNames(manuscripts) {
  const ids = new Set()
  for (const m of manuscripts) {
    if (m.submittingAuthorId) ids.add(m.submittingAuthorId)
    if (m.reviewedBy) ids.add(m.reviewedBy)
  }

  if (ids.size === 0) return manuscripts

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', Array.from(ids))

  if (error) {
    console.error('MedPublish: failed to load profile names', error)
    return manuscripts
  }

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  return manuscripts.map((m) => ({
    ...m,
    submittingAuthorName: byId.get(m.submittingAuthorId)?.full_name ?? null,
    submittingAuthorEmail: byId.get(m.submittingAuthorId)?.email ?? null,
    reviewerName: m.reviewedBy ? (byId.get(m.reviewedBy)?.full_name ?? null) : null,
  }))
}

/** Every submission belonging to the current signed-in author. */
export async function getMySubmissions() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('submitted_at', { ascending: false })

  return { data: error ? [] : data.map(fromRow), error }
}

/** Every submission, for the editor/admin review queue. RLS enforces role. */
export async function getSubmissions() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('submitted_at', { ascending: false })

  if (error) return { data: [], error }

  const withNames = await attachProfileNames(data.map(fromRow))
  return { data: withNames, error: null }
}

/** Alias for getSubmissions(), named to match the editorial-screening queue's purpose. */
export const getEditorialSubmissions = getSubmissions

export async function getSubmissionById(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error || !data) return { data: fromRow(data), error }

  const [withNames] = await attachProfileNames([fromRow(data)])
  return { data: withNames, error: null }
}

/** Save a new manuscript submission for the currently authenticated user. */
export async function saveSubmission(formData, authorId) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(toInsertRow(formData, authorId))
    .select()
    .single()

  return { data: fromRow(data), error }
}

/**
 * Record an editorial screening decision.
 *
 * `decision` is one of 'peer_review' | 'revision' | 'reject'. `reviewed_by`
 * and `reviewed_at` are stamped server-side by the stamp_editorial_decision
 * trigger — this function never sends them itself, so a decision can never
 * be misattributed to the wrong editor.
 */
export async function updateEditorialDecision(id, { decision, notes } = {}) {
  const status = DECISION_TO_STATUS[decision]
  if (!status) {
    return { data: null, error: new Error(`Unknown editorial decision: "${decision}"`) }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ status, screening_notes: notes?.trim() || null })
    .eq('id', id)
    .select()
    .single()

  return { data: fromRow(data), error }
}

/** Published manuscripts — these are merged into the public Research Library. */
export async function getPublishedSubmissions() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'published')
    .order('reviewed_at', { ascending: false })

  return { data: error ? [] : data.map(fromRow), error }
}

/** Basic counts for the admin dashboard's summary cards. */
export async function getSubmissionStats() {
  const { data, error } = await getSubmissions()
  if (error) {
    return {
      data: {
        total: 0,
        awaitingScreening: 0,
        revisionRequested: 0,
        underPeerReview: 0,
        awaitingEditorDecision: 0,
        accepted: 0,
        rejected: 0,
      },
      error,
    }
  }
  return {
    data: {
      total: data.length,
      awaitingScreening: data.filter((s) => AWAITING_SCREENING_STATUSES.includes(s.status)).length,
      revisionRequested: data.filter((s) => s.status === 'revision_requested').length,
      underPeerReview: data.filter((s) => s.status === 'under_peer_review').length,
      // Manuscripts an editor still needs to act on post-peer-review: either
      // currently under review, or the author has just resubmitted.
      awaitingEditorDecision: data.filter((s) =>
        ['under_peer_review', 'revision_submitted'].includes(s.status),
      ).length,
      minorRevisionRequested: data.filter((s) => s.status === 'minor_revision_requested').length,
      majorRevisionRequested: data.filter((s) => s.status === 'major_revision_requested').length,
      revisionSubmitted: data.filter((s) => s.status === 'revision_submitted').length,
      accepted: data.filter((s) => s.status === 'accepted').length,
      rejected: data.filter((s) => s.status === 'rejected').length,
    },
    error: null,
  }
}
