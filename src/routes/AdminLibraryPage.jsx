import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCategoryBySlug } from '../data/mockData.js'
import {
  publicationStatusLabel,
  publicationStatusBadgeClassName,
  PUBLICATION_STATUS_FILTERS,
} from '../data/publicationStatus.js'
import {
  getAllPublications,
  getPublicationStats,
  publishPublication,
  rejectPublication,
  deleteDraftPublication,
  restoreRejectedPublication,
} from '../services/publicationService.js'

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide ${publicationStatusBadgeClassName(status)}`}
    >
      {publicationStatusLabel(status)}
    </span>
  )
}

function formatDate(isoDate) {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function matchesFilter(publication, filterKey) {
  if (filterKey === 'all') return true
  if (filterKey === 'imported') return publication.sourceType === 'imported'
  if (['draft', 'under_review', 'approved', 'published', 'rejected'].includes(filterKey)) {
    return publication.publicationStatus === filterKey
  }
  return false
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="font-mono text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 font-serif text-3xl font-semibold text-ink">{value}</div>
    </div>
  )
}

function AdminLibraryPage() {
  const [publications, setPublications] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    published: 0,
    rejected: 0,
    imported: 0,
  })
  const [activeFilter, setActiveFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      console.log('[MedPublish DEBUG] AdminLibraryPage loading publications')
      setLoading(true)
      setLoadError(false)
      const [{ data: pubs, error: pubsError }, { data: statsData, error: statsError }] =
        await Promise.all([getAllPublications(), getPublicationStats()])

      if (!isMounted) return

      if (pubsError || statsError) {
        console.error('MedPublish: failed to load admin library data', pubsError ?? statsError)
        setLoadError(true)
      } else {
        console.log('[MedPublish DEBUG] AdminLibraryPage loaded', pubs.length, 'publications')
        setPublications(pubs)
        setStats(statsData)
      }
      setLoading(false)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const visiblePublications = useMemo(
    () => publications.filter((publication) => matchesFilter(publication, activeFilter)),
    [publications, activeFilter],
  )

  const handlePublish = async (publicationId) => {
    console.log('[MedPublish DEBUG] handlePublish called with publication ID:', publicationId)
    const confirmed = window.confirm('Are you sure you want to publish this article? It will become visible in the public Research Library.')
    if (!confirmed) return

    console.log('[MedPublish DEBUG] Calling publishPublication with ID:', publicationId)
    const { error } = await publishPublication(publicationId)
    console.log('[MedPublish DEBUG] publishPublication returned error:', error)
    
    if (error) {
      alert(`Failed to publish: ${error.message}`)
      return
    }

    // Reload the data
    const [{ data: pubs }, { data: statsData }] = await Promise.all([getAllPublications(), getPublicationStats()])
    setPublications(pubs)
    setStats(statsData)
  }

  const handleReject = async (publicationId) => {
    const confirmed = window.confirm('Are you sure you want to reject this article? It will be marked as rejected and will not be published.')
    if (!confirmed) return

    const { error } = await rejectPublication(publicationId)
    if (error) {
      alert(`Failed to reject: ${error.message}`)
      return
    }

    // Reload the data
    const [{ data: pubs }, { data: statsData }] = await Promise.all([getAllPublications(), getPublicationStats()])
    setPublications(pubs)
    setStats(statsData)
  }

  const handleDelete = async (publicationId) => {
    const confirmed = window.confirm('Are you sure you want to delete this draft? This action cannot be undone.')
    if (!confirmed) return

    const { error } = await deleteDraftPublication(publicationId)
    if (error) {
      alert(`Failed to delete: ${error.message}`)
      return
    }

    // Reload the data
    const [{ data: pubs }, { data: statsData }] = await Promise.all([getAllPublications(), getPublicationStats()])
    setPublications(pubs)
    setStats(statsData)
  }

  const handleRestore = async (publicationId) => {
    const confirmed = window.confirm('Are you sure you want to restore this rejected article to draft status? This will allow you to edit and republish it.')
    if (!confirmed) return

    const { error } = await restoreRejectedPublication(publicationId)
    if (error) {
      alert(`Failed to restore: ${error.message}`)
      return
    }

    // Reload the data
    const [{ data: pubs }, { data: statsData }] = await Promise.all([getAllPublications(), getPublicationStats()])
    setPublications(pubs)
    setStats(statsData)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Research Library Management</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Manage imported articles and publications. Review drafts, edit metadata, and publish articles to the public Research Library.
          </p>
        </div>
        <Link
          to="/admin/library/import"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-light"
        >
          Import Article
        </Link>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading publications…</p>
      ) : loadError ? (
        <div className="mt-8 rounded-xl border border-dashed border-red-200 bg-red-50 p-10 text-center">
          <p className="text-red-600">
            We couldn't load the research library right now. Please try again shortly.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total publications" value={stats.total} />
            <StatCard label="Draft" value={stats.draft} />
            <StatCard label="Published" value={stats.published} />
            <StatCard label="Rejected" value={stats.rejected} />
            <StatCard label="Imported" value={stats.imported} />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2">
            {PUBLICATION_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeFilter === filter.key
                    ? 'bg-ink text-white'
                    : 'bg-white text-slate-600 hover:text-teal-700'
                } border border-slate-200`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {visiblePublications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-slate-500">
                  No publications found. {activeFilter !== 'all' ? 'Try a different filter or ' : ''}
                  <Link to="/admin/library/import" className="text-teal-700 hover:text-teal-800">
                    import an article
                  </Link>
                  {' '}to get started.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 font-mono text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Title</th>
                      <th className="px-6 py-3">Authors</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Created</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {visiblePublications.map((publication) => (
                      <tr key={publication.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="max-w-xs truncate font-medium text-ink">
                            {publication.title}
                          </div>
                          {publication.sourceType === 'imported' && (
                            <span className="mt-1 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                              Imported
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-slate-600">
                          {publication.authors}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-600">
                            {getCategoryBySlug(publication.category)?.name || publication.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={publication.publicationStatus} />
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {formatDate(publication.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {publication.publicationStatus === 'draft' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handlePublish(publication.id)}
                                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-800"
                                >
                                  Publish
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReject(publication.id)}
                                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(publication.id)}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            {publication.publicationStatus === 'rejected' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRestore(publication.id)}
                                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                                >
                                  Restore
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(publication.id)}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            <Link
                              to={`/admin/library/${publication.id}`}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default AdminLibraryPage