import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconSearch } from '../icons/Icons.jsx'
import { getCategoryBySlug, searchArticles } from '../../data/mockData.js'

const tabs = ['Articles', 'Authors', 'Topics']

function SearchResearch() {
  const [activeTab, setActiveTab] = useState('Articles')
  const [query, setQuery] = useState('')

  const results = useMemo(() => searchArticles(query), [query])
  const hasQuery = query.trim().length > 0

  return (
    <section className="relative z-10 mx-auto -mt-10 max-w-4xl px-4 sm:-mt-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'bg-ink text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>

        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="relative flex-1">
            <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${activeTab.toLowerCase()} by keyword…`}
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            Search
          </button>
        </form>

        {hasQuery && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 font-mono text-xs uppercase tracking-wide text-slate-400">
              {results.length > 0
                ? `${results.length} match${results.length === 1 ? '' : 'es'} in sample data`
                : 'No matches in sample data'}
            </p>
            <ul className="space-y-1">
              {results.slice(0, 4).map((article) => {
                const category = getCategoryBySlug(article.categorySlug)
                return (
                  <li key={article.id}>
                    <Link
                      to={`/resources/${article.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="text-ink">{article.title}</span>
                      <span className="ml-4 shrink-0 font-mono text-xs text-teal-700">
                        {category?.name}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

export default SearchResearch
