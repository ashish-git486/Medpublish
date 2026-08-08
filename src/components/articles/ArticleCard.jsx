import { Link } from 'react-router-dom'
import { getCategoryBySlug } from '../../data/mockData.js'

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ArticleCard({ article, variant = 'grid' }) {
  const category = getCategoryBySlug(article.categorySlug)

  if (variant === 'row') {
    return (
      <article className="flex flex-col gap-2 border-l-2 border-teal-600/40 py-4 pl-5 transition-colors hover:border-teal-600">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-wide text-teal-700">
          <span>{category?.name ?? 'General'}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">{article.articleType}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">{formatDate(article.publishedAt)}</span>
        </div>
        <h3 className="font-serif text-lg font-semibold leading-snug text-ink">
          {article.title}
        </h3>
        <p className="line-clamp-2 max-w-3xl text-sm text-slate-600">
          {article.abstract}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-slate-500">{article.authorName}</span>
          <Link
            to={`/resources/${article.id}`}
            className="text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Read Article →
          </Link>
        </div>
      </article>
    )
  }

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide text-teal-700">
          {category?.name ?? 'General'}
        </span>
        {article.openAccess && (
          <span className="inline-flex items-center rounded-full bg-gold-500/10 px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide text-gold-600">
            Open Access
          </span>
        )}
      </div>

      <h3 className="mt-4 font-serif text-lg font-semibold leading-snug text-ink">
        {article.title}
      </h3>

      <p className="mt-3 line-clamp-3 text-sm text-slate-600">
        {article.abstract}
      </p>

      <div className="mt-5 space-y-1 border-t border-slate-100 pt-4 font-mono text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <span>{article.authorName}</span>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
        <div className="text-slate-400">{article.articleType}</div>
      </div>

      <Link
        to={`/resources/${article.id}`}
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-light"
      >
        Read Article
      </Link>
    </article>
  )
}

export default ArticleCard
