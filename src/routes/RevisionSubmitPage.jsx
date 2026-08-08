import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { revisionTypeLabel } from '../data/editorDecisionStatus.js'
import { getSubmissionById } from '../services/manuscriptService.js'
import {
  getAuthorVisibleReviews,
  getPendingRevisionRequest,
  submitManuscriptRevision,
} from '../services/revisionService.js'

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

function FieldLabel({ htmlFor, children, required }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
      {children}
      {required && <span className="ml-1 text-red-600">*</span>}
    </label>
  )
}

const textInputClassName =
  'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700'

function RevisionSubmitPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [submission, setSubmission] = useState(null)
  const [revisionRequest, setRevisionRequest] = useState(null)
  const [reviewerComments, setReviewerComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

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

      const { data: requestData, error: requestError } = await getPendingRevisionRequest(id)
      if (!isMounted) return
      if (requestError || !requestData) {
        // No pending revision request — either already fulfilled, or this
        // manuscript never had one. Nothing to submit here.
        setSubmission(submissionData)
        setRevisionRequest(null)
        setLoading(false)
        return
      }

      const { data: commentsData } = await getAuthorVisibleReviews(requestData.id)
      if (!isMounted) return

      setSubmission(submissionData)
      setRevisionRequest(requestData)
      setReviewerComments(commentsData)
      setForm({
        title: submissionData.title,
        abstract: submissionData.abstract,
        authors: submissionData.authors,
        content: submissionData.content,
        keywords: submissionData.keywords ?? '',
        references: submissionData.references ?? '',
        responseLetter: '',
        generalNotes: '',
      })
      setLoading(false)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [id])

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function validate() {
    const nextErrors = {}
    const required = [
      ['title', 'Manuscript title'],
      ['abstract', 'Abstract'],
      ['authors', 'Authors'],
      ['content', 'Manuscript content'],
      ['responseLetter', 'Response letter'],
    ]
    for (const [field, label] of required) {
      if (!form[field] || !form[field].trim()) {
        nextErrors[field] = `${label} is required.`
      }
    }
    return nextErrors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setSubmitError(null)

    const { error } = await submitManuscriptRevision(revisionRequest.id, form)

    setSubmitting(false)

    if (error) {
      console.error('MedPublish: failed to submit revision', error)
      setSubmitError('Something went wrong submitting your revision. Please try again.')
      return
    }

    navigate(`/my-submissions/${id}`)
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-sm text-slate-500">Loading…</p>
  }

  if (loadError || !submission) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
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

  if (!revisionRequest) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">
            There's no outstanding revision request for this manuscript right now.
          </p>
          <Link
            to={`/my-submissions/${id}`}
            className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            ← Back to submission
          </Link>
        </div>
      </div>
    )
  }

  const decision = revisionRequest.decision

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link
        to={`/my-submissions/${id}`}
        className="text-sm font-semibold text-teal-700 hover:text-teal-800"
      >
        ← Back to submission
      </Link>

      <h1 className="mt-4 font-serif text-2xl font-semibold text-ink sm:text-3xl">
        Submit revision — {revisionTypeLabel(revisionRequest.revisionType)}
      </h1>
      <p className="mt-2 text-sm text-slate-600">{submission.title}</p>

      {/* Editor's decision letter + instructions */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Editorial decision</h2>
        {decision?.createdAt && (
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(decision.createdAt)}</p>
        )}
        {decision?.decisionLetter && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{decision.decisionLetter}</p>
        )}
        {decision?.reviewerSummary && (
          <div className="mt-3 rounded-lg bg-paper p-3">
            <h4 className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
              Summary of reviewer feedback
            </h4>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{decision.reviewerSummary}</p>
          </div>
        )}
        {decision?.authorInstructions && (
          <div className="mt-3 rounded-lg bg-paper p-3">
            <h4 className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
              Instructions
            </h4>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {decision.authorInstructions}
            </p>
          </div>
        )}
        {revisionRequest.deadline && (
          <p className="mt-3 text-xs text-slate-500">Please respond by {revisionRequest.deadline}.</p>
        )}
      </div>

      {/* Non-confidential reviewer comments */}
      {reviewerComments.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">Reviewer comments</h2>
          <p className="mt-1 text-sm text-slate-600">
            Comments intended for you, from each reviewer. Reviewer identity and internal notes
            to the editor are never shared.
          </p>
          <div className="mt-4 space-y-4">
            {reviewerComments.map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-4">
                {r.majorComments && (
                  <div>
                    <h4 className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
                      Major comments
                    </h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.majorComments}</p>
                  </div>
                )}
                {r.minorComments && (
                  <div className="mt-3">
                    <h4 className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
                      Minor comments
                    </h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.minorComments}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revision form */}
      <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Revised manuscript</h2>
        <p className="mt-1 text-sm text-slate-600">
          Update your manuscript below. This creates a new version — your previous version stays
          on record.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <FieldLabel htmlFor="title" required>
              Manuscript title
            </FieldLabel>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className={textInputClassName}
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          <div>
            <FieldLabel htmlFor="abstract" required>
              Abstract
            </FieldLabel>
            <textarea
              id="abstract"
              rows={4}
              value={form.abstract}
              onChange={(e) => setField('abstract', e.target.value)}
              className={textInputClassName}
            />
            {errors.abstract && <p className="mt-1 text-sm text-red-600">{errors.abstract}</p>}
          </div>

          <div>
            <FieldLabel htmlFor="authors" required>
              Authors
            </FieldLabel>
            <input
              id="authors"
              type="text"
              value={form.authors}
              onChange={(e) => setField('authors', e.target.value)}
              className={textInputClassName}
            />
            {errors.authors && <p className="mt-1 text-sm text-red-600">{errors.authors}</p>}
          </div>

          <div>
            <FieldLabel htmlFor="content" required>
              Manuscript content
            </FieldLabel>
            <textarea
              id="content"
              rows={10}
              value={form.content}
              onChange={(e) => setField('content', e.target.value)}
              className={textInputClassName}
            />
            {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content}</p>}
          </div>

          <div>
            <FieldLabel htmlFor="keywords">Keywords</FieldLabel>
            <input
              id="keywords"
              type="text"
              value={form.keywords}
              onChange={(e) => setField('keywords', e.target.value)}
              className={textInputClassName}
            />
          </div>

          <div>
            <FieldLabel htmlFor="references">References</FieldLabel>
            <textarea
              id="references"
              rows={4}
              value={form.references}
              onChange={(e) => setField('references', e.target.value)}
              className={textInputClassName}
            />
          </div>
        </div>

        <div className="mt-6 space-y-5 border-t border-slate-100 pt-6">
          <div>
            <FieldLabel htmlFor="responseLetter" required>
              Response letter
            </FieldLabel>
            <p className="mt-1 text-xs text-slate-500">
              Address each reviewer point — e.g. "Section 4.2 has been expanded to explain the
              statistical analysis."
            </p>
            <textarea
              id="responseLetter"
              rows={6}
              value={form.responseLetter}
              onChange={(e) => setField('responseLetter', e.target.value)}
              className={textInputClassName}
            />
            {errors.responseLetter && (
              <p className="mt-1 text-sm text-red-600">{errors.responseLetter}</p>
            )}
          </div>

          <div>
            <FieldLabel htmlFor="generalNotes">General notes to the editor (optional)</FieldLabel>
            <textarea
              id="generalNotes"
              rows={3}
              value={form.generalNotes}
              onChange={(e) => setField('generalNotes', e.target.value)}
              className={textInputClassName}
            />
          </div>
        </div>

        {submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit revision'}
          </button>
          <Link
            to={`/my-submissions/${id}`}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-ink hover:border-slate-400"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

export default RevisionSubmitPage
