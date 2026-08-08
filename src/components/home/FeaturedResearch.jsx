import ArticleCard from '../articles/ArticleCard.jsx'
import { getFeaturedArticles } from '../../data/mockData.js'

function FeaturedResearch() {
  const featured = getFeaturedArticles()

  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">
          Featured Research
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
          Recently published, hand-selected studies
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {featured.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  )
}

export default FeaturedResearch
