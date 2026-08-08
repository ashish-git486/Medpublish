import { useEffect, useMemo, useState } from 'react'
import { categories, getCategoryBySlug } from '../data/mockData.js'
import { getAllArticles } from '../services/articleService.js'
import ArticleCard from '../components/articles/ArticleCard.jsx'
import { IconSearch } from '../components/icons/Icons.jsx'

function LibraryPage() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const allArticles = await getAllArticles()
        if (isMounted) setArticles(allArticles)
      } catch (error) {
        console.error('MedPublish: failed to load the research library', error)
        if (isMounted) setLoadError(true)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return articles
      .filter((article) =>
        activeCategory === 'all' ? true : article.categorySlug === activeCategory,
      )
      .filter((article) => {
        if (!q) return true
        const category = getCategoryBySlug(article.categorySlug)
        return (
          article.title.toLowerCase().includes(q) ||
          article.authorName.toLowerCase().includes(q) ||
          (category && category.name.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  }, [articles, query, activeCategory])

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold text-ink">
        Research Library
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Browse published, peer-reviewed research across every subject on
        MedPublish.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, author, or subject"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-ink shadow-sm placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-ink text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:text-teal-700'
          }`}
        >
          All subjects
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.slug)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === category.slug
                ? 'bg-ink text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:text-teal-700'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading articles…</p>
      ) : loadError ? (
        <div className="mt-4 rounded-xl border border-dashed border-red-200 bg-red-50 p-10 text-center">
          <p className="text-red-600">
            We couldn't load the research library right now. Please try again shortly.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-500">
            {filtered.length} article{filtered.length === 1 ? '' : 's'}
          </p>

          {filtered.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-slate-500">
                No articles match your search. Try a different keyword or
                subject.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default LibraryPage
