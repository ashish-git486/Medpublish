import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCategoryBySlug } from '../data/mockData.js'
import { statusBadgeClassName, statusLabel } from '../data/manuscriptStatus.js'
import { productionStatusBadgeClassName, productionStatusLabel } from '../data/productionStatus.js'
import { getMySubmissions } from '../services/manuscriptService.js'
import { getProductionRecord, getCurrentProofVersion, getProofCorrections, getProofFileUrl } from '../services/productionService.js'

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
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const STATUS_MESSAGES = {
  submitted: 'Awaiting editorial screening.',
  editorial_review: 'Awaiting editorial screening.',
  under_peer_review: 'Sent to peer review.',
  minor_revision_requested: 'The editorial team has requested a minor revision.',
  major_revision_requested: 'The editorial team has requested a major revision.',
  revision_submitted: 'Your revision has been submitted and is awaiting an editorial decision.',
  accepted: 'Accepted — preparing for publication.',
}

function ProductionInfo({ manuscriptId }) {
  const [production, setProduction] = useState(null)
  const [currentProof, setCurrentProof] = useState(null)
  const [corrections, setCorrections] = useState([])
  const [loading, setLoading] = useState(true)
  const [proofUrl, setProofUrl] = useState(null)
  const [urlError, setUrlError] = useState(null)

  useEffect(() => {
    async function loadProductionData() {
      setLoading(true)
      const [productionResult, proofResult, correctionsResult] = await Promise.all([
        getProductionRecord(manuscriptId),
        getCurrentProofVersion(manuscriptId),
        getProofCorrections(manuscriptId),
      ])
      setProduction(productionResult.data)
      setCurrentProof(proofResult.data)
      setCorrections(correctionsResult.data || [])
      setLoading(false)
    }
    loadProductionData()
  }, [manuscriptId])

  useEffect(() => {
    async function loadProofUrl() {
      if (currentProof?.storage_path) {
        const { data: url, error } = await getProofFileUrl(currentProof.storage_path)
        if (error) {
          setUrlError('Failed to load proof')
        } else {
          setProofUrl(url)
        }
      }
    }
    loadProofUrl()
  }, [currentProof])

  if (loading) {
    return <p className="mt-3 text-sm text-slate-500">Loading production status…</p>
  }

  if (!production) {
    return null
  }

  const openCorrections = corrections.filter(c => c.status === 'open').length

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h4 className="font-mono text-xs uppercase tracking-wide text-slate-500">Production Status</h4>
      <div className="mt-2 flex items-center gap-2">
        <ProductionStatusBadge status={production.productionStatus} />
      </div>

      {currentProof && (
        <div className="mt-3 text-sm">
          <p className="font-medium text-ink">Current Proof: v{currentProof.version_number}</p>
          <p className="text-xs text-slate-500">
            {formatDate(currentProof.uploaded_at)} · {(currentProof.file_size_bytes / 1024 / 1024).toFixed(2)} MB
          </p>
          {proofUrl && (
            <a
              href={proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs font-medium text-teal-700 hover:text-teal-800"
            >
              View/Download Proof →
            </a>
          )}
          {urlError && (
            <p className="mt-1 text-xs text-red-600">{urlError}</p>
          )}
        </div>
      )}

      {production.productionStatus === 'author_proof' && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
          <p className="font-medium text-blue-900">Action Required</p>
          <p className="mt-1 text-blue-800">
            Your article is ready for proof review. Please review the typeset proof and submit corrections or approve for publication.
          </p>
        </div>
      )}

      {production.productionStatus === 'proof_corrections' && (
        <div className="mt-3 rounded-lg border border-orange-100 bg-orange-50 p-3 text-sm">
          <p className="font-medium text-orange-900">Corrections Under Review</p>
          <p className="mt-1 text-orange-800">
            Your proof corrections are being reviewed by the production team.
          </p>
        </div>
      )}

      {production.productionStatus === 'final_proof_approval' && (
        <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3 text-sm">
          <p className="font-medium text-green-900">Proof Approved</p>
          <p className="mt-1 text-green-800">
            Your final proof has been approved and is ready for publication.
          </p>
        </div>
      )}

      {production.productionStatus === 'publication_ready' && (
        <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm">
          <p className="font-medium text-teal-900">Publication Ready</p>
          <p className="mt-1 text-teal-800">
            Your article has completed the production workflow and is ready for publication.
          </p>
        </div>
      )}
    </div>
  )
}

function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setLoading(true)
      setLoadError(false)
      const { data, error } = await getMySubmissions()
      if (!isMounted) return
      if (error) {
        console.error('MedPublish: failed to load submissions', error)
        setLoadError(true)
      } else {
        setSubmissions(data)
      }
      setLoading(false)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold text-ink">My Submissions</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Manuscripts you've submitted to MedPublish, and their current editorial status.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading your submissions…</p>
      ) : loadError ? (
        <div className="mt-8 rounded-xl border border-dashed border-red-200 bg-red-50 p-10 text-center">
          <p className="text-red-600">
            We couldn't load your submissions right now. Please try again shortly.
          </p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">You haven't submitted any manuscripts yet.</p>
          <Link
            to="/submit"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light"
          >
            Submit a manuscript
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {submissions.map((submission) => {
            const category = getCategoryBySlug(submission.categorySlug)
            return (
              <div
                key={submission.id}
                className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-slate-500">
                      <span>{category?.name ?? submission.categorySlug}</span>
                      <span className="text-slate-300">·</span>
                      <span>{formatDate(submission.submittedAt)}</span>
                    </div>
                    <h3 className="mt-2 font-serif text-lg font-semibold text-ink">
                      {submission.title}
                    </h3>
                  </div>
                  <StatusBadge status={submission.status} />
                </div>

                <div className="mt-4">
                  {submission.status === 'published' && (
                    <Link
                      to={`/resources/${submission.id}`}
                      className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                    >
                      View published article →
                    </Link>
                  )}
                  {submission.status === 'rejected' && (
                    <p className="text-sm text-slate-500">
                      This manuscript was not approved for publication.
                    </p>
                  )}
                  {submission.status === 'revision_requested' && (
                    <p className="text-sm text-slate-500">
                      The editorial team has requested a revision.
                    </p>
                  )}
                  {STATUS_MESSAGES[submission.status] && (
                    <p className="text-sm text-slate-500">{STATUS_MESSAGES[submission.status]}</p>
                  )}

                  {submission.status === 'accepted' && (
                    <ProductionInfo manuscriptId={submission.id} />
                  )}

                  {(submission.status === 'revision_requested' || submission.status === 'rejected') &&
                    submission.screeningNotes && (
                      <div className="mt-3 rounded-lg bg-paper p-3">
                        <h4 className="font-mono text-xs uppercase tracking-wide text-slate-500">
                          Editor's note
                        </h4>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {submission.screeningNotes}
                        </p>
                      </div>
                    )}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    <Link
                      to={`/my-submissions/${submission.id}`}
                      className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                    >
                      View timeline →
                    </Link>
                    {(submission.status === 'minor_revision_requested' ||
                      submission.status === 'major_revision_requested') && (
                      <Link
                        to={`/my-submissions/${submission.id}/revise`}
                        className="text-sm font-semibold text-gold-600 hover:text-gold-500"
                      >
                        Submit revision →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MySubmissionsPage
