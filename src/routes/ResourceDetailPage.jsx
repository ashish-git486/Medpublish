import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCategoryBySlug } from '../data/mockData.js'
import { getArticleById } from '../services/articleService.js'

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function ResourceDetailPage() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const found = await getArticleById(id)
        if (isMounted) setArticle(found ?? null)
      } catch (error) {
        console.error('MedPublish: failed to load article', error)
        if (isMounted) setLoadError(true)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-slate-500">Loading article…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Something went wrong
        </h1>
        <p className="mt-3 text-slate-600">
          We couldn't load this article right now. Please try again shortly.
        </p>
        <Link
          to="/library"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light"
        >
          Back to Research Library
        </Link>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold text-ink">
          Article not found
        </h1>
        <p className="mt-3 text-slate-600">
          We couldn't find an article with id{' '}
          <span className="font-mono">{id}</span>. It may have been
          unpublished or the link may be incorrect.
        </p>
        <Link
          to="/library"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light"
        >
          Back to Research Library
        </Link>
      </div>
    )
  }

  const category = getCategoryBySlug(article.categorySlug)

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link
        to="/library"
        className="text-sm font-semibold text-teal-700 hover:text-teal-800"
      >
        ← Back to Research Library
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-teal-700">
        <span>{category?.name ?? 'General'}</span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">{article.articleType}</span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">{formatDate(article.publishedAt)}</span>
        {article.openAccess && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-gold-600">Open Access</span>
          </>
        )}
      </div>

      <h1 className="mt-4 font-serif text-3xl font-semibold leading-snug text-ink">
        {article.title}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
        <span className="font-medium text-ink">{article.authorName}</span>
        {article.authorAffiliation && (
          <>
            <span className="text-slate-300">·</span>
            <span>{article.authorAffiliation}</span>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-y border-slate-200 py-4 font-mono text-xs text-slate-500">
        {article.doi && <span>DOI: {article.doi}</span>}
        <span>{article.readTimeMinutes} min read</span>
        {typeof article.citationCount === 'number' && (
          <span>{article.citationCount} citations</span>
        )}
        {article.isLocalSubmission && (
          <span className="text-teal-700">
            Published from a MedPublish author submission
          </span>
        )}
      </div>

      <section className="mt-8">
        <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
          Abstract
        </h2>
        <p className="mt-2 text-base leading-relaxed text-slate-700">
          {article.abstract}
        </p>
      </section>

      {article.content && (
        <section className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Full Text
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-slate-700">
            {article.content}
          </p>
        </section>
      )}

      {article.keywords && (
        <section className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
            Keywords
          </h2>
          <p className="mt-2 text-sm text-slate-700">{article.keywords}</p>
        </section>
      )}

      {article.references && (
        <section className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-wide text-slate-500">
            References
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {article.references}
          </p>
        </section>
      )}
    </div>
  )
}

export default ResourceDetailPage
