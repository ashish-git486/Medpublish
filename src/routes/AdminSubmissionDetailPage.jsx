import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getCategoryBySlug } from '../data/mockData.js'
import {
  AWAITING_EDITOR_DECISION_STATUSES,
  statusBadgeClassName,
  statusLabel,
} from '../data/manuscriptStatus.js'
import {
  assignmentStatusBadgeClassName,
  assignmentStatusLabel,
  recommendationBadgeClassName,
  recommendationLabel,
} from '../data/reviewStatus.js'
import { DECISION_META, decisionBadgeClassName, decisionLabel } from '../data/editorDecisionStatus.js'
import {
  AWAITING_SCREENING_STATUSES,
  getSubmissionById,
  updateEditorialDecision,
} from '../services/manuscriptService.js'
import {
  SCORE_FIELDS,
  assignReviewer,
  getAssignmentsForManuscript,
  getReviewerCandidates,
  getReviewsForEditor,
} from '../services/reviewService.js'
import {
  getAuthorResponseForRevisionRequest,
  getDecisionsForManuscript,
  getRevisionRequestsForManuscript,
  getVersionsForManuscript,
  recordEditorDecision,
} from '../services/revisionService.js'

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide ${statusBadgeClassName(status)}`}
    >
      {statusLabel(status)}
    </span>
  )
}

function formatDate(isoDate) {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function DetailField({ label, children }) {
  return (
    <div>
      <h4 className="font-mono text-xs uppercase tracking-wide text-slate-500">{label}</h4>
      <div className="mt-1.5 text-sm leading-relaxed text-slate-700">{children}</div>
    </div>
  )
}

const ACTIONS = {
  peer_review: {
    label: 'Send to Peer Review',
    confirmCopy: 'Send this manuscript to peer review? It will leave editorial screening.',
    notesRequired: false,
    notesLabel: 'Note to reviewers (optional)',
    buttonClassName: 'bg-teal-700 hover:bg-teal-800',
    confirmClassName: 'bg-teal-700 hover:bg-teal-800',
  },
  revision: {
    label: 'Request Revision',
    confirmCopy: 'Request a revision from the author? Explain what needs to change below.',
    notesRequired: true,
    notesLabel: 'What needs to be revised? (required)',
    buttonClassName: 'border border-gold-500 text-gold-600 hover:bg-gold-500/10',
    confirmClassName: 'bg-gold-600 hover:bg-gold-500',
  },
  reject: {
    label: 'Reject',
    confirmCopy: 'Reject this manuscript at editorial screening? This cannot be undone from here.',
    notesRequired: true,
    notesLabel: 'Reason for rejection (required)',
    buttonClassName: 'border border-red-200 text-red-600 hover:bg-red-50',
    confirmClassName: 'bg-red-600 hover:bg-red-700',
  },
}

// Manuscript statuses at which peer review is relevant to show. Peer
// review only begins once an editor has sent the manuscript there via the
// editorial screening decision above.
const PEER_REVIEW_VISIBLE_STATUSES = [
  'under_peer_review',
  'minor_revision_requested',
  'major_revision_requested',
  'revision_submitted',
  'accepted',
  'rejected',
  'published',
]

// Which decision buttons to offer. Same four everywhere for now — kept as a
// list (not derived from DECISION_META directly) so display order is
// explicit and independent of object key order.
const DECISION_ORDER = ['accept', 'minor_revision', 'major_revision', 'reject']

function AssignmentStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${assignmentStatusBadgeClassName(status)}`}
    >
      {assignmentStatusLabel(status)}
    </span>
  )
}

function RecommendationBadge({ value }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${recommendationBadgeClassName(value)}`}
    >
      {recommendationLabel(value)}
    </span>
  )
}

function formatDateTime(isoDate) {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function PeerReviewPanel({ manuscriptId }) {
  const [assignments, setAssignments] = useState([])
  const [reviews, setReviews] = useState([])
  const [averageScores, setAverageScores] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [selectedReviewerId, setSelectedReviewerId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    const [
      { data: assignmentsData, error: assignmentsError },
      { data: reviewsData, error: reviewsError, averageScores: avg },
      { data: candidatesData, error: candidatesError },
    ] = await Promise.all([
      getAssignmentsForManuscript(manuscriptId),
      getReviewsForEditor(manuscriptId),
      getReviewerCandidates(),
    ])

    if (assignmentsError || reviewsError || candidatesError) {
      console.error(
        'MedPublish: failed to load peer review data',
        assignmentsError ?? reviewsError ?? candidatesError,
      )
      setLoadError(true)
    } else {
      setAssignments(assignmentsData)
      setReviews(reviewsData)
      setAverageScores(avg)
      setCandidates(candidatesData)
    }
    setLoading(false)
  }, [manuscriptId])

  useEffect(() => {
    load()
  }, [load])

  const assignedReviewerIds = new Set(
    assignments.filter((a) => a.status !== 'declined').map((a) => a.reviewerId),
  )
  const availableCandidates = candidates.filter((c) => !assignedReviewerIds.has(c.id))

  async function handleAssign() {
    if (!selectedReviewerId) return
    setAssigning(true)
    setAssignError(null)
    const { error } = await assignReviewer(manuscriptId, selectedReviewerId)
    setAssigning(false)
    if (error) {
      console.error('MedPublish: failed to assign reviewer', error)
      setAssignError('Could not assign this reviewer. Please try again.')
      return
    }
    setSelectedReviewerId('')
    await load()
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-ink">Peer review</h2>
      <p className="mt-1 text-sm text-slate-600">
        Assign reviewers, track their progress, and review completed reports. Reviewer identities
        are never shown to the author.
      </p>

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">Loading peer review data…</p>
      ) : loadError ? (
        <p className="mt-5 text-sm text-red-600">
          We couldn't load peer review data right now. Please try again shortly.
        </p>
      ) : (
        <>
          {/* Assign reviewer */}
          <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg bg-paper p-4">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="reviewer-select" className="font-mono text-xs uppercase tracking-wide text-slate-500">
                Assign a reviewer
              </label>
              <select
                id="reviewer-select"
                value={selectedReviewerId}
                onChange={(e) => setSelectedReviewerId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              >
                <option value="">
                  {availableCandidates.length === 0 ? 'No available reviewers' : 'Select a reviewer…'}
                </option>
                {availableCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.email}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!selectedReviewerId || assigning}
              onClick={handleAssign}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {assigning ? 'Assigning…' : 'Assign reviewer'}
            </button>
          </div>
          {assignError && <p className="mt-2 text-sm text-red-600">{assignError}</p>}
          {candidates.length === 0 && (
            <p className="mt-2 text-xs text-slate-500">
              No users hold the reviewer role yet. Grant reviewer access from the dashboard's
              Reviewer Management panel first.
            </p>
          )}

          {/* Assignment progress */}
          <div className="mt-6">
            <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
              Assigned reviewers ({assignments.length})
            </h3>
            {assignments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No reviewers assigned yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div className="text-sm text-ink">
                      {a.reviewerName || a.reviewerEmail || 'Unknown reviewer'}
                      <span className="ml-2 text-xs text-slate-500">
                        assigned {formatDateTime(a.assignedAt)}
                      </span>
                    </div>
                    <AssignmentStatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed reviews */}
          <div className="mt-6 border-t border-slate-100 pt-6">
            <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
              Completed reviews ({reviews.length})
            </h3>

            {reviews.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No reviews submitted yet.</p>
            ) : (
              <>
                {averageScores && (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {SCORE_FIELDS.map((field) => (
                      <div key={field.key} className="rounded-lg bg-paper p-3 text-center">
                        <div className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                          {field.label}
                        </div>
                        <div className="mt-1 font-serif text-xl font-semibold text-ink">
                          {averageScores[field.key]}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-ink">
                          {review.reviewerName || review.reviewerEmail || 'Unknown reviewer'}
                        </div>
                        <div className="flex items-center gap-2">
                          {review.confidential && (
                            <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-white">
                              Confidential
                            </span>
                          )}
                          <RecommendationBadge value={review.overallRecommendation} />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Submitted {formatDateTime(review.submittedAt)}
                      </p>

                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {SCORE_FIELDS.map((field) => (
                          <div key={field.key} className="text-center">
                            <div className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                              {field.label}
                            </div>
                            <div className="text-sm font-semibold text-ink">{review[field.key]}</div>
                          </div>
                        ))}
                      </div>

                      {review.majorComments && (
                        <div className="mt-3">
                          <h4 className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
                            Major comments
                          </h4>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {review.majorComments}
                          </p>
                        </div>
                      )}
                      {review.minorComments && (
                        <div className="mt-3">
                          <h4 className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
                            Minor comments
                          </h4>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {review.minorComments}
                          </p>
                        </div>
                      )}
                      {review.commentsToEditor && (
                        <div className="mt-3 rounded-lg bg-paper p-3">
                          <h4 className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
                            Comments to editor only
                          </h4>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {review.commentsToEditor}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function DecisionBadge({ decision }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${decisionBadgeClassName(decision)}`}
    >
      {decisionLabel(decision)}
    </span>
  )
}

/**
 * Post-peer-review editorial decision: Accept / Minor Revision / Major
 * Revision / Reject. Shown once a manuscript has entered peer review
 * (under_peer_review) or a revised version has just come back in
 * (revision_submitted). Recording a decision here is a single insert into
 * editor_decisions — the database trigger handles moving the manuscript's
 * status and, for a revision decision, creating the revision_requests row
 * the author will see.
 */
function EditorDecisionPanel({ manuscriptId, onDecisionRecorded }) {
  const [activeDecision, setActiveDecision] = useState(null)
  const [decisionLetter, setDecisionLetter] = useState('')
  const [reviewerSummary, setReviewerSummary] = useState('')
  const [authorInstructions, setAuthorInstructions] = useState('')
  const [revisionDeadline, setRevisionDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function open(decisionKey) {
    setActiveDecision(decisionKey)
    setDecisionLetter('')
    setReviewerSummary('')
    setAuthorInstructions('')
    setRevisionDeadline('')
    setError(null)
  }

  function close() {
    setActiveDecision(null)
    setError(null)
  }

  async function confirm() {
    if (!decisionLetter.trim()) {
      setError('Please write a decision letter — the author will see this.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: recordError } = await recordEditorDecision(manuscriptId, {
      decision: activeDecision,
      decisionLetter,
      reviewerSummary,
      authorInstructions,
      revisionDeadline: revisionDeadline || null,
    })

    setSubmitting(false)

    if (recordError) {
      console.error('MedPublish: failed to record editorial decision', recordError)
      setError('Something went wrong recording this decision. Please try again.')
      return
    }

    close()
    onDecisionRecorded?.()
  }

  const isRevision = activeDecision === 'minor_revision' || activeDecision === 'major_revision'

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-ink">Editorial decision</h2>
      <p className="mt-1 text-sm text-slate-600">
        Based on the peer reviews above, choose how this manuscript proceeds. The decision
        letter and (for revisions) your author instructions are shown to the author; write your
        own summary of reviewer feedback rather than pasting confidential comments.
      </p>

      {!activeDecision ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {DECISION_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => open(key)}
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${DECISION_META[key].buttonClassName}`}
            >
              {DECISION_META[key].label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-3 rounded-lg bg-paper p-4">
          <p className="text-sm text-ink">{DECISION_META[activeDecision].confirmCopy}</p>

          <div>
            <label
              htmlFor="decision-letter"
              className="font-mono text-xs uppercase tracking-wide text-slate-500"
            >
              Decision letter (required, visible to author)
            </label>
            <textarea
              id="decision-letter"
              rows={4}
              value={decisionLetter}
              onChange={(e) => setDecisionLetter(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              placeholder="Dear Dr. …"
            />
          </div>

          <div>
            <label
              htmlFor="reviewer-summary"
              className="font-mono text-xs uppercase tracking-wide text-slate-500"
            >
              Summary of reviewer feedback (optional, visible to author)
            </label>
            <textarea
              id="reviewer-summary"
              rows={3}
              value={reviewerSummary}
              onChange={(e) => setReviewerSummary(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              placeholder="Write this yourself — never paste confidential comments to editor"
            />
          </div>

          {isRevision && (
            <>
              <div>
                <label
                  htmlFor="author-instructions"
                  className="font-mono text-xs uppercase tracking-wide text-slate-500"
                >
                  Instructions for the author (optional, visible to author)
                </label>
                <textarea
                  id="author-instructions"
                  rows={3}
                  value={authorInstructions}
                  onChange={(e) => setAuthorInstructions(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  placeholder="e.g. Please address each reviewer point in a numbered response letter."
                />
              </div>
              <div>
                <label
                  htmlFor="revision-deadline"
                  className="font-mono text-xs uppercase tracking-wide text-slate-500"
                >
                  Revision deadline (optional — defaults to 30 days from today)
                </label>
                <input
                  id="revision-deadline"
                  type="date"
                  value={revisionDeadline}
                  onChange={(e) => setRevisionDeadline(e.target.value)}
                  className="mt-1.5 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={confirm}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Recording…' : `Confirm: ${DECISION_META[activeDecision].label}`}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={close}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-ink hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Read-only history: every version submitted so far, and which was reviewed. */
function VersionHistoryPanel({ manuscriptId }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      setLoading(true)
      const { data, error } = await getVersionsForManuscript(manuscriptId)
      if (!isMounted) return
      if (error) console.error('MedPublish: failed to load manuscript versions', error)
      setVersions(data)
      setLoading(false)
    }
    load()
    return () => {
      isMounted = false
    }
  }, [manuscriptId])

  if (loading || versions.length <= 1) return null

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-ink">Version history</h2>
      <p className="mt-1 text-sm text-slate-600">
        Every submitted version remains accessible — nothing is ever overwritten.
      </p>
      <div className="mt-4 space-y-2">
        {versions.map((v) => {
          const isExpanded = expandedId === v.id
          return (
            <div key={v.id} className="rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : v.id)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-ink">
                  Version {v.versionNumber}
                  <span className="ml-2 font-normal text-slate-500">{formatDateTime(v.createdAt)}</span>
                </span>
                <span className="text-xs text-slate-500">{isExpanded ? 'Hide' : 'View'}</span>
              </button>
              {isExpanded && (
                <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                  <DetailField label="Title">{v.title}</DetailField>
                  <DetailField label="Abstract">
                    <p className="whitespace-pre-wrap">{v.abstract}</p>
                  </DetailField>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Read-only history: every editorial decision and, where applicable, the author's response. */
function RevisionHistoryPanel({ manuscriptId }) {
  const [decisions, setDecisions] = useState([])
  const [revisionRequests, setRevisionRequests] = useState([])
  const [responsesByRequestId, setResponsesByRequestId] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function load() {
      setLoading(true)
      const [{ data: decisionsData, error: decisionsError }, { data: requestsData, error: requestsError }] =
        await Promise.all([
          getDecisionsForManuscript(manuscriptId),
          getRevisionRequestsForManuscript(manuscriptId),
        ])
      if (!isMounted) return
      if (decisionsError || requestsError) {
        console.error('MedPublish: failed to load decision history', decisionsError ?? requestsError)
      }
      setDecisions(decisionsData)
      setRevisionRequests(requestsData)

      const submittedRequests = requestsData.filter((r) => r.status === 'submitted')
      const responseEntries = await Promise.all(
        submittedRequests.map(async (r) => {
          const { data } = await getAuthorResponseForRevisionRequest(r.id)
          return [r.id, data]
        }),
      )
      if (!isMounted) return
      setResponsesByRequestId(Object.fromEntries(responseEntries))
      setLoading(false)
    }
    load()
    return () => {
      isMounted = false
    }
  }, [manuscriptId])

  if (loading || decisions.length === 0) return null

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-ink">Decision history</h2>
      <div className="mt-4 space-y-4">
        {decisions.map((d) => {
          const request = revisionRequests.find((r) => r.editorDecisionId === d.id)
          const response = request ? responsesByRequestId[request.id] : null
          return (
            <div key={d.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  {formatDateTime(d.createdAt)}
                  {d.versionNumber ? ` — reviewed version ${d.versionNumber}` : ''}
                </span>
                <DecisionBadge decision={d.decision} />
              </div>
              {d.decisionLetter && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{d.decisionLetter}</p>
              )}
              {d.authorInstructions && (
                <div className="mt-2 rounded-lg bg-paper p-3">
                  <h4 className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
                    Instructions for author
                  </h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{d.authorInstructions}</p>
                </div>
              )}
              {request?.deadline && (
                <p className="mt-2 text-xs text-slate-500">Revision deadline: {request.deadline}</p>
              )}
              {response && (
                <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50/50 p-3">
                  <h4 className="font-mono text-[11px] uppercase tracking-wide text-teal-700">
                    Author response — submitted {formatDateTime(response.submittedAt)} (version{' '}
                    {response.newVersionNumber})
                  </h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {response.responseLetter}
                  </p>
                  {response.generalNotes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                      {response.generalNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AdminSubmissionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [activeAction, setActiveAction] = useState(null) // 'peer_review' | 'revision' | 'reject'
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)

  async function load() {
    setLoading(true)
    setLoadError(false)
    const { data, error } = await getSubmissionById(id)
    if (error || !data) {
      console.error('MedPublish: failed to load manuscript', error)
      setLoadError(true)
    } else {
      setSubmission(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function openAction(actionKey) {
    setActiveAction(actionKey)
    setNotes('')
    setActionError(null)
  }

  function closeAction() {
    setActiveAction(null)
    setNotes('')
    setActionError(null)
  }

  async function confirmAction() {
    const action = ACTIONS[activeAction]
    if (action.notesRequired && !notes.trim()) {
      setActionError('Please add a note before continuing — the author will see this.')
      return
    }

    setSubmitting(true)
    setActionError(null)

    const { error } = await updateEditorialDecision(id, { decision: activeAction, notes })

    setSubmitting(false)

    if (error) {
      console.error('MedPublish: failed to record editorial decision', error)
      setActionError('Something went wrong recording this decision. Please try again.')
      return
    }

    closeAction()
    await load()
  }

  if (loading) {
    return <p className="mx-auto max-w-4xl px-4 py-16 text-sm text-slate-500">Loading manuscript…</p>
  }

  if (loadError || !submission) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-10 text-center">
          <p className="text-red-600">
            We couldn't load this manuscript. It may not exist, or you may not have access.
          </p>
          <Link to="/admin" className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:text-teal-800">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const category = getCategoryBySlug(submission.categorySlug)
  const canScreen = AWAITING_SCREENING_STATUSES.includes(submission.status)

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Link to="/admin" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
        ← Back to dashboard
      </Link>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-slate-500">
            <span>{category?.name ?? submission.categorySlug}</span>
            <span className="text-slate-300">·</span>
            <span>{submission.articleType}</span>
            <span className="text-slate-300">·</span>
            <span>Submitted {formatDate(submission.submittedAt)}</span>
          </div>
          <h1 className="mt-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {submission.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{submission.authors}</p>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <DetailField label="Submitting author">
            {submission.submittingAuthorName || 'Unknown'}
            {submission.submittingAuthorEmail && (
              <span className="block text-slate-500">{submission.submittingAuthorEmail}</span>
            )}
          </DetailField>
          {submission.institution && (
            <DetailField label="Institution">{submission.institution}</DetailField>
          )}
          {submission.correspondingEmail && (
            <DetailField label="Corresponding author email">
              {submission.correspondingEmail}
            </DetailField>
          )}
          {submission.keywords && <DetailField label="Keywords">{submission.keywords}</DetailField>}
        </div>

        <div className="mt-6 space-y-6 border-t border-slate-100 pt-6">
          <DetailField label="Abstract">
            <p className="whitespace-pre-wrap">{submission.abstract}</p>
          </DetailField>

          <DetailField label="Manuscript">
            <p className="whitespace-pre-wrap">{submission.content}</p>
          </DetailField>

          {submission.references && (
            <DetailField label="References">
              <p className="whitespace-pre-wrap">{submission.references}</p>
            </DetailField>
          )}
        </div>

        {(submission.screeningNotes || submission.reviewedAt) && (
          <div className="mt-6 rounded-lg bg-paper p-4">
            <h4 className="font-mono text-xs uppercase tracking-wide text-slate-500">
              Most recent editorial decision
            </h4>
            <p className="mt-1.5 text-sm text-ink">
              {formatDate(submission.reviewedAt)}
              {submission.reviewerName ? ` — ${submission.reviewerName}` : ''}
            </p>
            {submission.screeningNotes && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {submission.screeningNotes}
              </p>
            )}
          </div>
        )}
      </div>

      {PEER_REVIEW_VISIBLE_STATUSES.includes(submission.status) && (
        <PeerReviewPanel manuscriptId={submission.id} />
      )}

      {AWAITING_EDITOR_DECISION_STATUSES.includes(submission.status) && (
        <EditorDecisionPanel manuscriptId={submission.id} onDecisionRecorded={load} />
      )}

      <VersionHistoryPanel manuscriptId={submission.id} />
      <RevisionHistoryPanel manuscriptId={submission.id} />

      {canScreen && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">Editorial screening decision</h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose how this manuscript proceeds. This is not a decision to accept for
            publication — it only decides whether it moves forward to peer review.
          </p>

          {!activeAction ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openAction('peer_review')}
                className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${ACTIONS.peer_review.buttonClassName}`}
              >
                {ACTIONS.peer_review.label}
              </button>
              <button
                type="button"
                onClick={() => openAction('revision')}
                className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${ACTIONS.revision.buttonClassName}`}
              >
                {ACTIONS.revision.label}
              </button>
              <button
                type="button"
                onClick={() => openAction('reject')}
                className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${ACTIONS.reject.buttonClassName}`}
              >
                {ACTIONS.reject.label}
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-3 rounded-lg bg-paper p-4">
              <p className="text-sm text-ink">{ACTIONS[activeAction].confirmCopy}</p>

              <div>
                <label htmlFor="editorial-notes" className="font-mono text-xs uppercase tracking-wide text-slate-500">
                  {ACTIONS[activeAction].notesLabel}
                </label>
                <textarea
                  id="editorial-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  placeholder="Visible to the submitting author"
                />
              </div>

              {actionError && <p className="text-sm text-red-600">{actionError}</p>}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={confirmAction}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${ACTIONS[activeAction].confirmClassName}`}
                >
                  {submitting ? 'Working…' : `Confirm: ${ACTIONS[activeAction].label}`}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={closeAction}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-ink hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminSubmissionDetailPage
