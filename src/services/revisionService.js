// Supabase-backed revision management service.
//
// This is the ONLY module that should query `manuscript_versions`,
// `editor_decisions`, `revision_requests`, `author_responses`, and
// `manuscript_events`, matching the pattern established by
// manuscriptService.js and reviewService.js.
//
// Every function returns { data, error } so callers can render proper
// loading/error/empty states instead of assuming success.

import { supabase } from '../lib/supabase.js'

const VERSIONS_TABLE = 'manuscript_versions'
const DECISIONS_TABLE = 'editor_decisions'
const REVISION_REQUESTS_TABLE = 'revision_requests'
const RESPONSES_TABLE = 'author_responses'
const EVENTS_TABLE = 'manuscript_events'

// ---------------------------------------------------------------------
// Row <-> camelCase mapping
// ---------------------------------------------------------------------

function versionFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    versionNumber: row.version_number,
    title: row.title,
    abstract: row.abstract,
    authors: row.authors,
    content: row.content,
    keywords: row.keywords,
    references: row.references,
    submittedBy: row.submitted_by,
    createdAt: row.created_at,
  }
}

function decisionFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    versionId: row.version_id,
    versionNumber: row.manuscript_versions?.version_number ?? null,
    editorId: row.editor_id,
    decision: row.decision,
    decisionLetter: row.decision_letter,
    reviewerSummary: row.reviewer_summary,
    authorInstructions: row.author_instructions,
    revisionDeadline: row.revision_deadline,
    createdAt: row.created_at,
  }
}

function revisionRequestFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    editorDecisionId: row.editor_decision_id,
    versionId: row.version_id,
    revisionType: row.revision_type,
    deadline: row.deadline,
    status: row.status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    decision: row.editor_decisions ? decisionFromRow(row.editor_decisions) : null,
  }
}

function authorResponseFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    revisionRequestId: row.revision_request_id,
    manuscriptId: row.manuscript_id,
    newVersionId: row.new_version_id,
    newVersionNumber: row.manuscript_versions?.version_number ?? null,
    responseLetter: row.response_letter,
    generalNotes: row.general_notes,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
  }
}

function eventFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    status: row.status,
    actorId: row.actor_id,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------

/** Every version of a manuscript, oldest first — for the version history panel. */
export async function getVersionsForManuscript(manuscriptId) {
  const { data, error } = await supabase
    .from(VERSIONS_TABLE)
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('version_number', { ascending: true })

  return { data: error ? [] : data.map(versionFromRow), error }
}

// ---------------------------------------------------------------------
// Editor decisions (Accept / Minor Revision / Major Revision / Reject)
// ---------------------------------------------------------------------

/**
 * Record a post-peer-review editorial decision.
 *
 * `editor_id`, `created_at`, and `version_id` (the manuscript's current
 * version at the time of the decision) are all stamped server-side by the
 * stamp_editor_decision trigger. A database trigger (apply_editor_decision)
 * then moves the manuscript's status and — for minor/major revision —
 * creates the revision_requests row automatically, so this call is the
 * single source of truth for the whole transition.
 */
export async function recordEditorDecision(manuscriptId, {
  decision,
  decisionLetter,
  reviewerSummary,
  authorInstructions,
  revisionDeadline,
} = {}) {
  const { data, error } = await supabase
    .from(DECISIONS_TABLE)
    .insert({
      manuscript_id: manuscriptId,
      decision,
      decision_letter: decisionLetter?.trim() || null,
      reviewer_summary: reviewerSummary?.trim() || null,
      author_instructions: authorInstructions?.trim() || null,
      revision_deadline: revisionDeadline || null,
    })
    .select('*, manuscript_versions (version_number)')
    .single()

  return { data: decisionFromRow(data), error }
}

/** Every past editorial decision for a manuscript, oldest first — decision history. */
export async function getDecisionsForManuscript(manuscriptId) {
  const { data, error } = await supabase
    .from(DECISIONS_TABLE)
    .select('*, manuscript_versions (version_number)')
    .eq('manuscript_id', manuscriptId)
    .order('created_at', { ascending: true })

  return { data: error ? [] : data.map(decisionFromRow), error }
}

// ---------------------------------------------------------------------
// Revision requests (the author's actionable task)
// ---------------------------------------------------------------------

/** The single outstanding (pending) revision request for a manuscript, if any. */
export async function getPendingRevisionRequest(manuscriptId) {
  const { data, error } = await supabase
    .from(REVISION_REQUESTS_TABLE)
    .select('*, editor_decisions (*, manuscript_versions (version_number))')
    .eq('manuscript_id', manuscriptId)
    .eq('status', 'pending')
    .maybeSingle()

  return { data: revisionRequestFromRow(data), error }
}

/** A single revision request by id, with its editor decision embedded — for the revision submission page. */
export async function getRevisionRequestById(id) {
  const { data, error } = await supabase
    .from(REVISION_REQUESTS_TABLE)
    .select('*, editor_decisions (*, manuscript_versions (version_number))')
    .eq('id', id)
    .maybeSingle()

  return { data: revisionRequestFromRow(data), error }
}

/** Every revision request for a manuscript, oldest first — for the editor's history view. */
export async function getRevisionRequestsForManuscript(manuscriptId) {
  const { data, error } = await supabase
    .from(REVISION_REQUESTS_TABLE)
    .select('*, editor_decisions (*, manuscript_versions (version_number))')
    .eq('manuscript_id', manuscriptId)
    .order('created_at', { ascending: true })

  return { data: error ? [] : data.map(revisionRequestFromRow), error }
}

/**
 * The non-confidential reviewer comments (recommendation + major/minor
 * comments only — no reviewer identity, no scores, no comments_to_editor)
 * for the review round tied to a revision request. Goes through the
 * get_author_visible_reviews() database function, which is the only path
 * by which an author-facing page ever touches anything derived from the
 * `reviews` table.
 */
export async function getAuthorVisibleReviews(revisionRequestId) {
  const { data, error } = await supabase.rpc('get_author_visible_reviews', {
    p_revision_request_id: revisionRequestId,
  })

  if (error) return { data: [], error }

  return {
    data: (data ?? []).map((row) => ({
      overallRecommendation: row.overall_recommendation,
      majorComments: row.major_comments,
      minorComments: row.minor_comments,
      submittedAt: row.submitted_at,
    })),
    error: null,
  }
}

// ---------------------------------------------------------------------
// Author responses / revision submission
// ---------------------------------------------------------------------

/**
 * Submit a revised manuscript against a pending revision request.
 *
 * Goes through the submit_manuscript_revision() database function, which
 * atomically creates the new manuscript_versions row, updates the live
 * manuscript row (content + status -> 'revision_submitted'), logs the
 * author_responses row, and closes out the revision request. The function
 * itself verifies the caller owns the manuscript and that the revision
 * request is still pending, so there's no way to submit against someone
 * else's manuscript or resubmit against an already-fulfilled request.
 */
export async function submitManuscriptRevision(revisionRequestId, form) {
  const { data, error } = await supabase.rpc('submit_manuscript_revision', {
    p_revision_request_id: revisionRequestId,
    p_title: form.title,
    p_abstract: form.abstract,
    p_authors: form.authors,
    p_content: form.content,
    p_keywords: form.keywords,
    p_references: form.references,
    p_response_letter: form.responseLetter,
    p_general_notes: form.generalNotes,
  })

  return { data: error ? null : data, error }
}

/** The author response tied to a revision request (once submitted) — for the editor's review of what changed. */
export async function getAuthorResponseForRevisionRequest(revisionRequestId) {
  const { data, error } = await supabase
    .from(RESPONSES_TABLE)
    .select('*, manuscript_versions (version_number)')
    .eq('revision_request_id', revisionRequestId)
    .maybeSingle()

  return { data: authorResponseFromRow(data), error }
}

// ---------------------------------------------------------------------
// Timeline (manuscript_events)
// ---------------------------------------------------------------------

/** Full status-change history for a manuscript, oldest first — powers the author-facing timeline. */
export async function getManuscriptTimeline(manuscriptId) {
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('created_at', { ascending: true })

  return { data: error ? [] : data.map(eventFromRow), error }
}
