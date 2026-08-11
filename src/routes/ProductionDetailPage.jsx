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
  startTypesetting,
  uploadProofVersion,
  issueAuthorProof,
  submitProofCorrections,
  resolveProofCorrection,
  rejectProofCorrection,
  approveFinalProof,
  markPublicationReady,
  returnToTypesetting,
  getCurrentProofVersion,
  getProofCorrections,
  getProofHistory,
  uploadProofFile,
  validateProofFile,
  getProofFileUrl,
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
    <Panel title="Production assignment" description="Assign staff to shepherd this manuscript through production.">
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
          <span className="text-sm font-medium text-teal-700">Publication Ready</span>
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
// Typesetting stage panel
// -------------------------------------------------------------------------

function TypesettingPanel({ manuscriptId, production, onUpdated }) {
  const [candidates, setCandidates] = useState([])
  const [typesetterId, setTypesetterId] = useState(production.typesetterId || '')
  const [currentProof, setCurrentProof] = useState(null)
  const [proofHistory, setProofHistory] = useState([])
  const [loadingProof, setLoadingProof] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getProductionStaffCandidates().then(({ data }) => setCandidates(data))
  }, [])

  useEffect(() => {
    setTypesetterId(production.typesetterId || '')
  }, [production.typesetterId])

  useEffect(() => {
    if (production.productionStatus === 'typesetting' || production.productionStatus === 'author_proof' || production.productionStatus === 'proof_corrections') {
      loadProofData()
    }
  }, [manuscriptId, production.productionStatus])

  async function loadProofData() {
    setLoadingProof(true)
    const [currentResult, historyResult] = await Promise.all([
      getCurrentProofVersion(manuscriptId),
      getProofHistory(manuscriptId),
    ])
    setCurrentProof(currentResult.data)
    setProofHistory(historyResult.data || [])
    setLoadingProof(false)
  }

  async function handleStartTypesetting() {
    if (!typesetterId) {
      setError('Please assign a typesetter first')
      return
    }
    const { error: startError } = await startTypesetting(manuscriptId, typesetterId)
    if (startError) {
      setError(startError.message)
      return
    }
    await onUpdated()
  }

  async function handleUploadProof(e) {
    e.preventDefault()
    const formData = new FormData(e.target)
    const file = formData.get('proofFile')
    
    if (!file) {
      setError('Please select a file')
      return
    }

    // Validate file before upload
    const validation = validateProofFile(file)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Get the next version number
      const nextVersion = proofHistory.length > 0 
        ? Math.max(...proofHistory.map(p => p.version_number)) + 1 
        : 1

      // Upload to Supabase Storage and register in database
      const { error: uploadError } = await uploadProofFile(
        manuscriptId, 
        file, 
        nextVersion,
        formData.get('notes') || ''
      )

      if (uploadError) {
        setError(`Proof upload failed: ${uploadError.message}`)
        return
      }

      setMessage({ type: 'success', text: `Proof v${nextVersion} uploaded successfully` })
      await loadProofData()
      await onUpdated()
    } catch (error) {
      setError(`Proof upload failed: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleIssueAuthorProof() {
    if (!currentProof) {
      setError('No proof version exists to issue')
      return
    }
    setIssuing(true)
    const { error: issueError } = await issueAuthorProof(manuscriptId)
    setIssuing(false)

    if (issueError) {
      setError(issueError.message)
      return
    }
    await onUpdated()
  }

  return (
    <Panel title="Typesetting" description="Manage typesetting workflow and proof versions.">
      <div className="space-y-6">
        {/* Typesetter assignment */}
        {production.productionStatus === 'ready_for_typesetting' && (
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">Assign Typesetter</h3>
            <div className="mt-2 flex items-center gap-3">
              <select
                value={typesetterId}
                onChange={(e) => setTypesetterId(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
              >
                <option value="">Select typesetter</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.email}
                  </option>
                ))}
              </select>
              <button
                onClick={handleStartTypesetting}
                disabled={!typesetterId}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start Typesetting
              </button>
            </div>
          </div>
        )}

        {/* Proof upload */}
        {(production.productionStatus === 'typesetting' || production.productionStatus === 'proof_corrections') && (
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">Upload Proof</h3>
            <form onSubmit={handleUploadProof} className="mt-2 space-y-3">
              <div>
                <input
                  type="file"
                  name="proofFile"
                  accept=".pdf"
                  className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-teal-700 hover:file:bg-teal-100"
                />
              </div>
              <div>
                <textarea
                  name="notes"
                  placeholder="Notes about this proof version (optional)"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? 'Uploading…' : 'Upload Proof'}
              </button>
            </form>
          </div>
        )}

        {/* Current proof info */}
        {currentProof && (
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">Current Proof</h3>
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">Proof v{currentProof.version_number}</p>
                  <p className="text-xs text-slate-500">{currentProof.file_name}</p>
                  <p className="text-xs text-slate-500">
                    {(currentProof.file_size_bytes / 1024 / 1024).toFixed(2)} MB · {formatDate(currentProof.uploaded_at)}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const { data: url, error } = await getProofFileUrl(currentProof.storage_path)
                    if (error || !url) {
                      setError('Failed to generate download link')
                      return
                    }
                    window.open(url, '_blank')
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-slate-100"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Issue author proof button */}
        {production.productionStatus === 'typesetting' && currentProof && (
          <div>
            <button
              onClick={handleIssueAuthorProof}
              disabled={issuing}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {issuing ? 'Working…' : 'Issue Author Proof'}
            </button>
          </div>
        )}

        {/* Proof history */}
        {proofHistory.length > 0 && (
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">Proof History</h3>
            <ul className="mt-2 space-y-2">
              {proofHistory.map((proof) => (
                <li key={proof.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-ink">Proof v{proof.version_number}</span>
                    <span className="ml-2 text-xs text-slate-500">{formatDate(proof.uploaded_at)}</span>
                    {proof.storage_path === currentProof?.storage_path && (
                      <span className="ml-2 text-xs font-medium text-teal-700">(current)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{proof.proof_purpose}</span>
                    <button
                      onClick={async () => {
                        const { data: url, error } = await getProofFileUrl(proof.storage_path)
                        if (error || !url) {
                          setError('Failed to generate download link')
                          return
                        }
                        window.open(url, '_blank')
                      }}
                      className="text-xs text-teal-700 hover:text-teal-800"
                    >
                      Download
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.type === 'error' ? 'text-red-600' : 'text-teal-700'}`}>
          {message.text}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Author proof panel
// -------------------------------------------------------------------------

function AuthorProofPanel({ manuscriptId, production, onUpdated }) {
  const [currentProof, setCurrentProof] = useState(null)
  const [corrections, setCorrections] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newCorrections, setNewCorrections] = useState([{ locationPage: '', locationText: '', correctionText: '' }])
  const [approving, setApproving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (production.productionStatus === 'author_proof') {
      loadProofData()
    }
  }, [manuscriptId, production.productionStatus])

  async function loadProofData() {
    setLoading(true)
    const [currentResult, correctionsResult] = await Promise.all([
      getCurrentProofVersion(manuscriptId),
      getProofCorrections(manuscriptId),
    ])
    setCurrentProof(currentResult.data)
    setCorrections(correctionsResult.data || [])
    setLoading(false)
  }

  function addCorrectionField() {
    setNewCorrections([...newCorrections, { locationPage: '', locationText: '', correctionText: '' }])
  }

  function updateCorrectionField(index, field, value) {
    const updated = [...newCorrections]
    updated[index][field] = value
    setNewCorrections(updated)
  }

  function removeCorrectionField(index) {
    setNewCorrections(newCorrections.filter((_, i) => i !== index))
  }

  async function handleSubmitCorrections() {
    const validCorrections = newCorrections.filter(c => c.correctionText.trim())
    if (validCorrections.length === 0) {
      setError('Please add at least one correction')
      return
    }

    setSubmitting(true)
    setError(null)
    const { error: submitError } = await submitProofCorrections(manuscriptId, validCorrections)
    setSubmitting(false)

    if (submitError) {
      setError(submitError.message)
      return
    }

    setMessage({ type: 'success', text: 'Corrections submitted successfully' })
    await onUpdated()
  }

  async function handleApproveProof() {
    setApproving(true)
    setError(null)
    const { error: approveError } = await approveFinalProof(manuscriptId)
    setApproving(false)

    if (approveError) {
      setError(approveError.message)
      return
    }

    setMessage({ type: 'success', text: 'Final proof approved' })
    await onUpdated()
  }

  if (loading) {
    return <Panel title="Author Proof"><p className="text-sm text-slate-500">Loading proof information…</p></Panel>
  }

  return (
    <Panel title="Author Proof" description="Review the typeset proof and submit corrections or approve for publication.">
      <div className="space-y-6">
        {/* Current proof */}
        {currentProof && (
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">Current Proof</h3>
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">Proof v{currentProof.version_number}</p>
                  <p className="text-xs text-slate-500">{currentProof.file_name}</p>
                  <p className="text-xs text-slate-500">
                    {(currentProof.file_size_bytes / 1024 / 1024).toFixed(2)} MB · {formatDate(currentProof.uploaded_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const { data: url, error } = await getProofFileUrl(currentProof.storage_path)
                      if (error || !url) {
                        setError('Failed to generate view link')
                        return
                      }
                      window.open(url, '_blank')
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-slate-100"
                  >
                    View Proof
                  </button>
                  <button
                    onClick={async () => {
                      const { data: url, error } = await getProofFileUrl(currentProof.storage_path)
                      if (error || !url) {
                        setError('Failed to generate download link')
                        return
                      }
                      window.open(url, '_blank')
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-slate-100"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm">
          <h4 className="font-medium text-blue-900">Proof Review Instructions</h4>
          <p className="mt-2 text-blue-800">
            Please review the typeset proof carefully for:
          </p>
          <ul className="mt-2 list-inside list-disc text-blue-800">
            <li>Typographical errors</li>
            <li>Author names and affiliations</li>
            <li>Tables and figures</li>
            <li>References</li>
            <li>Formatting</li>
            <li>Factual production errors</li>
          </ul>
          <p className="mt-2 text-xs text-blue-700">
            This is a proofing stage, not a new scientific peer-review stage.
          </p>
        </div>

        {/* Correction form */}
        <div>
          <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">Request Corrections</h3>
          <div className="mt-2 space-y-3">
            {newCorrections.map((correction, index) => (
              <div key={index} className="rounded-lg border border-slate-200 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500">Location/Page</label>
                    <input
                      type="text"
                      value={correction.locationPage}
                      onChange={(e) => updateCorrectionField(index, 'locationPage', e.target.value)}
                      placeholder="e.g., Page 2, paragraph 3"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Current text (optional)</label>
                    <input
                      type="text"
                      value={correction.locationText}
                      onChange={(e) => updateCorrectionField(index, 'locationText', e.target.value)}
                      placeholder="Current text to be corrected"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs text-slate-500">Requested correction</label>
                  <textarea
                    value={correction.correctionText}
                    onChange={(e) => updateCorrectionField(index, 'correctionText', e.target.value)}
                    placeholder="Describe the correction needed"
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
                {newCorrections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCorrectionField(index)}
                    className="mt-2 text-xs text-red-600 hover:text-red-700"
                  >
                    Remove correction
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addCorrectionField}
              className="text-sm font-medium text-teal-700 hover:text-teal-800"
            >
              + Add another correction
            </button>
          </div>
          <button
            onClick={handleSubmitCorrections}
            disabled={submitting}
            className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Corrections'}
          </button>
        </div>

        {/* Approve button */}
        <div className="border-t border-slate-200 pt-4">
          <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">Final Approval</h3>
          <p className="mt-2 text-sm text-slate-600">
            If there are no corrections needed, approve the final proof for publication.
          </p>
          <button
            onClick={handleApproveProof}
            disabled={approving}
            className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {approving ? 'Working…' : 'Approve Final Proof'}
          </button>
        </div>
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.type === 'error' ? 'text-red-600' : 'text-teal-700'}`}>
          {message.text}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Proof corrections panel (for production staff)
// -------------------------------------------------------------------------

function ProofCorrectionsPanel({ manuscriptId, production, onUpdated }) {
  const [corrections, setCorrections] = useState([])
  const [loading, setLoading] = useState(true)
  const [returning, setReturning] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (production.productionStatus === 'proof_corrections') {
      loadCorrections()
    }
  }, [manuscriptId, production.productionStatus])

  async function loadCorrections() {
    setLoading(true)
    const { data } = await getProofCorrections(manuscriptId)
    setCorrections(data || [])
    setLoading(false)
  }

  async function handleResolve(correctionId, resolutionNote) {
    const { error: resolveError } = await resolveProofCorrection(correctionId, resolutionNote)
    if (resolveError) {
      setError(resolveError.message)
      return
    }
    await loadCorrections()
    setMessage({ type: 'success', text: 'Correction resolved' })
  }

  async function handleReject(correctionId, resolutionNote) {
    const { error: rejectError } = await rejectProofCorrection(correctionId, resolutionNote)
    if (rejectError) {
      setError(rejectError.message)
      return
    }
    await loadCorrections()
    setMessage({ type: 'success', text: 'Correction rejected' })
  }

  async function handleReturnToTypesetting() {
    const openCorrections = corrections.filter(c => c.status === 'open')
    if (openCorrections.length > 0) {
      setError('All corrections must be resolved or rejected before returning to typesetting')
      return
    }

    setReturning(true)
    const { error: returnError } = await returnToTypesetting(manuscriptId)
    setReturning(false)

    if (returnError) {
      setError(returnError.message)
      return
    }

    await onUpdated()
  }

  if (loading) {
    return <Panel title="Proof Corrections"><p className="text-sm text-slate-500">Loading corrections…</p></Panel>
  }

  return (
    <Panel title="Proof Corrections" description="Review and resolve author correction requests.">
      <div className="space-y-4">
        {corrections.length === 0 ? (
          <p className="text-sm text-slate-500">No correction requests.</p>
        ) : (
          corrections.map((correction) => (
            <div key={correction.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide ${
                        correction.status === 'open'
                          ? 'bg-orange-100 text-orange-700'
                          : correction.status === 'resolved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {correction.status}
                    </span>
                    {correction.location_page && (
                      <span className="text-xs text-slate-500">Page: {correction.location_page}</span>
                    )}
                  </div>
                  {correction.location_text && (
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-medium">Current text:</span> {correction.location_text}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-ink">
                    <span className="font-medium">Correction:</span> {correction.correction_text}
                  </p>
                  {correction.resolution_note && (
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-medium">Resolution:</span> {correction.resolution_note}
                    </p>
                  )}
                </div>
              </div>
              {correction.status === 'open' && (
                <div className="mt-3 flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Resolution note"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                  <button
                    onClick={() => handleResolve(correction.id, 'Resolved')}
                    className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => handleReject(correction.id, 'Rejected')}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        <div className="border-t border-slate-200 pt-4">
          <button
            onClick={handleReturnToTypesetting}
            disabled={returning}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {returning ? 'Working…' : 'Return to Typesetting (Upload Revised Proof)'}
          </button>
        </div>
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.type === 'error' ? 'text-red-600' : 'text-teal-700'}`}>
          {message.text}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </Panel>
  )
}

// -------------------------------------------------------------------------
// Publication ready panel
// -------------------------------------------------------------------------

function PublicationReadyPanel({ manuscriptId, production, onUpdated }) {
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState(null)

  async function handleMarkReady() {
    setMarking(true)
    setError(null)
    const { error: markError } = await markPublicationReady(manuscriptId)
    setMarking(false)

    if (markError) {
      setError(markError.message)
      return
    }

    await onUpdated()
  }

  return (
    <Panel title="Publication Ready" description="Final verification before publication.">
      <div className="space-y-4">
        <div className="rounded-lg border border-green-100 bg-green-50 p-4">
          <h4 className="font-medium text-green-900">Publication Checklist</h4>
          <ul className="mt-2 space-y-2 text-sm text-green-800">
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              Manuscript accepted
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              Copyediting complete
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              Metadata verified
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              Typesetting complete
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              Proof reviewed
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              Corrections resolved
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              Final proof approved
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-mono text-xs uppercase tracking-wide text-slate-500">Final Proof Approval</h3>
          <p className="mt-2 text-sm text-slate-600">
            Approved: {formatDate(production.finalProofApprovedAt)}
          </p>
        </div>

        <button
          onClick={handleMarkReady}
          disabled={marking}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {marking ? 'Working…' : 'Mark Publication Ready'}
        </button>

        <p className="text-xs text-slate-500">
          This will mark the article as ready for the publication/release phase.
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
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
        
        {/* Phase 2: Typesetting, Author Proof, Corrections, Final Approval */}
        {(production.productionStatus === 'ready_for_typesetting' || 
          production.productionStatus === 'typesetting') && (
          <TypesettingPanel manuscriptId={id} production={production} onUpdated={refresh} />
        )}
        
        {production.productionStatus === 'author_proof' && (
          <AuthorProofPanel manuscriptId={id} production={production} onUpdated={refresh} />
        )}
        
        {production.productionStatus === 'proof_corrections' && (
          <>
            <TypesettingPanel manuscriptId={id} production={production} onUpdated={refresh} />
            <ProofCorrectionsPanel manuscriptId={id} production={production} onUpdated={refresh} />
          </>
        )}
        
        {production.productionStatus === 'final_proof_approval' && (
          <PublicationReadyPanel manuscriptId={id} production={production} onUpdated={refresh} />
        )}
        
        {production.productionStatus === 'publication_ready' && (
          <PublicationReadyPanel manuscriptId={id} production={production} onUpdated={refresh} />
        )}
        
        <ProductionTimelinePanel manuscriptId={id} refreshKey={refreshKey} />
        <VersionHistoryPanel manuscriptId={id} />
        <EditorialDecisionHistoryPanel manuscriptId={id} />
        <PeerReviewHistoryPanel manuscriptId={id} />
      </div>
    </div>
  )
}

export default ProductionDetailPage
