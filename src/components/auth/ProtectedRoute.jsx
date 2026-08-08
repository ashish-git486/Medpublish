// Route guard used in App.jsx.
//
// - Waits for the initial session check before deciding anything (avoids a
//   flash-redirect to /login while Supabase is still restoring a session).
// - Unauthenticated users are redirected to /login, and where they were
//   trying to go is preserved so LoginPage can send them back afterwards.
// - When `requireRole` is set, authenticated users without that role see an
//   access-denied state instead of the page (never just a hidden nav link).

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

function FullPageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-700"
        role="status"
        aria-label="Loading"
      />
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-serif text-2xl font-semibold text-ink">Access denied</h1>
      <p className="mt-3 text-slate-600">
        You're signed in, but your account doesn't have permission to view this page. If you
        believe this is a mistake, contact a MedPublish editor.
      </p>
    </div>
  )
}

function ProtectedRoute({ children, requireRole }) {
  const { loading, profileLoading, isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (loading || (isAuthenticated && requireRole && profileLoading)) {
    return <FullPageSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireRole && !requireRole.includes(role)) {
    return <AccessDenied />
  }

  return children
}

export default ProtectedRoute
