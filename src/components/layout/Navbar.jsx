import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/library', label: 'Library' },
  { to: '/author-guidelines', label: 'Author Guidelines' },
  { to: '/submit', label: 'Submit' },
  { to: '/my-submissions', label: 'My Submissions' },
]

function linkClasses({ isActive }) {
  return [
    'text-sm font-medium transition-colors',
    isActive ? 'text-teal-700' : 'text-slate-600 hover:text-teal-700',
  ].join(' ')
}

function Navbar() {
  const { isAuthenticated, loading, profile, role, signOut } = useAuth()
  const navigate = useNavigate()

  const visibleNavLinks = [
    ...navLinks,
    ...(isAuthenticated ? [{ to: '/profile', label: 'Profile' }] : []),
    ...(role === 'reviewer' ? [{ to: '/reviewer', label: 'Reviewer' }] : []),
    ...(role === 'editor' || role === 'admin'
      ? [
          { to: '/admin', label: 'Admin' },
          { to: '/production', label: 'Production' },
          { to: '/admin/library', label: 'Library' },
        ]
      : []),
  ]

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <NavLink to="/" className="font-serif text-lg font-semibold text-ink">
          MedPublish
        </NavLink>

        <nav className="flex items-center gap-6">
          {visibleNavLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={linkClasses}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {loading ? null : isAuthenticated ? (
            <>
              <NavLink 
                to="/profile" 
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-teal-700 transition-colors"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="h-8 w-8 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
                    <span className="text-xs font-semibold text-slate-500">
                      {profile?.full_name?.charAt(0) || profile?.email?.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="hidden sm:inline">
                  {profile?.full_name || profile?.email}
                </span>
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-teal-700"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClasses}>
                Log in
              </NavLink>
              <NavLink to="/signup" className={linkClasses}>
                Sign up
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
