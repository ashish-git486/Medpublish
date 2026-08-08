import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCategoryBySlug } from '../data/mockData.js'
import { assignmentStatusBadgeClassName, assignmentStatusLabel } from '../data/reviewStatus.js'
import {
  acceptReviewAssignment,
  declineReviewAssignment,
  getReviewerDashboard,
} from '../services/reviewService.js'

const TABS = [
  { key: 'assigned', label: 'Assigned Reviews' },
  { key: 'accepted', label: 'Accepted Reviews' },
  { key: 'completed', label: 'Completed Reviews' },
]

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide ${assignmentStatusBadgeClassName(status)}`}
    >
      {assignmentStatusLabel(status)}
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

// Peer review due dates aren't tracked yet (no per-assignment deadline
// column in the schema) — this is a clearly-labeled placeholder shown to
// reviewers so the card layout matches what a real due-date feature will
// look like later, per PROJECT_CONTEXT's future-extension notes.
function placeholderDueDate(assignedAt) {
  if (!assignedAt) return null
  const due = new Date(assignedAt)
  due.setDate(due.getDate() + 21)
  return due.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="font-mono text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 font-serif text-3xl font-semibold text-ink">{value}</div>
    </div>
  )
}

function AssignmentCard({ assignment, onAccept, onDecline, onStart, actionPending }) {
  const category = getCategoryBySlug(assignment.manuscript?.categorySlug)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-slate-500">
            <span>{category?.name ?? assignment.manuscript?.categorySlug}</span>
            <span className="text-slate-300">·</span>
            <span>{assignment.manuscript?.articleType}</span>
            <span className="text-slate-300">·</span>
            <span>Assigned {formatDate(assignment.assignedAt)}</span>
          </div>
          <h3 className="mt-2 font-serif text-lg font-semibold text-ink">
            {assignment.manuscript?.title ?? 'Untitled manuscript'}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{assignment.manuscript?.authors}</p>
          <p className="mt-1 text-xs text-slate-500">
            Due date (placeholder): {placeholderDueDate(assignment.assignedAt)}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        {assignment.status === 'assigned' && (
          <>
            <button
              type="button"
              disabled={actionPending}
              onClick={() => onAccept(assignment.id)}
              className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Accept Review
            </button>
            <button
              type="button"
              disabled={actionPending}
              onClick={() => onDecline(assignment.id)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Decline Review
            </button>
          </>
        )}

        {assignment.status === 'accepted' && (
          <button
            type="button"
            onClick={() => onStart(assignment.id)}
            className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light"
          >
            Start Review
          </button>
        )}

        {assignment.status === 'submitted' && (
          <span className="text-sm text-slate-500">
            Submitted {formatDate(assignment.completedAt)}
          </span>
        )}

        {assignment.status === 'declined' && (
          <span className="text-sm text-slate-500">Declined {formatDate(assignment.declinedAt)}</span>
        )}
      </div>
    </div>
  )
}

function ReviewerDashboardPage() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState({
    assigned: [],
    accepted: [],
    completed: [],
    stats: { total: 0, pendingResponse: 0, inProgress: 0, completed: 0, declined: 0 },
  })
  const [activeTab, setActiveTab] = useState('assigned')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [actionPendingId, setActionPendingId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    const { data, error } = await getReviewerDashboard()
    if (error) {
      console.error('MedPublish: failed to load reviewer dashboard', error)
      setLoadError(true)
    } else {
      setDashboard(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleAccept(assignmentId) {
    setActionPendingId(assignmentId)
    setActionError(null)
    const { error } = await acceptReviewAssignment(assignmentId)
    setActionPendingId(null)
    if (error) {
      console.error('MedPublish: failed to accept assignment', error)
      setActionError('Could not accept this assignment. Please try again.')
      return
    }
    await load()
  }

  async function handleDecline(assignmentId) {
    setActionPendingId(assignmentId)
    setActionError(null)
    const { error } = await declineReviewAssignment(assignmentId)
    setActionPendingId(null)
    if (error) {
      console.error('MedPublish: failed to decline assignment', error)
      setActionError('Could not decline this assignment. Please try again.')
      return
    }
    await load()
  }

  function handleStart(assignmentId) {
    navigate(`/reviewer/review/${assignmentId}`)
  }

  const visibleAssignments = dashboard[activeTab] ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold text-ink">Reviewer Dashboard</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Manuscripts you've been asked to review, organized by where each one stands.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading your assignments…</p>
      ) : loadError ? (
        <div className="mt-8 rounded-xl border border-dashed border-red-200 bg-red-50 p-10 text-center">
          <p className="text-red-600">
            We couldn't load your review assignments right now. Please try again shortly.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total assignments" value={dashboard.stats.total} />
            <StatCard label="Pending response" value={dashboard.stats.pendingResponse} />
            <StatCard label="In progress" value={dashboard.stats.inProgress} />
            <StatCard label="Completed" value={dashboard.stats.completed} />
            <StatCard label="Declined" value={dashboard.stats.declined} />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-ink text-white'
                    : 'bg-white text-slate-600 hover:text-teal-700'
                } border border-slate-200`}
              >
                {tab.label} ({dashboard[tab.key]?.length ?? 0})
              </button>
            ))}
          </div>

          {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}

          <div className="mt-6 space-y-4">
            {visibleAssignments.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-slate-500">Nothing here right now.</p>
              </div>
            )}

            {visibleAssignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onStart={handleStart}
                actionPending={actionPendingId === assignment.id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ReviewerDashboardPage
