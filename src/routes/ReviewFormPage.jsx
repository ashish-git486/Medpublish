import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getCategoryBySlug } from '../data/mockData.js'
import {
  RECOMMENDATION_OPTIONS,
  SCORE_FIELDS,
  getAssignmentById,
  getMyReviewForAssignment,
  submitReview,
} from '../services/reviewService.js'

const EMPTY_FORM = {
  overallRecommendation: '',
  originalityScore: 0,
  methodologyScore: 0,
  statisticalQualityScore: 0,
  clinicalRelevanceScore: 0,
  writingQualityScore: 0,
  ethicalComplianceScore: 0,
  majorComments: '',
  minorComments: '',
  commentsToEditor: '',
  confidential: false,
}

function ScoreSelector({ label, value, onChange }) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-wide text-slate-500">{label}</label>
      <div className="mt-1.5 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
              value === n
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-slate-300 text-slate-600 hover:border-teal-700 hover:text-teal-700'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function ReviewFormPage() {
  const { assignmentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [assignment, setAssignment] = useState(null)
  const [existingReview, setExistingReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    let isMounted = true

    async function load() {
      setLoading(true)
      setLoadError(false)
      const [{ data: assignmentData, error: assignmentError }, { data: reviewData }] =
        await Promise.all([getAssignmentById(assignmentId), getMyReviewForAssignment(assignmentId)])

      if (!isMounted) return

      if (assignmentError || !assignmentData) {
        console.error('MedPublish: failed to load assignment', assignmentError)
        setLoadError(true)
      } else {
        setAssignment(assignmentData)
        setExistingReview(reviewData)
      }
      setLoading(false)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [assignmentId])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate() {
    const errors = {}
    if (!form.overallRecommendation) errors.overallRecommendation = 'Choose a recommendation.'
    for (const field of SCORE_FIELDS) {
      if (!form[field.key] || form[field.key] < 1) {
        errors[field.key] = 'Required.'
      }
    }
    if (!form.majorComments.trim()) {
      errors.majorComments = 'Major comments are required.'
    }
    return errors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setSubmitError('Please complete all required fields before submitting.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    const { error } = await submitReview({ assignmentId, reviewerId: user.id, form })

    setSubmitting(false)

    if (error) {
      console.error('MedPublish: failed to submit review', error)
      setSubmitError('Something went wrong submitting your review. Please try again.')
      return
    }

    navigate('/reviewer')
  }

  if (loading) {
    return <p className="mx-auto max-w-4xl px-4 py-16 text-sm text-slate-500">Loading manuscript…</p>
  }

  if (loadError || !assignment) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-10 text-center">
          <p className="text-red-600">
            We couldn't load this review assignment. It may not exist, or you may not have access.
          </p>
          <Link to="/reviewer" className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:text-teal-800">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (assignment.status === 'assigned') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-xl border border-dashed border-gold-500 bg-gold-500/5 p-10 text-center">
          <p className="text-ink">
            You need to accept this review assignment before starting the review.
          </p>
          <Link to="/reviewer" className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:text-teal-800">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (existingReview) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-xl border border-dashed border-teal-700 bg-teal-50 p-10 text-center">
          <p className="text-teal-700">
            You already submitted a review for this manuscript on{' '}
            {new Date(existingReview.submittedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
            .
          </p>
          <Link to="/reviewer" className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:text-teal-800">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const category = getCategoryBySlug(assignment.manuscript?.categorySlug)

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Link to="/reviewer" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
        ← Back to dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-slate-500">
        <span>{category?.name ?? assignment.manuscript?.categorySlug}</span>
        <span className="text-slate-300">·</span>
        <span>{assignment.manuscript?.articleType}</span>
      </div>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
        {assignment.manuscript?.title}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{assignment.manuscript?.authors}</p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">Abstract</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {assignment.manuscript?.abstract}
        </p>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-teal-700 hover:text-teal-800">
            Show full manuscript text
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {assignment.manuscript?.content}
          </p>
        </details>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">Overall recommendation</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {RECOMMENDATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateField('overallRecommendation', opt.value)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                  form.overallRecommendation === opt.value
                    ? 'border-ink bg-ink text-white'
                    : 'border-slate-300 text-ink hover:border-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {fieldErrors.overallRecommendation && (
            <p className="mt-2 text-sm text-red-600">{fieldErrors.overallRecommendation}</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">Scores</h2>
          <p className="mt-1 text-sm text-slate-600">Rate each dimension from 1 (poor) to 5 (excellent).</p>
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {SCORE_FIELDS.map((field) => (
              <div key={field.key}>
                <ScoreSelector
                  label={field.label}
                  value={form[field.key]}
                  onChange={(n) => updateField(field.key, n)}
                />
                {fieldErrors[field.key] && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors[field.key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">Comments</h2>

          <div className="mt-5">
            <label htmlFor="major-comments" className="font-mono text-xs uppercase tracking-wide text-slate-500">
              Major comments (required)
            </label>
            <textarea
              id="major-comments"
              rows={6}
              value={form.majorComments}
              onChange={(e) => updateField('majorComments', e.target.value)}
              placeholder="Substantive concerns about methodology, validity, or significance."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
            {fieldErrors.majorComments && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.majorComments}</p>
            )}
          </div>

          <div className="mt-5">
            <label htmlFor="minor-comments" className="font-mono text-xs uppercase tracking-wide text-slate-500">
              Minor comments (optional)
            </label>
            <textarea
              id="minor-comments"
              rows={4}
              value={form.minorComments}
              onChange={(e) => updateField('minorComments', e.target.value)}
              placeholder="Typos, formatting, small clarifications."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          <div className="mt-5">
            <label htmlFor="editor-comments" className="font-mono text-xs uppercase tracking-wide text-slate-500">
              Comments to editor only (optional)
            </label>
            <textarea
              id="editor-comments"
              rows={4}
              value={form.commentsToEditor}
              onChange={(e) => updateField('commentsToEditor', e.target.value)}
              placeholder="Never shown to the author — concerns about ethics, conflicts of interest, or the manuscript's suitability."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.confidential}
              onChange={(e) => updateField('confidential', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
            />
            Mark this review as confidential (visible to editors only, never to the author)
          </label>
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Review'}
          </button>
          <Link
            to="/reviewer"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-ink hover:border-slate-400"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

export default ReviewFormPage
