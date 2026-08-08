import SubjectCard from './SubjectCard.jsx'
import { categories } from '../../data/mockData.js'

function BrowseBySubject() {
  return (
    <section className="bg-teal-50/50 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">
            Browse by Subject
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
            Find research in your field
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <SubjectCard key={category.id} category={category} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default BrowseBySubject
