import { useState } from 'react'
import { Link } from 'react-router-dom'
import { categories } from '../data/mockData.js'
import { saveSubmission } from '../services/manuscriptService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { IconUpload } from '../components/icons/Icons.jsx'

const articleTypes = [
  'Original Research',
  'Review Article',
  'Case Report',
  'Short Communication',
  'Editorial',
  'Medical Education',
]

const initialForm = {
  title: '',
  abstract: '',
  authors: '',
  categorySlug: '',
  articleType: '',
  content: '',
  keywords: '',
  institution: '',
  correspondingEmail: '',
  references: '',
}

const requiredFields = [
  ['title', 'Manuscript title'],
  ['abstract', 'Abstract'],
  ['authors', 'Authors'],
  ['categorySlug', 'Primary subject/category'],
  ['articleType', 'Article type'],
  ['content', 'Manuscript content'],
]

function validate(form) {
  const errors = {}

  for (const [field, label] of requiredFields) {
    if (!form[field] || !form[field].trim()) {
      errors[field] = `${label} is required.`
    }
  }

  if (
    form.correspondingEmail.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correspondingEmail.trim())
  ) {
    errors.correspondingEmail = 'Enter a valid email address.'
  }

  return errors
}

function FieldLabel({ htmlFor, children, required }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
      {children}
      {required && <span className="ml-1 text-teal-700">*</span>}
    </label>
  )
}

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1.5 text-sm text-red-600">{message}</p>
}

const inputClasses =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20'

function SubmitResourcePage() {
  const { user } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  function handleChange(field) {
    return (event) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const validationErrors = validate(form)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      const firstField = requiredFields.find(([field]) => validationErrors[field])?.[0]
      if (firstField) {
        document
          .getElementById(firstField)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setSubmitError(null)
    setSubmitting(true)

    const { data, error } = await saveSubmission(form, user.id)

    setSubmitting(false)

    if (error) {
      console.error('MedPublish: failed to save submission', error)
      setSubmitError(
        'Something went wrong saving your manuscript. Please try again in a moment.',
      )
      return
    }

    setSubmitted(data)
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <IconUpload className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-serif text-3xl font-semibold text-ink">
          Manuscript submitted
        </h1>
        <p className="mt-3 text-slate-600">
          Thank you. Your manuscript has been saved and is now awaiting
          editorial review.
        </p>

        <dl className="mt-8 space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-left">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-slate-500">Submission ID</dt>
            <dd className="font-mono text-sm text-ink">{submitted.id}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-slate-500">Title</dt>
            <dd className="text-right text-sm font-medium text-ink">
              {submitted.title}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-slate-500">Status</dt>
            <dd>
              <span className="inline-flex items-center rounded-full bg-gold-500/10 px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide text-gold-600">
                Pending review
              </span>
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/my-submissions"
            className="inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light"
          >
            View my submissions
          </Link>
          <button
            type="button"
            onClick={() => {
              setForm(initialForm)
              setSubmitted(null)
            }}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-teal-600 hover:text-teal-700"
          >
            Submit another manuscript
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold text-ink">
        Submit a Manuscript
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Complete the form below to submit your manuscript for editorial
        review. Fields marked with <span className="text-teal-700">*</span>{' '}
        are required.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Your manuscript is saved to your MedPublish account and is visible to
        editors for review.
      </p>

      <form
        noValidate
        onSubmit={handleSubmit}
        className="mt-10 space-y-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <section className="space-y-5">
          <h2 className="font-mono text-xs uppercase tracking-wide text-teal-700">
            Manuscript
          </h2>

          <div>
            <FieldLabel htmlFor="title" required>
              Manuscript title
            </FieldLabel>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={handleChange('title')}
              className={inputClasses}
              placeholder="e.g. Wearable ECG Screening for Undiagnosed Atrial Fibrillation"
            />
            <FieldError message={errors.title} />
          </div>

          <div>
            <FieldLabel htmlFor="abstract" required>
              Abstract
            </FieldLabel>
            <textarea
              id="abstract"
              rows={4}
              value={form.abstract}
              onChange={handleChange('abstract')}
              className={inputClasses}
              placeholder="Summarize the background, methods, results, and conclusion."
            />
            <FieldError message={errors.abstract} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="authors" required>
                Authors
              </FieldLabel>
              <input
                id="authors"
                type="text"
                value={form.authors}
                onChange={handleChange('authors')}
                className={inputClasses}
                placeholder="e.g. Dr. Amara N. Chen, Dr. Femi Okafor"
              />
              <FieldError message={errors.authors} />
            </div>

            <div>
              <FieldLabel htmlFor="institution">
                Institution/affiliation
              </FieldLabel>
              <input
                id="institution"
                type="text"
                value={form.institution}
                onChange={handleChange('institution')}
                className={inputClasses}
                placeholder="e.g. Ashcombe University Medical Center"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="categorySlug" required>
                Primary subject/category
              </FieldLabel>
              <select
                id="categorySlug"
                value={form.categorySlug}
                onChange={handleChange('categorySlug')}
                className={inputClasses}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.categorySlug} />
            </div>

            <div>
              <FieldLabel htmlFor="articleType" required>
                Article type
              </FieldLabel>
              <select
                id="articleType"
                value={form.articleType}
                onChange={handleChange('articleType')}
                className={inputClasses}
              >
                <option value="">Select an article type</option>
                {articleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <FieldError message={errors.articleType} />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="keywords">Keywords</FieldLabel>
            <input
              id="keywords"
              type="text"
              value={form.keywords}
              onChange={handleChange('keywords')}
              className={inputClasses}
              placeholder="Comma-separated, e.g. atrial fibrillation, wearables, screening"
            />
          </div>
        </section>

        <section className="space-y-5 border-t border-slate-100 pt-8">
          <h2 className="font-mono text-xs uppercase tracking-wide text-teal-700">
            Full manuscript
          </h2>

          <div>
            <FieldLabel htmlFor="content" required>
              Manuscript content
            </FieldLabel>
            <textarea
              id="content"
              rows={10}
              value={form.content}
              onChange={handleChange('content')}
              className={inputClasses}
              placeholder="Paste or write the full manuscript text (introduction, methods, results, discussion, conclusion)."
            />
            <FieldError message={errors.content} />
          </div>

          <div>
            <FieldLabel htmlFor="references">References</FieldLabel>
            <textarea
              id="references"
              rows={4}
              value={form.references}
              onChange={handleChange('references')}
              className={inputClasses}
              placeholder="One reference per line."
            />
          </div>
        </section>

        <section className="space-y-5 border-t border-slate-100 pt-8">
          <h2 className="font-mono text-xs uppercase tracking-wide text-teal-700">
            Corresponding author
          </h2>

          <div className="sm:max-w-sm">
            <FieldLabel htmlFor="correspondingEmail">
              Corresponding author email
            </FieldLabel>
            <input
              id="correspondingEmail"
              type="email"
              value={form.correspondingEmail}
              onChange={handleChange('correspondingEmail')}
              className={inputClasses}
              placeholder="name@institution.edu"
            />
            <FieldError message={errors.correspondingEmail} />
          </div>
        </section>

        {submitError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit manuscript'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SubmitResourcePage
