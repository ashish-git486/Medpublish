import { Link } from 'react-router-dom'

const columns = [
  {
    title: 'Explore',
    links: [
      { label: 'Resource Library', to: '/library' },
      { label: 'Browse by Subject', to: '/library' },
      { label: 'Latest Research', to: '/library' },
    ],
  },
  {
    title: 'For Authors',
    links: [
      { label: 'Submit Your Research', to: '/submit' },
      { label: 'Editorial Process', to: '/submit' },
      { label: 'Open Access Policy', to: '/submit' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log In', to: '/login' },
      { label: 'Sign Up', to: '/signup' },
      { label: 'Admin Dashboard', to: '/admin' },
    ],
  },
]

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <span className="font-serif text-lg font-semibold text-white">
              MedPublish
            </span>
            <p className="mt-3 max-w-xs text-sm text-slate-400">
              An open access platform for discovering, sharing, and
              publishing peer-reviewed medical research.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-mono text-xs uppercase tracking-wide text-teal-300">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-slate-300 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} MedPublish. All rights reserved.</span>
          <span>Prototype build — content shown is sample data.</span>
        </div>
      </div>
    </footer>
  )
}

export default Footer
