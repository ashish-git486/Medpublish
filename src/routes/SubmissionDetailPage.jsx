import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCategoryBySlug } from '../data/mockData.js'
import {
  REVISION_OWED_BY_AUTHOR_STATUSES,
  statusBadgeClassName,
  statusLabel,
} from '../data/manuscriptStatus.js'
import { decisionBadgeClassName, decisionLabel } from '../data/editorDecisionStatus.js'
import { getSubmissionById } from '../services/manuscriptService.js'
import {
  getDecisionsForManuscript,
  getManuscriptTimeline,
  getPendingRevisionRequest,
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

function DecisionBadge({ decision }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${decisionBadgeClassName(decision)}`}
    >
      {decisionLabel(decision)}
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

/** Vertical stepper built straight from manuscript_events — real timestamps per stage, in order. */
function Timeline({ events }) {
  return (
    <ol className="mt-4 space-y-0">
      {events.map((event, index) => {
        const isLast = index === events.length - 1
        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" aria-hidden="true" />
            )}
            <span className="relative z-10 mt-1.5 h-3.5 w-3.5 flex-none rounded-full bg-teal-700" />
            <div>
              <p className="text-sm font-semibold text-ink">{statusLabel(event.status)}</p>
              <p className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function SubmissionDetailPage() {
  const { id } = useParams()

  const [submission, setSubmission] = useState(null)
  const [events, setEvents] = useState([])
  const [decisions, setDecisions] = useState([])
  const [pendingRevisionRequest, setPendingRevisionRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setLoading(true)
      setLoadError(false)

      const { data: submissionData, error: submissionError } = await getSubmissionById(id)
      if (!isMounted) return
      if (submissionError || !submissionData) {
        console.error('MedPublish: failed to load manuscript', submissionError)
        setLoadError(true)
        setLoading(false)
        return
      }
      setSubmission(submissionData)

      const [
        { data: eventsData, error: eventsError },
        { data: decisionsData, error: decisionsError },
        { data: revisionRequestData },
      ] = await Promise.all([
        getManuscriptTimeline(id),
        getDecisionsForManuscript(id),
        REVISION_OWED_BY_AUTHOR_STATUSES.includes(submissionData.status)
          ? getPendingRevisionRequest(id)
          : Promise.resolve({ data: null }),
      ])

      if (!isMounted) return
      if (eventsError || decisionsError) {
        console.error('MedPublish: failed to load manuscript history', eventsError ?? decisionsError)
      }
      setEvents(eventsData)
      setDecisions(decisionsData)
      setPendingRevisionRequest(revisionRequestData)
      setLoading(false)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [id])

  if (loading) {
    return <p className="mx-auto max-w-4xl px-4 py-16 text-sm text-slate-500">Loading submission…</p>
  }

  if (loadError || !submission) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-10 text-center">
          <p className="text-red-600">
            We couldn't load this submission. It may not exist, or it may not belong to you.
          </p>
          <Link
            to="/my-submissions"
            className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            ← Back to My Submissions
          </Link>
        </div>
      </div>
    )
  }

  const category = getCategoryBySlug(submission.categorySlug)
  const owesRevision = REVISION_OWED_BY_AUTHOR_STATUSES.includes(submission.status)

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Link to="/my-submissions" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
        ← Back to My Submissions
      </Link>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-slate-500">
            <span>{category?.name ?? submission.categorySlug}</span>
            <span className="text-slate-300">·</span>
            <span>{submission.articleType}</span>
          </div>
          <h1 className="mt-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {submission.title}
          </h1>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      {owesRevision && pendingRevisionRequest && (
        <div className="mt-6 rounded-xl border border-gold-500 bg-gold-500/5 p-5 sm:p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">Revision requested</h2>
          <p className="mt-1 text-sm text-slate-600">
            The editorial team has asked for a{' '}
            {pendingRevisionRequest.revisionType === 'minor' ? 'minor' : 'major'} revision.
            {pendingRevisionRequest.deadline && ` Please respond by ${pendingRevisionRequest.deadline}.`}
          </p>
          <Link
            to={`/my-submissions/${submission.id}/revise`}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-gold-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gold-500"
          >
            Review and submit revision →
          </Link>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Timeline</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No history yet.</p>
        ) : (
          <Timeline events={events} />
        )}
      </div>

      {decisions.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">Editorial decisions</h2>
          <div className="mt-4 space-y-4">
            {decisions.map((d) => (
              <div key={d.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">{formatDateTime(d.createdAt)}</span>
                  <DecisionBadge decision={d.decision} />
                </div>
                {d.decisionLetter && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{d.decisionLetter}</p>
                )}
                {d.reviewerSummary && (
                  <div className="mt-2 rounded-lg bg-paper p-3">
                    <h4 className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
                      Summary of reviewer feedback
                    </h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{d.reviewerSummary}</p>
                  </div>
                )}
                {d.authorInstructions && (
                  <div className="mt-2 rounded-lg bg-paper p-3">
                    <h4 className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
                      Instructions
                    </h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {d.authorInstructions}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SubmissionDetailPage
