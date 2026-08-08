import { IconSearch, IconUpload, IconUnlock, IconUsers } from '../icons/Icons.jsx'

const points = [
  {
    icon: IconSearch,
    title: 'Discover research',
    description:
      'Search across articles, topics, and authors to find studies relevant to your work in seconds.',
  },
  {
    icon: IconUpload,
    title: 'Submit your work',
    description:
      'A straightforward submission flow gets your manuscript in front of editors without the paperwork.',
  },
  {
    icon: IconUnlock,
    title: 'Open access publishing',
    description:
      'Published research is freely available to read, cite, and build on — no paywalls, no subscriptions.',
  },
  {
    icon: IconUsers,
    title: 'Connect with the community',
    description:
      'Follow authors, track fields you care about, and see how your research connects to others.',
  },
]

function WhyMedPublish() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">
          Why MedPublish
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-ink sm:text-3xl">
          Built for the way research actually moves
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {points.map(({ icon: Icon, title, description }) => (
          <div key={title}>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-serif text-lg font-semibold text-ink">
              {title}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default WhyMedPublish
