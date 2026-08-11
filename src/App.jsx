import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import PageLayout from './components/layout/PageLayout.jsx'
import HomePage from './routes/HomePage.jsx'
import LibraryPage from './routes/LibraryPage.jsx'
import ResourceDetailPage from './routes/ResourceDetailPage.jsx'
import SubmitResourcePage from './routes/SubmitResourcePage.jsx'
import LoginPage from './routes/LoginPage.jsx'
import SignupPage from './routes/SignupPage.jsx'
import AdminDashboardPage from './routes/AdminDashboardPage.jsx'
import AdminSubmissionDetailPage from './routes/AdminSubmissionDetailPage.jsx'
import AdminLibraryPage from './routes/AdminLibraryPage.jsx'
import AdminImportPage from './routes/AdminImportPage.jsx'
import AdminPublicationDetailPage from './routes/AdminPublicationDetailPage.jsx'
import MySubmissionsPage from './routes/MySubmissionsPage.jsx'
import SubmissionDetailPage from './routes/SubmissionDetailPage.jsx'
import RevisionSubmitPage from './routes/RevisionSubmitPage.jsx'
import ReviewerDashboardPage from './routes/ReviewerDashboardPage.jsx'
import ReviewFormPage from './routes/ReviewFormPage.jsx'
import ProductionDashboardPage from './routes/ProductionDashboardPage.jsx'
import ProductionDetailPage from './routes/ProductionDetailPage.jsx'
import AuthorGuidelinesPage from './routes/AuthorGuidelinesPage.jsx'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PageLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/author-guidelines" element={<AuthorGuidelinesPage />} />
          <Route path="/resources/:id" element={<ResourceDetailPage />} />
          <Route
            path="/submit"
            element={
              <ProtectedRoute>
                <SubmitResourcePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-submissions"
            element={
              <ProtectedRoute>
                <MySubmissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-submissions/:id"
            element={
              <ProtectedRoute>
                <SubmissionDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-submissions/:id/revise"
            element={
              <ProtectedRoute>
                <RevisionSubmitPage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireRole={['editor', 'admin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/submissions/:id"
            element={
              <ProtectedRoute requireRole={['editor', 'admin']}>
                <AdminSubmissionDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/library"
            element={
              <ProtectedRoute requireRole={['editor', 'admin']}>
                <AdminLibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/library/import"
            element={
              <ProtectedRoute requireRole={['editor', 'admin']}>
                <AdminImportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/library/:id"
            element={
              <ProtectedRoute requireRole={['editor', 'admin']}>
                <AdminPublicationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer"
            element={
              <ProtectedRoute requireRole={['reviewer', 'editor', 'admin']}>
                <ReviewerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer/review/:assignmentId"
            element={
              <ProtectedRoute requireRole={['reviewer', 'editor', 'admin']}>
                <ReviewFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/production"
            element={
              <ProtectedRoute requireRole={['editor', 'admin']}>
                <ProductionDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/production/:id"
            element={
              <ProtectedRoute requireRole={['editor', 'admin']}>
                <ProductionDetailPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
