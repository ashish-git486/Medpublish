import { Link } from 'react-router-dom'
import ArticleCard from '../articles/ArticleCard.jsx'
import { getLatestArticles } from '../../data/mockData.js'

function LatestResearch() {
  const latest = getLatestArticles()

  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">
            Latest Research
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            Newly published across all subjects
          </h2>
        </div>
        <Link
          to="/library"
          className="text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          View all research →
        </Link>
      </div>

      <div className="mt-8 divide-y divide-slate-100">
        {latest.map((article) => (
          <ArticleCard key={article.id} article={article} variant="row" />
        ))}
      </div>
    </section>
  )
}

export default LatestResearch
