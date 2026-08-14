import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useState } from 'react'

const baseNavLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/library', label: 'Library' },
  { to: '/submit', label: 'Submit' },
  { to: '/my-submissions', label: 'My Submissions' },
]

function linkClasses({ isActive }) {
  return [
    'text-sm font-medium transition-colors',
    isActive 
      ? 'text-ink border-b-2 border-ink pb-1' 
      : 'text-slate-600 hover:text-ink border-b-2 border-transparent hover:border-slate-300 pb-1',
  ].join(' ')
}

function Navbar() {
  const { isAuthenticated, loading, profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const mainNavLinks = [
    ...baseNavLinks,
    ...(role === 'editor' || role === 'admin' 
      ? [
          { to: '/admin', label: 'Admin' },
          { to: '/production', label: 'Production' },
          { to: '/admin/library', label: 'Import' },
        ]
      : []),
    { to: '/author-guidelines', label: 'Author Guidelines' },
  ]

  const reviewerLink = role === 'reviewer' ? [{ to: '/reviewer', label: 'Reviewer' }] : []

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  function handleProfileClick() {
    navigate('/profile')
    setMobileMenuOpen(false)
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
        {/* Brand */}
        <NavLink 
          to="/" 
          className="font-serif text-xl font-semibold text-ink tracking-tight"
        >
          MedPublish
        </NavLink>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {mainNavLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={linkClasses}
            >
              {link.label}
            </NavLink>
          ))}
          {reviewerLink.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={linkClasses}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {loading ? null : isAuthenticated ? (
            <>
              {/* Profile Avatar/Name */}
              <button
                onClick={handleProfileClick}
                className="flex items-center gap-3 text-sm text-slate-600 hover:text-ink transition-colors"
                aria-label="View profile"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="h-9 w-9 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
                    <span className="text-sm font-semibold text-slate-500">
                      {profile?.full_name?.charAt(0) || profile?.email?.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="hidden lg:inline font-medium">
                  {profile?.full_name || profile?.email}
                </span>
              </button>

              {/* Desktop Logout */}
              <button
                type="button"
                onClick={handleLogout}
                className="hidden md:block text-sm font-medium text-slate-600 hover:text-ink transition-colors"
              >
                Log out
              </button>

              {/* Mobile Menu Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-slate-600 hover:text-ink"
                aria-label="Toggle menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
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

      {/* Mobile Menu */}
      {mobileMenuOpen && isAuthenticated && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <nav className="flex flex-col px-4 py-4 space-y-3">
            {mainNavLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-slate-600 hover:text-ink py-2"
              >
                {link.label}
              </NavLink>
            ))}
            {reviewerLink.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-slate-600 hover:text-ink py-2"
              >
                {link.label}
              </NavLink>
            ))}
            <div className="border-t border-slate-200 pt-3 mt-3">
              <button
                onClick={() => {
                  handleProfileClick()
                }}
                className="text-sm font-medium text-slate-600 hover:text-ink py-2 text-left w-full"
              >
                Profile
              </button>
              <button
                onClick={() => {
                  handleLogout()
                  setMobileMenuOpen(false)
                }}
                className="text-sm font-medium text-slate-600 hover:text-ink py-2 text-left w-full"
              >
                Log out
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

export default Navbar
