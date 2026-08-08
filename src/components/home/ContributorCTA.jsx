import { Link } from 'react-router-dom'

function ContributorCTA() {
  return (
    <section className="bg-ink py-20">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h2 className="font-serif text-2xl font-semibold text-white sm:text-3xl">
            Share your research with a global audience
          </h2>
          <p className="mt-3 text-slate-300">
            Submit your manuscript for peer review and reach researchers,
            clinicians, and institutions worldwide — openly and without
            paywalls.
          </p>
          <p className="mt-4 font-mono text-xs uppercase tracking-wide text-teal-300">
            Fast editorial review &middot; Global visibility &middot; Open access
          </p>
        </div>

        <Link
          to="/submit"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-gold-500 px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-gold-600"
        >
          Submit Your Research
        </Link>
      </div>
    </section>
  )
}

export default ContributorCTA
