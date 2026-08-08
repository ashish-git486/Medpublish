// Supabase-backed peer review service.
//
// This is the ONLY module that should query `review_assignments` and
// `reviews`. Pages must go through the functions exported here rather than
// calling `supabase.from(...)` directly, matching the pattern already
// established by manuscriptService.js.
//
// Every function returns { data, error } so callers can render proper
// loading/error/empty states instead of assuming success.

import { supabase } from '../lib/supabase.js'

const ASSIGNMENTS_TABLE = 'review_assignments'
const REVIEWS_TABLE = 'reviews'

// Manuscript columns pulled in whenever an assignment needs to display
// paper context (title, authors, category) without a second round trip.
const MANUSCRIPT_SUMMARY_COLUMNS =
  'id, title, authors, category, article_type, status, submitted_at'

export const RECOMMENDATION_OPTIONS = [
  { value: 'accept', label: 'Accept' },
  { value: 'minor_revision', label: 'Minor Revision' },
  { value: 'major_revision', label: 'Major Revision' },
  { value: 'reject', label: 'Reject' },
]

export const SCORE_FIELDS = [
  { key: 'originalityScore', column: 'originality_score', label: 'Originality' },
  { key: 'methodologyScore', column: 'methodology_score', label: 'Methodology' },
  {
    key: 'statisticalQualityScore',
    column: 'statistical_quality_score',
    label: 'Statistical Quality',
  },
  {
    key: 'clinicalRelevanceScore',
    column: 'clinical_relevance_score',
    label: 'Clinical Relevance',
  },
  { key: 'writingQualityScore', column: 'writing_quality_score', label: 'Writing Quality' },
  {
    key: 'ethicalComplianceScore',
    column: 'ethical_compliance_score',
    label: 'Ethical Compliance',
  },
]

// ---------------------------------------------------------------------
// Row <-> camelCase mapping
// ---------------------------------------------------------------------

function assignmentFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    reviewerId: row.reviewer_id,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    completedAt: row.completed_at,
    status: row.status,
    versionId: row.version_id,
    versionNumber: row.manuscript_versions?.version_number ?? null,
    manuscript: row.manuscripts
      ? {
          id: row.manuscripts.id,
          title: row.manuscripts.title,
          authors: row.manuscripts.authors,
          categorySlug: row.manuscripts.category,
          articleType: row.manuscripts.article_type,
          status: row.manuscripts.status,
          submittedAt: row.manuscripts.submitted_at,
        }
      : null,
  }
}

function reviewFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    assignmentId: row.assignment_id,
    reviewerId: row.reviewer_id,
    overallRecommendation: row.overall_recommendation,
    originalityScore: row.originality_score,
    methodologyScore: row.methodology_score,
    statisticalQualityScore: row.statistical_quality_score,
    clinicalRelevanceScore: row.clinical_relevance_score,
    writingQualityScore: row.writing_quality_score,
    ethicalComplianceScore: row.ethical_compliance_score,
    majorComments: row.major_comments,
    minorComments: row.minor_comments,
    commentsToEditor: row.comments_to_editor,
    confidential: row.confidential,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    versionNumber: row.review_assignments?.manuscript_versions?.version_number ?? null,
  }
}

function toReviewInsertRow({ assignmentId, reviewerId, form }) {
  return {
    assignment_id: assignmentId,
    reviewer_id: reviewerId,
    overall_recommendation: form.overallRecommendation,
    originality_score: form.originalityScore,
    methodology_score: form.methodologyScore,
    statistical_quality_score: form.statisticalQualityScore,
    clinical_relevance_score: form.clinicalRelevanceScore,
    writing_quality_score: form.writingQualityScore,
    ethical_compliance_score: form.ethicalComplianceScore,
    major_comments: form.majorComments?.trim() || null,
    minor_comments: form.minorComments?.trim() || null,
    comments_to_editor: form.commentsToEditor?.trim() || null,
    confidential: Boolean(form.confidential),
  }
}

// Attaches reviewer display names (from public.profiles) to a list of
// assignments or reviews. One batched query regardless of list size.
async function attachReviewerNames(items, reviewerIdKey = 'reviewerId') {
  const ids = new Set(items.map((item) => item[reviewerIdKey]).filter(Boolean))
  if (ids.size === 0) return items

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', Array.from(ids))

  if (error) {
    console.error('MedPublish: failed to load reviewer names', error)
    return items
  }

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  return items.map((item) => ({
    ...item,
    reviewerName: byId.get(item[reviewerIdKey])?.full_name ?? null,
    reviewerEmail: byId.get(item[reviewerIdKey])?.email ?? null,
  }))
}

// ---------------------------------------------------------------------
// Reviewer directory (for the editor's "assign reviewer" picker)
// ---------------------------------------------------------------------

/** Every user currently holding the 'reviewer' role. Editor/admin only (RLS on profiles is open-read, so no extra policy needed). */
export async function getReviewerCandidates() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, institution')
    .eq('role', 'reviewer')
    .order('full_name', { ascending: true })

  return { data: data ?? [], error }
}

// ---------------------------------------------------------------------
// Editor-side: assigning reviewers + tracking progress
// ---------------------------------------------------------------------

/** Assign a reviewer to a manuscript. `assigned_by`/`assigned_at` are stamped server-side. */
export async function assignReviewer(manuscriptId, reviewerId) {
  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .insert({ manuscript_id: manuscriptId, reviewer_id: reviewerId })
    .select()
    .single()

  return { data: assignmentFromRow(data), error }
}

/** All assignments (+ reviewer names) for one manuscript, for the editor's peer-review panel. */
export async function getAssignmentsForManuscript(manuscriptId) {
  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .select('*, manuscript_versions (version_number)')
    .eq('manuscript_id', manuscriptId)
    .order('assigned_at', { ascending: true })

  if (error) return { data: [], error }

  const withNames = await attachReviewerNames(data.map(assignmentFromRow))
  return { data: withNames, error: null }
}

/** All completed reviews (+ reviewer names) for one manuscript, for the editor's peer-review panel. */
export async function getReviewsForEditor(manuscriptId) {
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select('*, review_assignments (manuscript_versions (version_number))')
    .eq('manuscript_id', manuscriptId)
    .order('submitted_at', { ascending: true })

  if (error) return { data: [], error, averageScores: null }

  const withNames = await attachReviewerNames(data.map(reviewFromRow))
  return { data: withNames, error: null, averageScores: computeAverageScores(withNames) }
}

function computeAverageScores(reviews) {
  if (!reviews || reviews.length === 0) return null

  const totals = SCORE_FIELDS.reduce((acc, field) => {
    acc[field.key] = 0
    return acc
  }, {})

  for (const review of reviews) {
    for (const field of SCORE_FIELDS) {
      totals[field.key] += review[field.key] ?? 0
    }
  }

  const averages = {}
  for (const field of SCORE_FIELDS) {
    averages[field.key] = Math.round((totals[field.key] / reviews.length) * 10) / 10
  }
  return averages
}

// ---------------------------------------------------------------------
// Reviewer-side: dashboard + accept/decline/submit
// ---------------------------------------------------------------------

/** Every assignment belonging to the current signed-in reviewer, with manuscript context embedded. */
export async function getMyAssignments() {
  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .select(`*, manuscripts (${MANUSCRIPT_SUMMARY_COLUMNS})`)
    .order('assigned_at', { ascending: false })

  return { data: error ? [] : data.map(assignmentFromRow), error }
}

/** Grouped view + basic stats for the Reviewer Dashboard. */
export async function getReviewerDashboard() {
  const { data, error } = await getMyAssignments()
  if (error) {
    return {
      data: { assigned: [], accepted: [], completed: [], stats: emptyReviewerStats() },
      error,
    }
  }

  const assigned = data.filter((a) => a.status === 'assigned')
  const accepted = data.filter((a) => a.status === 'accepted')
  const completed = data.filter((a) => a.status === 'submitted')
  const declined = data.filter((a) => a.status === 'declined')

  return {
    data: {
      assigned,
      accepted,
      completed,
      stats: {
        total: data.length,
        pendingResponse: assigned.length,
        inProgress: accepted.length,
        completed: completed.length,
        declined: declined.length,
      },
    },
    error: null,
  }
}

function emptyReviewerStats() {
  return { total: 0, pendingResponse: 0, inProgress: 0, completed: 0, declined: 0 }
}

/** A single assignment (with manuscript context), for the Accept/Decline card and the review form. */
export async function getAssignmentById(assignmentId) {
  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .select(`*, manuscripts (${MANUSCRIPT_SUMMARY_COLUMNS}, abstract, content, keywords, references, institution)`)
    .eq('id', assignmentId)
    .maybeSingle()

  return { data: assignmentFromRow(data), error }
}

/** The reviewer's own submitted review for an assignment, if one already exists (prevents re-showing the form). */
export async function getMyReviewForAssignment(assignmentId) {
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select('*')
    .eq('assignment_id', assignmentId)
    .maybeSingle()

  return { data: reviewFromRow(data), error }
}

export async function acceptReviewAssignment(assignmentId) {
  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .update({ status: 'accepted' })
    .eq('id', assignmentId)
    .select()
    .single()

  return { data: assignmentFromRow(data), error }
}

export async function declineReviewAssignment(assignmentId) {
  const { data, error } = await supabase
    .from(ASSIGNMENTS_TABLE)
    .update({ status: 'declined' })
    .eq('id', assignmentId)
    .select()
    .single()

  return { data: assignmentFromRow(data), error }
}

/**
 * Submit a structured review for an accepted assignment.
 *
 * The database enforces the rest: the `validate_review_against_assignment`
 * trigger rejects submissions against assignments that aren't the
 * reviewer's own or aren't in 'accepted' status, the unique constraint on
 * `assignment_id` prevents a second review for the same assignment, and
 * the `mark_assignment_submitted` trigger flips the assignment to
 * 'submitted' and stamps `completed_at` automatically.
 */
export async function submitReview({ assignmentId, reviewerId, form }) {
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .insert(toReviewInsertRow({ assignmentId, reviewerId, form }))
    .select()
    .single()

  return { data: reviewFromRow(data), error }
}
