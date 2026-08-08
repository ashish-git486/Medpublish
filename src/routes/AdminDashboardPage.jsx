import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCategoryBySlug } from '../data/mockData.js'
import {
  DASHBOARD_STATUS_FILTERS,
  statusBadgeClassName,
  statusLabel,
} from '../data/manuscriptStatus.js'
import {
  AWAITING_SCREENING_STATUSES,
  getEditorialSubmissions,
  getSubmissionStats,
} from '../services/manuscriptService.js'
import { getReviewerCandidates } from '../services/reviewService.js'
import { promoteToReviewer } from '../services/userService.js'

function ReviewerManagementPanel() {
  const [reviewers, setReviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success' | 'error', text }

  async function loadReviewers() {
    setLoading(true)
    const { data } = await getReviewerCandidates()
    setReviewers(data)
    setLoading(false)
  }

  useEffect(() => {
    loadReviewers()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return

    setSubmitting(true)
    setMessage(null)
    const { data, error } = await promoteToReviewer(email.trim())
    setSubmitting(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: `${data.full_name || data.email} can now review manuscripts.` })
    setEmail('')
    await loadReviewers()
  }

  return (
    <div className="mt-10 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-ink">Reviewer management</h2>
      <p className="mt-1 text-sm text-slate-600">
        Grant the reviewer role to an existing MedPublish user so they can be assigned
        manuscripts to peer review. The user must already have an account.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="reviewer-email" className="font-mono text-xs uppercase tracking-wide text-slate-500">
            User's email
          </label>
          <input
            id="reviewer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="reviewer@example.com"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Granting…' : 'Grant reviewer role'}
        </button>
      </form>

      {message && (
        <p className={`mt-2 text-sm ${message.type === 'error' ? 'text-red-600' : 'text-teal-700'}`}>
          {message.text}
        </p>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">
          Current reviewers ({loading ? '…' : reviewers.length})
        </h3>
        {!loading && reviewers.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">No reviewers yet.</p>
        )}
        {!loading && reviewers.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {reviewers.map((r) => (
              <li key={r.id}>
                {r.full_name || 'Unnamed'} — <span className="text-slate-500">{r.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

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
  })
}

function matchesFilter(submission, filterKey) {
  if (filterKey === 'all') return true
  if (filterKey === 'awaiting_screening') {
    return AWAITING_SCREENING_STATUSES.includes(submission.status)
  }
  return submission.status === filterKey
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="font-mono text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 font-serif text-3xl font-semibold text-ink">{value}</div>
    </div>
  )
}

function AdminDashboardPage() {
  const [submissions, setSubmissions] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    awaitingScreening: 0,
    revisionRequested: 0,
    underPeerReview: 0,
    accepted: 0,
    rejected: 0,
  })
  const [activeFilter, setActiveFilter] = useState('awaiting_screening')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setLoading(true)
      setLoadError(false)
      const [{ data: subs, error: subsError }, { data: statsData, error: statsError }] =
        await Promise.all([getEditorialSubmissions(), getSubmissionStats()])

      if (!isMounted) return

      if (subsError || statsError) {
        console.error('MedPublish: failed to load admin dashboard data', subsError ?? statsError)
        setLoadError(true)
      } else {
        setSubmissions(subs)
        setStats(statsData)
      }
      setLoading(false)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const visibleSubmissions = useMemo(
    () => submissions.filter((submission) => matchesFilter(submission, activeFilter)),
    [submissions, activeFilter],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold text-ink">Editorial Dashboard</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Screen incoming manuscripts, send them to peer review, request revisions, or decline
        them at the editorial stage.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading submissions…</p>
      ) : loadError ? (
        <div className="mt-8 rounded-xl border border-dashed border-red-200 bg-red-50 p-10 text-center">
          <p className="text-red-600">
            We couldn't load the review queue right now. Please try again shortly.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total submissions" value={stats.total} />
            <StatCard label="Awaiting screening" value={stats.awaitingScreening} />
            <StatCard label="Revision requested" value={stats.revisionRequested} />
            <StatCard label="Under peer review" value={stats.underPeerReview} />
            <StatCard label="Awaiting revision" value={(stats.minorRevisionRequested ?? 0) + (stats.majorRevisionRequested ?? 0)} />
            <StatCard label="Revision submitted" value={stats.revisionSubmitted ?? 0} />
            <StatCard label="Accepted" value={stats.accepted} />
            <StatCard label="Rejected" value={stats.rejected} />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2">
            {DASHBOARD_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeFilter === filter.key
                    ? 'bg-ink text-white'
                    : 'bg-white text-slate-600 hover:text-teal-700'
                } border border-slate-200`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            {visibleSubmissions.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-slate-500">
                  {submissions.length === 0
                    ? 'No manuscripts have been submitted yet.'
                    : 'No manuscripts match this filter right now.'}
                </p>
              </div>
            )}

            {visibleSubmissions.map((submission) => {
              const category = getCategoryBySlug(submission.categorySlug)
              const lastActionDate = formatDate(submission.reviewedAt)

              return (
                <div
                  key={submission.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-slate-500">
                        <span>{category?.name ?? submission.categorySlug}</span>
                        <span className="text-slate-300">·</span>
                        <span>{submission.articleType}</span>
                        <span className="text-slate-300">·</span>
                        <span>{formatDate(submission.submittedAt)}</span>
                      </div>
                      <h3 className="mt-2 font-serif text-lg font-semibold text-ink">
                        {submission.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">{submission.authors}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Submitted by{' '}
                        {submission.submittingAuthorName || submission.submittingAuthorEmail || 'unknown author'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={submission.status} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-500">
                      {lastActionDate ? (
                        <>
                          Last editorial action: {lastActionDate}
                          {submission.reviewerName ? ` by ${submission.reviewerName}` : ''}
                        </>
                      ) : (
                        'No editorial action taken yet.'
                      )}
                    </p>
                    <Link
                      to={`/admin/submissions/${submission.id}`}
                      className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                    >
                      Review manuscript →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          <ReviewerManagementPanel />
        </>
      )}
    </div>
  )
}

export default AdminDashboardPage
