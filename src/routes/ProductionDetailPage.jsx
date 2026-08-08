import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { statusBadgeClassName, statusLabel } from '../data/manuscriptStatus.js'
import { decisionBadgeClassName, decisionLabel } from '../data/editorDecisionStatus.js'
import {
  assignmentStatusBadgeClassName,
  assignmentStatusLabel,
  recommendationBadgeClassName,
  recommendationLabel,
} from '../data/reviewStatus.js'
import {
  ADVANCE_ACTION_LABEL,
  nextProductionStatus,
  productionEventLabel,
  productionStatusBadgeClassName,
  productionStatusLabel,
} from '../data/productionStatus.js'
import { getAssignmentsForManuscript, getReviewsForEditor } from '../services/reviewService.js'
import {
  getDecisionsForManuscript,
  getRevisionRequestsForManuscript,
  getVersionsForManuscript,
} from '../services/revisionService.js'
import {
  advanceProductionStatus,
  assignProductionStaff,
  getProductionMetadata,
  getProductionRecord,
  getProductionStaffCandidates,
  getProductionTimeline,
  setMetadataVerified,
  updateProductionMetadata,
} from '../services/productionService.js'

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide ${statusBadgeClassName(status)}`}
    >
      {statusLabel(status)}
    </span>
  )
}

function ProductionStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide ${productionStatusBadgeClassName(status)}`}
    >
      {productionStatusLabel(status)}
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

function Panel({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function DetailField({ label, children }) {
  return (
    <div>
      <h4 className="font-mono text-xs uppercase tracking-wide text-slate-500">{label}</h4>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Manuscript summary (read-only)
// -------------------------------------------------------------------------

function ManuscriptSummaryPanel({ production }) {
  const m = production?.manuscript
  if (!m) return null

  return (
    <Panel title="Manuscript" description="The current scientific record — unaffected by production edits.">
      <div className="grid gap-4 sm:grid-cols-2">
        <DetailField label="Title">{m.title}</DetailField>
        <DetailField label="Authors">{m.authors}</DetailField>
        <DetailField label="Category">{production.categoryName}</DetailField>
        <DetailField label="Article type">{m.articleType}</DetailField>
        <DetailField label="Accepted">{formatDate(m.acceptedAt)}</DetailField>
        <DetailField label="Corresponding email">{m.correspondingEmail || '—'}</DetailField>
      </div>
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Version history (read-only)
// -------------------------------------------------------------------------

function VersionHistoryPanel({ manuscriptId }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    getVersionsForManuscript(manuscriptId).then(({ data }) => {
      if (isMounted) {
        setVersions(data)
        setLoading(false)
      }
    })
    return () => {
      isMounted = false
    }
  }, [manuscriptId])

  return (
    <Panel title="Revision history" description="Every submitted version of this manuscript.">
      {loading ? (
        <p className="text-sm text-slate-500">Loading versions…</p>
      ) : versions.length === 0 ? (
        <p className="text-sm text-slate-500">No version history recorded.</p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2 text-sm"
            >
              <span className="font-medium text-ink">Version {v.versionNumber}</span>
              <span className="text-slate-500">{formatDateTime(v.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Peer review history (read-only)
// -------------------------------------------------------------------------

function PeerReviewHistoryPanel({ manuscriptId }) {
  const [assignments, setAssignments] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    Promise.all([getAssignmentsForManuscript(manuscriptId), getReviewsForEditor(manuscriptId)]).then(
      ([assignmentsResult, reviewsResult]) => {
        if (!isMounted) return
        setAssignments(assignmentsResult.data)
        setReviews(reviewsResult.data)
        setLoading(false)
      },
    )
    return () => {
      isMounted = false
    }
  }, [manuscriptId])

  return (
    <Panel title="Peer review history" description="Reviewer assignments and submitted reviews.">
      {loading ? (
        <p className="text-sm text-slate-500">Loading peer review history…</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-slate-500">No reviewers were assigned to this manuscript.</p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => {
            const review = reviews.find((r) => r.assignmentId === a.id)
            return (
              <li key={a.id} className="rounded-lg border border-slate-100 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{a.reviewerName || 'Unnamed reviewer'}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide ${assignmentStatusBadgeClassName(a.status)}`}
                  >
                    {assignmentStatusLabel(a.status)}
                  </span>
                </div>
                {review && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono uppercase tracking-wide ${recommendationBadgeClassName(review.overallRecommendation)}`}
                    >
                      {recommendationLabel(review.overallRecommendation)}
                    </span>
                    <span>Submitted {formatDateTime(review.submittedAt)}</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Editorial decision history (read-only)
// -------------------------------------------------------------------------

function EditorialDecisionHistoryPanel({ manuscriptId }) {
  const [decisions, setDecisions] = useState([])
  const [revisionRequests, setRevisionRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    Promise.all([
      getDecisionsForManuscript(manuscriptId),
      getRevisionRequestsForManuscript(manuscriptId),
    ]).then(([decisionsResult, requestsResult]) => {
      if (!isMounted) return
      setDecisions(decisionsResult.data)
      setRevisionRequests(requestsResult.data)
      setLoading(false)
    })
    return () => {
      isMounted = false
    }
  }, [manuscriptId])

  return (
    <Panel title="Editorial decision history" description="Every post-peer-review decision recorded for this manuscript.">
      {loading ? (
        <p className="text-sm text-slate-500">Loading decision history…</p>
      ) : decisions.length === 0 ? (
        <p className="text-sm text-slate-500">No editorial decisions recorded.</p>
      ) : (
        <ul className="space-y-2">
          {decisions.map((d) => {
            const request = revisionRequests.find((r) => r.editorDecisionId === d.id)
            return (
              <li key={d.id} className="rounded-lg border border-slate-100 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide ${decisionBadgeClassName(d.decision)}`}
                  >
                    {decisionLabel(d.decision)}
                  </span>
                  <span className="text-xs text-slate-500">{formatDateTime(d.createdAt)}</span>
                </div>
                {d.decisionLetter && <p className="mt-2 text-sm text-slate-700">{d.decisionLetter}</p>}
                {request && (
                  <p className="mt-1 text-xs text-slate-500">
                    Revision {request.status === 'submitted' ? 'fulfilled' : 'pending'}
                    {request.deadline ? ` · deadline ${formatDate(request.deadline)}` : ''}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Production timeline (read-only)
// -------------------------------------------------------------------------

function ProductionTimelinePanel({ manuscriptId, refreshKey }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    getProductionTimeline(manuscriptId).then(({ data }) => {
      if (isMounted) {
        setEvents(data)
        setLoading(false)
      }
    })
    return () => {
      isMounted = false
    }
  }, [manuscriptId, refreshKey])

  return (
    <Panel title="Production timeline" description="Every production status change and assignment, in order.">
      {loading ? (
        <p className="text-sm text-slate-500">Loading timeline…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-slate-500">No production activity yet.</p>
      ) : (
        <ol className="space-y-3 border-l border-slate-200 pl-4">
          {events.map((e) => (
            <li key={e.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-teal-700" />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-ink">{productionEventLabel(e.eventType)}</span>
                <span className="text-xs text-slate-500">{formatDateTime(e.createdAt)}</span>
              </div>
              {e.actorName && <p className="text-xs text-slate-500">by {e.actorName}</p>}
              {e.note && <p className="mt-0.5 text-xs text-slate-500">{e.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Staff assignment
// -------------------------------------------------------------------------

function StaffAssignmentPanel({ manuscriptId, production, onAssigned }) {
  const [candidates, setCandidates] = useState([])
  const [productionEditorId, setProductionEditorId] = useState(production.productionEditorId || '')
  const [copyeditorId, setCopyeditorId] = useState(production.copyeditorId || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    getProductionStaffCandidates().then(({ data }) => setCandidates(data))
  }, [])

  useEffect(() => {
    setProductionEditorId(production.productionEditorId || '')
    setCopyeditorId(production.copyeditorId || '')
  }, [production.productionEditorId, production.copyeditorId])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const { error } = await assignProductionStaff(manuscriptId, {
      productionEditorId: productionEditorId || null,
      copyeditorId: copyeditorId || null,
    })
    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }
    setMessage({ type: 'success', text: 'Assignments saved.' })
    await onAssigned()
  }

  return (
    <Panel title="Copyediting assignment" description="Assign staff to shepherd this manuscript through production.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="production-editor" className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Production editor
          </label>
          <select
            id="production-editor"
            value={productionEditorId}
            onChange={(e) => setProductionEditorId(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          >
            <option value="">Unassigned</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || c.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="copyeditor" className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Copyeditor
          </label>
          <select
            id="copyeditor"
            value={copyeditorId}
            onChange={(e) => setCopyeditorId(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          >
            <option value="">Unassigned</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || c.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save assignment'}
      </button>

      {message && (
        <p className={`mt-2 text-sm ${message.type === 'error' ? 'text-red-600' : 'text-teal-700'}`}>
          {message.text}
        </p>
      )}
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Production metadata editor
// -------------------------------------------------------------------------

function MetadataEditorPanel({ manuscriptId, production, onUpdated }) {
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    title: '',
    runningTitle: '',
    abstract: '',
    keywords: '',
    authorOrderText: '',
    affiliationsText: '',
    correspondingAuthorName: '',
    correspondingAuthorEmail: '',
  })
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getProductionMetadata(manuscriptId)
    setMetadata(data)
    if (data) {
      setForm({
        title: data.title || '',
        runningTitle: data.runningTitle || '',
        abstract: data.abstract || '',
        keywords: data.keywords || '',
        authorOrderText: (data.authorOrder || []).map((a) => a.name).join(', '),
        affiliationsText: (data.affiliations || []).join('\n'),
        correspondingAuthorName: data.correspondingAuthorName || '',
        correspondingAuthorEmail: data.correspondingAuthorEmail || '',
      })
    }
    setLoading(false)
  }, [manuscriptId])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const authorOrder = form.authorOrderText
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, isCorresponding: false }))

    const affiliations = form.affiliationsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const { error } = await updateProductionMetadata(manuscriptId, {
      title: form.title,
      runningTitle: form.runningTitle,
      abstract: form.abstract,
      keywords: form.keywords,
      authorOrder,
      affiliations,
      correspondingAuthorName: form.correspondingAuthorName,
      correspondingAuthorEmail: form.correspondingAuthorEmail,
    })
    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }
    setMessage({ type: 'success', text: 'Metadata saved. Verification has been reset — please re-verify.' })
    await load()
    await onUpdated()
  }

  async function handleToggleVerified() {
    setVerifying(true)
    setMessage(null)
    const { error } = await setMetadataVerified(manuscriptId, !production.metadataVerified)
    setVerifying(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }
    await onUpdated()
  }

  if (loading) {
    return (
      <Panel title="Production metadata" description="The publication-facing record — separate from the scientific manuscript.">
        <p className="text-sm text-slate-500">Loading metadata…</p>
      </Panel>
    )
  }

  if (!metadata) {
    return (
      <Panel title="Production metadata" description="The publication-facing record — separate from the scientific manuscript.">
        <p className="text-sm text-slate-500">No production metadata record found for this manuscript.</p>
      </Panel>
    )
  }

  return (
    <Panel
      title="Production metadata"
      description="The publication-facing record (title, abstract, keywords, author order, affiliations, corresponding author, running title). Editing this never changes the underlying manuscript or its version history."
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="pm-title" className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Title
          </label>
          <input
            id="pm-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <div>
          <label htmlFor="pm-running-title" className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Running title
          </label>
          <input
            id="pm-running-title"
            type="text"
            value={form.runningTitle}
            onChange={(e) => setForm((f) => ({ ...f, runningTitle: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <div>
          <label htmlFor="pm-abstract" className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Abstract
          </label>
          <textarea
            id="pm-abstract"
            rows={5}
            value={form.abstract}
            onChange={(e) => setForm((f) => ({ ...f, abstract: e.target.value }))}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <div>
          <label htmlFor="pm-keywords" className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Keywords
          </label>
          <input
            id="pm-keywords"
            type="text"
            value={form.keywords}
            onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
            placeholder="Comma-separated"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <div>
          <label htmlFor="pm-authors" className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Author order
          </label>
          <input
            id="pm-authors"
            type="text"
            value={form.authorOrderText}
            onChange={(e) => setForm((f) => ({ ...f, authorOrderText: e.target.value }))}
            placeholder="Comma-separated, in publication order"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <div>
          <label htmlFor="pm-affiliations" className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Affiliations
          </label>
          <textarea
            id="pm-affiliations"
            rows={3}
            value={form.affiliationsText}
            onChange={(e) => setForm((f) => ({ ...f, affiliationsText: e.target.value }))}
            placeholder="One affiliation per line"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pm-corr-name" className="font-mono text-xs uppercase tracking-wide text-slate-500">
              Corresponding author name
            </label>
            <input
              id="pm-corr-name"
              type="text"
              value={form.correspondingAuthorName}
              onChange={(e) => setForm((f) => ({ ...f, correspondingAuthorName: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>
          <div>
            <label htmlFor="pm-corr-email" className="font-mono text-xs uppercase tracking-wide text-slate-500">
              Corresponding author email
            </label>
            <input
              id="pm-corr-email"
              type="email"
              value={form.correspondingAuthorEmail}
              onChange={(e) => setForm((f) => ({ ...f, correspondingAuthorEmail: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save metadata'}
          </button>

          <button
            type="button"
            onClick={handleToggleVerified}
            disabled={verifying}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              production.metadataVerified
                ? 'border-slate-300 text-slate-600 hover:bg-slate-50'
                : 'border-teal-700 text-teal-700 hover:bg-teal-50'
            }`}
          >
            {verifying
              ? 'Working…'
              : production.metadataVerified
                ? 'Mark as unverified'
                : 'Mark metadata verified'}
          </button>

          {production.metadataVerified && (
            <span className="text-xs text-teal-700">
              Verified {formatDateTime(production.metadataVerifiedAt)}
            </span>
          )}
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-teal-700'}`}>
            {message.text}
          </p>
        )}
      </form>
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Production status + advance action
// -------------------------------------------------------------------------

function ProductionStatusPanel({ manuscriptId, production, onAdvanced }) {
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState(null)

  const next = nextProductionStatus(production.productionStatus)
  const actionLabel = ADVANCE_ACTION_LABEL[production.productionStatus]

  async function handleAdvance() {
    if (!next) return
    setAdvancing(true)
    setError(null)
    const { error: advanceError } = await advanceProductionStatus(manuscriptId, next)
    setAdvancing(false)

    if (advanceError) {
      setError(advanceError.message)
      return
    }
    await onAdvanced()
  }

  return (
    <Panel title="Production status">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <ProductionStatusBadge status={production.productionStatus} />
          <p className="mt-2 text-xs text-slate-500">
            Entered production {formatDate(production.enteredProductionAt)}
          </p>
        </div>

        {next ? (
          <button
            type="button"
            onClick={handleAdvance}
            disabled={advancing}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {advancing ? 'Working…' : actionLabel}
          </button>
        ) : (
          <span className="text-sm font-medium text-teal-700">Ready for typesetting</span>
        )}
      </div>

      {production.productionStatus === 'metadata_verification' && !production.metadataVerified && (
        <p className="mt-3 text-xs text-gold-600">
          Metadata must be verified below before this manuscript can be marked ready for typesetting.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Page
// -------------------------------------------------------------------------

function ProductionDetailPage() {
  const { id } = useParams()
  const [production, setProduction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    const { data, error } = await getProductionRecord(id)
    if (error || !data) {
      setLoadError(true)
    } else {
      setProduction(data)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    setLoading(true)
    setLoadError(false)
    load()
  }, [load])

  async function refresh() {
    await load()
    setRefreshKey((k) => k + 1)
  }

  if (loading) {
    return <p className="mx-auto max-w-6xl px-4 py-16 text-sm text-slate-500">Loading production workspace…</p>
  }

  if (loadError || !production) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold text-ink">Not in production</h1>
        <p className="mt-3 text-slate-600">
          This manuscript doesn't have a production record yet, or you don't have permission to view it.
        </p>
        <Link to="/production" className="mt-6 inline-block text-sm font-semibold text-teal-700 hover:text-teal-800">
          ← Back to Production Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Link to="/production" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
        ← Back to Production Dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold text-ink">{production.manuscript?.title}</h1>
        <StatusBadge status={production.manuscript?.status} />
      </div>

      <div className="mt-8 space-y-6">
        <ProductionStatusPanel manuscriptId={id} production={production} onAdvanced={refresh} />
        <ManuscriptSummaryPanel production={production} />
        <StaffAssignmentPanel manuscriptId={id} production={production} onAssigned={refresh} />
        <MetadataEditorPanel manuscriptId={id} production={production} onUpdated={refresh} />
        <ProductionTimelinePanel manuscriptId={id} refreshKey={refreshKey} />
        <VersionHistoryPanel manuscriptId={id} />
        <EditorialDecisionHistoryPanel manuscriptId={id} />
        <PeerReviewHistoryPanel manuscriptId={id} />
      </div>
    </div>
  )
}

export default ProductionDetailPage
